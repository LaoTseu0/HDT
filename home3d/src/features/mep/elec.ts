// Composants électriques PONCTUELS (catégorie ① « ponctuel », E15-01/02, cf.
// docs/edit-mode-design.md § 4) posés sur une face de mur, façon openings/opening.
// Module PUR (pas de three, pas de react) → testable seul (elec.test.ts).
//
// Un composant élec est un petit mesh catalogue déposé sur la face survolée d'un
// mur, qu'il référence par node name (`plane.faceOf`, immuable). L'ORIGINE du plan
// est le CENTRE du composant sur la face : la géométrie (registre `generateElec`)
// est centrée dessus et ressort le long de la normale (extérieur du mur). Réutilise
// le plan d'esquisse contextuel (E12-02) et le snapping (E12-03) déjà en place —
// aucun booléen. La menuiserie des fenêtres (E14 ph.2) et les valves (E16) poseront
// leurs composants par la même machinerie.
//
// Convention de repère (repris de faceFrame) : `u` = horizontal le long du mur
// (largeur), `v` = vertical (hauteur), `normal` = vers l'extérieur. La hauteur du
// composant au-dessus du sol = `plane.origin[1]` (sol supposé à y=0), réglable
// ensuite dans l'inspector.

import type { ElecComponentKind, ElecParams, PayloadOf, Vec3, WorkFrame } from '@/types'

/** Entrée du catalogue élec : libellé UI, segment de nommage, emprise. */
export interface ElecComponentSpec {
  label: string
  type: string
  dims: ElecParams
}

// Catalogue des composants (dims en mètres, emprise réaliste). `type` = segment de
// nommage (`elec__<type>__…`, conforme à la regex `[a-z0-9_]+`).
export const ELEC_COMPONENTS: Record<ElecComponentKind, ElecComponentSpec> = {
  'elec.outlet': {
    label: 'Prise',
    type: 'prise',
    dims: { largeur_m: 0.08, hauteur_m: 0.08, profondeur_m: 0.03 },
  },
  'elec.switch': {
    label: 'Interrupteur',
    type: 'interrupteur',
    dims: { largeur_m: 0.08, hauteur_m: 0.08, profondeur_m: 0.03 },
  },
  'elec.junction': {
    label: 'Boîte de dérivation',
    type: 'boite_derivation',
    dims: { largeur_m: 0.1, hauteur_m: 0.1, profondeur_m: 0.05 },
  },
  'elec.meter': {
    label: 'Compteur',
    type: 'compteur',
    dims: { largeur_m: 0.4, hauteur_m: 0.6, profondeur_m: 0.18 },
  },
}

export const ELEC_KINDS = Object.keys(ELEC_COMPONENTS) as ElecComponentKind[]
export const DEFAULT_ELEC_KIND: ElecComponentKind = 'elec.outlet'

/** Vrai si `kind` est un composant élec ponctuel du catalogue. */
export function isElecKind(kind: string | null | undefined): kind is ElecComponentKind {
  return typeof kind === 'string' && kind in ELEC_COMPONENTS
}

/**
 * Payload `{ kind, params, plane }` d'un composant élec posé au point `point`
 * (monde) d'une face de mur de repère `frame`. Le point cliqué devient le CENTRE
 * du composant ; l'objet référence le mur par `frame.faceOf` (immuable).
 * @param point point d'impact sur la face (monde)
 * @param frame repère de la face { type, origin, u, v, normal, faceOf? }
 * @param kind composant du catalogue (défaut = prise)
 * @returns payload prêt pour `createObject`.
 */
export function elecPayload(
  point: Vec3,
  frame: WorkFrame,
  kind: string = DEFAULT_ELEC_KIND
): PayloadOf<ElecComponentKind> {
  const validKind = isElecKind(kind) ? kind : DEFAULT_ELEC_KIND
  const comp = ELEC_COMPONENTS[validKind]
  return {
    kind: validKind,
    params: { ...comp.dims },
    plane: {
      type: frame.type,
      origin: [point[0], point[1], point[2]],
      normal: frame.normal,
      u: frame.u,
      v: frame.v,
      ...(frame.faceOf ? { faceOf: frame.faceOf } : {}),
    },
  }
}
