import { create } from 'zustand'
import { useStore as useZustandStore } from 'zustand'
import { temporal } from 'zundo'
import { rectPayloadFromDraft, MIN_SIZE } from '../lib/sketchRect.js'
import { circlePayloadFromDraft } from '../lib/sketchCircle.js'
import {
  parseVcb,
  applyVcbToDraft,
  parseVcbRadius,
  applyVcbRadiusToDraft,
} from '../lib/vcb.js'
import { kindNaming } from '../lib/editRegistry.js'
import { nextIndex, DEFAULT_ZONE, DEFAULT_LEVEL } from '../lib/naming.js'

// Id interne STABLE d'un objet app (clé du map `objects`, jamais affichée). Le
// node name conforme (système__type__zone__niveau__index) en est DÉCOUPLÉ et
// dérivé via lib/naming → on peut changer zone/niveau sans re-keyer le store
// (E12-06, cohérent avec l'immutabilité des ids E7-03). Max+1 sur le suffixe pour
// ne pas réutiliser un id après suppression.
function makeStableId(objects) {
  let max = 0
  for (const id of Object.keys(objects)) {
    const m = /^app-(\d+)$/.exec(id)
    if (m) {
      const n = Number(m[1])
      if (n > max) max = n
    }
  }
  return `app-${max + 1}`
}

// Assemble un objet app complet depuis un payload de tracé { kind, params, plane }
// et la zone/niveau courants → champs de nommage (système/type du registre, index
// auto-incrémenté par bucket). Le node name est dérivé à l'affichage/export.
function buildAppObject(state, payload) {
  const id = makeStableId(state.objects)
  const { system, type } = kindNaming(payload.kind)
  const zone = state.currentZone || DEFAULT_ZONE
  const level = state.currentLevel || DEFAULT_LEVEL
  const index = nextIndex(state.objects, { system, zone, level })
  return { id, system, type, zone, level, index, ...payload }
}

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
          vcbText: '',
          activeTool: 'select',
          extrude: null,
          hoveredNode: null,
        }),
      toggleEditMode: () =>
        set((state) => ({
          editMode: !state.editMode,
          draft: null,
          vcbText: '',
          activeTool: 'select',
          extrude: null,
          hoveredNode: null,
        })),
      // Changer d'outil efface le survol résiduel (Model coupe sa surbrillance
      // hors outil Sélection — sinon un highlight figé resterait).
      setActiveTool: (tool) =>
        set({ activeTool: tool, draft: null, vcbText: '', extrude: null, hoveredNode: null }),
      draft: null,
      setDraft: (draft) => set({ draft }),

      // E12-04 : cote saisie au clavier pendant un tracé (VCB façon SketchUp).
      // Éphémère (non historisé), alimenté par les raccourcis clavier (App.jsx).
      vcbText: '',
      setVcbText: (vcbText) => set({ vcbText }),

      // Committe le tracé courant en objet app. Appelé au relâché du glissé
      // (EditObjects) ET à la validation clavier (Entrée). Si une cote VCB a été
      // tapée, elle prime (et lève la garde clic-accidentel MIN_SIZE).
      commitDraft: () =>
        set((state) => {
          const d = state.draft
          if (!d) return state
          // L'outil du tracé (cercle vs rectangle) décide du parsing VCB, de la
          // garde clic-accidentel et du constructeur de payload.
          let payload
          if ((d.tool ?? 'rect') === 'circle') {
            const parsed = state.vcbText ? parseVcbRadius(state.vcbText) : null
            const eff = applyVcbRadiusToDraft(d, parsed)
            if (!parsed) {
              const r = Math.hypot(d.current[0] - d.start[0], d.current[1] - d.start[1])
              if (r < MIN_SIZE) return { draft: null, vcbText: '' }
            }
            payload = circlePayloadFromDraft(eff.start, eff.current, d.frame)
          } else {
            const parsed = state.vcbText ? parseVcb(state.vcbText) : null
            const eff = applyVcbToDraft(d, parsed)
            if (!parsed) {
              const w = Math.abs(d.current[0] - d.start[0])
              const dep = Math.abs(d.current[1] - d.start[1])
              if (w < MIN_SIZE || dep < MIN_SIZE) return { draft: null, vcbText: '' }
            }
            payload = rectPayloadFromDraft(eff.start, eff.current, d.frame)
          }
          if (!payload) return { draft: null, vcbText: '' }
          const obj = buildAppObject(state, payload)
          return {
            objects: { ...state.objects, [obj.id]: obj },
            selectedNode: obj.id,
            draft: null,
            vcbText: '',
          }
        }),

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
      createObject: (payload) =>
        set((state) => {
          const obj = buildAppObject(state, payload)
          return {
            objects: { ...state.objects, [obj.id]: obj },
            selectedNode: obj.id,
            draft: null,
          }
        }),

      // E12-06 : zone / niveau « courants » — défaut des nouvelles formes. Seedés
      // depuis le modèle chargé (1re zone/1er niveau présents), mis à jour quand on
      // change la zone/niveau d'un objet dans l'inspector (la valeur « colle » pour
      // les tracés suivants, façon zone courante).
      currentZone: DEFAULT_ZONE,
      currentLevel: DEFAULT_LEVEL,

      // E12-06 : change zone et/ou niveau de l'objet sélectionné → recalcule l'index
      // dans le nouveau bucket (système, zone, niveau) et reconstruit le node name
      // (dérivé). Historisé (mutation de `objects`) ; met aussi à jour la zone/niveau
      // courants. L'`id` (clé) reste stable — pas de renommage de clé.
      setObjectNaming: (id, patch) =>
        set((state) => {
          const obj = state.objects[id]
          if (!obj) return state
          const zone = patch.zone !== undefined ? patch.zone : obj.zone
          const level = patch.level !== undefined ? patch.level : obj.level
          if (zone === obj.zone && level === obj.level) return state
          const index = nextIndex(state.objects, { system: obj.system, zone, level }, id)
          return {
            objects: { ...state.objects, [id]: { ...obj, zone, level, index } },
            currentZone: zone,
            currentLevel: level,
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
          // E12-06 : zone/niveau courants seedés depuis le modèle (1re zone/1er
          // niveau présents) → défaut des formes créées ensuite.
          currentZone: metadata?.model?.zones?.[0] ?? DEFAULT_ZONE,
          currentLevel: metadata?.model?.levels?.[0] ?? DEFAULT_LEVEL,
          draft: null,
          vcbText: '',
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
