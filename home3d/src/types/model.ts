// Modèle chargé : GLB, calques, extras de nodes — Phase 1 du refactor TS.

import type * as THREE from 'three'
import type { ObjectPayload } from './objects'

/** Config d'un calque (issue des extras scène du GLB — rien en dur côté app). */
export interface LayerConfig {
  label: string
  color: string
  visible: boolean
}

/** Table des calques, clé = id de calque (`structure`, `elec`, …). */
export type LayersTable = Record<string, LayerConfig>

/** Sous-types masqués par calque (E20-04) : { [layerId]: { [type]: true } }. */
export type HiddenSubtypes = Record<string, Record<string, boolean>>

/** Infos modèle des extras scène (pipeline script/process.mjs). */
export interface ModelInfo {
  zones?: string[]
  levels?: string[]
  [key: string]: unknown
}

/** Extras de la scène racine du GLB (obligatoires, sinon PipelineError). */
export interface ModelMetadata {
  model: ModelInfo
  layers: LayersTable
  [key: string]: unknown
}

/**
 * Extras d'un node IMPORTÉ (posés par le pipeline, relus par extractModelData).
 * `layer` peut avoir été posé côté app (repli « non classé », E3-03).
 */
export interface NodeExtras {
  layer?: string
  type?: string
  zone?: string
  level?: string
  index?: number
  subtype?: string | null
  subtypeLabel?: string | null
  material?: string
  notes?: string
  dims?: unknown
  [key: string]: unknown
}

/** Table { nodeName: extras } des nodes importés porteurs d'un calque. */
export type NodesTable = Record<string, NodeExtras>

/**
 * Extras d'un node créé IN-APP (buildAppNodeExtras) : métadonnées de
 * convention + bloc `edit` qui rend l'objet régénérable au chargement
 * (E10-04). `source: 'app'` le distingue de la coquille importée.
 */
export interface AppNodeExtras extends NodeExtras {
  source: 'app'
  edit: ObjectPayload
}

/** Modèle GLB chargé dans le store. */
export interface GlbState {
  scene: THREE.Group
  fileName: string
}

/** Fichier déposé en attente de parsing (le Canvas fait le parse, E3). */
export interface PendingFile {
  buffer: ArrayBuffer
  name: string
}
