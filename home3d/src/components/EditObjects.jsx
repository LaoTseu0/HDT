import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import useStore from '../store/useStore.js'
import { generateObject, disposeObject, referencePoints } from '../lib/editRegistry.js'
import { ensureBoundsTree, meshReferencesNear } from '../lib/bvh.js'
import {
  groundFrame,
  faceFrame,
  worldToPlane,
  planeToWorld,
  extrudeHeightFromRay,
} from '../lib/workPlanes.js'
import {
  midpoint,
  closestPointOnSegment,
  closestPointOnLine,
  closestPointBetweenLines,
  axisColorForDir,
  pickBestSnap,
  SNAP_COLORS,
} from '../lib/snapping.js'
import { isChainVisible } from '../lib/appearance.js'

// Rendu des objets créés in-app (Edit mode, Slice 0) + outils de tracé sur le
// PLAN D'ESQUISSE CONTEXTUEL (E12-02, façon SketchUp) et Push/Pull (E12-08).
// Vit dans le Canvas. Les objets sont DÉRIVÉS du store via le registre
// paramétrique : changer un param régénère la géométrie.

const DRAFT_FILL = '#8fc7ff'
const DRAFT_EDGE = '#cfe4f8'
const PLANE_FILL = '#378add'
const PLANE_EDGE = '#5a9fd6'
const PREVIEW_SIZE = 1.6 // m — emprise de l'aperçu du plan au survol
const PREVIEW_DIV = 4 // subdivisions de la grille d'aperçu
const SNAP_THRESHOLD_PX = 14 // rayon d'accroche à l'écran (E12-03)
const SNAP_QUERY_MARGIN = 1.6 // sur-collecte BVH vs seuil px (le gate exact reste pickBestSnap)
const INFER_SOURCES = 12 // # de références les plus proches alimentant axes/intersections
const INFER_LINE_LEN = 60 // m — demi-longueur d'une ligne d'inférence dessinée
const GRID_STEP_M = 0.1 // pas de la grille d'accroche (E12-03)

// Grille (segments dans le plan XY local centré) — en LIGNES, pour ne pas
// teinter le modèle derrière.
function makeGridGeometry(size, divisions) {
  const half = size / 2
  const step = size / divisions
  const pts = []
  for (let i = 0; i <= divisions; i++) {
    const c = -half + i * step
    pts.push(c, -half, 0, c, half, 0)
    pts.push(-half, c, 0, half, c, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
}

// Quaternion d'un repère { u, v, normal } : u→X local, v→Y local, normal→Z local.
function frameQuaternion(u, v, normal) {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...u),
    new THREE.Vector3(...v),
    new THREE.Vector3(...normal)
  )
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

function liftedAlongNormal(world, normal, eps) {
  return [
    world[0] + normal[0] * eps,
    world[1] + normal[1] * eps,
    world[2] + normal[2] * eps,
  ]
}

const rayArrays = (ray) => [
  [ray.origin.x, ray.origin.y, ray.origin.z],
  [ray.direction.x, ray.direction.y, ray.direction.z],
]

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const addScaled3 = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]

// Face cliquée d'une forme → axe du repère (u/v/normal) le plus aligné avec sa
// normale monde, et de quel côté (signe). Détermine quelle cote le Push/Pull
// modifie (largeur/profondeur/hauteur) et l'ancrage de la face opposée (E12-08).
function pickPushAxis(obj, event) {
  const u = obj.plane?.u ?? [1, 0, 0]
  const v = obj.plane?.v ?? [0, 0, -1]
  const n = obj.plane?.normal ?? [0, 1, 0]
  // Face touchée : `event.face` direct, sinon 1re intersection portant une face
  // (robuste si une géométrie sans face traîne devant). Défaut = axe normal.
  let fn = n
  const faceHit = event.face ? event : event.intersections?.find((i) => i.face)
  if (faceHit?.face && faceHit.object) {
    const wn = faceHit.face.normal
      .clone()
      .transformDirection(faceHit.object.matrixWorld)
      .normalize()
    fn = [wn.x, wn.y, wn.z]
  }
  const axes = [
    { vec: u, key: 'largeur_m', anchored: false },
    { vec: v, key: 'profondeur_m', anchored: false },
    { vec: n, key: 'hauteur_m', anchored: true },
  ]
  let best = axes[2]
  let bestDot = 0
  for (const a of axes) {
    const d = dot3(fn, a.vec)
    if (Math.abs(d) > Math.abs(bestDot)) {
      bestDot = d
      best = a
    }
  }
  const sign = bestDot >= 0 ? 1 : -1
  return { ...best, sign, outward: best.vec.map((c) => c * sign) }
}

