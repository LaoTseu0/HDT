// Type complet de l'état du store (Phase 3 du refactor TS).
//
// Le store est découpé en SLICES par domaine (store/slices/*), chacune typée
// contre l'état complet `Store` — une action d'une slice peut donc lire/écrire
// l'état des autres via `set`/`get` (pattern zustand slices). Ce fichier est la
// source de vérité de la forme globale.

import type { StateCreator } from 'zustand'
import type {
  Draft,
  ExtrudePreview,
  GlbState,
  HiddenSubtypes,
  LayersTable,
  ModelMetadata,
  NodesTable,
  ObjectsTable,
  PendingFile,
  Vec3,
} from '@/types'
import type { JoineryVariant } from '@/types'

/** Sections de la barre latérale (accordéon, E19). */
export type MenuSection = 'calques' | 'edit' | 'vue' | 'more'

/** Outil courant de la palette d'Edit mode (= ids de la barre d'outils). */
export type ActiveTool =
  | 'select'
  | 'rect'
  | 'circle'
  | 'arc'
  | 'opening'
  | 'door'
  | 'joinery'
  | 'elec'
  | 'cable'
  | 'pipe'
  | 'valve'
  | 'pushpull'

/** Mode caméra : orbite (défaut) ou visite (vol libre, E17). */
export type ViewMode = 'orbit' | 'visit'

// ── Slices ───────────────────────────────────────────────────────────────────

/** Modèle chargé + cycle de chargement (E3) + zone/niveau courants (E12-06). */
export interface ModelSlice {
  glb: GlbState | null
  metadata: ModelMetadata | null
  nodes: NodesTable
  currentZone: string
  currentLevel: string
  pendingFile: PendingFile | null
  isLoading: boolean
  loadError: string | null
  requestLoad: (buffer: ArrayBuffer, name: string) => void
  setModel: (payload: {
    scene: GlbState['scene']
    fileName: string
    metadata: ModelMetadata | null
    layers: LayersTable
    nodes: NodesTable
    objects?: ObjectsTable
  }) => void
  setLoadError: (message: string) => void
  clearLoadError: () => void
}

/** Calques : visibilité, isolation, sous-types masqués, colorisation (E5, E20). */
export interface LayersSlice {
  layers: LayersTable
  hiddenSubtypes: HiddenSubtypes
  colorByLayer: boolean
  toggleLayer: (id: string) => void
  setAllLayersVisible: (visible: boolean) => void
  isolateLayer: (id: string) => void
  toggleSubtypes: (layerId: string, types: string[]) => void
  isolateSubtypes: (layerId: string, keepTypes: string[], allTypes: string[]) => void
  toggleColorByLayer: () => void
}

/** Sélection, survol et recadrage caméra (E6, E4-03). */
export interface SelectionSlice {
  selectedNode: string | null
  hoveredNode: string | null
  fitRequest: number
  selectNode: (name: string | null) => void
  hoverNode: (name: string | null) => void
  requestFit: () => void
}

/** État de l'UI globale : menu, overlays, perf (E19, E8-01). */
export interface UiSlice {
  menuOpen: boolean
  menuSection: MenuSection
  shortcutsOpen: boolean
  showPerf: boolean
  toggleMenu: () => void
  setMenuOpen: (open: boolean) => void
  setMenuSection: (section: MenuSection) => void
  setShortcutsOpen: (open: boolean) => void
  togglePerf: () => void
}

/** Mode caméra visite/orbite et réglages associés (E17, E19-04). */
export interface ViewSlice {
  viewMode: ViewMode
  pointerLocked: boolean
  visitFov: number
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
  setPointerLocked: (locked: boolean) => void
  setVisitFov: (fov: number) => void
}

/** Edit mode : bascule, outil actif, aperçu Push/Pull, accroche grille (E12, E22). */
export interface EditSlice {
  editMode: boolean
  activeTool: ActiveTool
  extrude: ExtrudePreview | null
  gridSnap: boolean
  csgFallbackIds: string[]
  setEditMode: (on: boolean) => void
  toggleEditMode: () => void
  setActiveTool: (tool: ActiveTool) => void
  setExtrude: (extrude: ExtrudePreview | null) => void
  toggleGridSnap: () => void
  setCsgFallbackIds: (ids: string[]) => void
}

/** Objets créés in-app + mutations paramétriques (E12-05/06, E14, E16). */
export interface ObjectsSlice {
  objects: ObjectsTable
  createObject: (payload: import('@/types').ObjectPayload) => void
  setObjectNaming: (
    id: string,
    patch: { zone?: string; level?: string; type?: string }
  ) => void
  updateObjectParams: (
    id: string,
    patch: Record<string, unknown>,
    planePatch?: Record<string, unknown>
  ) => void
  setOpeningAllege: (id: string, allege: number) => void
  setObjectFloorHeight: (id: string, height: number) => void
  insertValve: (pipeId: string, worldPoint: Vec3) => void
  deleteObject: (id: string) => void
}

/** Tracé en cours (draft) + saisie VCB + commit (E12-04, E13). */
export interface DraftSlice {
  draft: Draft | null
  vcbText: string
  setDraft: (draft: Draft | null) => void
  setVcbText: (vcbText: string) => void
  commitDraft: () => void
}

/** Préférences d'outil (gabarits/sections) sélectionnées avant la pose (E14-E16). */
export interface SettingsSlice {
  openingPreset: string
  doorPreset: string
  joineryVariant: JoineryVariant
  elecComponent: string
  cableSection: string
  pipeSection: string
  setOpeningPreset: (preset: string) => void
  setDoorPreset: (preset: string) => void
  setJoineryVariant: (variant: JoineryVariant) => void
  setElecComponent: (kind: string) => void
  setCableSection: (section: string) => void
  setPipeSection: (section: string) => void
}

/** État complet du store = union de toutes les slices. */
export type Store = ModelSlice &
  LayersSlice &
  SelectionSlice &
  UiSlice &
  ViewSlice &
  EditSlice &
  ObjectsSlice &
  DraftSlice &
  SettingsSlice

/**
 * Créateur d'une slice, typé contre l'état complet. Le middleware `temporal`
 * (zundo) est déclaré comme mutator pour que `set`/`get` restent cohérents.
 */
export type SliceCreator<T> = StateCreator<Store, [['temporal', unknown]], [], T>
