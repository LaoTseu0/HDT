// Construction du payload d'un arc d'esquisse à partir d'un tracé (E13-03).
// Module PUR (pas de three, pas de react) → testable seul (sketchArc.test.ts).
//
// Interaction « centre + début + fin » (3 clics, façon SketchUp) :
//   1. clic CENTRE        → origine de l'arc (= centre du cercle support) ;
//   2. clic DÉBUT         → fixe le RAYON et l'angle de départ ;
//   3. clic FIN (curseur) → fixe le BALAYAGE (angle parcouru depuis le départ).
//
// Le balayage est ACCUMULÉ au fil du déplacement (nextSweep) pour franchir ±180°
// (arcs majeurs) sans saut — un simple atan2 du point final plafonnerait à ±180°.
// Coordonnées toujours en (s,t) du plan d'esquisse actif ; reprojetées en monde au
// commit. L'arc est paramétré par { rayon_m, angle_debut_deg, angle_balayage_deg }
// dans le repère u/v du plan (u = X local → s, v = Y local → t).

import { planeToWorld } from '@/core/workPlanes'
import type { PayloadOf, Vec2, WorkFrame } from '@/types'

const RAD2DEG = 180 / Math.PI
export const DEG2RAD = Math.PI / 180

/** Distance centre→point dans le plan (= rayon). */
export function radiusOf(center: Vec2, p: Vec2): number {
  return Math.hypot(p[0] - center[0], p[1] - center[1])
}

/** Angle (rad) du point `p` autour de `center`, dans le plan (s,t). */
export function angleOf(center: Vec2, p: Vec2): number {
  return Math.atan2(p[1] - center[1], p[0] - center[0])
}

/** Ramène un angle dans (-π, π]. */
function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/**
 * Balayage ACCUMULÉ : ajoute au balayage courant le plus petit incrément qui
 * amène l'extrémité de l'arc sur l'angle du curseur. En intégrant les petits pas,
 * le balayage peut croître continûment au-delà de ±180° (arc majeur) et changer
 * de signe selon le sens du mouvement.
 * @param prevSweepRad balayage accumulé jusqu'ici (rad, signé)
 * @param startAngleRad angle de départ fixe (rad)
 * @param cursorAngleRad angle courant du curseur (rad)
 * @returns nouveau balayage accumulé (rad)
 */
export function nextSweep(
  prevSweepRad: number,
  startAngleRad: number,
  cursorAngleRad: number
): number {
  const cur = startAngleRad + prevSweepRad
  return prevSweepRad + wrapPi(cursorAngleRad - cur)
}

/**
 * Payload `{ kind, params, plane }` d'un arc.
 * @param centerST centre (s,t) dans le plan
 * @param r rayon (m)
 * @param startAngleRad angle de départ (rad)
 * @param sweepRad balayage signé (rad)
 * @param frame repère du plan d'esquisse
 * @returns payload prêt pour `createObject`, ou `null` si rayon/balayage nul.
 */
export function arcPayloadFromDraft(
  centerST: Vec2,
  r: number,
  startAngleRad: number,
  sweepRad: number,
  frame: WorkFrame
): PayloadOf<'sketch.arc'> | null {
  if (!(r > 0) || Math.abs(sweepRad) < 1e-4) return null
  const origin = planeToWorld(centerST[0], centerST[1], frame)
  return {
    kind: 'sketch.arc',
    params: {
      rayon_m: Number(r.toFixed(3)),
      angle_debut_deg: Number((startAngleRad * RAD2DEG).toFixed(2)),
      angle_balayage_deg: Number((sweepRad * RAD2DEG).toFixed(2)),
    },
    plane: {
      type: frame.type,
      origin,
      normal: frame.normal,
      u: frame.u,
      v: frame.v,
      ...(frame.faceOf ? { faceOf: frame.faceOf } : {}),
    },
  }
}
