// Accès TYPÉ au `userData` de three.js — Phase 1 du refactor TS.
//
// `Object3D.userData` est `Record<string, any>` côté three : c'est LE trou de
// typage du projet (GLTFLoader y place les extras glTF, le registre y tague
// l'id d'objet app). Toujours passer par ces guards/helpers plutôt que de lire
// `userData` à nu — le narrow est explicite et centralisé ici.

import type * as THREE from 'three'
import type { AppNodeExtras, NodeExtras } from './model'
import type { ObjectPayload } from './objects'

/** Vrai si l'objet 3D est un node créé in-app (porte un bloc `edit`). */
export function isAppNodeUserData(ud: unknown): ud is AppNodeExtras {
  if (typeof ud !== 'object' || ud === null) return false
  const rec = ud as Record<string, unknown>
  return rec.source === 'app' && typeof rec.edit === 'object' && rec.edit !== null
}

/** Extras d'app node d'un Object3D, ou null (narrow via isAppNodeUserData). */
export function appNodeExtrasOf(object: THREE.Object3D): AppNodeExtras | null {
  return isAppNodeUserData(object.userData) ? object.userData : null
}

/** Bloc `edit` (payload régénérable) d'un Object3D créé in-app, ou null. */
export function editPayloadOf(object: THREE.Object3D): ObjectPayload | null {
  return appNodeExtrasOf(object)?.edit ?? null
}

/** Extras (pipeline ou app) d'un Object3D — vue permissive mais typée. */
export function nodeExtrasOf(object: THREE.Object3D): NodeExtras {
  return object.userData as NodeExtras
}

/** Calque propre d'un Object3D (posé par le pipeline ou le repli E3-03). */
export function layerOf(object: THREE.Object3D): string | undefined {
  const layer = (object.userData as NodeExtras).layer
  return typeof layer === 'string' ? layer : undefined
}

/**
 * Id d'objet app tagué par le registre sur le groupe généré et ses enfants
 * (generateObject) — le raycast de sélection remonte à l'objet métier par là.
 */
export function appObjectIdOf(object: THREE.Object3D): string | undefined {
  const id = (object.userData as Record<string, unknown>).appObjectId
  return typeof id === 'string' ? id : undefined
}

/** Tague l'id d'objet app sur un Object3D (pendant de appObjectIdOf). */
export function tagAppObjectId(object: THREE.Object3D, id: string): void {
  object.userData.appObjectId = id
}
