// Helpers PURS du store (id stable, assemblage d'objet app, commits de tracé).
// Extraits du monolithe pour rester testables et partagés entre slices.

import { rectPayloadFromDraft, MIN_SIZE } from '@/features/sketch/sketchRect'
import { circlePayloadFromDraft } from '@/features/sketch/sketchCircle'
import {
  arcPayloadFromDraft,
  radiusOf,
  angleOf,
  DEG2RAD,
} from '@/features/sketch/sketchArc'
import {
  parseVcb,
  applyVcbToDraft,
  parseVcbRadius,
  applyVcbRadiusToDraft,
  parseVcbAngle,
} from '@/features/sketch/vcb'
import { kindNaming } from '@/features/edit/registry'
import { nextIndex, DEFAULT_ZONE, DEFAULT_LEVEL } from '@/core/naming'
import { cablePayloadFromPath } from '@/features/mep/cable'
import { pipePayloadFromPath } from '@/features/mep/plumbing'
import type {
  AppObject,
  ArcDraft,
  CircleDraft,
  Draft,
  ObjectPayload,
  ObjectsTable,
  RectDraft,
  RunDraft,
  Vec2,
} from '@/types'

/** Sous-ensemble du store lu par les helpers de commit (évite un couplage total). */
export interface CommitContext {
  objects: ObjectsTable
  currentZone: string
  currentLevel: string
  vcbText: string
  cableSection: string
  pipeSection: string
}

// Id interne STABLE d'un objet app (clé du map `objects`, jamais affichée). Le
// node name conforme (système__type__zone__niveau__index) en est DÉCOUPLÉ et
// dérivé via core/naming → on peut changer zone/niveau sans re-keyer le store
// (E12-06, cohérent avec l'immutabilité des ids E7-03). Max+1 sur le suffixe pour
// ne pas réutiliser un id après suppression.
export function makeStableId(objects: ObjectsTable): string {
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
export function buildAppObject(state: CommitContext, payload: ObjectPayload): AppObject {
  const id = makeStableId(state.objects)
  const { system, type } = kindNaming(payload.kind)
  const zone = state.currentZone || DEFAULT_ZONE
  const level = state.currentLevel || DEFAULT_LEVEL
  const index = nextIndex(state.objects, { system, zone, level })
  return { id, system, type, zone, level, index, ...payload } as AppObject
}

/** Patch partiel d'état renvoyé par un commit (fusionné par `set`). */
export type CommitPatch = {
  objects?: ObjectsTable
  selectedNode?: string | null
  draft?: Draft | null
  vcbText?: string
}

// Commit d'un tracé d'ARC (E13-03), piloté par l'étape du draft (multi-clics) :
//   - étape 'radius' : verrouille rayon + angle de départ (clic DÉBUT ou VCB
//     rayon), puis AVANCE vers l'étape 'sweep' (aucun objet créé) ;
//   - étape 'sweep'  : fixe le balayage (clic FIN ou VCB angle) et CRÉE l'objet.
// `nextSweep` a déjà accumulé `d.sweepRad` pendant le déplacement (arcs majeurs).
export function commitArc(state: CommitContext, d: ArcDraft): CommitPatch {
  if (d.stage === 'radius') {
    const parsed = state.vcbText ? parseVcbRadius(state.vcbText) : null
    let radiusPoint: Vec2 = d.current
    let r = radiusOf(d.center, d.current)
    if (parsed) {
      r = parsed.radius
      const len = radiusOf(d.center, d.current) || 1
      const dir: Vec2 =
        len > 1e-6
          ? [(d.current[0] - d.center[0]) / len, (d.current[1] - d.center[1]) / len]
          : [1, 0] // pas encore bougé → départ par défaut le long de +u
      radiusPoint = [d.center[0] + dir[0] * r, d.center[1] + dir[1] * r]
    }
    // Clic accidentel sur le centre (sans VCB ni glissé) : rester en l'état.
    if (!parsed && r < MIN_SIZE) return {}
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
  const r = radiusOf(d.center, d.start ?? d.current)
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
  const payload = arcPayloadFromDraft(d.center, r, d.startAngle ?? 0, sweepRad, d.frame)
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
export function commitRun(state: CommitContext, d: RunDraft): CommitPatch {
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

// Solder un tracé en cours quand on QUITTE l'outil (Échap, outil Sélection, sortie
// d'édition — cf. #28). Un run (câble E15-03 / tuyau E16-01) n'est pas un geste
// unique jetable comme un rectangle : ses sommets déjà cliqués sont des ANCRAGES
// que l'utilisateur veut conserver → on le FINALISE (commitRun, qui exige ≥ 2
// sommets distincts, sinon jette proprement). Les autres tracés (rect/cercle/arc),
// gestes incomplets, sont simplement abandonnés. Renvoie le patch d'état à fusionner.
export function finalizeDraft(
  state: CommitContext & { draft: Draft | null }
): CommitPatch {
  const d = state.draft
  if (d && (d.tool === 'cable' || d.tool === 'pipe')) return commitRun(state, d)
  return { draft: null, vcbText: '' }
}

/** Commit du tracé courant (rect/cercle/arc/run) selon l'outil du draft. */
export function commitDraft(state: CommitContext & { draft: Draft | null }): CommitPatch {
  const d = state.draft
  if (!d) return {}
  // L'outil du tracé décide du parsing VCB, de la garde clic-accidentel et du
  // constructeur de payload. L'arc est multi-étapes (cf. commitArc).
  const tool = d.tool ?? 'rect'
  if (tool === 'arc') return commitArc(state, d as ArcDraft)
  if (tool === 'cable' || tool === 'pipe') return commitRun(state, d as RunDraft)
  // Reste : rect ou circle — les deux portent (start, current) en (s,t).
  const sketch = d as CircleDraft | RectDraft
  let payload: ObjectPayload | null
  if (tool === 'circle') {
    const parsed = state.vcbText ? parseVcbRadius(state.vcbText) : null
    const eff = applyVcbRadiusToDraft(sketch, parsed)
    if (!parsed) {
      const r = Math.hypot(
        sketch.current[0] - sketch.start[0],
        sketch.current[1] - sketch.start[1]
      )
      if (r < MIN_SIZE) return { draft: null, vcbText: '' }
    }
    payload = circlePayloadFromDraft(eff.start, eff.current, sketch.frame)
  } else {
    const parsed = state.vcbText ? parseVcb(state.vcbText) : null
    const eff = applyVcbToDraft(sketch, parsed)
    if (!parsed) {
      const w = Math.abs(sketch.current[0] - sketch.start[0])
      const dep = Math.abs(sketch.current[1] - sketch.start[1])
      if (w < MIN_SIZE || dep < MIN_SIZE) return { draft: null, vcbText: '' }
    }
    payload = rectPayloadFromDraft(eff.start, eff.current, sketch.frame)
  }
  if (!payload) return { draft: null, vcbText: '' }
  const obj = buildAppObject(state, payload)
  return {
    objects: { ...state.objects, [obj.id]: obj },
    selectedNode: obj.id,
    draft: null,
    vcbText: '',
  }
}
