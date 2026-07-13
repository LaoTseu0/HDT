// Plan d'esquisse contextuel d'Edit mode (E12-02, façon SketchUp — cf.
// docs/edit-mode-design.md § 5.2, amendement 2026-06-24).
//
// Il n'y a PAS de sélecteur de plan : le plan d'esquisse est déduit du contexte.
//   - par défaut on dessine sur le SOL (niveau 0, plan horizontal) ;
//   - dès que le curseur survole une FACE d'un mesh, le plan devient cette face.
//
// Un plan se résout en un REPÈRE orthonormé `{ origin, normal, u, v }` (vecteurs
// monde, tableaux [x,y,z]). `u`/`v` sont les axes du plan (largeur/profondeur du
// tracé), `normal` la perpendiculaire (axe d'extrusion du Push/Pull, E12-08). Le
// tracé travaille en coordonnées (s,t) dans ce repère puis reprojette en monde —
// l'outil Rectangle est ainsi indépendant de l'orientation du plan.
//
// Module PUR (maths sur tableaux, pas de three, pas de react) → testable seul
// (workPlanes.test.ts) et réutilisable côté générateur comme côté tracé.

import type { Basis, ObjectPlane, Vec2, Vec3, WorkFrame } from '@/types'

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
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * Repère orthonormé DIRECT à partir d'une normale et d'un axe « graine » `seed`
 * (la direction qu'on aimerait pour `u`). `u` est `seed` re-orthogonalisé à la
 * normale (Gram-Schmidt), `v = normal × u` → (u, v, normal) direct, `u × v = normal`.
 */
export function makeBasisFromNormal(normal: Vec3, seed: Vec3 = [1, 0, 0]): Basis {
  const n = normalize(normal)
  // `seed` quasi parallèle à la normale → choisir une autre graine.
  let s = seed
  if (Math.abs(dot(normalize(s), n)) > 0.99) {
    s = Math.abs(n[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0]
  }
  const u = normalize(sub(s, scale(n, dot(s, n))))
  const v = cross(n, u) // déjà unitaire (n ⊥ u, tous deux unitaires)
  return { u, v, normal: n }
}

/** Repère du plan de SOL (horizontal, niveau 0) — plan d'esquisse par défaut. */
export function groundFrame(): WorkFrame {
  const { u, v, normal } = makeBasisFromNormal([0, 1, 0], [1, 0, 0])
  return { type: 'ground', origin: [0, 0, 0], u, v, normal }
}

/**
 * Repère d'une FACE survolée : origine au point d'impact, axes dérivés de la
 * normale monde de la face. `u` est gardé « horizontal » quand c'est possible
 * (mur vertical → largeur horizontale), pour un tracé naturel.
 * @param point  point d'impact (monde)
 * @param normal normale monde de la face
 * @param faceOf node name du mesh (liaison, pour Slice 1 ouvertures)
 */
export function faceFrame(point: Vec3, normal: Vec3, faceOf?: string): WorkFrame {
  const n = normalize(normal)
  // Graine = horizontale ⊥ à la normale (up × normal) → `u` horizontal le long du
  // mur, `v` vertical. Face ~horizontale (normale verticale) → graine dégénérée,
  // on retombe sur l'axe X.
  let seed = cross([0, 1, 0], n)
  if (length(seed) < 1e-6) seed = [1, 0, 0]
  const { u, v, normal: nn } = makeBasisFromNormal(n, seed)
  return { type: 'face', origin: point, u, v, normal: nn, ...(faceOf ? { faceOf } : {}) }
}

/**
 * Repère d'un objet déjà créé (pour le générateur). L'objet stocke `plane` avec
 * `origin` = CENTRE de la forme et le repère (u/v/normal). Rétro-compat : les
 * objets d'avant E12-02 n'ont que `{ origin }` → repère sol par défaut.
 */
export function frameOfObjectPlane(plane?: ObjectPlane | null): Basis & { origin: Vec3 } {
  const g = groundFrame()
  return {
    origin: plane?.origin ?? [0, 0, 0],
    u: plane?.u ?? g.u,
    v: plane?.v ?? g.v,
    normal: plane?.normal ?? g.normal,
  }
}

/** Coordonnées (s,t) d'un point monde dans le plan. */
export function worldToPlane(point: Vec3, frame: Basis & { origin: Vec3 }): Vec2 {
  const d = sub(point, frame.origin)
  return [dot(d, frame.u), dot(d, frame.v)]
}

/** Point monde d'une coordonnée (s,t) du plan. */
export function planeToWorld(
  s: number,
  t: number,
  frame: Basis & { origin: Vec3 }
): Vec3 {
  return add(frame.origin, add(scale(frame.u, s), scale(frame.v, t)))
}

/**
 * Hauteur d'extrusion d'un Push/Pull (E12-08) : paramètre le long de la droite
 * (centre de la face, normale) du point le plus proche d'un RAYON souris. C'est
 * la distance signée dont on « tire » la face. Géométrie classique des deux
 * droites les plus proches ; si le rayon est ~parallèle à la normale, on renvoie
 * la projection directe (dénominateur dégénéré).
 * @param center centre de la face (monde)
 * @param normal normale de la face (monde, unitaire)
 * @param rayOrigin origine du rayon souris
 * @param rayDir direction du rayon souris (unitaire)
 * @returns hauteur signée le long de la normale
 */
export function extrudeHeightFromRay(
  center: Vec3,
  normal: Vec3,
  rayOrigin: Vec3,
  rayDir: Vec3
): number {
  const n = normalize(normal)
  const d2 = normalize(rayDir)
  const r = sub(center, rayOrigin)
  const b = dot(n, d2)
  const den = 1 - b * b
  if (Math.abs(den) < 1e-6) return dot(r, n) // rayon ∥ normale : projection directe
  const d = dot(n, r)
  const e = dot(d2, r)
  return (b * e - d) / den
}
