// Construction du payload d'un cercle d'esquisse à partir d'un tracé (E13-02).
// Pendant pareille à sketchRect : extrait pour être partagé entre le glissé
// souris et la validation au clavier (VCB rayon, E12-04 — commitDraft du store).

import { planeToWorld } from './workPlanes.js'

/**
 * Payload `{ kind, params, plane }` d'un cercle depuis le centre (s,t) et un
 * point du bord (s,t) du tracé sur le plan d'esquisse actif. `origin` = CENTRE ;
 * le rayon est la distance centre→bord dans le plan.
 * @returns payload prêt pour `createObject`, ou `null` si le rayon est nul.
 */
export function circlePayloadFromDraft(center, edge, frame) {
  const r = Math.hypot(edge[0] - center[0], edge[1] - center[1])
  if (r <= 0) return null
  const c = planeToWorld(center[0], center[1], frame)
  return {
    kind: 'sketch.circle',
    params: { rayon_m: Number(r.toFixed(3)) },
    plane: {
      type: frame.type,
      origin: c,
      normal: frame.normal,
      u: frame.u,
      v: frame.v,
      ...(frame.faceOf ? { faceOf: frame.faceOf } : {}),
    },
  }
}
