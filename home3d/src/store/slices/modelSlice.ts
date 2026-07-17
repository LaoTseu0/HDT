import { DEFAULT_ZONE, DEFAULT_LEVEL } from '@/core/naming'
import type { ModelSlice, SliceCreator } from '../types'

// Modèle chargé (E3) : le fichier déposé est parsé dans le Canvas (le KTX2Loader
// a besoin du renderer pour detectSupport), puis `setModel` publie l'état complet.
export const createModelSlice: SliceCreator<ModelSlice> = (set) => ({
  glb: null, // { scene: THREE.Group, fileName: string }
  metadata: null, // extras de la scène racine parsés ({ model, layers })

  // Liaison GLB ↔ extras : { [nodeName]: extras }. Les node names sont des
  // identifiants immuables, ne jamais les renommer.
  nodes: {},

  // E12-06 : zone / niveau « courants » — défaut des nouvelles formes. Seedés
  // depuis le modèle chargé (1re zone/1er niveau présents), mis à jour quand on
  // change la zone/niveau d'un objet dans l'inspector.
  currentZone: DEFAULT_ZONE,
  currentLevel: DEFAULT_LEVEL,

  pendingFile: null, // { buffer: ArrayBuffer, name: string }
  isLoading: false,
  loadError: null,
  requestLoad: (buffer, name) =>
    set({ pendingFile: { buffer, name }, isLoading: true, loadError: null }),
  setModel: ({ scene, fileName, metadata, layers, nodes, objects }) =>
    set({
      glb: { scene, fileName },
      metadata,
      layers,
      hiddenSubtypes: {},
      nodes,
      pendingFile: null,
      isLoading: false,
      loadError: null,
      selectedNode: null,
      hoveredNode: null,
      // Objets app reconstruits depuis les extras.edit du GLB (E10-04),
      // sinon édition vierge.
      objects: objects ?? {},
      // E12-06 : zone/niveau courants seedés depuis le modèle (1re zone/1er
      // niveau présents) → défaut des formes créées ensuite.
      currentZone: metadata?.model?.zones?.[0] ?? DEFAULT_ZONE,
      currentLevel: metadata?.model?.levels?.[0] ?? DEFAULT_LEVEL,
      draft: null,
      vcbText: '',
      editMode: false,
      extrude: null,
    }),
  // E10-02 : matériau / notes d'un node IMPORTÉ. Met à jour la table `nodes`
  // (nouvelle référence → re-render) ET ré-assigne les extras sur le node de la
  // scène vive : l'export (clone de la scène, E10-04) écrit le userData du node,
  // pas la table du store. Non historisé (zundo ne suit que `objects`).
  setNodeMeta: (nodeName, patch) =>
    set((state) => {
      const extras = state.nodes[nodeName]
      if (!extras) return state
      const material = patch.material !== undefined ? patch.material : extras.material
      const notes = patch.notes !== undefined ? patch.notes : extras.notes
      if (
        (extras.material ?? '') === (material ?? '') &&
        (extras.notes ?? '') === (notes ?? '')
      ) {
        return state
      }
      const next = { ...extras, material, notes }
      const sceneNode = state.glb?.scene.getObjectByName(nodeName)
      if (sceneNode) sceneNode.userData = next
      return { nodes: { ...state.nodes, [nodeName]: next } }
    }),
  setLoadError: (message) =>
    set({ loadError: message, pendingFile: null, isLoading: false }),
  clearLoadError: () => set({ loadError: null }),
})