// Plan d'esquisse contextuel + intersection modèle à partir d'un évènement reçu
// sur le quad de sol : SOL par défaut, ou la FACE d'un mesh si le rayon en touche
// une plus près. Le `hit` retourné alimente le snapping (E12-03).
function probeSketch(event, glbScene, rc, nodes) {
  if (glbScene) {
    rc.set(event.ray.origin, event.ray.direction)
    const hits = rc
      .intersectObject(glbScene, true)
      .filter((h) => h.face && isChainVisible(h.object))
    if (hits.length && hits[0].distance < event.distance - 1e-4) {
      const h = hits[0]
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize()
      // Remonter au node porteur des extras (liaison faceOf, utile en Slice 1).
      let o = h.object
      while (o && !(o.name && nodes?.[o.name])) o = o.parent
      const faceOf = o?.name || h.object.name || undefined
      return {
        frame: faceFrame([h.point.x, h.point.y, h.point.z], [n.x, n.y, n.z], faceOf),
        hit: h,
      }
    }
  }
  return { frame: groundFrame(), hit: null }
}

// Position écran (pixels, repère canvas) d'un point monde. Vecteur réutilisé : le
// snapping projette des dizaines de candidats par déplacement souris.
const _projV = new THREE.Vector3()
function worldToScreen(point, camera, rect) {
  _projV.set(point[0], point[1], point[2]).project(camera)
  return {
    x: (_projV.x * 0.5 + 0.5) * rect.width,
    y: (-_projV.y * 0.5 + 0.5) * rect.height,
  }
}

// Rayon MONDE correspondant à `pixels` à l'écran, à la profondeur d'un point — pour
// dimensionner la requête de proximité BVH d'après le seuil d'accroche en pixels
// (constant à l'écran, façon SketchUp, quel que soit le zoom).
const _radV = new THREE.Vector3()
function worldRadiusForPixels(point, pixels, camera, rect) {
  if (camera.isOrthographicCamera) {
    const worldPerPx = (camera.top - camera.bottom) / camera.zoom / rect.height
    return pixels * worldPerPx
  }
  const dist = camera.position.distanceTo(_radV.set(point[0], point[1], point[2]))
  const worldHeight = 2 * dist * Math.tan((camera.fov * Math.PI) / 360)
  return pixels * (worldHeight / rect.height)
}

// Sommets monde du triangle touché.
function triangleWorldVerts(hit) {
  const pos = hit.object.geometry.attributes.position
  const m = hit.object.matrixWorld
  const v = new THREE.Vector3()
  return [hit.face.a, hit.face.b, hit.face.c].map((i) => {
    v.fromBufferAttribute(pos, i).applyMatrix4(m)
    return [v.x, v.y, v.z]
  })
}

// Projection orthogonale d'un point sur le plan d'esquisse actif. Le tracé vit sur
// CE plan : on y ramène toute accroche (sinon le marqueur 3D et le coin du
// rectangle, reprojeté par worldToPlane, divergeraient). Une référence hors plan
// donne ainsi un point ALIGNÉ sur le plan (sa « colonne »), pas une accroche hors-sol.
function projectToPlane(p, frame) {
  const o = frame.origin
  const n = frame.normal
  const d = (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2]
  return [p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d]
}

