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
  // E5-03 : tout afficher / tout masquer.
  setAllLayersVisible: (visible) =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([id, layer]) => [id, { ...layer, visible }])
      ),
    })),
  // E5-03 : isoler un calque (masque tous les autres).
  isolateLayer: (id) =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([key, layer]) => [
          key,
          { ...layer, visible: key === id },
        ])
      ),
    })),

  // E5-04 : colorisation des objets par la couleur de leur calque.
  colorByLayer: false,
  toggleColorByLayer: () => set((state) => ({ colorByLayer: !state.colorByLayer })),

  // Sélection (E6) — référencée par node name, identifiant immuable de
  // liaison GLB ↔ extras (E7-03) : aucune action ne renomme un node.
  selectedNode: null,
  selectNode: (name) => set({ selectedNode: name }),

  // E6-04 : survol — même référence par node name que la sélection.
  // Garde d'égalité : appelé à chaque pointermove, ne notifie que si
  // le node survolé change (pas de re-render pendant le déplacement).
  hoveredNode: null,
  hoverNode: (name) =>
    set((state) => (state.hoveredNode === name ? state : { hoveredNode: name })),

  // E4-03 : recadrage caméra. La caméra vit dans le Canvas : le bouton
  // (hors Canvas) incrémente un compteur que le Viewer consomme.
  fitRequest: 0,
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),

  // E17 (mode visite, Niveau 1) : navigation à la 1re personne, orthogonale
  // à l'édition. 'orbit' = OrbitControls (défaut) ; 'visit' = vol libre
  // (PointerLockControls + WASD). `pointerLocked` reflète l'état du verrou
  // souris natif : overlay « Cliquez pour explorer » tant qu'il est relâché.
  viewMode: 'orbit',
  setViewMode: (mode) => set({ viewMode: mode, hoveredNode: null }),
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'visit' ? 'orbit' : 'visit',
      hoveredNode: null,
    })),
  pointerLocked: false,
  setPointerLocked: (locked) => set({ pointerLocked: locked }),

  // E8-01 : overlay perf (dev uniquement, toggle clavier).
  showPerf: false,
  togglePerf: () => set((state) => ({ showPerf: !state.showPerf })),

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
      hoveredNode: null,
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
