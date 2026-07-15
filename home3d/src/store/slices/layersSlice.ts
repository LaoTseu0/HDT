import type { LayersSlice, SliceCreator } from '../types'

// Calques (E5, E20) : visibilité, isolation, sous-types masqués, colorisation.
// La config des calques (`layers`) est publiée par `setModel` (elle vit avec le
// modèle) ; cette slice porte les mutations d'affichage.
export const createLayersSlice: SliceCreator<LayersSlice> = (set) => ({
  // Calques : { structure: { visible, color, label }, ... } — issus des extras
  // scène du GLB (aucune config en dur côté app). Peuplé par setModel.
  layers: {},
  // E20-04 : sous-types masqués par calque { [layerId]: { [type]: true } }.
  hiddenSubtypes: {},
  // E5-04 : colorisation des objets par la couleur de leur calque.
  colorByLayer: false,

  toggleLayer: (id) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id]!, visible: !state.layers[id]!.visible },
      },
    })),
  // E5-03 : tout afficher / tout masquer. Réinitialise aussi l'état fin des
  // sous-types (E20-04) : « Tout »/« Aucun » repartent d'un état simple.
  setAllLayersVisible: (visible) =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([id, layer]) => [id, { ...layer, visible }])
      ),
      hiddenSubtypes: {},
    })),
  // E5-03 : isoler un calque (masque tous les autres). Le calque isolé s'affiche
  // ENTIER : son état de sous-types est réinitialisé (E20-04).
  isolateLayer: (id) =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([key, layer]) => [
          key,
          { ...layer, visible: key === id },
        ])
      ),
      hiddenSubtypes: {},
    })),
  // Toggle d'un GROUPE de types (un sous-type = [type] ; « Autres » = tous ses
  // types) : si tout le groupe est masqué on le réaffiche, sinon on le masque.
  toggleSubtypes: (layerId, types) =>
    set((state) => {
      const current = state.hiddenSubtypes[layerId] ?? {}
      const allHidden = types.every((t) => current[t])
      const next = { ...current }
      for (const t of types) {
        if (allHidden) delete next[t]
        else next[t] = true
      }
      return { hiddenSubtypes: { ...state.hiddenSubtypes, [layerId]: next } }
    }),
  // Isoler un groupe de sous-types : seul son calque reste visible, et dans ce
  // calque seuls `keepTypes` restent affichés. `allTypes` = tous les types
  // présents dans le calque (connus du panneau, pas du store).
  isolateSubtypes: (layerId, keepTypes, allTypes) =>
    set((state) => ({
      layers: Object.fromEntries(
        Object.entries(state.layers).map(([key, layer]) => [
          key,
          { ...layer, visible: key === layerId },
        ])
      ),
      hiddenSubtypes: {
        [layerId]: Object.fromEntries(
          allTypes.filter((t) => !keepTypes.includes(t)).map((t) => [t, true])
        ),
      },
    })),
  toggleColorByLayer: () => set((state) => ({ colorByLayer: !state.colorByLayer })),
})
