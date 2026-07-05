// Routage des objets LINÉAIRES (catégorie ② « routé », E15-03 câble élec, cf.
// docs/edit-mode-design.md § 5.3). Module PUR (maths sur tableaux [x,y,z], pas de
// three, pas de react) → testable seul (script/routing.test.mjs) et RÉUTILISABLE
// par la plomberie (Slice 3, E16 : mêmes tuyaux routés, section différente).
//
// Un « run » est une polyligne (suite de points MONDE) balayée avec une SECTION
// RECTANGULAIRE ({ largeur_m, hauteur_m }) — pas un tube cylindrique : 4 faces par
// tronçon au lieu de 8–32, gain de polygones massif sur un réseau complet (§ 5.3,
// préoccupation perf E8). Les coudes aux sommets sont des JONCTIONS D'ONGLET
// (mitre) : à chaque sommet, la section est portée par le plan bissecteur des deux
// tronçons → les faces se rejoignent sans trou ni coude torique.

// --- petite algèbre vectorielle (tableaux [x,y,z]) ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * Supprime les points consécutifs quasi confondus d'un chemin (clics accidentels,
 * doublon du double-clic de fin). Conserve l'ordre.
 * @param {number[][]} points
 * @param {number} [eps] distance mini entre deux sommets (m)
 * @returns {number[][]}
 */
export function dedupePath(points, eps = 1e-3) {
  const out = []
  for (const p of points ?? []) {
    if (!out.length || dist(out[out.length - 1], p) > eps) out.push([p[0], p[1], p[2]])
  }
  return out
}

/** Longueur totale (m) d'un chemin (somme des tronçons). */
export function pathLength(points) {
  const pts = points ?? []
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i])
  return total
}

// Repère de section à un sommet : `tangent` (bissecteur pour un sommet interne,
// direction du tronçon aux extrémités), et une base (right, up) du plan de section.
// L'« up » de référence est vertical (la section rectangulaire reste de niveau,
// façon conduit posé) ; on retombe sur X quand la tangente est ~verticale.
function sectionBasis(tangent) {
  let t = norm(tangent)
  if (len(t) < 1e-9) t = [0, 0, 1]
  let up = [0, 1, 0]
  if (Math.abs(dot(t, up)) > 0.99) up = [1, 0, 0]
  const right = norm(cross(t, up))
  const realUp = norm(cross(right, t)) // ⊥ à right et t, dans le plan de section
  return { tangent: t, right, up: realUp }
}

/**
 * Anneaux de section le long d'un chemin, pour balayer la géométrie. Chaque anneau
 * porte le CENTRE (= sommet) et ses 4 COINS dans le plan de section (perpendiculaire
 * au bissecteur au sommet → jonction d'onglet). Coins ordonnés dans le sens
 * (right,up) : [−−, +−, ++, −+] → indices cohérents pour coudre les quads.
 * @param {number[][]} points chemin (monde), sera dédupliqué
 * @param {{largeur_m:number, hauteur_m:number}} section
 * @returns {{center:number[], corners:number[][]}[]} un anneau par sommet dédupliqué
 */
export function runRings(points, section) {
  const pts = dedupePath(points)
  const hw = Math.max(Number(section?.largeur_m) || 0, 1e-3) / 2
  const hh = Math.max(Number(section?.hauteur_m) || 0, 1e-3) / 2
  const n = pts.length
  const rings = []
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? norm(sub(pts[i], pts[i - 1])) : null
    const next = i < n - 1 ? norm(sub(pts[i + 1], pts[i])) : null
    let tangent
    if (prev && next) tangent = add(prev, next) // bissecteur (coude d'onglet)
    else tangent = prev || next || [0, 0, 1]
    const { right, up } = sectionBasis(tangent)
    const c = pts[i]
    const corners = [
      add(add(c, scale(right, -hw)), scale(up, -hh)),
      add(add(c, scale(right, hw)), scale(up, -hh)),
      add(add(c, scale(right, hw)), scale(up, hh)),
      add(add(c, scale(right, -hw)), scale(up, hh)),
    ]
    rings.push({ center: c, corners })
  }
  return rings
}

/**
 * Maillage du balayage d'un chemin par une section rectangulaire : 4 sommets par
 * anneau (cf. runRings), 4 quads latéraux par tronçon + 2 bouchons d'extrémité.
 * Données brutes (tableaux plats) prêtes pour un BufferGeometry — partagées par
 * les runs (elec.cable, plomberie.pipe) et les raccords (E16-03, lib/fittings).
 * @param {number[][]} points chemin (monde)
 * @param {{largeur_m:number, hauteur_m:number}} section
 * @returns {{position:number[], index:number[]}}
 */
export function runMesh(points, section) {
  const rings = runRings(points, section)
  const position = []
  const index = []
  for (const ring of rings) {
    for (const c of ring.corners) position.push(c[0], c[1], c[2])
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = i * 4
    const b = a + 4
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4
      // quad (a+k, a+k2, b+k2, b+k) → 2 triangles.
      index.push(a + k, a + k2, b + k2, a + k, b + k2, b + k)
    }
  }
  if (rings.length >= 2) {
    const last = (rings.length - 1) * 4
    index.push(0, 2, 1, 0, 3, 2) // départ
    index.push(last, last + 1, last + 2, last, last + 2, last + 3) // arrivée
  }
  return { position, index }
}
