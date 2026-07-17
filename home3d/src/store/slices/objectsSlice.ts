import { nextIndex } from '@/core/naming'
import { kindNaming } from '@/features/edit/registry'
import { splitPipeAt, isValvablePipe } from '@/features/mep/valve'
import { buildAppObject, makeStableId } from '../helpers'
import type { ObjectsSlice, SliceCreator } from '../types'
import type { AppObject, ObjectsTable, Vec3 } from '@/types'

// Objets créés in-app : { [id]: { id, kind, params, plane, …nommage } }. La
// géométrie est DÉRIVÉE des params par le registre (features/edit/registry) →
// ré-éditable et régénérable au chargement (E12-05). Seul ce champ est historisé
// (zundo partialize).
export const createObjectsSlice: SliceCreator<ObjectsSlice> = (set) => ({
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

  // E12-06 : change zone / niveau / sous-type (E20-03) de l'objet sélectionné →
  // recalcule l'index dans le nouveau bucket (système, zone, niveau — le type
  // n'en fait pas partie) et reconstruit le node name (dérivé). L'`id` (clé)
  // reste stable — pas de renommage de clé.
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
      // Ignorer un set no-op : ne pas créer de nouvelle référence `objects` (donc
      // pas d'entrée d'historique zundo) si rien ne change.
      const params = obj.params as unknown as Record<string, unknown>
      const paramsChanged = Object.keys(patch).some((k) => params[k] !== patch[k])
      const plane = (obj.plane ?? {}) as unknown as Record<string, unknown>
      const planeChanged =
        !!planePatch && Object.keys(planePatch).some((k) => plane[k] !== planePatch[k])
      if (!paramsChanged && !planeChanged) return state
      return {
        objects: {
          ...state.objects,
          [id]: {
            ...obj,
            params: { ...obj.params, ...patch },
            plane: planePatch ? { ...obj.plane, ...planePatch } : obj.plane,
          } as AppObject,
        },
      }
    }),

  // E10-02 : matériau / notes de l'objet app — métadonnées descriptives libres,
  // embarquées dans les extras à l'export (buildAppNodeExtras) et relues au
  // chargement. Nouvelle référence `objects` → une entrée d'historique (undo/redo).
  setObjectMeta: (id, patch) =>
    set((state) => {
      const obj = state.objects[id]
      if (!obj) return state
      const material = patch.material !== undefined ? patch.material : obj.material
      const notes = patch.notes !== undefined ? patch.notes : obj.notes
      // Ignorer un set no-op ('' et absent équivalents) : pas d'entrée zundo.
      if ((obj.material ?? '') === (material ?? '') && (obj.notes ?? '') === (notes ?? '')) {
        return state
      }
      return { objects: { ...state.objects, [id]: { ...obj, material, notes } } }
    }),

  // E14-01 : régler l'allège (hauteur du seuil au-dessus du sol) d'une ouverture →
  // déplace `plane.origin` le long de l'axe vertical monde, en gardant la
  // hauteur/largeur.
  setOpeningAllege: (id, allege) =>
    set((state) => {
      const obj = state.objects[id]
      if (!obj || obj.kind !== 'opening.window') return state
      const next = Math.max(0, Number(allege) || 0)
      const cur = Number(obj.params.allege_m) || 0
      if (next === cur) return state
      const o = obj.plane.origin
      const origin: Vec3 = [o[0], o[1] + (next - cur), o[2]] // seuil monté/descendu
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

  // E15-01 : régler la hauteur au-dessus du sol (y monde) du CENTRE d'un composant
  // posé → déplace `plane.origin` verticalement. Générique (contrairement à
  // setOpeningAllege qui met aussi à jour un param `allege_m`).
  setObjectFloorHeight: (id, height) =>
    set((state) => {
      const obj = state.objects[id]
      if (!obj) return state
      const h = Math.max(0, Number(height) || 0)
      const o = obj.plane.origin ?? [0, 0, 0]
      if (o[1] === h) return state
      return {
        objects: {
          ...state.objects,
          [id]: { ...obj, plane: { ...obj.plane, origin: [o[0], h, o[2]] as Vec3 } },
        },
      }
    }),

  // E16-04 : insérer une VANNE sur un tuyau au point cliqué (monde) — coupe le run
  // en DEUX tronçons + crée l'objet vanne (cf. features/mep/valve splitPipeAt), le
  // tout dans UN set() → une seule entrée d'historique (undo restaure le tuyau
  // entier).
  insertValve: (pipeId, worldPoint) =>
    set((state) => {
      const pipe = state.objects[pipeId]
      if (!isValvablePipe(pipe) || pipe?.kind !== 'plomberie.pipe') return state
      const split = splitPipeAt(pipe, worldPoint)
      if (!split) return state

      // Créer AVANT de supprimer : le tuyau d'origine reste dans la table pendant
      // l'attribution des ids/index → son id et son node name ne sont pas
      // réutilisés (invariant makeStableId/nextIndex).
      const objects: ObjectsTable = { ...state.objects }
      const { zone, level } = pipe
      let selected: string | null = null
      const payloads = [
        ...split.runs.map((params) => ({ kind: pipe.kind, params, plane: pipe.plane })),
        split.valve,
      ]
      for (const payload of payloads) {
        const id = makeStableId(objects)
        const { system, type } = kindNaming(payload.kind)
        const index = nextIndex(objects, { system, zone, level })
        objects[id] = { id, system, type, zone, level, index, ...payload } as AppObject
        selected = id // la vanne (dernière créée) finit sélectionnée
      }
      delete objects[pipeId]
      return { objects, selectedNode: selected }
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
})
