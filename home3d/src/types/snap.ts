// Accroche / inférence (E12-03, façon SketchUp) — Phase 1 du refactor TS.

import type { Vec3 } from './geometry'

/**
 * Types d'accroche, par priorité décroissante : sommet > intersection >
 * milieu > arête > axe > grille (cf. SNAP_PRIORITY, core/snapping).
 */
export type SnapType = 'endpoint' | 'intersection' | 'midpoint' | 'edge' | 'axis' | 'grid'

/** Droite d'inférence affichée pendant le tracé (pointillés colorés). */
export interface InferenceLine {
  origin: Vec3
  dir: Vec3
  /** Couleur de l'axe monde quasi colinéaire, sinon couleur « off ». */
  color: string
}

/**
 * Accroche retenue par pickBestSnap : le point remplace le curseur libre.
 * `color`/`lines` ne sont portés que par les inférences linéaires
 * (`axis`/`intersection`) pour dessiner les pointillés.
 */
export interface Snap {
  type: SnapType
  point: Vec3
  color?: string
  lines?: InferenceLine[]
}

/**
 * Candidat annoté de sa position écran (pixels) pendant la sélection —
 * pickBestSnap choisit dans le seuil par priorité puis distance curseur.
 */
export interface SnapCandidate extends Snap {
  sx?: number
  sy?: number
}
