// Vanne INLINE insérée sur un tuyau (E16-04, plomberie, cf.
// docs/edit-mode-design.md § 5.3). Module PUR (maths sur tableaux [x,y,z], pas
// de three, pas de react) → testable seul (valve.test.ts).
//
// Principe : cliquer un tuyau avec l'outil Vanne projette le point cliqué sur
// l'axe RENDU du run (pente d'évacuation comprise, E16-02), COUPE le run en deux
// tronçons au point de coupe et insère un objet `plomberie.valve` paramétrique
// (kind au registre → ré-éditable, round-trip GLB générique). L'opération est
// atomique côté store (une seule entrée d'historique : undo restaure le tuyau
// entier).
//
// Les deux tronçons se touchent extrémité contre extrémité → les raccords
// automatiques (E16-03) y verraient un « manchon » ; il est SUPPRIMÉ sous la
// vanne (la vanne EST le raccord, cf. dropFittingsAtValves). Supprimer la vanne
// fait réapparaître le manchon gratuitement : les tronçons restent raccordés.

import { closestOnPath, dedupePath, dist, runMesh, type RawMesh } from './routing'
import { PIPE_KIND, slopedPoints } from './plumbing'
import type {
  AppObject,
  PayloadOf,
  PipeParams,
  SizedParams,
  ValveParams,
  Vec3,
} from '@/types'
import type { Fitting } from './fittings'

export const VALVE_KIND = 'plomberie.valve' as const

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
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const round = (x: number) => Number(Number(x).toFixed(4))
const roundPt = (p: Vec3): Vec3 => [round(p[0]), round(p[1]), round(p[2])]

/** Échelle de la section du corps de vanne vs celle du tuyau (collier). */
export const VALVE_OVERSIZE = 1.8
/** Longueur du corps = VALVE_BODY_FACTOR × plus grand côté de la section. */
export const VALVE_BODY_FACTOR = 2.4
/** Longueur minimale du corps (m) — lisible même sur du cuivre Ø12. */
export const VALVE_BODY_MIN = 0.05

const maxSide = (params: SizedParams | null | undefined) =>
  Math.max(Number(params?.largeur_m) || 0, Number(params?.hauteur_m) || 0)

/** Longueur du corps d'une vanne (m) depuis ses params (section du tuyau hôte). */
export function valveBodyLength(params: SizedParams | null | undefined): number {
  return Math.max(VALVE_BODY_FACTOR * maxSide(params), VALVE_BODY_MIN)
}

/** Résultat de coupe : payload de la vanne + params des deux tronçons. */
export interface PipeSplit {
  valve: PayloadOf<'plomberie.valve'>
  runs: PipeParams[]
}

/**
 * Coupe un tuyau au point (monde) le plus proche de `worldPoint` sur son axe
 * RENDU (pente comprise) : renvoie le payload de la VANNE et les params des DEUX
 * tronçons — ou `null` si la coupe tombe (quasi) sur une extrémité du run (un
 * tronçon serait dégénéré).
 *
 * Pente (E16-02) NON destructive préservée : la coupe est interpolée sur les
 * CLICS (`params.points`) au même paramètre `t` que sur l'axe pentu ; le tronçon
 * AVAL est abaissé de la chute déjà accumulée à la coupe pour que son rendu
 * pentu (qui repart de son 1er point) prolonge exactement l'original.
 * @param pipe objet app tuyau
 * @param worldPoint point cliqué (monde, sur la surface du tuyau)
 */
export function splitPipeAt(
  pipe: AppObject | null | undefined,
  worldPoint: Vec3
): PipeSplit | null {
  if (pipe?.kind !== PIPE_KIND) return null
  const params = pipe.params
  const pts = params.points ?? []
  if (pts.length < 2) return null

  const rendered = slopedPoints(params)
  const hit = closestOnPath(rendered, worldPoint)
  if (!hit) return null

  // Coupe sur les CLICS au même paramètre t (la pente ne décale que les y des
  // sommets → la paramétrisation des segments est partagée).
  const cut = lerp(pts[hit.seg]!, pts[hit.seg + 1]!, hit.t)
  // Chute de pente déjà accumulée à la coupe (0 si run sans pente).
  const drop = cut[1] - hit.point[1]

  const before = dedupePath([...pts.slice(0, hit.seg + 1), cut])
  const lower = ([x, y, z]: Vec3): Vec3 => [x, round(y - drop), z]
  const after = dedupePath([cut, ...pts.slice(hit.seg + 1)].map(lower))
  // Coupe sur une extrémité du run → un tronçon dégénéré : on refuse.
  if (before.length < 2 || after.length < 2) return null

  const dir = norm(sub(rendered[hit.seg + 1]!, rendered[hit.seg]!))
  const centre = roundPt(hit.point)

  return {
    valve: {
      kind: VALVE_KIND,
      params: {
        centre,
        dir: roundPt(dir),
        largeur_m: params.largeur_m,
        hauteur_m: params.hauteur_m,
        diametre_mm: params.diametre_mm,
        famille: params.famille,
        section: params.section,
      },
      // Nominal, comme les runs : la vanne vit en coordonnées MONDE.
      plane: {
        type: 'run',
        origin: centre,
        u: [1, 0, 0],
        v: [0, 1, 0],
        normal: [0, 0, 1],
      },
    },
    runs: [
      { ...params, points: before.map(roundPt) },
      { ...params, points: after.map(roundPt) },
    ],
  }
}

