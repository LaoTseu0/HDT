// Menuiserie (cadre + vitrage) posée DANS une ouverture existante (E14-05, cf.
// docs/edit-mode-design.md § 5.4 phase 2). Module PUR (pas de three, pas de
// react) → testable seul (script/joinery.test.mjs).
//
// Une menuiserie est un COMPOSANT POSÉ (catégorie ① du § 4), pas un booléen :
// elle réutilise la machinerie de pose des composants élec (E15-01) et se loge
// dans le vide déjà creusé par l'ouverture (E14-02). À la pose, elle est AJUSTÉE
// aux dims de l'ouverture hôte (largeur/hauteur copiées) et reprend son plan
// (origin = CENTRE DU SEUIL, u horizontal, v vertical, normal vers l'extérieur).
//
// Liaison : `plane.hostOf` = node name de l'ouverture hôte. Le node name dérivé
// est aussi l'id de l'objet après un round-trip GLB (loadModel re-clé les objets
// app sur leur node name exporté) → la liaison survit au ré-export/rechargement.
// Informationnelle en E14-05 (affichage inspector + garde « un cadre par
// ouverture ») ; les variantes (E14-06) pourront s'y appuyer.

export const JOINERY_KIND = 'joinery.frame'

// Profil de cadre par défaut (m) : section des montants/traverses (epaisseur_m)
// et profondeur du dormant le long de la normale (profondeur_m). Modifiables
// ensuite par instance dans l'inspector.
export const DEFAULT_JOINERY = { epaisseur_m: 0.06, profondeur_m: 0.08 }

// Variantes de menuiserie (E14-06), façon catalogue élec (lib/elec) : la variante
// est un PARAM d'instance (`params.variante`) — le kind, le nommage
// (`ouvertures__menuiserie__…`) et l'emprise (largeur/hauteur copiées de l'hôte)
// ne changent pas, seule la géométrie générée diffère (meneau, vantaux sur
// rails…). Sélectionnable avant la pose (sous-barre) ET modifiable ensuite par
// instance dans l'inspector. `fixe` = le rendu d'E14-05 (rétro-compat : les
// menuiseries sans `variante` — GLB antérieurs — sont rendues en fixe).
export const JOINERY_VARIANTS = {
  fixe: { label: 'Fixe', hint: 'vitrage plein, sans vantail' },
  battant: { label: 'Battant', hint: '2 vantaux, meneau central' },
  coulissant: { label: 'Coulissant', hint: '2 vantaux sur rails décalés' },
}

export const JOINERY_VARIANT_KEYS = Object.keys(JOINERY_VARIANTS)
export const DEFAULT_JOINERY_VARIANT = 'fixe'

/** Variante valide du catalogue, avec repli sur la variante par défaut. */
export function joineryVariantOf(variante) {
  return variante in JOINERY_VARIANTS ? variante : DEFAULT_JOINERY_VARIANT
}

/** Vrai si `kind` est une menuiserie. */
export function isJoineryKind(kind) {
  return kind === JOINERY_KIND
}

/**
 * Payload `{ kind, params, plane }` d'une menuiserie ajustée à une ouverture.
 * @param {object} opening objet app hôte (kind `opening.window`)
 * @param {string} hostName node name de l'ouverture (dérivé via lib/naming)
 * @param {string} [variante] variante du catalogue (E14-06, défaut `fixe`)
 * @returns payload prêt pour `createObject`, ou null si l'hôte n'est pas une ouverture.
 */
export function joineryPayloadFromOpening(opening, hostName, variante = DEFAULT_JOINERY_VARIANT) {
  if (opening?.kind !== 'opening.window') return null
  const p = opening.plane ?? {}
  return {
    kind: JOINERY_KIND,
    params: {
      largeur_m: Number(opening.params.largeur_m) || 0,
      hauteur_m: Number(opening.params.hauteur_m) || 0,
      ...DEFAULT_JOINERY,
      variante: joineryVariantOf(variante),
    },
    // Plan copié PAR VALEUR (pas de partage de tableaux avec l'hôte).
    plane: {
      type: p.type,
      origin: [...(p.origin ?? [0, 0, 0])],
      u: [...(p.u ?? [1, 0, 0])],
      v: [...(p.v ?? [0, 1, 0])],
      normal: [...(p.normal ?? [0, 0, 1])],
      ...(p.faceOf ? { faceOf: p.faceOf } : {}),
      hostOf: hostName,
    },
  }
}

/**
 * Menuiserie déjà posée dans l'ouverture `hostName`, ou null. Garde « un cadre
 * par ouverture » : re-cliquer une ouverture équipée sélectionne l'existant.
 */
export function findJoinery(objects, hostName) {
  for (const o of Object.values(objects ?? {})) {
    if (o.kind === JOINERY_KIND && o.plane?.hostOf === hostName) return o
  }
  return null
}
