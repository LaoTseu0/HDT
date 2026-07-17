// Objets app paramétriques (Phase 1 du refactor TS).
//
// Le modèle central d'Edit mode : un objet = { kind, params, plane } (+ champs
// de nommage). La géométrie est toujours DÉRIVÉE des params par le registre
// (features/edit/registry) — jamais l'inverse. L'union est DISCRIMINÉE par
// `kind` : narrower `obj.kind === '…'` suffit à typer `obj.params`.

import type { ObjectPlane, Vec3 } from './geometry'

// ── Kinds ────────────────────────────────────────────────────────────────────

/** Primitives d'esquisse (Slice 0). */
export type SketchKind = 'sketch.rect' | 'sketch.circle' | 'sketch.arc'

/** Ouvertures creusant le mur par CSG (E14). */
export type OpeningKind = 'opening.window' | 'opening.door'

/** Composants hébergés dans une ouverture (E14-05/07). */
export type HostedKind = 'joinery.frame' | 'door.leaf'

/** Composants élec ponctuels posés sur une face (E15-01/02). */
export type ElecComponentKind =
  | 'elec.outlet'
  | 'elec.switch'
  | 'elec.junction'
  | 'elec.meter'

/** Runs routés : polyligne balayée à section rectangulaire (E15-03, E16-01). */
export type RunKind = 'elec.cable' | 'plomberie.pipe'

/** Tous les kinds connus du registre. */
export type Kind =
  | SketchKind
  | OpeningKind
  | HostedKind
  | ElecComponentKind
  | RunKind
  | 'plomberie.valve'

// ── Params par kind ──────────────────────────────────────────────────────────
// Convention : cotes en MÈTRES, suffixe `_m` ; angles en degrés, `_deg`.

/** Rectangle d'esquisse, optionnellement extrudé par Push/Pull (E12-08). */
export interface RectParams {
  largeur_m: number
  profondeur_m: number
  /** Extrusion signée le long de la normale ; absente ou ~0 → forme plate. */
  hauteur_m?: number
}

/** Disque d'esquisse, optionnellement extrudé en cylindre. */
export interface CircleParams {
  rayon_m: number
  hauteur_m?: number
}

/** Arc « centre + début + fin » (E13-03), balayage signé (arc majeur admis). */
export interface ArcParams {
  rayon_m: number
  angle_debut_deg: number
  angle_balayage_deg: number
  hauteur_m?: number
}

/** Fenêtre : le seuil (plane.origin) monte de v=0 à v=hauteur_m (E14-01). */
export interface WindowParams {
  largeur_m: number
  hauteur_m: number
  /** Hauteur du seuil au-dessus du sol (y=0). */
  allege_m: number
}

/** Porte : seuil AU SOL, pas d'allège (E14-07). */
export interface DoorParams {
  largeur_m: number
  hauteur_m: number
}

/** Variantes de menuiserie (E14-06) — param d'instance, géométrie seule change. */
export type JoineryVariant = 'fixe' | 'battant' | 'coulissant'

/** Cadre + vitrage logé dans une fenêtre (E14-05). Dims copiées de l'hôte. */
export interface JoineryParams {
  largeur_m: number
  hauteur_m: number
  /** Section des montants/traverses. */
  epaisseur_m: number
  /** Profondeur du dormant le long de la normale. */
  profondeur_m: number
  /** Rétro-compat : absente sur les GLB d'avant E14-06 → rendue `fixe`. */
  variante?: JoineryVariant
}

/** Vantail de porte (E14-07) : dormant 3 côtés + panneau plein + poignée. */
export interface DoorLeafParams {
  largeur_m: number
  hauteur_m: number
  epaisseur_m: number
  profondeur_m: number
}

/** Composant élec ponctuel : emprise catalogue (cf. features/mep/elec). */
export interface ElecParams {
  largeur_m: number
  hauteur_m: number
  profondeur_m: number
}

