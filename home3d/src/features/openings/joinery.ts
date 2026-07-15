// Menuiserie (cadre + vitrage) posée DANS une ouverture existante (E14-05, cf.
// docs/edit-mode-design.md § 5.4 phase 2). Module PUR (pas de three, pas de
// react) → testable seul (joinery.test.ts).
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

import { DOOR_KIND, WINDOW_KIND } from './opening'
import type {
  AppObject,
  JoineryVariant,
  Kind,
  ObjectsTable,
  PayloadOf,
  Vec3,
} from '@/types'

export const JOINERY_KIND = 'joinery.frame' as const

// Vantail de porte (E14-07) : le composant hébergé dans une ouverture PORTE,
// même mécanique que le cadre de fenêtre (catégorie ①, aucun booléen) — le kind
// diffère car la géométrie (dormant 3 côtés + panneau plein + poignée) et le
// nommage (`ouvertures__vantail__…`) diffèrent.
export const DOOR_LEAF_KIND = 'door.leaf' as const

/** Vrai si `kind` est un composant hébergé dans une ouverture (cadre ou vantail). */
export function isHostedKind(
  kind: Kind | string | null | undefined
): kind is typeof JOINERY_KIND | typeof DOOR_LEAF_KIND {
  return kind === JOINERY_KIND || kind === DOOR_LEAF_KIND
}

// Profil de cadre par défaut (m) : section des montants/traverses (epaisseur_m)
// et profondeur du dormant le long de la normale (profondeur_m). Modifiables
// ensuite par instance dans l'inspector.
export const DEFAULT_JOINERY = { epaisseur_m: 0.06, profondeur_m: 0.08 }

// Variantes de menuiserie (E14-06), façon catalogue élec (mep/elec) : la variante
// est un PARAM d'instance (`params.variante`) — le kind, le nommage
// (`ouvertures__menuiserie__…`) et l'emprise (largeur/hauteur copiées de l'hôte)
// ne changent pas, seule la géométrie générée diffère (meneau, vantaux sur
// rails…). Sélectionnable avant la pose (sous-barre) ET modifiable ensuite par
// instance dans l'inspector. `fixe` = le rendu d'E14-05 (rétro-compat : les
// menuiseries sans `variante` — GLB antérieurs — sont rendues en fixe).
export const JOINERY_VARIANTS: Record<JoineryVariant, { label: string; hint: string }> = {
  fixe: { label: 'Fixe', hint: 'vitrage plein, sans vantail' },
  battant: { label: 'Battant', hint: '2 vantaux, meneau central' },
  coulissant: { label: 'Coulissant', hint: '2 vantaux sur rails décalés' },
}

export const JOINERY_VARIANT_KEYS = Object.keys(JOINERY_VARIANTS) as JoineryVariant[]
export const DEFAULT_JOINERY_VARIANT: JoineryVariant = 'fixe'

/** Variante valide du catalogue, avec repli sur la variante par défaut. */
export function joineryVariantOf(variante: string | null | undefined): JoineryVariant {
  return typeof variante === 'string' && variante in JOINERY_VARIANTS
    ? (variante as JoineryVariant)
    : DEFAULT_JOINERY_VARIANT
}

/** Vrai si `kind` est une menuiserie. */
export function isJoineryKind(
  kind: Kind | string | null | undefined
): kind is typeof JOINERY_KIND {
  return kind === JOINERY_KIND
}

/**
 * Payload `{ kind, params, plane }` du composant qui équipe une ouverture :
 * cadre + vitrage (`joinery.frame`) dans une FENÊTRE, vantail (`door.leaf`)
 * dans une PORTE (E14-07) — le module choisit selon le kind de l'hôte.
 * @param opening objet app hôte (kind `opening.window` ou `opening.door`)
 * @param hostName node name de l'ouverture (dérivé via core/naming)
 * @param variante variante du catalogue (E14-06, fenêtre seulement)
 * @returns payload prêt pour `createObject`, ou null si l'hôte n'est pas une ouverture.
 */
export function joineryPayloadFromOpening(
  opening: AppObject | null | undefined,
  hostName: string,
  variante: string = DEFAULT_JOINERY_VARIANT
): PayloadOf<'joinery.frame' | 'door.leaf'> | null {
  // Comparaisons littérales (pas isOpeningKind) : seul le narrowing direct du
  // discriminant propage le type des params à travers l'union.
  if (!opening || (opening.kind !== WINDOW_KIND && opening.kind !== DOOR_KIND))
    return null
  const p = opening.plane ?? {}
  const door = opening.kind === DOOR_KIND
  const base = {
    largeur_m: Number(opening.params.largeur_m) || 0,
    hauteur_m: Number(opening.params.hauteur_m) || 0,
    ...DEFAULT_JOINERY,
  }
  // Plan copié PAR VALEUR (pas de partage de tableaux avec l'hôte).
  const plane = {
    type: p.type,
    origin: [...(p.origin ?? [0, 0, 0])] as Vec3,
    u: [...(p.u ?? [1, 0, 0])] as Vec3,
    v: [...(p.v ?? [0, 1, 0])] as Vec3,
    normal: [...(p.normal ?? [0, 0, 1])] as Vec3,
    ...(p.faceOf ? { faceOf: p.faceOf } : {}),
    hostOf: hostName,
  }
  // La variante (fixe/battant/coulissant) est propre aux fenêtres.
  return door
    ? { kind: DOOR_LEAF_KIND, params: base, plane }
    : {
        kind: JOINERY_KIND,
        params: { ...base, variante: joineryVariantOf(variante) },
        plane,
      }
}

/**
 * Composant (cadre OU vantail) déjà posé dans l'ouverture `hostName`, ou null.
 * Garde « un composant par ouverture » : re-cliquer une ouverture équipée
 * sélectionne l'existant.
 */
export function findJoinery(
  objects: ObjectsTable | null | undefined,
  hostName: string
): AppObject | null {
  for (const o of Object.values(objects ?? {})) {
    if (isHostedKind(o.kind) && o.plane?.hostOf === hostName) return o
  }
  return null
}
