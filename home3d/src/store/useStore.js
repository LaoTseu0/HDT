import { create } from 'zustand'
import { useStore as useZustandStore } from 'zustand'
import { temporal } from 'zundo'

// Store Zustand — structure V2-ready (cf. cahier des charges, E7-01).
// Toute mutation passe par une action nommée. Depuis la V2 (Slice 0), le store
// est enveloppé par le middleware `zundo` (`temporal`) : undo/redo sur l'état
// métier de l'édition (E10-03). On `partialize` pour n'historiser que les
// objets créés in-app — pas l'éphémère (sélection, survol, draft, calques…).
// Les composants se connectent via des sélecteurs (pas de re-render global).
const useStore = create(
  temporal(
    (set) => ({
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

      // Sélection (E6) — référencée par node name (importé) ou id d'objet app.
      selectedNode: null,
      selectNode: (name) => set({ selectedNode: name }),

      // E6-04 : survol — même référence que la sélection. Garde d'égalité :
      // appelé à chaque pointermove, ne notifie que si le node survolé change.
      hoveredNode: null,
      hoverNode: (name) =>
        set((state) => (state.hoveredNode === name ? state : { hoveredNode: name })),

      // E4-03 : recadrage caméra. La caméra vit dans le Canvas : le bouton
      // (hors Canvas) incrémente un compteur que le Viewer consomme.
      fitRequest: 0,
      requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),

      // E17 (mode visite, Niveau 1) : 'orbit' = OrbitControls ; 'visit' = vol
      // libre (PointerLockControls + WASD). `pointerLocked` = verrou souris natif.
      viewMode: 'orbit',
      setViewMode: (mode) => set({ viewMode: mode, hoveredNode: null }),
      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === 'visit' ? 'orbit' : 'visit',
          hoveredNode: null,
        })),
      pointerLocked: false,
      setPointerLocked: (locked) => set({ pointerLocked: locked }),

      // ── Edit mode (V2, Slice 0) ──────────────────────────────────────────
      // editMode : bascule View ↔ Edit. activeTool : outil courant de la palette
      // ('select' | 'rect' | …). draft : tracé en cours (non committé, éphémère).
      editMode: false,
      activeTool: 'select',
      setEditMode: (on) =>
        set({
          editMode: on,
          draft: null,
          activeTool: 'select',
          extrude: null,
          hoveredNode: null,
        }),
      toggleEditMode: () =>
        set((state) => ({
          editMode: !state.editMode,
          draft: null,
          activeTool: 'select',
          extrude: null,
          hoveredNode: null,
        })),
      // Changer d'outil efface le survol résiduel (Model coupe sa surbrillance
      // hors outil Sélection — sinon un highlight figé resterait).
      setActiveTool: (tool) =>
        set({ activeTool: tool, draft: null, extrude: null, hoveredNode: null }),
      draft: null,
      setDraft: (draft) => set({ draft }),

      // E12-03 : accroche à la grille du plan d'esquisse (préférence d'outil, pas
      // historisée). Candidat de plus basse priorité : la géométrie l'emporte
      // toujours, la grille ne « tire » qu'en l'absence de référence proche.
      gridSnap: false,
      toggleGridSnap: () => set((state) => ({ gridSnap: !state.gridSnap })),

      // E12-08 : aperçu éphémère d'un Push/Pull en cours =
      // { id, paramKey, value, origin } (la face cliquée fixe quelle cote bouge).
      // NON historisé (zundo partialize n'historise que `objects`) ; committé en
      // une seule entrée d'historique au relâché via updateObjectParams.
      extrude: null,
      setExtrude: (extrude) => set({ extrude }),

      // Objets créés in-app : { [id]: { id, kind, params, plane } }. La géométrie
      // est DÉRIVÉE des params par le registre (lib/editRegistry) → ré-éditable
      // et régénérable au chargement (E12-05). Seul ce champ est historisé (zundo).
      objects: {},
      createObject: ({ kind, params, plane }) =>
        set((state) => {
          const n = Object.values(state.objects).filter((o) => o.kind === kind).length + 1
          const id = `app-${kind.replace(/\./g, '-')}-${String(n).padStart(3, '0')}`
          return {
            objects: { ...state.objects, [id]: { id, kind, params, plane } },
            selectedNode: id,
            draft: null,
          }
        }),
      // `planePatch` optionnel (Push/Pull sur une face latérale, E12-08) : déplace
      // aussi l'ancrage `plane.origin` pour garder la face opposée fixe — committé
      // dans la MÊME entrée d'historique que le changement de cote.
      updateObjectParams: (id, patch, planePatch) =>
        set((state) => {
          const obj = state.objects[id]
          if (!obj) return state
          // Ignorer un set no-op : ne pas créer de nouvelle référence `objects`
          // (donc pas d'entrée d'historique zundo) si rien ne change.
          const paramsChanged = Object.keys(patch).some((k) => obj.params[k] !== patch[k])
          const planeChanged =
            !!planePatch &&
            Object.keys(planePatch).some((k) => obj.plane?.[k] !== planePatch[k])
          if (!paramsChanged && !planeChanged) return state
          return {
            objects: {
              ...state.objects,
              [id]: {
                ...obj,
                params: { ...obj.params, ...patch },
                plane: planePatch ? { ...obj.plane, ...planePatch } : obj.plane,
              },
            },
          }
        }),
      deleteObject: (id) =>
        set((state) => {
          if (!state.objects[id]) return state
          const objects = { ...state.objects }
          delete objects[id]
          return {
            objects,
            selectedNode: state.selectedNode === id ? null : state.selectedNode,
          }
        }),

      // Chargement (E3) — le fichier déposé est parsé dans le Canvas
      // (le KTX2Loader a besoin du renderer pour detectSupport).
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
          nodes,
          pendingFile: null,
          isLoading: false,
          loadError: null,
          selectedNode: null,
          hoveredNode: null,
          // Objets app reconstruits depuis les extras.edit du GLB (E10-04),
          // sinon édition vierge.
          objects: objects ?? {},
          draft: null,
          editMode: false,
          extrude: null,
        }),
      setLoadError: (message) =>
        set({ loadError: message, pendingFile: null, isLoading: false }),
      clearLoadError: () => set({ loadError: null }),
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
export const useTemporal = (selector) => useZustandStore(useStore.temporal, selector)

export default useStore
