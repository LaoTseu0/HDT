// Routage des objets LINÉAIRES (catégorie ② « routé », E15-03 câble élec, cf.
// docs/edit-mode-design.md § 5.3). Module PUR (maths sur tableaux [x,y,z], pas de
// three, pas de react) → testable seul (routing.test.ts) et RÉUTILISABLE
// par la plomberie (Slice 3, E16 : mêmes tuyaux routés, section différente).
//
// Un « run » est une polyligne (suite de points MONDE) balayée avec une SECTION
// RECTANGULAIRE ({ largeur_m, hauteur_m }) — pas un tube cylindrique : 4 faces par
// tronçon au lieu de 8–32, gain de polygones massif sur un réseau complet (§ 5.3,
// préoccupation perf E8). Les coudes aux sommets sont des JONCTIONS D'ONGLET
// (mitre) : à chaque sommet, la section est portée par le plan bissecteur des deux
// tronçons → les faces se rejoignent sans trou ni coude torique.

import type { Vec3 } from '@/types'

/** Section rectangulaire d'un balayage (côtés en mètres). */
export interface RunSection {
  largeur_m: number
  hauteur_m: number
}

/** Maillage brut (tableaux plats) prêt pour un BufferGeometry. */
export interface RawMesh {
  position: number[]
  index: number[]
}

// --- petite algèbre vectorielle (tableaux [x,y,z]) ---
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const dist = (a: Vec3, b: Vec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Résultat de projection d'un point sur un chemin. */
export interface PathHit {
  point: Vec3
  seg: number
  t: number
  d: number
}

/**
 * Point d'un chemin (polyligne) le plus proche de `p` : projection sur chaque
 * segment, on garde la meilleure. Renvoie le point, l'index du segment porteur,
 * le paramètre `t` ∈ [0,1] sur ce segment et la distance. Partagé par les
 * raccords (E16-03, fittings) et la vanne inline (E16-04, valve).
 * @param points chemin (≥ 2 sommets)
 * @param p point requête
 */
export function closestOnPath(points: Vec3[], p: Vec3): PathHit | null {
  let best: PathHit | null = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const ab = sub(b, a)
    const denom = dot(ab, ab) || 1
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / denom))
    const q = add(a, scale(ab, t))
    const d = dist(p, q)
    if (!best || d < best.d) best = { point: q, seg: i, t, d }
  }
  return best
}

/**
 * Supprime les points consécutifs quasi confondus d'un chemin (clics accidentels,
 * doublon du double-clic de fin). Conserve l'ordre.
 * @param eps distance mini entre deux sommets (m)
 */
export function dedupePath(points: Vec3[] | null | undefined, eps = 1e-3): Vec3[] {
  const out: Vec3[] = []
  for (const p of points ?? []) {
    if (!out.length || dist(out[out.length - 1]!, p) > eps) out.push([p[0], p[1], p[2]])
  }
  return out
}

/** Longueur totale (m) d'un chemin (somme des tronçons). */
export function pathLength(points: Vec3[] | null | undefined): number {
  const pts = points ?? []
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!)
  return total
}

// Repère de section à un sommet : `tangent` (bissecteur pour un sommet interne,
// direction du tronçon aux extrémités), et une base (right, up) du plan de section.
// L'« up » de référence est vertical (la section rectangulaire reste de niveau,
// façon conduit posé) ; on retombe sur X quand la tangente est ~verticale.
function sectionBasis(tangent: Vec3): { tangent: Vec3; right: Vec3; up: Vec3 } {
  let t = norm(tangent)
  if (len(t) < 1e-9) t = [0, 0, 1]
  let up: Vec3 = [0, 1, 0]
  if (Math.abs(dot(t, up)) > 0.99) up = [1, 0, 0]
  const right = norm(cross(t, up))
  const realUp = norm(cross(right, t)) // ⊥ à right et t, dans le plan de section
  return { tangent: t, right, up: realUp }
}

/** Anneau de section : centre (= sommet) + 4 coins dans le plan de section. */
export interface RunRing {
  center: Vec3
  corners: [Vec3, Vec3, Vec3, Vec3]
}

/**
 * Anneaux de section le long d'un chemin, pour balayer la géométrie. Chaque anneau
 * porte le CENTRE (= sommet) et ses 4 COINS dans le plan de section (perpendiculaire
 * au bissecteur au sommet → jonction d'onglet). Coins ordonnés dans le sens
 * (right,up) : [−−, +−, ++, −+] → indices cohérents pour coudre les quads.
 * @param points chemin (monde), sera dédupliqué
 * @returns un anneau par sommet dédupliqué
 */
export function runRings(
  points: Vec3[],
  section: Partial<RunSection> | null | undefined
): RunRing[] {
  const pts = dedupePath(points)
  const hw = Math.max(Number(section?.largeur_m) || 0, 1e-3) / 2
  const hh = Math.max(Number(section?.hauteur_m) || 0, 1e-3) / 2
  const n = pts.length
  const rings: RunRing[] = []
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? norm(sub(pts[i]!, pts[i - 1]!)) : null
    const next = i < n - 1 ? norm(sub(pts[i + 1]!, pts[i]!)) : null
    let tangent: Vec3
    if (prev && next)
      tangent = add(prev, next) // bissecteur (coude d'onglet)
    else tangent = prev || next || [0, 0, 1]
    const { right, up } = sectionBasis(tangent)
    const c = pts[i]!
    const corners: [Vec3, Vec3, Vec3, Vec3] = [
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
 * les runs (elec.cable, plomberie.pipe) et les raccords (E16-03, fittings).
 * @param points chemin (monde)
 */
export function runMesh(
  points: Vec3[],
  section: Partial<RunSection> | null | undefined
): RawMesh {
  const rings = runRings(points, section)
  const position: number[] = []
  const index: number[] = []
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
