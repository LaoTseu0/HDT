// Données de la barre d'édition (E19-03) : liste des outils, sous-catalogues
// (gabarits, variantes, sections) et libellés d'aide. Extrait d'EditBar (données
// vs présentation) pour un composant plus lisible.

import { ELEC_COMPONENTS, ELEC_KINDS } from '@/features/mep/elec'
import { JOINERY_VARIANTS, JOINERY_VARIANT_KEYS } from '@/features/openings/joinery'
import { CABLE_SECTIONS, CABLE_SECTION_KEYS } from '@/features/mep/cable'
import { PIPE_SECTIONS, PIPE_SECTION_KEYS } from '@/features/mep/plumbing'
import type { ActiveTool } from '@/store/types'

/** Un outil de la palette (id = valeur d'`activeTool`, sauf `pushpull`/`opening`). */
export interface ToolDef {
  id: string
  label: string
  hint: string
  key?: string
}

export const TOOLS: ToolDef[] = [
  {
    id: 'select',
    label: 'Sélection',
    hint: 'Sélectionner / éditer un objet',
    key: 'Échap',
  },
  {
    id: 'rect',
    label: 'Rectangle',
    hint: 'Dessiner un rectangle (sol ou face survolée)',
  },
  { id: 'circle', label: 'Cercle', hint: 'Dessiner un cercle (centre puis rayon)' },
  { id: 'arc', label: 'Arc', hint: 'Dessiner un arc (centre, début, fin)' },
  { id: 'opening', label: 'Ouverture', hint: 'Poser une fenêtre sur une face de mur' },
  {
    id: 'door',
    label: 'Porte',
    hint: 'Poser une porte sur une face de mur (seuil au sol)',
  },
  {
    id: 'joinery',
    label: 'Menuiserie',
    hint: 'Équiper une ouverture existante (cadre + vitrage, ou vantail de porte)',
  },
  {
    id: 'elec',
    label: 'Électricité',
    hint: 'Poser un composant électrique sur une face de mur',
  },
  {
    id: 'cable',
    label: 'Câble',
    hint: 'Router un câble électrique (clics successifs, double-clic pour finir)',
  },
  {
    id: 'pipe',
    label: 'Tuyau',
    hint: 'Router un tuyau de plomberie (clics successifs, double-clic pour finir)',
  },
  {
    id: 'valve',
    label: 'Vanne',
    hint: 'Insérer une vanne sur un tuyau (coupe le run en deux)',
  },
  { id: 'pushpull', label: 'Push/Pull', hint: 'Donner du volume à une face (extrusion)' },
]

/** Entrée d'une sous-barre (gabarit / composant / section). */
export interface SubItem {
  id: string
  label: string
  hint?: string
}

export const OPENING_PRESET_LIST: SubItem[] = [
  { id: 'classique', label: 'Classique' },
  { id: 'large', label: 'Large' },
  { id: 'etroite', label: 'Étroite' },
]

export const DOOR_PRESET_LIST: SubItem[] = [
  { id: 'simple', label: 'Simple' },
  { id: 'double', label: 'Double' },
  { id: 'etroite', label: 'Étroite' },
]

// Listes ordonnées dérivées des catalogues des features.
export const ELEC_COMPONENT_LIST: SubItem[] = ELEC_KINDS.map((id) => ({
  id,
  label: ELEC_COMPONENTS[id].label,
}))

export const JOINERY_VARIANT_LIST: SubItem[] = JOINERY_VARIANT_KEYS.map((id) => ({
  id,
  label: JOINERY_VARIANTS[id].label,
  hint: JOINERY_VARIANTS[id].hint,
}))

export const CABLE_SECTION_LIST: SubItem[] = CABLE_SECTION_KEYS.map((id) => ({
  id,
  label: CABLE_SECTIONS[id]!.label,
}))

export const PIPE_SECTION_LIST: SubItem[] = PIPE_SECTION_KEYS.map((id) => ({
  id,
  label: PIPE_SECTIONS[id]!.label,
}))

// Libellés d'aide affichés sous la palette selon l'outil actif.
export const TOOL_HINTS: Partial<Record<ActiveTool | 'opening' | 'pushpull', string>> = {
  rect: 'Tracez un rectangle : sur le sol, ou directement sur une face survolée du modèle.',
  circle: 'Cliquez le centre puis glissez pour le rayon. Tapez une valeur pour le fixer.',
  arc: 'Cliquez le centre, puis le début (rayon), puis la fin (balayage). Tapez une valeur pour la fixer.',
  opening:
    'Choisissez un gabarit puis cliquez sur une face de mur pour y poser une fenêtre. Ajustez largeur / hauteur / allège dans l’inspecteur.',
  door: 'Choisissez un gabarit puis cliquez sur une face de mur : la porte se pose avec son seuil au sol. Ajustez largeur / hauteur dans l’inspecteur.',
  joinery:
    'Choisissez une variante puis cliquez une ouverture déjà posée : une fenêtre reçoit un cadre + vitrage, une porte reçoit son vantail. Une ouverture déjà équipée sélectionne son composant.',
  elec: 'Choisissez un composant puis cliquez sur une face de mur pour le poser. Ajustez la hauteur / sol dans l’inspecteur.',
  cable:
    'Choisissez une section, puis cliquez chaque point du trajet (sol ou faces de mur). Double-cliquez ou Entrée pour terminer, Échap pour annuler.',
  pipe: 'Choisissez une section (cuivre ou évac PVC), puis cliquez chaque point du trajet (sol ou faces de mur). Double-cliquez ou Entrée pour terminer, Échap pour annuler.',
  valve:
    'Cliquez un tuyau déjà routé : une vanne s’insère au point cliqué et coupe le run en deux tronçons (annulable en une fois).',
  pushpull: 'Cliquez une forme et tirez pour l’extruder le long de sa normale.',
}
