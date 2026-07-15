import type { SliceCreator, ViewSlice } from '../types'

// Mode caméra (E17) : 'orbit' = OrbitControls ; 'visit' = vol libre
// (PointerLockControls + WASD). `pointerLocked` = verrou souris natif. `visitFov`
// = seul réglage de visite exposé (E19-04). Changer de mode efface le survol.
export const createViewSlice: SliceCreator<ViewSlice> = (set) => ({
  viewMode: 'orbit',
  pointerLocked: false,
  visitFov: 70,
  setViewMode: (mode) => set({ viewMode: mode, hoveredNode: null }),
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'visit' ? 'orbit' : 'visit',
      hoveredNode: null,
    })),
  setPointerLocked: (locked) => set({ pointerLocked: locked }),
  setVisitFov: (fov) => set({ visitFov: fov }),
})
