import { finalizeDraft } from '../helpers'
import type { EditSlice, SliceCreator } from '../types'

// Edit mode (V2, Slice 0). editMode : bascule View ↔ Edit. activeTool : outil
// courant de la palette. Un run câble/tuyau en cours est FINALISÉ (pas jeté)
// quand on quitte l'édition ou change d'outil (finalizeDraft, #28).
export const createEditSlice: SliceCreator<EditSlice> = (set) => ({
  editMode: false,
  activeTool: 'select',
  // E12-08 : aperçu éphémère d'un Push/Pull en cours. NON historisé ; committé en
  // une seule entrée d'historique au relâché via updateObjectParams.
  extrude: null,
  // E12-03 : accroche à la grille du plan d'esquisse (préférence d'outil, pas
  // historisée). Candidat de plus basse priorité.
  gridSnap: false,
  // E14-03 : ids des ouvertures dont le perçage CSG a échoué. Non historisé.
  csgFallbackIds: [],

  // Entrer en édition ouvre la barre latérale sur la section Edit (E19-03).
  setEditMode: (on) =>
    set((state) => ({
      ...finalizeDraft(state),
      editMode: on,
      activeTool: 'select',
      extrude: null,
      hoveredNode: null,
      ...(on ? { menuOpen: true, menuSection: 'edit' as const } : {}),
    })),
  toggleEditMode: () =>
    set((state) => ({
      ...finalizeDraft(state),
      editMode: !state.editMode,
      activeTool: 'select',
      extrude: null,
      hoveredNode: null,
      ...(state.editMode ? {} : { menuOpen: true, menuSection: 'edit' as const }),
    })),
  // Changer d'outil efface le survol résiduel et finalise un run en cours (#28).
  setActiveTool: (tool) =>
    set((state) => ({
      ...finalizeDraft(state),
      activeTool: tool,
      extrude: null,
      hoveredNode: null,
    })),
  setExtrude: (extrude) => set({ extrude }),
  toggleGridSnap: () => set((state) => ({ gridSnap: !state.gridSnap })),
  setCsgFallbackIds: (ids) =>
    set((state) => {
      // Garde d'égalité pour ne pas boucler (mis à jour dans un effet).
      const a = state.csgFallbackIds
      if (a.length === ids.length && a.every((x, i) => x === ids[i])) return state
      return { csgFallbackIds: ids }
    }),
})