// Les `k` candidats dont la projection écran est la plus proche du curseur (borne
// le coût et le bruit des axes/intersections : O(k²) intersections au lieu de O(n²)).
function nearestByScreen(points, cursor, camera, rect, k) {
  const scored = points.map((p) => {
    const s = worldToScreen(p.point, camera, rect)
    return { ...p, sx: s.x, sy: s.y, d: Math.hypot(s.x - cursor.x, s.y - cursor.y) }
  })
  scored.sort((a, b) => a.d - b.d)
  return scored.slice(0, k)
}

// Références d'accroche du MESH importé près du curseur. Requête de proximité
// `three-mesh-bvh` (E12-03) : sommets + arêtes des triangles à portée d'écran,
// PAS seulement le triangle directement survolé. Repli sur le triangle survolé si
// le mesh n'a pas de boundsTree. Renvoie sommets et arêtes en MONDE (non projetés).
function meshRefsNear(hit, freeWorld, camera, rect) {
  const radius = worldRadiusForPixels(
    freeWorld,
    SNAP_THRESHOLD_PX * SNAP_QUERY_MARGIN,
    camera,
    rect
  )
  const refs = meshReferencesNear(hit.object, freeWorld, radius)
  if (refs) return refs
  // Fallback : le seul triangle survolé (comportement E12-03 inc.1).
  const [a, b, c] = triangleWorldVerts(hit)
  return {
    verts: [a, b, c],
    edges: [
      [a, b],
      [b, c],
      [c, a],
    ],
  }
}

/**
 * Meilleure accroche dans le seuil px. Candidats :
 *  - POINTS précis : sommets + milieux d'arête du mesh importé proche du curseur
 *    (requête BVH, E12-03), références des objets app, le tout ramené sur le plan
 *    actif ;
 *  - en cours de tracé seulement : ARÊTES (mesh proche), AXES (u/v du plan passant
 *    par une référence) et INTERSECTIONS de ces axes — les inférences linéaires ;
 *  - GRILLE du plan (si activée) — accroche de dernier recours.
 * @returns {{type, point, color?, lines?}|null}
 */
function computeSnap({
  hit,
  objects,
  frame,
  drawing,
  freeWorld,
  startWorld,
  cursor,
  camera,
  rect,
  gridSnap,
}) {
  const proj = (p) => projectToPlane(p, frame)

  // 1) Points précis (projetés sur le plan actif).
  const points = []
  let meshEdges = null // arêtes du mesh (projetées) — pour les candidats `edge`
  if (hit) {
    const refs = meshRefsNear(hit, freeWorld, camera, rect)
    for (const v of refs.verts) points.push({ type: 'endpoint', point: proj(v) })
    meshEdges = refs.edges.map(([a, b]) => [proj(a), proj(b)])
    for (const [pa, pb] of meshEdges)
      points.push({ type: 'midpoint', point: midpoint(pa, pb) })
  }
  for (const o of Object.values(objects)) {
    for (const rp of referencePoints(o))
      points.push({ type: rp.type, point: proj(rp.point) })
  }
  // Le point de départ du tracé est lui aussi une référence d'inférence.
  if (drawing && startWorld) points.push({ type: 'endpoint', point: proj(startWorld) })

  const candidates = [...points]

  if (drawing) {
    // 1b) Arêtes du mesh proche (point le plus proche du curseur libre).
    if (meshEdges) {
      for (const [a, b] of meshEdges)
        candidates.push({ type: 'edge', point: closestPointOnSegment(freeWorld, a, b) })
    }
    // 2) Axes + intersections, dans le plan, autour des références les plus proches.
    const near = nearestByScreen(points, cursor, camera, rect, INFER_SOURCES)
    const uColor = axisColorForDir(frame.u)
    const vColor = axisColorForDir(frame.v)
    const uLines = []
    const vLines = []
    for (const p of near) {
      const lu = { origin: p.point, dir: frame.u, color: uColor }
      const lv = { origin: p.point, dir: frame.v, color: vColor }
      uLines.push(lu)
      vLines.push(lv)
      candidates.push(
        {
          type: 'axis',
          point: closestPointOnLine(freeWorld, lu.origin, lu.dir),
          color: uColor,
          lines: [lu],
        },
        {
          type: 'axis',
          point: closestPointOnLine(freeWorld, lv.origin, lv.dir),
          color: vColor,
          lines: [lv],
        }
      )
    }
    for (const lu of uLines) {
      for (const lv of vLines) {
        const x = closestPointBetweenLines(lu.origin, lu.dir, lv.origin, lv.dir)
        if (x) candidates.push({ type: 'intersection', point: x, lines: [lu, lv] })
      }
    }
  }

  // 3) Grille du plan (E12-03) : intersection de grille la plus proche, en (s,t).
  // Priorité minimale → n'emporte qu'à défaut de toute autre référence proche.
  if (gridSnap) {
    const [s, t] = worldToPlane(freeWorld, frame)
    const gs = Math.round(s / GRID_STEP_M) * GRID_STEP_M
    const gt = Math.round(t / GRID_STEP_M) * GRID_STEP_M
    candidates.push({ type: 'grid', point: planeToWorld(gs, gt, frame) })
  }

  for (const cand of candidates) {
    if (cand.sx === undefined) {
      const s = worldToScreen(cand.point, camera, rect)
      cand.sx = s.x
      cand.sy = s.y
    }
  }
  return pickBestSnap(candidates, cursor, SNAP_THRESHOLD_PX)
}

