// Snapping / inférence d'Edit mode (E12-03, façon SketchUp — « points d'accroche »).
//
// Incrément 1 : pendant un tracé, le curseur s'accroche aux références de la
// géométrie SOUS le curseur — sommets (endpoint), milieux d'arête (midpoint),
// point le plus proche sur une arête (edge) — quand on s'en approche à moins d'un
// seuil EN PIXELS (constant à l'écran quel que soit le zoom, comme SketchUp).
//
// Module PUR (maths sur tableaux). La récupération des candidats depuis la
// géométrie three et la projection écran vivent côté composant (EditObjects) ;
// ici on garde la sélection du meilleur candidat et la géométrie de segment,
// testables seules (script/snapping.test.mjs).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Milieu de [a, b]. */
export function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

/** Point du SEGMENT [a, b] le plus proche de p (paramètre borné à [0, 1]). */
export function closestPointOnSegment(p, a, b) {
  const ab = sub(b, a)
  const denom = dot(ab, ab) || 1
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / denom))
  return add(a, scale(ab, t))
}

// Priorité d'accroche (la plus forte gagne à seuil égal) : sommet > milieu > arête.
export const SNAP_PRIORITY = { endpoint: 3, midpoint: 2, edge: 1 }

// Couleurs des marqueurs par type (convention SketchUp : vert=sommet, cyan=milieu,
// rouge=sur l'arête).
export const SNAP_COLORS = { endpoint: '#22c55e', midpoint: '#22d3ee', edge: '#ef4444' }

/**
 * Choisit la meilleure accroche parmi des candidats annotés de leur position
 * écran (sx, sy en pixels). Dans le seuil, on préfère la plus haute priorité,
 * puis la plus proche du curseur.
 *
 * @param {Array<{type:string, point:number[], sx:number, sy:number}>} candidates
 * @param {{x:number, y:number}} cursor  position curseur (pixels écran)
 * @param {number} threshold  rayon d'accroche en pixels
 * @returns {{type:string, point:number[]}|null}
 */
export function pickBestSnap(candidates, cursor, threshold) {
  let best = null
  let bestPrio = -1
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.hypot(c.sx - cursor.x, c.sy - cursor.y)
    if (d > threshold) continue
    const prio = SNAP_PRIORITY[c.type] ?? 0
    if (prio > bestPrio || (prio === bestPrio && d < bestDist)) {
      best = c
      bestPrio = prio
      bestDist = d
    }
  }
  return best ? { type: best.type, point: best.point } : null
}
