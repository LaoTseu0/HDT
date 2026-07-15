import type { Object3D, Raycaster, Ray } from 'three'
import { faceFrame, groundFrame, worldToPlane, planeToWorld } from '@/core/workPlanes'
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
import type { AnyCamera, ViewportRect, MeshHit } from '@/core/snapRefs'
import { referencePoints } from '@/features/edit/registry'
import { isChainVisible } from '@/features/layers/appearance'
import type {
  Vec3,
  WorkFrame,
  Snap,
  SnapCandidate,
  InferenceLine,
  NodesTable,
  ObjectsTable,
} from '@/types'

// Moteur d'accroche du tracé (étape C2a du découpage d'EditObjects, typé en F1).
// Fonctions PURES : la caméra, le raycaster (`rc`), la scène GLB et le rect du canvas
// sont passés en arguments — pas de dépendance à React/R3F. `probeSketch` déduit le
// plan d'esquisse contextuel + l'intersection modèle ; `computeSnap` en dérive la
// meilleure accroche (points/arêtes/axes/intersections/grille, E12-03).

const INFER_SOURCES = 12 // # de références les plus proches alimentant axes/intersections

/** Évènement pointeur réduit aux champs utilisés (rayon monde + distance au quad). */
interface RayEvent {
  ray: Ray
  distance: number
}

/** Résultat de `probeSketch` : plan d'esquisse actif + éventuel hit mesh (accroche). */
export interface SketchProbe {
  frame: WorkFrame
  hit: MeshHit | null
}

// Plan d'esquisse contextuel + intersection modèle à partir d'un évènement reçu
// sur le quad de sol : SOL par défaut, ou la FACE d'un mesh si le rayon en touche
// une plus près. Le `hit` retourné alimente le snapping (E12-03).
export function probeSketch(
  event: RayEvent,
  glbScene: Object3D | null | undefined,
  rc: Raycaster,
  nodes: NodesTable
): SketchProbe {
  if (glbScene) {
    rc.set(event.ray.origin, event.ray.direction)
    const hits = rc
      .intersectObject(glbScene, true)
      .filter((h) => h.face && isChainVisible(h.object))
    const h = hits[0]
    if (h && h.distance < event.distance - 1e-4) {
      const n = h.face!.normal.clone().transformDirection(h.object.matrixWorld).normalize()
      // Remonter au node porteur des extras (liaison faceOf, utile en Slice 1).
      let o: Object3D | null = h.object
      while (o && !(o.name && nodes?.[o.name])) o = o.parent
      const faceOf = o?.name || h.object.name || undefined
      return {
        frame: faceFrame([h.point.x, h.point.y, h.point.z], [n.x, n.y, n.z], faceOf),
        // Runtime : filtré aux hits porteurs de face → l'objet est un Mesh
        // (MeshHit) ; le type Intersection ne peut pas l'exprimer sans assertion.
        hit: h as unknown as MeshHit,
      }
    }
  }
  return { frame: groundFrame(), hit: null }
}

// Projection orthogonale d'un point sur le plan d'esquisse actif. Le tracé vit sur
// CE plan : on y ramène toute accroche (sinon le marqueur 3D et le coin du
// rectangle, reprojeté par worldToPlane, divergeraient). Une référence hors plan
// donne ainsi un point ALIGNÉ sur le plan (sa « colonne »), pas une accroche hors-sol.
function projectToPlane(p: Vec3, frame: WorkFrame): Vec3 {
  const o = frame.origin
  const n = frame.normal
  const d = (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2]
  return [p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d]
}

type ScoredCandidate = SnapCandidate & { d: number }

// Les `k` candidats dont la projection écran est la plus proche du curseur (borne
// le coût et le bruit des axes/intersections : O(k²) intersections au lieu de O(n²)).
function nearestByScreen(
  points: SnapCandidate[],
  cursor: { x: number; y: number },
  camera: AnyCamera,
  rect: ViewportRect,
  k: number
): ScoredCandidate[] {
  const scored = points.map((p): ScoredCandidate => {
    const s = worldToScreen(p.point, camera, rect)
    return { ...p, sx: s.x, sy: s.y, d: Math.hypot(s.x - cursor.x, s.y - cursor.y) }
  })
  scored.sort((a, b) => a.d - b.d)
  return scored.slice(0, k)
}

/** Paramètres de `computeSnap` : contexte du plan + curseur + réglages. */
export interface ComputeSnapArgs {
  hit: MeshHit | null
  objects: ObjectsTable
  frame: WorkFrame
  drawing: boolean
  freeWorld: Vec3
  startWorld: Vec3 | null
  cursor: { x: number; y: number }
  camera: AnyCamera
  rect: ViewportRect
  gridSnap: boolean
}

/**
 * Meilleure accroche dans le seuil px. Candidats :
 *  - POINTS précis : sommets + milieux d'arête du mesh importé proche du curseur
 *    (requête BVH, E12-03), références des objets app, le tout ramené sur le plan
 *    actif ;
 *  - en cours de tracé seulement : ARÊTES (mesh proche), AXES (u/v du plan passant
 *    par une référence) et INTERSECTIONS de ces axes — les inférences linéaires ;
 *  - GRILLE du plan (si activée) — accroche de dernier recours.
 */
export function computeSnap({
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
}: ComputeSnapArgs): Snap | null {
  const proj = (p: Vec3): Vec3 => projectToPlane(p, frame)

  // 1) Points précis (projetés sur le plan actif).
  const points: SnapCandidate[] = []
  let meshEdges: [Vec3, Vec3][] | null = null // arêtes du mesh (projetées) — candidats `edge`
  if (hit) {
    const refs = meshRefsNear(hit, freeWorld, camera, rect)
    for (const v of refs.verts) points.push({ type: 'endpoint', point: proj(v) })
    meshEdges = refs.edges.map(([a, b]): [Vec3, Vec3] => [proj(a), proj(b)])
    for (const [pa, pb] of meshEdges)
      points.push({ type: 'midpoint', point: midpoint(pa, pb) })
  }
  for (const o of Object.values(objects)) {
    for (const rp of referencePoints(o))
      points.push({ type: rp.type, point: proj(rp.point) })
  }
  // Le point de départ du tracé est lui aussi une référence d'inférence.
  if (drawing && startWorld) points.push({ type: 'endpoint', point: proj(startWorld) })

  const candidates: SnapCandidate[] = [...points]

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
    const uLines: InferenceLine[] = []
    const vLines: InferenceLine[] = []
    for (const p of near) {
      const lu: InferenceLine = { origin: p.point, dir: frame.u, color: uColor }
      const lv: InferenceLine = { origin: p.point, dir: frame.v, color: vColor }
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
