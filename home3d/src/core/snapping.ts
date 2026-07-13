// Snapping / inférence d'Edit mode (E12-03, façon SketchUp — « points d'accroche »).
//
// Incrément 1 : pendant un tracé, le curseur s'accroche aux références de la
// géométrie SOUS le curseur — sommets (endpoint), milieux d'arête (midpoint),
// point le plus proche sur une arête (edge) — quand on s'en approche à moins d'un
// seuil EN PIXELS (constant à l'écran quel que soit le zoom, comme SketchUp).
//
// Incrément 2 : on étend les références aux OBJETS APP déjà dessinés (cf.
// features/edit/registry referencePoints), et on ajoute deux inférences LINÉAIRES,
// calculées dans le plan d'esquisse actif :
//   - accroche sur un AXE passant par une référence (le long de u/v du plan) →
//     « aligné avec ce point » + ligne d'inférence colorée ;
//   - accroche à l'INTERSECTION de deux axes (alignement croisé h × v).
//
// Module PUR (maths sur tableaux). La récupération des candidats depuis la
// géométrie three et la projection écran vivent côté composant (EditObjects) ;
// ici on garde la sélection du meilleur candidat et la géométrie (segment, droite,
// intersection), testables seules (snapping.test.ts).

import type { Snap, SnapCandidate, SnapType, Vec3 } from '@/types'

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// Seuil d'accroche à l'écran (px, constant quel que soit le zoom, façon
// SketchUp) et pas de la grille du plan d'esquisse (E12-03) — partagés entre le
// tracé (EditObjects) et le drag sur axe (useAxisDrag, E22-03).
export const SNAP_THRESHOLD_PX = 14
export const GRID_STEP_M = 0.1

/** Milieu de [a, b]. */
export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

/**
 * Valeur de cote qu'atteindrait un drag sur axe (E22-03) pour que la face/
 * poignée tirée passe par le point `p` : la face part de `refPoint` et se
 * déplace de `value − baseParam` le long de `outward` (invariant du moteur
 * useAxisDrag, face opposée/centre fixes) → value = base + (p − ref)·outward.
 * @param p         point de référence visé (monde)
 * @param refPoint  point de la face/poignée au DÉBUT du drag (monde)
 * @param outward   direction du drag (unitaire monde, axe·signe)
 * @param baseParam cote au début du drag (m)
 * @returns cote snappée (m)
 */
export function valueOnAxis(
  p: Vec3,
  refPoint: Vec3,
  outward: Vec3,
  baseParam: number
): number {
  return (
    baseParam +
    (p[0] - refPoint[0]) * outward[0] +
    (p[1] - refPoint[1]) * outward[1] +
    (p[2] - refPoint[2]) * outward[2]
  )
}

/** Point du SEGMENT [a, b] le plus proche de p (paramètre borné à [0, 1]). */
export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const ab = sub(b, a)
  const denom = dot(ab, ab) || 1
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / denom))
  return add(a, scale(ab, t))
}

/** Projection de p sur la DROITE infinie (origin, dir) — `dir` n'a pas à être unitaire. */
export function closestPointOnLine(p: Vec3, origin: Vec3, dir: Vec3): Vec3 {
  const d = normalize(dir)
  return add(origin, scale(d, dot(sub(p, origin), d)))
}

/**
 * Point de la droite 1 le plus proche de la droite 2 (géométrie des deux droites
 * les plus proches). Les axes d'inférence vivant dans le MÊME plan, les droites
 * non parallèles se coupent vraiment → ce point est leur intersection.
 * @returns null si (quasi) parallèles
 */
export function closestPointBetweenLines(
  o1: Vec3,
  dir1: Vec3,
  o2: Vec3,
  dir2: Vec3
): Vec3 | null {
  const d1 = normalize(dir1)
  const d2 = normalize(dir2)
  const b = dot(d1, d2)
  const den = 1 - b * b
  if (den < 1e-9) return null // parallèles : pas d'intersection unique
  const r = sub(o1, o2)
  const s = (b * dot(d2, r) - dot(d1, r)) / den
  return add(o1, scale(d1, s))
}

// Axes du monde (pour colorer les lignes d'inférence façon SketchUp).
export const WORLD_AXES: ReadonlyArray<{ key: 'x' | 'y' | 'z'; dir: Vec3 }> = [
  { key: 'x', dir: [1, 0, 0] },
  { key: 'y', dir: [0, 1, 0] },
  { key: 'z', dir: [0, 0, 1] },
]

// Couleurs d'axe (façon SketchUp : X rouge, Y vertical bleu, Z vert ; `off` =
// direction non alignée sur un axe monde, ex. mur en biais → magenta).
export const AXIS_COLORS = {
  x: '#e8473f',
  y: '#2f6fed',
  z: '#21a366',
  off: '#d946ef',
} as const

/** Couleur d'inférence d'une direction : l'axe monde quasi colinéaire, sinon `off`. */
export function axisColorForDir(dir: Vec3): string {
  const d = normalize(dir)
  for (const a of WORLD_AXES) {
    if (Math.abs(dot(d, a.dir)) > 0.99) return AXIS_COLORS[a.key]
  }
  return AXIS_COLORS.off
}

// Priorité d'accroche (la plus forte gagne à seuil égal). Les POINTS précis priment
// sur les inférences linéaires, et la grille ne l'emporte qu'en dernier recours :
// sommet > intersection > milieu > arête > axe > grille.
export const SNAP_PRIORITY: Record<SnapType, number> = {
  endpoint: 5,
  intersection: 4,
  midpoint: 3,
  edge: 2,
  axis: 1,
  grid: 0,
}

// Couleurs des marqueurs par type (convention SketchUp : vert=sommet, cyan=milieu,
// rouge=sur l'arête, magenta=intersection, gris=grille). Les accroches `axis`
// portent leur propre couleur d'axe (champ `color`), posée par le composant.
export const SNAP_COLORS: Partial<Record<SnapType, string>> = {
  endpoint: '#22c55e',
  midpoint: '#22d3ee',
  edge: '#ef4444',
  intersection: '#d946ef',
  grid: '#94a3b8',
}

/**
 * Choisit la meilleure accroche parmi des candidats annotés de leur position
 * écran (sx, sy en pixels). Dans le seuil, on préfère la plus haute priorité,
 * puis la plus proche du curseur. Renvoie le candidat retenu privé de ses
 * coordonnées écran (conserve d'éventuels champs `color`/`lines` portés par les
 * inférences linéaires).
 *
 * @param candidates candidats annotés (sx, sy posés)
 * @param cursor position curseur (pixels écran)
 * @param threshold rayon d'accroche en pixels
 */
export function pickBestSnap(
  candidates: SnapCandidate[],
  cursor: { x: number; y: number },
  threshold: number
): Snap | null {
  let best: SnapCandidate | null = null
  let bestPrio = -1
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.hypot((c.sx ?? Infinity) - cursor.x, (c.sy ?? Infinity) - cursor.y)
    if (d > threshold) continue
    const prio = SNAP_PRIORITY[c.type] ?? 0
    if (prio > bestPrio || (prio === bestPrio && d < bestDist)) {
      best = c
      bestPrio = prio
      bestDist = d
    }
  }
  if (!best) return null
  const rest = { ...best }
  delete rest.sx
  delete rest.sy
  return rest
}
