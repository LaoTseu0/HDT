// Tracés en cours (drafts) — Phase 1 du refactor TS.
//
// Le draft est l'état ÉPHÉMÈRE d'un geste de tracé (non historisé, non
// committé). L'union est DISCRIMINÉE par `tool` : chaque outil a sa propre
// shape, et l'arc porte en plus une étape (`stage`, multi-clics E13-03).

import type { Vec2, Vec3, WorkFrame } from './geometry'
import type { Snap } from './snap'

/** Outils de tracé produisant un draft. */
export type DraftTool = 'rect' | 'circle' | 'arc' | 'cable' | 'pipe'

/**
 * Rectangle : coin de départ → coin courant, en (s,t) du plan d'esquisse.
 * Rétro-compat : `tool` peut manquer sur d'anciens drafts (commitDraft replie
 * sur 'rect').
 */
export interface RectDraft {
  tool?: 'rect'
  start: Vec2
  current: Vec2
  frame: WorkFrame
  snap?: Snap | null
}

/** Cercle : `start` = centre, `current` = point du bord, en (s,t). */
export interface CircleDraft {
  tool: 'circle'
  start: Vec2
  current: Vec2
  frame: WorkFrame
  snap?: Snap | null
}

/**
 * Arc « centre + début + fin » (E13-03), piloté par étape :
 *  - `radius` : le centre est posé, on fixe rayon + angle de départ ;
 *  - `sweep`  : rayon verrouillé (`start` posé), on fixe le balayage accumulé
 *               (`sweepRad`, signé, > ±180° admis) depuis `startAngle`.
 */
export interface ArcDraft {
  tool: 'arc'
  stage: 'radius' | 'sweep'
  center: Vec2
  current: Vec2
  frame: WorkFrame
  snap?: Snap | null
  /** Point du bord verrouillé au passage à l'étape `sweep`. */
  start?: Vec2
  /** Balayage accumulé (rad, signé) — étape `sweep`. */
  sweepRad?: number
  /** Angle de départ (rad) — étape `sweep`. */
  startAngle?: number
}

/**
 * Run routé (câble E15-03 / tuyau E16-01) : sommets MONDE déjà cliqués
 * (ancrages conservés) + `current` = segment d'aperçu sous le curseur.
 */
export interface RunDraft {
  tool: 'cable' | 'pipe'
  points: Vec3[]
  current: Vec3
  frame: WorkFrame
  snap?: Snap | null
}

/** Union discriminée des tracés en cours. */
export type Draft = RectDraft | CircleDraft | ArcDraft | RunDraft

/**
 * Aperçu éphémère d'un Push/Pull ou d'un drag de poignée (E12-08, E22) :
 * quelle cote bouge (`paramKey`), sa valeur d'aperçu, et l'ancrage `origin`
 * déplacé pour garder la face opposée fixe. Committé en UNE entrée
 * d'historique au relâché (updateObjectParams).
 */
export interface ExtrudePreview {
  id: string
  paramKey: string
  value: number
  origin?: Vec3
  /** Accroche courante du drag (E22-03) — dessinée par un SnapMarker. */
  snap?: Snap | null
}
