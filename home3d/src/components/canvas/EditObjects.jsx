import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import useStore from '../../store/useStore.js'
import { referencePoints } from '@/features/edit/registry'
import ObjectsLayer from '@/features/edit/canvas/ObjectsLayer'
import {
  ContextualPlanePreview,
  DraftPreview,
  SnapMarker,
  InferenceLines,
} from '@/features/edit/canvas/previews'
import { ensureBoundsTree } from '@/core/bvh'
import {
  groundFrame,
  faceFrame,
  worldToPlane,
  planeToWorld,
} from '@/core/workPlanes'
import { angleOf, nextSweep } from '@/features/sketch/sketchArc'
import {
  openingPayload,
  OPENING_PRESETS,
  DEFAULT_OPENING_PRESET,
  doorPayload,
  DOOR_PRESETS,
  DEFAULT_DOOR_PRESET,
} from '@/features/openings/opening'
import { elecPayload } from '@/features/mep/elec'
import {
  midpoint,
  closestPointOnSegment,
  closestPointOnLine,
  closestPointBetweenLines,
  axisColorForDir,
  pickBestSnap,
  SNAP_THRESHOLD_PX,
  GRID_STEP_M,
} from '@/core/snapping'
import { worldToScreen, meshRefsNear } from '@/core/snapRefs'
import { isChainVisible } from '@/features/layers/appearance'

// Rendu des objets créés in-app (Edit mode, Slice 0) + outils de tracé sur le
// PLAN D'ESQUISSE CONTEXTUEL (E12-02, façon SketchUp), Push/Pull (E12-08) et
// poignées de déformation (E22-01, cf. DeformHandles + lib/useAxisDrag).
// Vit dans le Canvas. Les objets sont DÉRIVÉS du store via le registre
// paramétrique : changer un param régénère la géométrie.

const INFER_SOURCES = 12 // # de références les plus proches alimentant axes/intersections
// Seuil d'accroche (px) et pas de grille : SNAP_THRESHOLD_PX / GRID_STEP_M,
// partagés avec le drag sur axe (lib/snapping, E22-03).

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


