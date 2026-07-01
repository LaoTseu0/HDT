// Construction du payload d'une ouverture (fenêtre) posée sur une face de mur
// (E14-01, cf. docs/edit-mode-design.md § 5.4). Module PUR (pas de three, pas de
// react) → testable seul (script/opening.test.mjs).
//
// Phase 1 de la fenêtre = l'OUVERTURE = le futur vide dans le mur. En E14-01 on ne
// pose que l'objet paramétrique + sa liaison au mur (`plane.faceOf` = node name du
// mur, immuable) ; le vrai trou CSG viendra en E14-02 (recalculé au chargement).
//
// Convention de repère (repris de faceFrame) : `u` = horizontal le long du mur
// (largeur), `v` = vertical (hauteur, vers le haut), `normal` = vers l'extérieur du
// mur. L'ORIGINE du plan est le CENTRE DU SEUIL (bas-milieu) de l'ouverture : la
// géométrie monte de v=0 (allège) à v=hauteur → éditer la hauteur fait grandir
// l'ouverture VERS LE HAUT (seuil fixe), et l'allège = hauteur du seuil au-dessus
// du sol (origin.y, sol supposé à y=0).

// Dimensions par défaut d'une fenêtre posée (m). Modifiables ensuite dans l'inspector.
export const DEFAULT_OPENING = { largeur_m: 1.0, hauteur_m: 1.2 }

/**
 * Payload `{ kind, params, plane }` d'une ouverture posée au point `point` (monde)
 * d'une face de mur de repère `frame`. Le point cliqué devient le CENTRE de
 * l'ouverture : on descend d'une demi-hauteur le long de `v` pour placer le seuil
 * (origin), de sorte que l'ouverture soit centrée verticalement sur le clic.
 * @param {number[]} point point d'impact sur la face (monde)
 * @param {object} frame repère de la face { type, origin, u, v, normal, faceOf? }
 * @returns payload prêt pour `createObject`.
 */
export function openingPayload(point, frame) {
  const H = DEFAULT_OPENING.hauteur_m
  // Seuil = clic − (H/2)·v (reste sur le plan de la face pour un mur vertical).
  const origin = [
    point[0] - frame.v[0] * (H / 2),
    point[1] - frame.v[1] * (H / 2),
    point[2] - frame.v[2] * (H / 2),
  ]
  return {
    kind: 'opening.window',
    params: {
      largeur_m: DEFAULT_OPENING.largeur_m,
      hauteur_m: H,
      allege_m: Number(Math.max(0, origin[1]).toFixed(3)), // hauteur du seuil / sol (y=0)
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
