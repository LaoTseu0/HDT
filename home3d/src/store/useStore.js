import { create } from 'zustand'
import { useStore as useZustandStore } from 'zustand'
import { temporal } from 'zundo'
import { rectPayloadFromDraft, MIN_SIZE } from '../lib/sketchRect.js'
import { circlePayloadFromDraft } from '../lib/sketchCircle.js'
import { arcPayloadFromDraft, radiusOf, angleOf, DEG2RAD } from '../lib/sketchArc.js'
import {
  parseVcb,
  applyVcbToDraft,
  parseVcbRadius,
  applyVcbRadiusToDraft,
  parseVcbAngle,
} from '../lib/vcb.js'
import { kindNaming } from '../lib/editRegistry.js'
import { nextIndex, DEFAULT_ZONE, DEFAULT_LEVEL } from '../lib/naming.js'
import { DEFAULT_OPENING_PRESET, DEFAULT_DOOR_PRESET } from '../lib/opening.js'
import { DEFAULT_ELEC_KIND } from '../lib/elec.js'
import { DEFAULT_JOINERY_VARIANT } from '../lib/joinery.js'
import { cablePayloadFromPath, DEFAULT_CABLE_SECTION } from '../lib/cable.js'
import { pipePayloadFromPath, DEFAULT_PIPE_SECTION } from '../lib/plumbing.js'
import { splitPipeAt, isValvablePipe } from '../lib/valve.js'

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

// Commit d'un tracé d'ARC (E13-03), piloté par l'étape du draft (multi-clics) :
//   - étape 'radius' : verrouille rayon + angle de départ (clic DÉBUT ou VCB
//     rayon), puis AVANCE vers l'étape 'sweep' (aucun objet créé) ;
//   - étape 'sweep'  : fixe le balayage (clic FIN ou VCB angle) et CRÉE l'objet.
// `nextSweep` a déjà accumulé `d.sweepRad` pendant le déplacement (arcs majeurs).
function commitArc(state, d) {
  if (d.stage === 'radius') {
    const parsed = state.vcbText ? parseVcbRadius(state.vcbText) : null
    let radiusPoint = d.current
    let r = radiusOf(d.center, d.current)
    if (parsed) {
      r = parsed.radius
      const len = radiusOf(d.center, d.current) || 1
      const dir =
        len > 1e-6
          ? [(d.current[0] - d.center[0]) / len, (d.current[1] - d.center[1]) / len]
          : [1, 0] // pas encore bougé → départ par défaut le long de +u
      radiusPoint = [d.center[0] + dir[0] * r, d.center[1] + dir[1] * r]
    }
    // Clic accidentel sur le centre (sans VCB ni glissé) : rester en l'état.
    if (!parsed && r < MIN_SIZE) return state
    return {
      draft: {
        ...d,
        start: radiusPoint,
        current: radiusPoint,
        stage: 'sweep',
        sweepRad: 0,
        startAngle: angleOf(d.center, radiusPoint),
      },
      vcbText: '',
    }
  }
  // étape 'sweep'
  const r = radiusOf(d.center, d.start)
  const parsedA = state.vcbText ? parseVcbAngle(state.vcbText) : null
  let sweepRad = d.sweepRad || 0
  if (parsedA) {
    if (parsedA.angleDeg < 0) {
      sweepRad = parsedA.angleDeg * DEG2RAD // signe explicite
    } else {
      const sign = sweepRad < 0 ? -1 : 1 // valeur positive → on garde le sens du tracé
      sweepRad = sign * parsedA.angleDeg * DEG2RAD
    }
  }
  const payload = arcPayloadFromDraft(d.center, r, d.startAngle, sweepRad, d.frame)
  if (!payload) return { draft: null, vcbText: '' }
  const obj = buildAppObject(state, payload)
  return {
    objects: { ...state.objects, [obj.id]: obj },
    selectedNode: obj.id,
    draft: null,
    vcbText: '',
  }
}

