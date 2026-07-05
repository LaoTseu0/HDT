// Raccords AUTOMATIQUES aux jonctions entre runs routés (E16-03, plomberie, cf.
// docs/edit-mode-design.md § 5.3). Module PUR (maths sur tableaux [x,y,z], pas de
// three, pas de react) → testable seul (script/fittings.test.mjs).
//
// Les coudes d'onglet AU SEIN d'un run sont déjà rendus par le balayage
// (lib/routing, runRings) ; ce module traite les jonctions ENTRE runs : une
// EXTRÉMITÉ de tuyau A qui arrive sur un tuyau B reçoit un raccord généré
// automatiquement, DÉRIVÉ des objets (rien dans les params, rien dans le store —
// même philosophie que le perçage CSG de WallCutter : recalculé à chaque
// changement, gratuit au rechargement).
//
// Classification :
//   - « te »      : l'extrémité arrive sur le CORPS de B (milieu de segment ou
//                   sommet intérieur) → té à 3 bras ;
//   - « coude »   : extrémité contre extrémité, directions en angle ;
//   - « manchon » : extrémité contre extrémité, directions colinéaires.
//
// Un raccord = des BRAS balayés (section rectangulaire surdimensionnée, même
// esthétique low-poly que les runs) depuis le point de jonction le long de
// chaque direction incidente — maillage via runMesh (lib/routing, partagé).

import { dist, runMesh } from './routing.js'

// --- petite algèbre vectorielle (tableaux [x,y,z]) ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

/** Échelle de la section d'un raccord vs celle du tuyau (effet « collier »). */
export const FITTING_OVERSIZE = 1.4
/** Longueur d'un bras = FITTING_ARM_FACTOR × plus grand côté des sections jointes. */
export const FITTING_ARM_FACTOR = 1.6
/** Longueur minimale d'un bras (m) — lisible même sur du cuivre Ø12. */
export const FITTING_ARM_MIN = 0.03
// En deçà de |dot| entre les deux directions, extrémité-contre-extrémité = coude ;
// au-delà (quasi colinéaires), manchon.
const COLINEAR_DOT = 0.985
// Un point de jonction plus proche que ça d'un sommet de B est traité AU sommet.
const VERTEX_EPS = 1e-3

const maxSide = (params) =>
  Math.max(Number(params?.largeur_m) || 0, Number(params?.hauteur_m) || 0)

// Point du chemin (polyligne) le plus proche de p : point, index du segment, et
// distance. Réimplémente la projection segment (cf. lib/snapping) sans dépendance.
function closestOnPath(points, p) {
  let best = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const ab = sub(b, a)
    const denom = dot(ab, ab) || 1
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / denom))
    const q = add(a, scale(ab, t))
    const d = dist(p, q)
    if (!best || d < best.d) best = { point: q, seg: i, d }
  }
  return best
}

// Directions unitaires PARTANT de q le long du chemin de B : si q est (quasi) sur
// un sommet, vers chacun de ses voisins (1 seule aux extrémités du chemin) ; sinon
// les deux sens du segment porteur.
function dirsAwayFrom(points, hit) {
  const { point: q, seg } = hit
  for (let j = seg; j <= seg + 1; j++) {
    if (dist(points[j], q) <= VERTEX_EPS) {
      const dirs = []
      if (j > 0) dirs.push(norm(sub(points[j - 1], q)))
      if (j < points.length - 1) dirs.push(norm(sub(points[j + 1], q)))
      return { dirs, atEnd: dirs.length === 1 }
    }
  }
  const d = norm(sub(points[seg + 1], points[seg]))
  return { dirs: [d, scale(d, -1)], atEnd: false }
}

// Les deux extrémités d'un chemin, avec la direction PARTANT de l'extrémité vers
// l'intérieur du run.
function endpointsOf(points) {
  const n = points.length
  return [
    { point: points[0], dir: norm(sub(points[1], points[0])) },
    { point: points[n - 1], dir: norm(sub(points[n - 2], points[n - 1])) },
  ]
}

const keyOf = (idA, idB, point) =>
  [idA, idB].sort().join('|') + ':' + point.map((c) => c.toFixed(3)).join(',')

/**
 * Détecte les jonctions entre runs et décrit leurs raccords. Une extrémité du run
 * A à portée du chemin du run B (tolérance = demi-sections cumulées) crée un
 * raccord ; extrémité-contre-extrémité n'est comptée qu'une fois (dédup par paire
 * + point). Chaque raccord porte ses BRAS prêts à mailler (fittingMesh).
 * @param {{id:string, params:{points:number[][], largeur_m:number, hauteur_m:number}}[]} runs
 * @returns {{type:'te'|'coude'|'manchon', point:number[], runIds:string[],
 *   arms:{a:number[], b:number[], section:{largeur_m:number, hauteur_m:number}}[]}[]}
 */
export function detectFittings(runs) {
  const list = (runs ?? []).filter((r) => (r.params?.points?.length ?? 0) >= 2)
  const fittings = []
  const seen = new Set()

  for (const A of list) {
    for (const end of endpointsOf(A.params.points)) {
      for (const B of list) {
        if (B.id === A.id) continue
        const hit = closestOnPath(B.params.points, end.point)
        const tol = (maxSide(A.params) + maxSide(B.params)) / 2 + VERTEX_EPS
        if (!hit || hit.d > tol) continue

        const { dirs: dirsB, atEnd } = dirsAwayFrom(B.params.points, hit)
        // Extrémité contre extrémité : point médian (symétrique → même clé de
        // dédup vue de A ou de B) ; sinon le point est SUR l'axe de B (té).
        const point = atEnd ? mid(end.point, hit.point) : hit.point
        const key = keyOf(A.id, B.id, point)
        if (seen.has(key)) continue
        seen.add(key)

        const type = atEnd
          ? dot(end.dir, dirsB[0]) <= -COLINEAR_DOT
            ? 'manchon'
            : 'coude'
          : 'te'

        // Bras : longueur commune (le collier doit couvrir le plus gros des deux
        // tuyaux), section surdimensionnée de CHAQUE tuyau sur ses directions.
        const armLen = Math.max(
          FITTING_ARM_FACTOR * Math.max(maxSide(A.params), maxSide(B.params)),
          FITTING_ARM_MIN
        )
        const sec = (params) => ({
          largeur_m: (Number(params.largeur_m) || 0) * FITTING_OVERSIZE,
          hauteur_m: (Number(params.hauteur_m) || 0) * FITTING_OVERSIZE,
        })
        const arms = dirsB.map((d) => ({
          a: point,
          b: add(point, scale(d, armLen)),
          section: sec(B.params),
        }))
        arms.push({ a: point, b: add(point, scale(end.dir, armLen)), section: sec(A.params) })

        fittings.push({ type, point, runIds: [A.id, B.id], arms })
      }
    }
  }
  return fittings
}

/**
 * Maillage d'un raccord : chaque bras est un mini-run de 2 points (runMesh,
 * lib/routing) ; les bras se recouvrent au point de jonction (solide opaque →
 * aucune couture visible). Tableaux plats prêts pour un BufferGeometry.
 * @param {{arms:{a:number[], b:number[], section:object}[]}} fitting
 * @returns {{position:number[], index:number[]}}
 */
export function fittingMesh(fitting) {
  const position = []
  const index = []
  for (const arm of fitting.arms ?? []) {
    const m = runMesh([arm.a, arm.b], arm.section)
    const offset = position.length / 3
    position.push(...m.position)
    for (const i of m.index) index.push(offset + i)
  }
  return { position, index }
}
