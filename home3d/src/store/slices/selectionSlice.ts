import type { SelectionSlice, SliceCreator } from '../types'

// Sélection / survol (E6) — référencés par node name (importé) ou id d'objet app.
// Recadrage caméra (E4-03) : la caméra vit dans le Canvas, le bouton incrémente
// un compteur que le Viewer consomme.
export const createSelectionSlice: SliceCreator<SelectionSlice> = (set) => ({
  selectedNode: null,
  hoveredNode: null,
  fitRequest: 0,
  selectNode: (name) => set({ selectedNode: name }),
  // E6-04 : survol — même référence que la sélection. Garde d'égalité : appelé à
  // chaque pointermove, ne notifie que si le node survolé change.
  hoverNode: (name) =>
    set((state) => (state.hoveredNode === name ? state : { hoveredNode: name })),
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
})
