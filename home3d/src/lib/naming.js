// Génération des node names conformes pour les objets créés in-app (E12-06,
// cf. HTD_cahier_des_charges.md « convention de nommage »).
//
// La CONVENTION (regex, systèmes, niveaux, normalisation) est la source unique
// de `script/naming.mjs` — partagée avec le pipeline (process.mjs) pour que les
// noms générés ici passent EXACTEMENT la même validation. Ce module n'ajoute que
// la logique de GÉNÉRATION (côté app) : node name + index auto-incrémenté.
//
// Découplage clé : l'`id` interne d'un objet app (clé du store) est STABLE et
// distinct du node name. Le node name (système__type__zone__niveau__index) est
// DÉRIVÉ des champs de nommage → on peut changer zone/niveau dans l'inspector
// sans renommer la clé du store (cohérent avec l'immutabilité des ids, E7-03).

import { NODE_NAME_REGEX, SYSTEMS, LEVELS, normalizeSegment } from '../../script/naming.mjs'

export { NODE_NAME_REGEX, SYSTEMS, LEVELS }

// Zone / niveau par défaut quand le modèle n'en fournit pas (édition sans modèle
// chargé, ou toute première forme). Segments valides au sens de la convention.
export const DEFAULT_ZONE = 'libre'
export const DEFAULT_LEVEL = 'rdc'

const pad3 = (n) => String(Math.max(1, Math.trunc(Number(n) || 1))).padStart(3, '0').slice(-3)

/**
 * Normalise une zone choisie/saisie à la convention ; repli DEFAULT_ZONE si la
 * normalisation ne laisse aucun caractère utile (vide, ou que des séparateurs).
 */
export function normalizeZone(zone) {
  const z = normalizeSegment(String(zone ?? ''))
  return /[a-z0-9]/.test(z) ? z : DEFAULT_ZONE
}

/**
 * Node name conforme d'un objet app : `système__type__zone__niveau__index`.
 * `système`/`type` viennent du registre (kindNaming) ; `zone`/`niveau` de
 * l'inspector ; `index` est auto-incrémenté par bucket (cf. nextIndex).
 * @returns {string} nom qui passe NODE_NAME_REGEX.
 */
export function nodeName({ system, type, zone, level, index }) {
  return `${system}__${type}__${zone}__${level}__${pad3(index)}`
}

/**
 * Prochain index libre du bucket (système, zone, niveau) : **max existant + 1**
 * (et non count + 1) pour ne jamais réutiliser un index après une suppression,
 * ce qui produirait deux node names identiques.
 * @param {Record<string, object>} objects  table des objets app
 * @param {{system, zone, level}} bucket
 * @param {string|null} excludeId  objet à ignorer (ex. lui-même lors d'un changement de zone)
 */
export function nextIndex(objects, { system, zone, level }, excludeId = null) {
  let max = 0
  for (const o of Object.values(objects)) {
    if (o.id === excludeId) continue
    if (o.system === system && o.zone === zone && o.level === level && o.index > max) {
      max = o.index
    }
  }
  return max + 1
}
