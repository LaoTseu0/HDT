// Construction du payload d'un rectangle d'esquisse à partir d'un tracé (E13-01).
// Extrait de EditObjects.onPointerUp pour être partagé entre le glissé souris et
// la validation au clavier (VCB, E12-04 — commitDraft du store).

import { planeToWorld } from '@/core/workPlanes'
import type { PayloadOf, Vec2, WorkFrame } from '@/types'

// En deçà, un glissé est ignoré (clic accidentel). Une cote tapée à la VCB est
// délibérée → cette garde ne s'applique pas à la saisie clavier.
export const MIN_SIZE = 0.05 // m

/**
 * Payload `{ kind, params, plane }` d'un rectangle depuis les coins (s,t) du
 * tracé sur le plan d'esquisse actif. `origin` = CENTRE de la forme ; le repère
 * (u/v/normal) fige l'orientation.
 * @returns payload prêt pour `createObject`, ou `null` si une cote est nulle.
 */
export function rectPayloadFromDraft(
  start: Vec2,
  current: Vec2,
  frame: WorkFrame
): PayloadOf<'sketch.rect'> | null {
  const w = Math.abs(current[0] - start[0])
  const depth = Math.abs(current[1] - start[1])
  if (w <= 0 || depth <= 0) return null
  const sc = (start[0] + current[0]) / 2
  const tc = (start[1] + current[1]) / 2
  const center = planeToWorld(sc, tc, frame)
  return {
    kind: 'sketch.rect',
    params: { largeur_m: Number(w.toFixed(3)), profondeur_m: Number(depth.toFixed(3)) },
    plane: {
      type: frame.type,
      origin: center,
      normal: frame.normal,
      u: frame.u,
      v: frame.v,
      ...(frame.faceOf ? { faceOf: frame.faceOf } : {}),
    },
  }
}