// Un objet app : (re)généré dès que `obj` (ou l'aperçu Push/Pull) change. `preview`
// = patch éphémère { paramKey, value, origin } d'un Push/Pull en cours.
function EditObject({
  obj,
  preview,
  selected,
  selectable,
  pushable,
  onSelect,
  onStartPush,
}) {
  const effective = useMemo(
    () =>
      preview
        ? {
            ...obj,
            params: { ...obj.params, [preview.paramKey]: preview.value },
            plane: { ...obj.plane, origin: preview.origin },
          }
        : obj,
    [obj, preview]
  )
  const object3d = useMemo(() => generateObject(effective), [effective])
  // Opacité de base posée par le générateur (0.5 solide / 0.35 plat).
  const baseOpacity =
    Math.abs(Number(effective.params.hauteur_m) || 0) >= 0.001 ? 0.5 : 0.35

  useEffect(() => () => object3d && disposeObject(object3d), [object3d])

  useEffect(() => {
    if (!object3d) return
    const fill = object3d.getObjectByName('__fill')
    if (fill) {
      fill.material.opacity = selected ? 0.65 : baseOpacity
      fill.material.emissive = new THREE.Color(selected ? 0x16344f : 0x000000)
    }
  }, [object3d, selected, baseOpacity])

  if (!object3d) return null
  const interactive = selectable || pushable
  return (
    <primitive
      object={object3d}
      onClick={
        selectable
          ? (event) => {
              event.stopPropagation()
              onSelect(obj.id)
            }
          : undefined
      }
      onPointerDown={
        pushable
          ? (event) => {
              event.stopPropagation()
              onStartPush(obj.id, event)
            }
          : undefined
      }
      // sans handler, pas de raycast inutile en mode tracé.
      raycast={interactive ? undefined : () => null}
    />
  )
}

// Aperçu discret du plan d'esquisse actif au survol (feedback visuel E12-02) :
// petite grille + segment de normale, posés au point survolé.
function ContextualPlanePreview({ hover }) {
  const quat = useMemo(() => frameQuaternion(hover.u, hover.v, hover.normal), [hover])
  const grid = useMemo(() => makeGridGeometry(PREVIEW_SIZE, PREVIEW_DIV), [])
  const normalGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0.5], 3))
    return g
  }, [])
  useEffect(
    () => () => {
      grid.dispose()
      normalGeo.dispose()
    },
    [grid, normalGeo]
  )

  return (
    <group position={hover.point} quaternion={quat}>
      <lineSegments geometry={grid} raycast={() => null} renderOrder={2}>
        <lineBasicMaterial
          color={PLANE_FILL}
          transparent
          opacity={0.5}
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>
      <line geometry={normalGeo} raycast={() => null} renderOrder={3}>
        <lineBasicMaterial
          color={PLANE_EDGE}
          transparent
          opacity={0.9}
          depthTest={false}
          depthWrite={false}
        />
      </line>
    </group>
  )
}

