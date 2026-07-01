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

// Gabarits d'ouverture (E14-04) : dims de départ sélectionnables avant la pose,
// modifiables ensuite par instance dans l'inspector (comme les dims par défaut
// d'avant E14-04, inchangées ici sous le nom `classique`).
export const OPENING_PRESETS = {
  classique: { largeur_m: 1.0, hauteur_m: 1.2 },
  large: { largeur_m: 1.6, hauteur_m: 1.4 },
  etroite: { largeur_m: 0.6, hauteur_m: 1.0 },
}
export const DEFAULT_OPENING_PRESET = 'classique'

// Dimensions par défaut d'une fenêtre posée (m). Modifiables ensuite dans l'inspector.
export const DEFAULT_OPENING = OPENING_PRESETS[DEFAULT_OPENING_PRESET]

/**
 * Payload `{ kind, params, plane }` d'une ouverture posée au point `point` (monde)
 * d'une face de mur de repère `frame`. Le point cliqué devient le CENTRE de
 * l'ouverture : on descend d'une demi-hauteur le long de `v` pour placer le seuil
 * (origin), de sorte que l'ouverture soit centrée verticalement sur le clic.
 * @param {number[]} point point d'impact sur la face (monde)
 * @param {object} frame repère de la face { type, origin, u, v, normal, faceOf? }
 * @param {{largeur_m:number, hauteur_m:number}} [dims] gabarit de départ (E14-04,
 *   défaut `classique`) ; l'utilisateur peut ensuite l'ajuster dans l'inspector.
 * @returns payload prêt pour `createObject`.
 */
export function openingPayload(point, frame, dims = DEFAULT_OPENING) {
  const H = dims.hauteur_m
  // Seuil = clic − (H/2)·v (reste sur le plan de la face pour un mur vertical).
  const origin = [
    point[0] - frame.v[0] * (H / 2),
    point[1] - frame.v[1] * (H / 2),
    point[2] - frame.v[2] * (H / 2),
  ]
  return {
    kind: 'opening.window',
    params: {
      largeur_m: dims.largeur_m,
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
