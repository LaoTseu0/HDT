// Choix de l'axe d'extrusion pour le Push/Pull (E12-08), extrait d'EditObjects
// (étape A du découpage). La logique RISQUÉE et branchue (cas de l'arc, choix de
// l'axe par produit scalaire dominant, signe, sens sortant) est isolée ici en
// fonction PURE — `pickExtrudeAxis` — testable sans mocker d'évènement three.js.
// L'adaptateur `pickPushAxis` ne fait que l'I/O three (event → normale monde).

import { Vector3 } from 'three'
import type { Object3D } from 'three'
import type { Vec3 } from '@/types'

const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Cote paramétrique que le Push/Pull modifie selon l'axe choisi. */
export type ExtrudeParamKey = 'largeur_m' | 'profondeur_m' | 'hauteur_m'

export interface ExtrudeAxis {
  /** Axe du repère de l'objet (u/v/normal) le long duquel on tire. */
  vec: Vec3
  /** Cote paramétrique associée à cet axe. */
  key: ExtrudeParamKey
  /** Face opposée fixe : l'extrusion ancre le côté opposé (ex. hauteur). */
  anchored: boolean
  /** Sens du tir : +1 si la face pointe dans le sens de l'axe, −1 sinon. */
  sign: 1 | -1
  /**
   * Direction sortante = `vec × sign`. NOTE : redondant — `useAxisDrag`
   * recalcule `outward` depuis `axisVec`+`sign` et personne ne lit ce champ.
   * Conservé pour parité de comportement (étape A) ; candidat à retrait.
   */
  outward: Vec3
}

/** Repère local d'un objet ; défauts = sol (u=X, v=−Z, n=Y). */
interface PlaneBasis {
  u?: Vec3
  v?: Vec3
  normal?: Vec3
}

interface AxisSpec {
  vec: Vec3
  key: ExtrudeParamKey
  anchored: boolean
}

/**
 * Face cliquée (via sa normale MONDE) → axe du repère (u/v/normal) le plus
 * aligné, et de quel côté (signe). Détermine quelle cote le Push/Pull modifie
 * (largeur/profondeur/hauteur) et l'ancrage de la face opposée (E12-08).
 *
 * L'arc n'a pas de cotes u/v (courbe ouverte) : seule l'extrusion le long de la
 * normale (mur courbe) a un sens → on restreint le Push/Pull à `hauteur_m`.
 *
 * Fonction PURE : aucune dépendance three, entièrement déterministe.
 */
export function pickExtrudeAxis(
  plane: PlaneBasis | null | undefined,
  kind: string,
  faceNormalWorld: Vec3
): ExtrudeAxis {
  const u = plane?.u ?? [1, 0, 0]
  const v = plane?.v ?? [0, 0, -1]
  const n = plane?.normal ?? [0, 1, 0]

  // Défaut = axe normal si aucun axe n'est plus aligné (dernier de la liste).
  const normalAxis: AxisSpec = { vec: n, key: 'hauteur_m', anchored: true }
  const axes: AxisSpec[] =
    kind === 'sketch.arc'
      ? [normalAxis]
      : [
          { vec: u, key: 'largeur_m', anchored: false },
          { vec: v, key: 'profondeur_m', anchored: false },
          normalAxis,
        ]

  let best: AxisSpec = normalAxis
  let bestDot = 0
  for (const a of axes) {
    const d = dot3(faceNormalWorld, a.vec)
    if (Math.abs(d) > Math.abs(bestDot)) {
      bestDot = d
      best = a
    }
  }
  const sign: 1 | -1 = bestDot >= 0 ? 1 : -1
  return {
    ...best,
    sign,
    outward: [best.vec[0] * sign, best.vec[1] * sign, best.vec[2] * sign],
  }
}

/** Intersection three.js portant (peut-être) une face touchée. */
interface FaceHitLike {
  face?: { normal: Vector3 } | null
  object?: Object3D
}

/** Évènement pointer r3f, réduit aux champs utiles au Push/Pull. */
export interface PushEvent extends FaceHitLike {
  intersections?: FaceHitLike[]
}

/**
 * Normale MONDE de la face touchée par l'évènement : `event.face` direct, sinon
 * 1re intersection portant une face (robuste si une géométrie sans face traîne
 * devant). À défaut, `fallback` (la normale du plan de l'objet).
 */
function faceNormalFromEvent(event: PushEvent, fallback: Vec3): Vec3 {
  const faceHit: FaceHitLike | undefined = event.face
    ? event
    : event.intersections?.find((i) => i.face)
  if (faceHit?.face && faceHit.object) {
    const wn = faceHit.face.normal
      .clone()
      .transformDirection(faceHit.object.matrixWorld)
      .normalize()
    return [wn.x, wn.y, wn.z]
  }
  return fallback
}

/** Objet extrudable : repère local + kind (pour le cas arc). */
export interface ExtrudableObject {
  kind: string
  plane?: PlaneBasis | null
}

/**
 * Adaptateur I/O : résout la normale monde depuis l'évènement three puis délègue
 * à `pickExtrudeAxis`. Conserve l'API d'origine appelée par EditObjects.
 */
export function pickPushAxis(obj: ExtrudableObject, event: PushEvent): ExtrudeAxis {
  const fallback = obj.plane?.normal ?? [0, 1, 0]
  return pickExtrudeAxis(obj.plane, obj.kind, faceNormalFromEvent(event, fallback))
}