// Repère du corps : « up » de référence vertical (comme sectionBasis du balayage,
// routing) → la tige de manœuvre monte au-dessus du tuyau ; repli sur X
// quand l'axe est ~vertical.
function valveBasis(dir: Vec3): { axis: Vec3; up: Vec3 } {
  let t = norm(dir)
  if (Math.hypot(...t) < 1e-9) t = [0, 0, 1]
  let up: Vec3 = [0, 1, 0]
  if (Math.abs(dot(t, up)) > 0.99) up = [1, 0, 0]
  const right = norm(cross(t, up))
  const realUp = norm(cross(right, t))
  return { axis: t, up: realUp }
}

/**
 * Maillage d'une vanne : corps sur-dimensionné le long de l'axe du tuyau + tige
 * de manœuvre perpendiculaire + poignée (levier parallèle à l'axe) — chaque
 * pièce est un mini-run de 2 points (runMesh, routing, même esthétique
 * low-poly que runs et raccords). Tableaux plats prêts pour un BufferGeometry.
 */
export function valveMesh(params: Partial<ValveParams> | null | undefined): RawMesh {
  const c = params?.centre ?? [0, 0, 0]
  const { axis, up } = valveBasis(params?.dir ?? [0, 0, 1])
  const side = Math.max(maxSide(params), 1e-3)
  const bodyLen = valveBodyLength(params)
  const bodySide = side * VALVE_OVERSIZE
  const stemLen = Math.max(1.2 * side, 0.04)
  const stemSide = Math.max(0.35 * bodySide, 0.008)
  const handleLen = Math.max(bodySide, 0.04) // levier ≤ corps (lisible sans déborder)

  const half = (v: Vec3, l: number) => scale(v, l / 2)
  const top = add(c, scale(up, bodySide / 2 + stemLen))
  const pieces = [
    // Corps : le long de l'axe du tuyau, centré sur la coupe.
    { a: sub(c, half(axis, bodyLen)), b: add(c, half(axis, bodyLen)), side: bodySide },
    // Tige : du centre vers le haut du corps.
    { a: c, b: top, side: stemSide },
    // Poignée : levier parallèle à l'axe, posé sur la tige.
    {
      a: sub(top, half(axis, handleLen)),
      b: add(top, half(axis, handleLen)),
      side: stemSide,
    },
  ]

  const position: number[] = []
  const index: number[] = []
  for (const p of pieces) {
    const m = runMesh([p.a, p.b], { largeur_m: p.side, hauteur_m: p.side })
    const offset = position.length / 3
    position.push(...m.position)
    for (const i of m.index) index.push(offset + i)
  }
  return { position, index }
}

/**
 * Filtre les raccords automatiques (E16-03) tombant SOUS une vanne : la jonction
 * extrémité-contre-extrémité des deux tronçons coupés produirait un « manchon »
 * superflu au point de coupe (la vanne est le raccord). Tolérance = demi-corps.
 * @param fittings sortie de detectFittings
 * @param valves objets vanne
 * @returns raccords conservés
 */
export function dropFittingsAtValves(
  fittings: Fitting[] | null | undefined,
  valves: Array<{ params: Partial<ValveParams> }> | null | undefined
): Fitting[] {
  const list = valves ?? []
  if (!list.length) return fittings ?? []
  return (fittings ?? []).filter(
    (f) =>
      !list.some(
        (v) =>
          v.params?.centre &&
          dist(f.point, v.params.centre) <= valveBodyLength(v.params) / 2
      )
  )
}

/** Un objet app est-il coupable par l'outil Vanne ? (tuyau routé valide) */
export function isValvablePipe(obj: AppObject | null | undefined): boolean {
  return obj?.kind === PIPE_KIND && (obj.params?.points?.length ?? 0) >= 2
}
