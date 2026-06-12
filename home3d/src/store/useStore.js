import { create } from 'zustand'

// Store Zustand — structure V2-ready (cf. cahier des charges, E7-01).
// Toute mutation passe par une action nommée : prérequis pour brancher
// le command pattern + middleware `zundo` (undo/redo) en V2 sans refonte.
// Les composants se connectent via des sélecteurs (pas de re-render global).
const useStore = create((set) => ({
  // Modèle chargé
  glb: null, // { scene: THREE.Group, fileName: string }
  metadata: null, // extras de la scène racine parsés ({ model, layers })

  // Liaison GLB ↔ extras : { [nodeName]: extras }.
  // Les node names sont des identifiants immuables, ne jamais les renommer.
  nodes: {},

  // Calques : { structure: { visible, color, label }, ... } — issus des
  // extras scène du GLB (aucune config en dur côté app).
  layers: {},
  toggleLayer: (id) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], visible: !state.layers[id].visible },
      },
    })),

  // Sélection
  selectedNode: null,
  selectNode: (name) => set({ selectedNode: name }),

  // Chargement (E3) — le fichier déposé est parsé dans le Canvas
  // (le KTX2Loader a besoin du renderer pour detectSupport).
  pendingFile: null, // { buffer: ArrayBuffer, name: string }
  isLoading: false,
  loadError: null,
  requestLoad: (buffer, name) =>
    set({ pendingFile: { buffer, name }, isLoading: true, loadError: null }),
  setModel: ({ scene, fileName, metadata, layers, nodes }) =>
    set({
      glb: { scene, fileName },
      metadata,
      layers,
      nodes,
      pendingFile: null,
      isLoading: false,
      loadError: null,
      selectedNode: null,
    }),
  setLoadError: (message) =>
    set({ loadError: message, pendingFile: null, isLoading: false }),
  clearLoadError: () => set({ loadError: null }),

  // V2 : historique (command pattern)
  // history: [],
  // future: [],
  // push: (command) => {},
  // undo: () => {},
  // redo: () => {},
}))

export default useStore
