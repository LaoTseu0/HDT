import { commitDraft } from '../helpers'
import type { DraftSlice, SliceCreator } from '../types'

// Tracé en cours (E12-04, E13) : `draft` éphémère (non committé, non historisé),
// `vcbText` = cote saisie au clavier (VCB façon SketchUp). Le commit délègue au
// helper qui choisit parsing/garde/constructeur selon l'outil du draft.
export const createDraftSlice: SliceCreator<DraftSlice> = (set) => ({
  draft: null,
  vcbText: '',
  setDraft: (draft) => set({ draft }),
  setVcbText: (vcbText) => set({ vcbText }),
  // Committe le tracé courant en objet app. Appelé au relâché du glissé
  // (EditObjects) ET à la validation clavier (Entrée). Si une cote VCB a été
  // tapée, elle prime (et lève la garde clic-accidentel MIN_SIZE).
  commitDraft: () =>
    set((state) => {
      if (!state.draft) return state
      return commitDraft(state)
    }),
})
