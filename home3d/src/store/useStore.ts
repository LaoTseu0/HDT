import { create } from 'zustand'
import { useStore as useZustandStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import { createModelSlice } from './slices/modelSlice'
import { createLayersSlice } from './slices/layersSlice'
import { createSelectionSlice } from './slices/selectionSlice'
import { createUiSlice } from './slices/uiSlice'
import { createViewSlice } from './slices/viewSlice'
import { createEditSlice } from './slices/editSlice'
import { createObjectsSlice } from './slices/objectsSlice'
import { createDraftSlice } from './slices/draftSlice'
import { createSettingsSlice } from './slices/settingsSlice'
import type { Store } from './types'

// Store Zustand découpé en SLICES par domaine (E7-01, structure V2-ready). Toute
// mutation passe par une action nommée. Depuis la V2 (Slice 0), le store est
// enveloppé par le middleware `zundo` (`temporal`) : undo/redo sur l'état métier
// de l'édition (E10-03). On `partialize` pour n'historiser que les objets créés
// in-app — pas l'éphémère (sélection, survol, draft, calques…). Les composants se
// connectent via des sélecteurs (pas de re-render global).
const useStore = create<Store>()(
  temporal(
    (...a) => ({
      ...createModelSlice(...a),
      ...createLayersSlice(...a),
      ...createSelectionSlice(...a),
      ...createUiSlice(...a),
      ...createViewSlice(...a),
      ...createEditSlice(...a),
      ...createObjectsSlice(...a),
      ...createDraftSlice(...a),
      ...createSettingsSlice(...a),
    }),
    {
      // N'historiser QUE les objets créés in-app (état métier). L'égalité par
      // référence évite d'empiler une entrée d'historique à chaque mutation
      // d'état éphémère (toggle calque, sélection, survol…).
      partialize: (state) => ({ objects: state.objects }),
      equality: (a, b) => a.objects === b.objects,
      limit: 100,
    }
  )
)

// Accès réactif au store temporel de zundo (pastStates/futureStates) pour câbler
// les boutons undo/redo. Les actions `undo`/`redo` se prennent via getState().
export const useTemporal = <T>(
  selector: (state: TemporalState<Pick<Store, 'objects'>>) => T
): T => useZustandStore(useStore.temporal, selector)

export default useStore

// Réexport des helpers de commit (testés isolément — cf. finalizeDraft.test).
export { finalizeDraft } from './helpers'