// Surface de captation du tracé (outil Rectangle) : un grand quad de sol qui
// fournit le rayon souris. Le plan d'esquisse est déduit du contexte (sol ou
// face survolée). Pendant le tracé, on reprojette le rayon sur le plan VERROUILLÉ,
// avec accroche (snapping) aux sommets/milieux/arêtes survolés (E12-03).
function SketchSurface({ tool, glbScene, nodes, objects }) {
  const setDraft = useStore((state) => state.setDraft)
  const gridSnap = useStore((state) => state.gridSnap)
  const openingPreset = useStore((state) => state.openingPreset)
  const doorPreset = useStore((state) => state.doorPreset)
  const elecComponent = useStore((state) => state.elecComponent)
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

  // Résout le point (s,t) accroché sur le plan VERROUILLÉ d'un tracé en cours, et
  // le balayage accumulé pour un arc en étape 'sweep'. Mutualisé entre le
  // déplacement (move) et les clics intermédiaires de l'arc (down).
  const resolveOnLockedFrame = (event, d) => {
    const { hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const freeWorld = projectOnFrame(event, d.frame)
    if (!freeWorld) return null
    const ref = d.tool === 'arc' ? (d.stage === 'sweep' ? d.start : d.center) : d.start
    const startWorld = planeToWorld(ref[0], ref[1], d.frame)
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
    const patch = { ...d, current: [s, t], snap }
    if (d.tool === 'arc' && d.stage === 'sweep') {
      patch.sweepRad = nextSweep(d.sweepRad || 0, d.startAngle, angleOf(d.center, [s, t]))
    }
    return patch
  }

  // Run routé (câble E15-03, tuyau E16-01) : chaque sommet est résolu sur le plan
  // CONTEXTUEL frais (le run peut passer d'une face à l'autre, contrairement au plan
  // verrouillé d'un rectangle) avec accroche ; le dernier sommet posé sert de
  // référence d'inférence.
  const resolveRunPoint = (event) => {
    const { frame, hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const contextWorld = projectOnFrame(event, frame) ?? [
      event.point.x,
      event.point.y,
      event.point.z,
    ]
    const d = useStore.getState().draft
    const last = d?.points?.length ? d.points[d.points.length - 1] : null
    const snap = computeSnap({
      hit,
      objects,
      frame,
      drawing: !!d,
      freeWorld: contextWorld,
      startWorld: last,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    return { world: snap?.point ?? contextWorld, frame, snap }
  }

  const onPointerMove = (event) => {
    // E21-02 : Ctrl enfoncé = navigation caméra — on gèle le tracé/survol (masquer
    // l'aperçu évite un marqueur fantôme qui flotterait pendant l'orbite).
    if (event.ctrlKey) {
      setHover(null)
      return
    }
    // Run routé (câble/tuyau) : polyligne multi-clics ; suit le curseur sur le plan
    // contextuel, avec aperçu du tronçon en cours dès qu'un premier sommet est posé.
    if (tool === 'cable' || tool === 'pipe') {
      const { world, frame, snap } = resolveRunPoint(event)
      const d = useStore.getState().draft
      if (d) setDraft({ ...d, current: world, frame, snap })
      else setHover({ point: world, u: frame.u, v: frame.v, normal: frame.normal, snap })
      return
    }
    // Arc (multi-clics) : tant qu'un draft existe, suivre le curseur sans bouton
    // pressé (pas de drag) ; sinon retomber sur le survol comme les autres outils.
    if (tool === 'arc') {
      const d = useStore.getState().draft
      if (d) {
        const patch = resolveOnLockedFrame(event, d)
        if (patch) setDraft(patch)
        return
      }
    } else if (drawing.current) {
      const d = useStore.getState().draft
      if (!d) return
      const patch = resolveOnLockedFrame(event, d)
      if (patch) setDraft(patch)
      return
    }
    // Survol : accroche aux POINTS (sommets/milieux/centres) ; aperçu du plan
    // contextuel centré sur l'accroche le cas échéant.
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
    const point = snap?.point ?? (frame.type === 'face' ? frame.origin : contextWorld)
    setHover({ point, u: frame.u, v: frame.v, normal: frame.normal, snap })
  }

  const onPointerDown = (event) => {
    if (event.ctrlKey) return // E21-02 : Ctrl+clic = navigation pure, pas de tracé
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

    // Ouverture (E14-01) : pose au CLIC sur une FACE de mur (pas sur le sol). Le
    // point cliqué devient le centre ; l'objet référence le mur par `frame.faceOf`.
    if (tool === 'opening') {
      if (frame.type !== 'face') return // ignore un clic sur le sol
      const dims = OPENING_PRESETS[openingPreset] ?? OPENING_PRESETS[DEFAULT_OPENING_PRESET]
      useStore.getState().createObject(openingPayload(world, frame, dims))
      setHover(null)
      return
    }

    // Porte (E14-07) : même mécanique que l'ouverture fenêtre, mais le seuil
    // est posé AU SOL par doorPayload (pas d'allège).
    if (tool === 'door') {
      if (frame.type !== 'face') return // ignore un clic sur le sol
      const dims = DOOR_PRESETS[doorPreset] ?? DOOR_PRESETS[DEFAULT_DOOR_PRESET]
      useStore.getState().createObject(doorPayload(world, frame, dims))
      setHover(null)
      return
    }

    // Composant élec (E15-01/02) : pose au CLIC sur une FACE de mur, même
    // mécanique que l'ouverture. Le composant sélectionné vient du store.
    if (tool === 'elec') {
      if (frame.type !== 'face') return // ignore un clic sur le sol
      useStore.getState().createObject(elecPayload(world, frame, elecComponent))
      setHover(null)
      return
    }

    // Run routé (câble E15-03, tuyau E16-01) : polyligne multi-clics. 1er clic =
    // 1er sommet ; chaque clic ajoute un sommet ; double-clic ou Entrée termine
    // (cf. onDoubleClick / commitDraft). Sommets en MONDE (plan contextuel frais).
    if (tool === 'cable' || tool === 'pipe') {
      const { world, frame, snap } = resolveRunPoint(event)
      const d = useStore.getState().draft
      if (!d) {
        setHover(null)
        useStore.getState().setVcbText('')
        setDraft({ tool, frame, points: [world], current: world, snap })
      } else {
        setDraft({ ...d, points: [...d.points, world], current: world, frame, snap })
      }
      return
    }

    // Arc : tracé en 3 CLICS (pas de glissé). 1er clic = centre ; clics suivants
    // = verrouille rayon (étape 'radius'→'sweep') puis fixe le balayage (commit).
    if (tool === 'arc') {
      const d = useStore.getState().draft
      if (!d) {
        setHover(null)
        useStore.getState().setVcbText('')
        setDraft({ tool: 'arc', stage: 'radius', frame, center: [s, t], current: [s, t], snap })
        return
      }
      const patch = resolveOnLockedFrame(event, d)
      if (patch) setDraft(patch)
      useStore.getState().commitDraft()
      return
    }

    drawing.current = true
    setHover(null) // masque l'aperçu de survol pendant le tracé
    useStore.getState().setVcbText('') // nouvelle saisie VCB pour ce tracé
    // `tool` distingue rectangle (2 coins) et cercle (centre + rayon) au commit.
    setDraft({ start: [s, t], current: [s, t], frame, snap, tool })
    event.target.setPointerCapture?.(event.pointerId)
  }

  // Relâché : committe le tracé via le store (gère cote VCB éventuelle + garde
  // clic accidentel). L'arc commit au clic (pas au relâché) → ignoré ici.
  const onPointerUp = () => {
    if (tool === 'arc' || tool === 'cable' || tool === 'pipe' || !drawing.current) return
    drawing.current = false
    if (useStore.getState().draft) useStore.getState().commitDraft()
  }

  // Run routé : double-clic = fin du routage (les deux clics ajoutent un sommet
  // chacun, le doublon final est fusionné par la déduplication de commitRun).
  const onDoubleClick = (event) => {
    if (event.ctrlKey) return // E21-02 : verrou d'action sous Ctrl
    if (tool !== 'cable' && tool !== 'pipe') return
    event.stopPropagation()
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
        onDoubleClick={onDoubleClick}
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
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)
  const extrude = useStore((state) => state.extrude)
  const glb = useStore((state) => state.glb)
  const nodes = useStore((state) => state.nodes)

  // Outils qui rendent la surface d'esquisse : tracés (rect/circle/arc) + pose
  // d'ouverture (E14-01, clic sur une face de mur).
  const drawing =
    editMode &&
    (activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'arc' ||
      activeTool === 'opening' ||
      activeTool === 'door' ||
      activeTool === 'elec' ||
      activeTool === 'cable' ||
      activeTool === 'pipe')

  // E12-03 : indexer le modèle importé (BVH three-mesh-bvh) à l'entrée d'Edit mode
  // — accélère le raycast du tracé ET les requêtes de proximité du snapping. Coût
  // one-time, payé seulement quand on édite (pas pour un simple viewer).
  useEffect(() => {
    if (editMode && glb?.scene) ensureBoundsTree(glb.scene)
  }, [editMode, glb])

  return (
    <>
      <ObjectsLayer />
      {drawing && (
        <SketchSurface
          tool={activeTool}
          glbScene={glb?.scene}
          nodes={nodes}
          objects={objects}
        />
      )}
      {draft && <DraftPreview draft={draft} />}
      {draft?.snap && <SnapMarker snap={draft.snap} />}
      {draft?.snap?.lines && <InferenceLines snap={draft.snap} />}
      {/* Accroche d'un drag sur axe (poignée / Push/Pull, E22-03). */}
      {extrude?.snap && <SnapMarker snap={extrude.snap} />}
    </>
  )
}