// Aperçu du rectangle en cours de tracé (coordonnées (s,t) du plan verrouillé).
function DraftPreview({ draft }) {
  const { frame } = draft
  const w = Math.max(Math.abs(draft.current[0] - draft.start[0]), 0.001)
  const d = Math.max(Math.abs(draft.current[1] - draft.start[1]), 0.001)
  const sc = (draft.start[0] + draft.current[0]) / 2
  const tc = (draft.start[1] + draft.current[1]) / 2
  const center = liftedAlongNormal(planeToWorld(sc, tc, frame), frame.normal, 0.004)
  const quat = useMemo(() => frameQuaternion(frame.u, frame.v, frame.normal), [frame])

  const geo = useMemo(() => new THREE.PlaneGeometry(w, d), [w, d])
  useEffect(() => () => geo.dispose(), [geo])

  return (
    <group position={center} quaternion={quat}>
      <mesh geometry={geo}>
        <meshBasicMaterial
          color={DRAFT_FILL}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color={DRAFT_EDGE} />
      </lineSegments>
    </group>
  )
}

// Marqueur d'accroche (E12-03) : petit losange coloré au point de snap, dessiné
// par-dessus (depthTest off) pour rester visible. Les accroches `axis` portent leur
// propre couleur d'axe (`snap.color`) ; les autres suivent SNAP_COLORS[type].
function SnapMarker({ snap }) {
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.06), [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh position={snap.point} geometry={geo} raycast={() => null} renderOrder={4}>
      <meshBasicMaterial
        color={snap.color ?? SNAP_COLORS[snap.type] ?? '#ffffff'}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

// Lignes d'inférence (E12-03) : longues droites colorées passant par le point de
// snap le long de leur direction d'axe (1 pour une accroche `axis`, 2 pour une
// `intersection`), dessinées par-dessus comme les axes de SketchUp.
function InferenceLines({ snap }) {
  const { geos, lines } = useMemo(() => {
    const ls = snap.lines ?? []
    const p = snap.point
    const gs = ls.map((l) => {
      const d = l.dir
      const g = new THREE.BufferGeometry()
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [
            p[0] - d[0] * INFER_LINE_LEN,
            p[1] - d[1] * INFER_LINE_LEN,
            p[2] - d[2] * INFER_LINE_LEN,
            p[0] + d[0] * INFER_LINE_LEN,
            p[1] + d[1] * INFER_LINE_LEN,
            p[2] + d[2] * INFER_LINE_LEN,
          ],
          3
        )
      )
      return g
    })
    return { geos: gs, lines: ls }
  }, [snap])
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])

  return (
    <>
      {geos.map((g, i) => (
        <line key={i} geometry={g} raycast={() => null} renderOrder={3}>
          <lineBasicMaterial
            color={lines[i].color}
            transparent
            opacity={0.85}
            depthTest={false}
            depthWrite={false}
          />
        </line>
      ))}
    </>
  )
}

