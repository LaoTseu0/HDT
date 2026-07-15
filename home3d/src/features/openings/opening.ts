// Construction du payload d'une ouverture (fenêtre) posée sur une face de mur
// (E14-01, cf. docs/edit-mode-design.md § 5.4). Module PUR (pas de three, pas de
// react) → testable seul (opening.test.ts).
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

import type { Kind, PayloadOf, Vec3, WorkFrame } from '@/types'

// Les deux kinds d'ouverture (E14-07) : la porte réemploie TOUTE la machinerie
// de la fenêtre (pose sur face, liaison faceOf, CSG WallCutter) ; seules
// diffèrent la position du seuil (AU SOL, pas d'allège) et le nommage (porte).
export const WINDOW_KIND = 'opening.window' as const
export const DOOR_KIND = 'opening.door' as const

/** Vrai si `kind` est une ouverture (fenêtre OU porte) — creuse le mur (CSG). */
export function isOpeningKind(
  kind: Kind | string | null | undefined
): kind is typeof WINDOW_KIND | typeof DOOR_KIND {
  return kind === WINDOW_KIND || kind === DOOR_KIND
}

/** Gabarit de dimensions d'une ouverture (départ, modifiable par instance). */
export interface OpeningDims {
  largeur_m: number
  hauteur_m: number
}

// Gabarits d'ouverture (E14-04) : dims de départ sélectionnables avant la pose,
// modifiables ensuite par instance dans l'inspector (comme les dims par défaut
// d'avant E14-04, inchangées ici sous le nom `classique`).
export const OPENING_PRESETS: Record<string, OpeningDims> = {
  classique: { largeur_m: 1.0, hauteur_m: 1.2 },
  large: { largeur_m: 1.6, hauteur_m: 1.4 },
  etroite: { largeur_m: 0.6, hauteur_m: 1.0 },
}
export const DEFAULT_OPENING_PRESET = 'classique'

// Dimensions par défaut d'une fenêtre posée (m). Modifiables ensuite dans l'inspector.
export const DEFAULT_OPENING = OPENING_PRESETS[DEFAULT_OPENING_PRESET]!

/**
 * Payload `{ kind, params, plane }` d'une ouverture posée au point `point` (monde)
 * d'une face de mur de repère `frame`. Le point cliqué devient le CENTRE de
 * l'ouverture : on descend d'une demi-hauteur le long de `v` pour placer le seuil
 * (origin), de sorte que l'ouverture soit centrée verticalement sur le clic.
 * @param point point d'impact sur la face (monde)
 * @param frame repère de la face { type, origin, u, v, normal, faceOf? }
 * @param dims gabarit de départ (E14-04, défaut `classique`) ; l'utilisateur peut
 *   ensuite l'ajuster dans l'inspector.
 * @returns payload prêt pour `createObject`.
 */
export function openingPayload(
  point: Vec3,
  frame: WorkFrame,
  dims: OpeningDims = DEFAULT_OPENING
): PayloadOf<'opening.window'> {
  const H = dims.hauteur_m
  // Seuil = clic − (H/2)·v (reste sur le plan de la face pour un mur vertical).
  const origin: Vec3 = [
    point[0] - frame.v[0] * (H / 2),
    point[1] - frame.v[1] * (H / 2),
    point[2] - frame.v[2] * (H / 2),
  ]
  return {
    kind: WINDOW_KIND,
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

// Gabarits de porte (E14-07) : passages standards FR, modifiables ensuite par
// instance dans l'inspector (largeur/hauteur, comme la fenêtre).
export const DOOR_PRESETS: Record<string, OpeningDims> = {
  simple: { largeur_m: 0.9, hauteur_m: 2.15 },
  double: { largeur_m: 1.4, hauteur_m: 2.15 },
  etroite: { largeur_m: 0.73, hauteur_m: 2.04 },
}
export const DEFAULT_DOOR_PRESET = 'simple'

/**
 * Payload `{ kind, params, plane }` d'une PORTE posée au point `point` (monde)
 * d'une face de mur de repère `frame`. Même mécanique que `openingPayload`,
 * mais le seuil est posé AU SOL (y=0, convention du projet — cf. allège E14-01
 * et hauteur/sol E15-01) : on descend le long de `v` jusqu'à y=0, en restant
 * sur le plan de la face. Pas de param `allege_m` (une porte n'en a pas).
 * Face non verticale (|v.y| trop faible) → repli « centré sur le clic » comme
 * la fenêtre (une porte sur un plafond n'a de toute façon pas de sol).
 * @param point point d'impact sur la face (monde)
 * @param frame repère de la face { type, origin, u, v, normal, faceOf? }
 * @param dims gabarit (E14-07, défaut `simple`)
 * @returns payload prêt pour `createObject`.
 */
export function doorPayload(
  point: Vec3,
  frame: WorkFrame,
  dims: OpeningDims = DOOR_PRESETS[DEFAULT_DOOR_PRESET]!
): PayloadOf<'opening.door'> {
  const H = dims.hauteur_m
  // Descente au sol le long de v : t tel que (point − t·v).y = 0.
  const vy = frame.v[1]
  const t = Math.abs(vy) > 0.5 ? point[1] / vy : H / 2
  const origin: Vec3 = [
    point[0] - frame.v[0] * t,
    point[1] - frame.v[1] * t,
    point[2] - frame.v[2] * t,
  ]
  return {
    kind: DOOR_KIND,
    params: {
      largeur_m: dims.largeur_m,
      hauteur_m: H,
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