// Commit d'un tracé de RUN routé (câble E15-03 / tuyau E16-01) : le chemin
// committé = les sommets déjà cliqués (`d.points`), le `current` (segment sous
// le curseur) n'est qu'un aperçu et n'est pas ajouté. Le payload déduplique et
// exige ≥ 2 sommets distincts (sinon le tracé est simplement abandonné).
function commitRun(state, d) {
  const payload =
    d.tool === 'pipe'
      ? pipePayloadFromPath(d.points ?? [], state.pipeSection)
      : cablePayloadFromPath(d.points ?? [], state.cableSection)
  if (!payload) return { draft: null, vcbText: '' }
  const obj = buildAppObject(state, payload)
  return {
    objects: { ...state.objects, [obj.id]: obj },
    selectedNode: obj.id,
    draft: null,
    vcbText: '',
  }
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
      // E5-03 : tout afficher / tout masquer. Réinitialise aussi l'état fin des
      // sous-types (E20-04) : « Tout »/« Aucun » repartent d'un état simple.
      setAllLayersVisible: (visible) =>
        set((state) => ({
          layers: Object.fromEntries(
            Object.entries(state.layers).map(([id, layer]) => [id, { ...layer, visible }])
          ),
          hiddenSubtypes: {},
        })),
      // E5-03 : isoler un calque (masque tous les autres). Le calque isolé
      // s'affiche ENTIER : son état de sous-types est réinitialisé (E20-04).
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

      // E20-04 : sous-types masqués par calque { [layerId]: { [type]: true } }.
      // Un node importé est visible si son calque l'est ET si son type ne figure
      // pas ici. Les types sont les segments réels des nodes ; le bucket
      // « Autres » de l'UI est un groupe de types hors vocabulaire.
      hiddenSubtypes: {},
      // Toggle d'un GROUPE de types (un sous-type = [type] ; « Autres » = tous
      // ses types) : si tout le groupe est masqué on le réaffiche, sinon on le
      // masque entièrement.
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
      // Isoler un groupe de sous-types : seul son calque reste visible, et dans
      // ce calque seuls `keepTypes` restent affichés. `allTypes` = tous les types
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
          // L'outil du tracé décide du parsing VCB, de la garde clic-accidentel et
          // du constructeur de payload. L'arc est multi-étapes (cf. commitArc).
          const tool = d.tool ?? 'rect'
          if (tool === 'arc') return commitArc(state, d)
          if (tool === 'cable' || tool === 'pipe') return commitRun(state, d)
          let payload
          if (tool === 'circle') {
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

      // E14-03 : ids des ouvertures dont le perçage CSG a échoué (mur non-manifold
      // → posées en surface sans trou). Alimenté par WallCutter à chaque recalcul ;
      // garde d'égalité pour ne pas boucler (mis à jour dans un effet). Non historisé.
      csgFallbackIds: [],
      setCsgFallbackIds: (ids) =>
        set((state) => {
          const a = state.csgFallbackIds
          if (a.length === ids.length && a.every((x, i) => x === ids[i])) return state
          return { csgFallbackIds: ids }
        }),

      // E12-03 : accroche à la grille du plan d'esquisse (préférence d'outil, pas
      // historisée). Candidat de plus basse priorité : la géométrie l'emporte
      // toujours, la grille ne « tire » qu'en l'absence de référence proche.
      gridSnap: false,
      toggleGridSnap: () => set((state) => ({ gridSnap: !state.gridSnap })),

      // E14-04 : gabarit d'ouverture sélectionné avant la pose (classique/large/
      // étroite, cf. lib/opening `OPENING_PRESETS`). Préférence d'outil, pas
      // historisée ; l'instance posée reste modifiable ensuite dans l'inspector.
      openingPreset: DEFAULT_OPENING_PRESET,
      setOpeningPreset: (preset) => set({ openingPreset: preset }),

      // E14-07 : gabarit de porte sélectionné avant la pose (simple/double/
      // étroite, cf. lib/opening `DOOR_PRESETS`). Préférence d'outil, pas
      // historisée ; l'instance posée reste modifiable ensuite dans l'inspector.
      doorPreset: DEFAULT_DOOR_PRESET,
      setDoorPreset: (preset) => set({ doorPreset: preset }),

      // E14-06 : variante de menuiserie sélectionnée avant la pose (fixe/battant/
      // coulissant, cf. lib/joinery `JOINERY_VARIANTS`). Préférence d'outil, pas
      // historisée ; l'instance posée reste modifiable ensuite dans l'inspector.
      joineryVariant: DEFAULT_JOINERY_VARIANT,
      setJoineryVariant: (variant) => set({ joineryVariant: variant }),

      // E15-01/02 : composant élec sélectionné avant la pose (prise/interrupteur/
      // boîte/compteur, cf. lib/elec `ELEC_COMPONENTS`). Préférence d'outil, pas
      // historisée ; l'instance posée reste modifiable ensuite dans l'inspector.
      elecComponent: DEFAULT_ELEC_KIND,
      setElecComponent: (kind) => set({ elecComponent: kind }),

      // E15-03 : section de câble sélectionnée avant le routage (gaine Ø16/20/25/
      // 32, cf. lib/cable `CABLE_SECTIONS`). Préférence d'outil, pas historisée ;
      // l'instance posée reste modifiable ensuite dans l'inspector.
      cableSection: DEFAULT_CABLE_SECTION,
      setCableSection: (section) => set({ cableSection: section }),

      // E16-01 : section de tuyau sélectionnée avant le routage (cuivre Ø12→22,
      // évac PVC Ø32/40/100, cf. lib/plumbing `PIPE_SECTIONS`). Préférence
      // d'outil, pas historisée ; l'instance posée reste modifiable ensuite.
      pipeSection: DEFAULT_PIPE_SECTION,
      setPipeSection: (section) => set({ pipeSection: section }),

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

      // E12-06 : change zone / niveau / sous-type (E20-03) de l'objet sélectionné →
      // recalcule l'index dans le nouveau bucket (système, zone, niveau — le type
      // n'en fait pas partie) et reconstruit le node name (dérivé). Historisé
      // (mutation de `objects`) ; met aussi à jour la zone/niveau courants.
      // L'`id` (clé) reste stable — pas de renommage de clé.
      setObjectNaming: (id, patch) =>
        set((state) => {
          const obj = state.objects[id]
          if (!obj) return state
          const zone = patch.zone !== undefined ? patch.zone : obj.zone
          const level = patch.level !== undefined ? patch.level : obj.level
          const type = patch.type !== undefined ? patch.type : obj.type
          if (zone === obj.zone && level === obj.level && type === obj.type) return state
          // Le sous-type ne change pas le bucket d'indexation : index conservé.
          if (zone === obj.zone && level === obj.level) {
            return { objects: { ...state.objects, [id]: { ...obj, type } } }
          }
          const index = nextIndex(state.objects, { system: obj.system, zone, level }, id)
          return {
            objects: { ...state.objects, [id]: { ...obj, type, zone, level, index } },
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
      // E14-01 : régler l'allège (hauteur du seuil au-dessus du sol) d'une
      // ouverture → déplace `plane.origin` le long de l'axe vertical monde, en
      // gardant la hauteur/largeur. Historisé (mutation de `objects`).
      setOpeningAllege: (id, allege) =>
        set((state) => {
          const obj = state.objects[id]
          if (!obj || obj.kind !== 'opening.window') return state
          const next = Math.max(0, Number(allege) || 0)
          const cur = Number(obj.params.allege_m) || 0
          if (next === cur) return state
          const o = obj.plane.origin
          const origin = [o[0], o[1] + (next - cur), o[2]] // seuil monté/descendu
          return {
            objects: {
              ...state.objects,
              [id]: {
                ...obj,
                params: { ...obj.params, allege_m: next },
                plane: { ...obj.plane, origin },
              },
            },
          }
        }),

      // E15-01 : régler la hauteur au-dessus du sol (y monde) du CENTRE d'un
      // composant posé (élec…) → déplace `plane.origin` verticalement, garde le
      // reste. Générique (contrairement à setOpeningAllege qui met aussi à jour un
      // param `allege_m`). Historisé (mutation de `objects`).
      setObjectFloorHeight: (id, height) =>
        set((state) => {
          const obj = state.objects[id]
          if (!obj) return state
          const h = Math.max(0, Number(height) || 0)
          const o = obj.plane.origin
          if (o[1] === h) return state
          return {
            objects: {
              ...state.objects,
              [id]: { ...obj, plane: { ...obj.plane, origin: [o[0], h, o[2]] } },
            },
          }
        }),

      // E16-04 : insérer une VANNE sur un tuyau au point cliqué (monde) — coupe
      // le run en DEUX tronçons + crée l'objet vanne (cf. lib/valve splitPipeAt),
      // le tout dans UN set() → une seule entrée d'historique (undo restaure le
      // tuyau entier). Les tronçons héritent kind/params (section, pente…) et
      // zone/niveau du tuyau d'origine ; la coupe sur une extrémité est refusée.
      insertValve: (pipeId, worldPoint) =>
        set((state) => {
          const pipe = state.objects[pipeId]
          if (!isValvablePipe(pipe)) return state
          const split = splitPipeAt(pipe, worldPoint)
          if (!split) return state

          // Créer AVANT de supprimer : le tuyau d'origine reste dans la table
          // pendant l'attribution des ids/index → son id et son node name ne
          // sont pas réutilisés (invariant makeStableId/nextIndex).
          const objects = { ...state.objects }
          const { zone, level } = pipe
          let selected = null
          for (const payload of [
            ...split.runs.map((params) => ({ kind: pipe.kind, params, plane: pipe.plane })),
            split.valve,
          ]) {
            const id = makeStableId(objects)
            const { system, type } = kindNaming(payload.kind)
            const index = nextIndex(objects, { system, zone, level })
            objects[id] = { id, system, type, zone, level, index, ...payload }
            selected = id // la vanne (dernière créée) finit sélectionnée
          }
          delete objects[pipeId]
          return {
            objects,
            selectedNode: selected,
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
          hiddenSubtypes: {},
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