// Surface de captation du tracé (outil Rectangle) : un grand quad de sol qui
// fournit le rayon souris. Le plan d'esquisse est déduit du contexte (sol ou
// face survolée). Pendant le tracé, on reprojette le rayon sur le plan VERROUILLÉ,
// avec accroche (snapping) aux sommets/milieux/arêtes survolés (E12-03).
function SketchSurface({ glbScene, nodes, objects }) {
  const setDraft = useStore((state) => state.setDraft)
  const gridSnap = useStore((state) => state.gridSnap)
  const [hover, setHover] = useState(null)
  const drawing = useRef(false)
  const rc = useMemo(() => new THREE.Raycaster(), [])
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  // Point monde du rayon de l'évènement projeté sur un plan verrouillé.
  const projectOnFrame = (event, frame) => {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(...frame.normal),
      new THREE.Vector3(...frame.origin)
    )
    const pt = new THREE.Vector3()
    return event.ray.intersectPlane(plane, pt) ? [pt.x, pt.y, pt.z] : null
  }

  const cursorOf = (event) => {
    const rect = gl.domElement.getBoundingClientRect()
    return { rect, cursor: { x: event.clientX - rect.left, y: event.clientY - rect.top } }
  }

  const onPointerMove = (event) => {
    const { frame, hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    if (drawing.current) {
      const d = useStore.getState().draft
      if (!d) return
      // Plan VERROUILLÉ : point libre du rayon + accroche (axes/intersections actifs).
      const freeWorld = projectOnFrame(event, d.frame)
      if (!freeWorld) return
      const startWorld = planeToWorld(d.start[0], d.start[1], d.frame)
      const snap = computeSnap({
        hit,
        objects,
        frame: d.frame,
        drawing: true,
        freeWorld,
        startWorld,
        cursor,
        camera,
        rect,
        gridSnap,
      })
      const world = snap ? snap.point : freeWorld
      const [s, t] = worldToPlane(world, d.frame)
      setDraft({ ...d, current: [s, t], snap })
      return
    }
    // Survol : accroche aux POINTS (sommets/milieux/centres) ; aperçu du plan
    // contextuel centré sur l'accroche le cas échéant.
    const contextWorld = projectOnFrame(event, frame) ?? [
      event.point.x,
      event.point.y,
      event.point.z,
    ]
    const snap = computeSnap({
      hit,
      objects,
      frame,
      drawing: false,
      freeWorld: contextWorld,
      startWorld: null,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    const point = snap?.point ?? (frame.type === 'face' ? frame.origin : contextWorld)
    setHover({ point, u: frame.u, v: frame.v, normal: frame.normal, snap })
  }

  const onPointerDown = (event) => {
    event.stopPropagation()
    const { frame, hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const contextWorld = projectOnFrame(event, frame) ?? [
      event.point.x,
      event.point.y,
      event.point.z,
    ]
    const snap = computeSnap({
      hit,
      objects,
      frame,
      drawing: false,
      freeWorld: contextWorld,
      startWorld: null,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    const world = snap?.point ?? contextWorld
    const [s, t] = worldToPlane(world, frame)
    drawing.current = true
    setHover(null) // masque l'aperçu de survol pendant le tracé
    useStore.getState().setVcbText('') // nouvelle saisie VCB pour ce tracé
    setDraft({ start: [s, t], current: [s, t], frame, snap })
    event.target.setPointerCapture?.(event.pointerId)
  }

  // Relâché : committe le tracé via le store (gère cote VCB éventuelle + garde
  // clic accidentel). Si la VCB a déjà committé (Entrée), draft est null → no-op.
  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    if (useStore.getState().draft) useStore.getState().commitDraft()
  }

  return (
    <>
      {hover && <ContextualPlanePreview hover={hover} />}
      {hover?.snap && <SnapMarker snap={hover.snap} />}
      {hover?.snap?.lines && <InferenceLines snap={hover.snap} />}
      <mesh
        rotation-x={-Math.PI / 2}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        <planeGeometry args={[800, 800]} />
        {/* invisible mais raycastable (un mesh visible=false n'est pas testé) */}
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}

export default function EditObjects() {
  const objects = useStore((state) => state.objects)
  const selectedNode = useStore((state) => state.selectedNode)
  const selectNode = useStore((state) => state.selectNode)
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)
  const extrude = useStore((state) => state.extrude)
  const glb = useStore((state) => state.glb)
  const nodes = useStore((state) => state.nodes)
  const setExtrude = useStore((state) => state.setExtrude)
  const updateObjectParams = useStore((state) => state.updateObjectParams)

  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)

  const selectable = editMode && activeTool === 'select'
  const drawing = editMode && activeTool === 'rect'
  const pushable = editMode && activeTool === 'pushpull'

  // E12-03 : indexer le modèle importé (BVH three-mesh-bvh) à l'entrée d'Edit mode
  // — accélère le raycast du tracé ET les requêtes de proximité du snapping. Coût
  // one-time, payé seulement quand on édite (pas pour un simple viewer).
  useEffect(() => {
    if (editMode && glb?.scene) ensureBoundsTree(glb.scene)
  }, [editMode, glb])

  // ── Push/Pull (E12-08) : extruder/redimensionner par la face cliquée ─────────
  // Marche sur TOUTE face d'une forme : la face détermine la cote modifiée
  // (largeur/profondeur/hauteur) ; la face opposée reste fixe (décalage d'origine).
  // `pushRef` = données du drag ; `pushing` (re)branche les écouteurs fenêtre
  // (le pointeur sort de la forme pendant le tirage).
  const pushRef = useRef(null)
  const [pushing, setPushing] = useState(false)

  const rayFromClient = useCallback(
    (cx, cy) => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray
    },
    [gl, camera, raycaster]
  )

  const onStartPush = useCallback(
    (objId, event) => {
      const obj = useStore.getState().objects[objId]
      if (!obj) return
      const axis = pickPushAxis(obj, event)
      const center = obj.plane?.origin ?? [0, 0, 0]
      const baseParam = Number(obj.params[axis.key]) || 0
      const [ro, rd] = rayArrays(event.ray)
      pushRef.current = {
        id: objId,
        paramKey: axis.key,
        anchored: axis.anchored,
        axisVec: axis.vec,
        sign: axis.sign,
        outward: axis.outward,
        baseParam,
        baseOrigin: center,
        h0: extrudeHeightFromRay(center, axis.outward, ro, rd),
      }
      setExtrude({ id: objId, paramKey: axis.key, value: baseParam, origin: center })
      gl.domElement.setPointerCapture?.(event.pointerId)
      setPushing(true)
    },
    [gl, setExtrude]
  )

  useEffect(() => {
    if (!pushing) return
    const onMove = (e) => {
      const p = pushRef.current
      if (!p) return
      const [ro, rd] = rayArrays(rayFromClient(e.clientX, e.clientY))
      const disp = extrudeHeightFromRay(p.baseOrigin, p.outward, ro, rd) - p.h0
      const value = Math.max(p.baseParam + disp, 0.01)
      const delta = value - p.baseParam
      // Garder la face OPPOSÉE fixe : axe centré (u/v) → demi-décalage ; axe normal
      // ancré à la base (sol/plan) → décalage seulement si on pousse la face « base ».
      const shift = p.anchored ? ((p.sign - 1) / 2) * delta : (p.sign * delta) / 2
      const origin = addScaled3(p.baseOrigin, p.axisVec, shift)
      setExtrude({
        id: p.id,
        paramKey: p.paramKey,
        value: Number(value.toFixed(3)),
        origin: origin.map((c) => Number(c.toFixed(4))),
      })
    }
    const onUp = () => {
      const p = pushRef.current
      pushRef.current = null
      const ex = useStore.getState().extrude
      setExtrude(null)
      if (p && ex && Math.abs(ex.value - p.baseParam) >= 0.01) {
        updateObjectParams(p.id, { [p.paramKey]: ex.value }, { origin: ex.origin })
      }
      setPushing(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [pushing, rayFromClient, setExtrude, updateObjectParams])

  return (
    <>
      {Object.values(objects).map((obj) => (
        <EditObject
          key={obj.id}
          obj={obj}
          preview={extrude?.id === obj.id ? extrude : undefined}
          selected={obj.id === selectedNode}
          selectable={selectable}
          pushable={pushable}
          onSelect={selectNode}
          onStartPush={onStartPush}
        />
      ))}
      {drawing && <SketchSurface glbScene={glb?.scene} nodes={nodes} objects={objects} />}
      {draft && <DraftPreview draft={draft} />}
      {draft?.snap && <SnapMarker snap={draft.snap} />}
      {draft?.snap?.lines && <InferenceLines snap={draft.snap} />}
    </>
  )
}
