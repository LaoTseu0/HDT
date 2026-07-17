import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { planeToWorld } from '@/core/workPlanes'
import { SNAP_COLORS } from '@/core/snapping'
import type {
  Vec3,
  Snap,
  Draft,
  RectDraft,
  CircleDraft,
  ArcDraft,
  RunDraft,
} from '@/types'

// Aperçus éphémères du tracé (étape C1 du découpage d'EditObjects, typé en F3) :
// plan contextuel au survol, aperçu du draft en cours (rect/cercle/arc/run), marqueur
// d'accroche et lignes d'inférence. Purement visuels, rendus dans le Canvas.
// Partagés entre SketchSurface (survol + draft) et EditObjects (draft + snap de
// drag). Aucune logique métier : géométrie dérivée des props.

const DRAFT_FILL = '#8fc7ff'
const DRAFT_EDGE = '#cfe4f8'
const PLANE_FILL = '#378add'
const PLANE_EDGE = '#5a9fd6'
const PREVIEW_SIZE = 1.6 // m — emprise de l'aperçu du plan au survol
const PREVIEW_DIV = 4 // subdivisions de la grille d'aperçu
const INFER_LINE_LEN = 60 // m — demi-longueur d'une ligne d'inférence dessinée

// `<line>` (THREE.Line) entre en collision avec le `<line>` SVG de @types/react :
// en .tsx, TS résout l'intrinsic vers SVG et rejette la prop `geometry`. On l'aliase
// en composant typé (les props R3F utilisées ici) — au runtime, React rend
// l'intrinsic 'line' à l'identique (React.createElement('line', …) → THREE.Line via
// le réconciliateur R3F).
interface LineProps {
  geometry: THREE.BufferGeometry
  raycast?: () => null
  renderOrder?: number
  children?: React.ReactNode
}
const Line = 'line' as unknown as React.FC<LineProps>

/** Survol : plan contextuel + éventuelle accroche (le repère u/v/normal + le point). */
export interface HoverPreview {
  point: Vec3
  u: Vec3
  v: Vec3
  normal: Vec3
  snap?: Snap | null
}

// Grille (segments dans le plan XY local centré) — en LIGNES, pour ne pas
// teinter le modèle derrière.
function makeGridGeometry(size: number, divisions: number): THREE.BufferGeometry {
  const half = size / 2
  const step = size / divisions
  const pts: number[] = []
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
function frameQuaternion(u: Vec3, v: Vec3, normal: Vec3): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...u),
    new THREE.Vector3(...v),
    new THREE.Vector3(...normal)
  )
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

function liftedAlongNormal(world: Vec3, normal: Vec3, eps: number): Vec3 {
  return [world[0] + normal[0] * eps, world[1] + normal[1] * eps, world[2] + normal[2] * eps]
}

// Aperçu discret du plan d'esquisse actif au survol (feedback visuel E12-02) :
// petite grille + segment de normale, posés au point survolé.
export function ContextualPlanePreview({ hover }: { hover: HoverPreview }) {
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
      <Line geometry={normalGeo} raycast={() => null} renderOrder={3}>
        <lineBasicMaterial
          color={PLANE_EDGE}
          transparent
          opacity={0.9}
          depthTest={false}
          depthWrite={false}
        />
      </Line>
    </group>
  )
}

// Aperçu du tracé en cours (coordonnées (s,t) du plan verrouillé) : rectangle ou
// cercle selon l'outil. Le centre/contour reprend exactement la géométrie qui sera
// générée au commit (cf. lib/editRegistry). Dispatch par variante (`tool`) : chaque
// sous-aperçu reçoit la variante concrète garantie au runtime.
export function DraftPreview({ draft }: { draft: Draft }) {
  const tool = draft.tool ?? 'rect'
  if (tool === 'circle') return <CircleDraftPreview draft={draft as CircleDraft} />
  if (tool === 'arc') return <ArcDraftPreview draft={draft as ArcDraft} />
  if (tool === 'cable' || tool === 'pipe') return <RunDraftPreview draft={draft as RunDraft} />
  return <RectDraftPreview draft={draft as RectDraft} />
}

// Aperçu d'un run routé en cours (câble E15-03, tuyau E16-01) : polyligne des
// sommets déjà posés + tronçon vers le curseur. Sommets déjà en coordonnées
// MONDE → géométrie à l'identité.
function RunDraftPreview({ draft }: { draft: RunDraft }) {
  const { points, current } = draft
  const geo = useMemo(() => {
    const pts = [...(points ?? []), current]
    const arr: number[] = []
    for (const p of pts) arr.push(p[0], p[1], p[2])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    return g
  }, [points, current])
  useEffect(() => () => geo.dispose(), [geo])

  return (
    <Line geometry={geo} raycast={() => null} renderOrder={3}>
      <lineBasicMaterial color={DRAFT_FILL} transparent depthTest={false} depthWrite={false} />
    </Line>
  )
}