/**
 * Base d'un run routé : polyligne MONDE (les clics) + section rectangulaire
 * d'emprise équivalente au Ø nominal (côté = diamètre), cf. § 5.3.
 */
export interface RunParamsBase {
  points: Vec3[]
  largeur_m: number
  hauteur_m: number
  /** Identité nominale conservée pour l'étiquetage. */
  diametre_mm: number
  /** Clé du preset de section du catalogue. */
  section: string
}

/** Câble élec routé (gaine ICT, E15-03). */
export type CableParams = RunParamsBase

/** Famille de tuyau : alimentation cuivre ou évacuation PVC. */
export type PipeFamille = 'cuivre' | 'evac'

/** Tuyau routé (E16-01) ; la pente (E16-02) ne concerne que l'évacuation. */
export interface PipeParams extends RunParamsBase {
  famille: PipeFamille
  /** % de descente par longueur horizontale, appliqué à la volée (non destructif). */
  pente_pct?: number
}

/** Vanne inline insérée sur un tuyau (E16-04) — vit en coordonnées monde. */
export interface ValveParams {
  /** Centre du corps, sur l'axe rendu du tuyau coupé. */
  centre: Vec3
  /** Direction de l'axe du tuyau à la coupe (unitaire). */
  dir: Vec3
  largeur_m: number
  hauteur_m: number
  diametre_mm: number
  famille: PipeFamille
  section: string
}

/** Table kind → params (source de l'union discriminée). */
export interface ParamsByKind {
  'sketch.rect': RectParams
  'sketch.circle': CircleParams
  'sketch.arc': ArcParams
  'opening.window': WindowParams
  'opening.door': DoorParams
  'joinery.frame': JoineryParams
  'door.leaf': DoorLeafParams
  'elec.outlet': ElecParams
  'elec.switch': ElecParams
  'elec.junction': ElecParams
  'elec.meter': ElecParams
  'elec.cable': CableParams
  'plomberie.pipe': PipeParams
  'plomberie.valve': ValveParams
}

// ── Payload et objet app ─────────────────────────────────────────────────────

/**
 * Payload d'un `kind` donné : ce que produisent les constructeurs
 * (rectPayloadFromDraft, openingPayload…) et que consomme `createObject`.
 */
export type PayloadOf<K extends Kind> = {
  [P in K]: { kind: P; params: ParamsByKind[P]; plane: ObjectPlane }
}[K]

/** Union discriminée de tous les payloads. */
export type ObjectPayload = PayloadOf<Kind>

/**
 * Champs de nommage (E12-06) : le node name conforme
 * `système__type__zone__niveau__index` en est DÉRIVÉ (lib naming) — l'`id`
 * interne (clé du store) reste STABLE et découplé.
 */
export interface NamingFields {
  system: string
  type: string
  zone: string
  level: string
  index: number
}

/**
 * Métadonnées descriptives libres (E10-02) : saisies dans le panneau Info,
 * embarquées dans les extras à l'export (buildAppNodeExtras) et relues au
 * chargement. Absentes = jamais renseignées.
 */
export interface MetaFields {
  material?: string
  notes?: string
}

/** Objet app complet d'un `kind` donné. */
export type AppObjectOf<K extends Kind> = PayloadOf<K> &
  NamingFields &
  MetaFields & { id: string }

/** Union discriminée de tous les objets app (narrow par `obj.kind`). */
export type AppObject = AppObjectOf<Kind>

/** Table des objets créés in-app, clé = id interne stable (`app-N`). */
export type ObjectsTable = Record<string, AppObject>

/**
 * Vue structurelle « cotes » d'un params quelconque : pour les helpers
 * génériques (corps de vanne, sous-barre de section…) qui lisent
 * largeur/hauteur sans connaître le kind.
 */
export interface SizedParams {
  largeur_m?: number
  hauteur_m?: number
  profondeur_m?: number
}
