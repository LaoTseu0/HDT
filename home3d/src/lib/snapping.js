// Snapping / inférence d'Edit mode (E12-03, façon SketchUp — « points d'accroche »).
//
// Incrément 1 : pendant un tracé, le curseur s'accroche aux références de la
// géométrie SOUS le curseur — sommets (endpoint), milieux d'arête (midpoint),
// point le plus proche sur une arête (edge) — quand on s'en approche à moins d'un
// seuil EN PIXELS (constant à l'écran quel que soit le zoom, comme SketchUp).
//
// Incrément 2 : on étend les références aux OBJETS APP déjà dessinés (cf.
// editRegistry.referencePoints), et on ajoute deux inférences LINÉAIRES, calculées
// dans le plan d'esquisse actif :
//   - accroche sur un AXE passant par une référence (le long de u/v du plan) →
//     « aligné avec ce point » + ligne d'inférence colorée ;
//   - accroche à l'INTERSECTION de deux axes (alignement croisé h × v).
//
// Module PUR (maths sur tableaux). La récupération des candidats depuis la
// géométrie three et la projection écran vivent côté composant (EditObjects) ;
// ici on garde la sélection du meilleur candidat et la géométrie (segment, droite,
// intersection), testables seules (script/snapping.test.mjs).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

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

/** Projection de p sur la DROITE infinie (origin, dir) — `dir` n'a pas à être unitaire. */
export function closestPointOnLine(p, origin, dir) {
  const d = normalize(dir)
  return add(origin, scale(d, dot(sub(p, origin), d)))
}

/**
 * Point de la droite 1 le plus proche de la droite 2 (géométrie des deux droites
 * les plus proches). Les axes d'inférence vivant dans le MÊME plan, les droites
 * non parallèles se coupent vraiment → ce point est leur intersection.
 * @returns {number[]|null} null si (quasi) parallèles
 */
export function closestPointBetweenLines(o1, dir1, o2, dir2) {
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
export const WORLD_AXES = [
  { key: 'x', dir: [1, 0, 0] },
  { key: 'y', dir: [0, 1, 0] },
  { key: 'z', dir: [0, 0, 1] },
]

// Couleurs d'axe (façon SketchUp : X rouge, Y vertical bleu, Z vert ; `off` =
// direction non alignée sur un axe monde, ex. mur en biais → magenta).
export const AXIS_COLORS = { x: '#e8473f', y: '#2f6fed', z: '#21a366', off: '#d946ef' }

/** Couleur d'inférence d'une direction : l'axe monde quasi colinéaire, sinon `off`. */
export function axisColorForDir(dir) {
  const d = normalize(dir)
  for (const a of WORLD_AXES) {
    if (Math.abs(dot(d, a.dir)) > 0.99) return AXIS_COLORS[a.key]
  }
  return AXIS_COLORS.off
}

// Priorité d'accroche (la plus forte gagne à seuil égal). Les POINTS précis priment
// sur les inférences linéaires, et la grille ne l'emporte qu'en dernier recours :
// sommet > intersection > milieu > arête > axe > grille.
export const SNAP_PRIORITY = {
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
export const SNAP_COLORS = {
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
  if (!best) return null
  const rest = { ...best }
  delete rest.sx
  delete rest.sy
  return rest
}