function RectDraftPreview({ draft }: { draft: RectDraft }) {
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

// Aperçu cercle : centre = `start`, rayon = distance centre→`current` dans le plan.
function CircleDraftPreview({ draft }: { draft: CircleDraft }) {
  const { frame } = draft
  const r = Math.max(
    Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]),
    0.001
  )
  const center = liftedAlongNormal(
    planeToWorld(draft.start[0], draft.start[1], frame),
    frame.normal,
    0.004
  )
  const quat = useMemo(() => frameQuaternion(frame.u, frame.v, frame.normal), [frame])

  const geo = useMemo(() => new THREE.CircleGeometry(r, 48), [r])
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
        <edgesGeometry args={[geo, 30]} />
        <lineBasicMaterial color={DRAFT_EDGE} />
      </lineSegments>
    </group>
  )
}

// Aperçu de l'arc en cours (E13-03), selon l'étape du draft. Construit dans le
// repère local du plan (origine = centre, comme le générateur) :
//   - étape 'radius' : cercle support complet (faible) + rayon center→curseur ;
//   - étape 'sweep'  : arc tracé (a0 → a0+balayage) + rayons aux deux extrémités.
function ArcDraftPreview({ draft }: { draft: ArcDraft }) {
  const { frame, center } = draft
  const centerWorld = liftedAlongNormal(
    planeToWorld(center[0], center[1], frame),
    frame.normal,
    0.004
  )
  const quat = useMemo(() => frameQuaternion(frame.u, frame.v, frame.normal), [frame])

  const { arcGeo, guideGeo } = useMemo(() => {
    const sweepStage = draft.stage === 'sweep'
    const ref = sweepStage ? draft.start! : draft.current
    const r = Math.max(Math.hypot(ref[0] - center[0], ref[1] - center[1]), 0.001)
    const a0 = sweepStage ? draft.startAngle! : 0
    const sweep = sweepStage ? draft.sweepRad || 0 : 2 * Math.PI
    const seg = Math.max(8, Math.ceil((Math.abs(sweep) / (2 * Math.PI)) * 96))
    const arcPts: number[] = []
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (sweep * i) / seg
      arcPts.push(r * Math.cos(a), r * Math.sin(a), 0)
    }
    const arc = new THREE.BufferGeometry()
    arc.setAttribute('position', new THREE.Float32BufferAttribute(arcPts, 3))

    // Rayons-guides : center→curseur (radius) ou center→début + center→fin (sweep).
    const g: number[] = []
    if (sweepStage) {
      const e = a0 + sweep
      g.push(0, 0, 0, r * Math.cos(a0), r * Math.sin(a0), 0)
      g.push(0, 0, 0, r * Math.cos(e), r * Math.sin(e), 0)
    } else {
      g.push(0, 0, 0, draft.current[0] - center[0], draft.current[1] - center[1], 0)
    }
    const guide = new THREE.BufferGeometry()
    guide.setAttribute('position', new THREE.Float32BufferAttribute(g, 3))
    return { arcGeo: arc, guideGeo: guide }
  }, [draft, center])

  useEffect(
    () => () => {
      arcGeo.dispose()
      guideGeo.dispose()
    },
    [arcGeo, guideGeo]
  )

  return (
    <group position={centerWorld} quaternion={quat}>
      <Line geometry={arcGeo} raycast={() => null} renderOrder={3}>
        <lineBasicMaterial color={DRAFT_EDGE} transparent depthWrite={false} />
      </Line>
      <lineSegments geometry={guideGeo} raycast={() => null} renderOrder={3}>
        <lineBasicMaterial color={DRAFT_FILL} transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
    </group>
  )
}

// Marqueur d'accroche (E12-03) : petit losange coloré au point de snap, dessiné
// par-dessus (depthTest off) pour rester visible. Les accroches `axis` portent leur
// propre couleur d'axe (`snap.color`) ; les autres suivent SNAP_COLORS[type].
export function SnapMarker({ snap }: { snap: Snap }) {
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
export function InferenceLines({ snap }: { snap: Snap }) {
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
        <Line key={i} geometry={g} raycast={() => null} renderOrder={3}>
          <lineBasicMaterial
            color={lines[i]!.color}
            transparent
            opacity={0.85}
            depthTest={false}
            depthWrite={false}
          />
        </Line>
      ))}
    </>
  )
}
