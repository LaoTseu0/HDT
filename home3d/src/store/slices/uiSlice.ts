import type { SliceCreator, UiSlice } from '../types'

// UI globale : barre latérale (accordéon E19), overlay raccourcis (E19-07),
// overlay perf dev (E8-01, exclu du bundle prod côté Viewer).
export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  menuOpen: false,
  menuSection: 'calques',
  shortcutsOpen: false,
  showPerf: false,
  toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
  setMenuSection: (section) => set({ menuSection: section }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  togglePerf: () => set((state) => ({ showPerf: !state.showPerf })),
})
