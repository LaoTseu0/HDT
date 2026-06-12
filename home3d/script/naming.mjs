// Convention de nommage des nodes (cf. HTD_cahier_des_charges.md).
// Format : [système]__[type]__[zone]__[niveau]__[index 3 chiffres]
// Module séparé du pipeline pour être testable unitairement (E2-09).

export const SYSTEMS = [
  'structure',
  'ouvertures',
  'elec',
  'plomberie',
  'vmc',
  'reseau',
  'terrain',
]

export const LEVELS = ['ss', 'rdc', 'r1', 'r2', 'combles', 'ext']

export const NODE_NAME_REGEX =
  /^(structure|ouvertures|elec|plomberie|vmc|reseau|terrain)__[a-z0-9_]+__[a-z0-9_]+__(ss|rdc|r1|r2|combles|ext)__\d{3}$/

// Config des calques injectée dans les extras de la scène racine (E2-05).
export const LAYERS_CONFIG = {
  structure: { label: 'Structure', color: '#378ADD', visible: true },
  ouvertures: { label: 'Ouvertures', color: '#1D9E75', visible: true },
  elec: { label: 'Électricité', color: '#D85A30', visible: false },
  plomberie: { label: 'Plomberie', color: '#7F77DD', visible: false },
  vmc: { label: 'VMC/Chauffage', color: '#BA7517', visible: false },
  reseau: { label: 'Réseau/Fibre', color: '#A855F7', visible: false },
  terrain: { label: 'Terrain', color: '#4CAF50', visible: true },
}

// Diacritiques combinants (U+0300–U+036F), produits par la décomposition NFD.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Normalise un segment : minuscules, accents retirés, espaces/tirets → `_`. */
function normalizeSegment(segment) {
  return segment
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Valide un nom de node contre la convention et diagnostique chaque
 * violation (E2-02, E2-03).
 *
 * @returns {{ valid: boolean, errors: string[], suggestion: string|null, parsed: object|null }}
 *   - `errors`   : raisons lisibles (segment invalide, casse, accent…)
 *   - `suggestion` : nom corrigé proposé quand une correction automatique a un sens
 *   - `parsed`   : { layer, type, zone, level, index } si le nom est valide
 */
export function validateNodeName(name) {
  if (NODE_NAME_REGEX.test(name)) {
    return { valid: true, errors: [], suggestion: null, parsed: parseNodeName(name) }
  }

  const errors = []

  if (/[A-Z]/.test(name)) errors.push('contient des majuscules (minuscules uniquement)')
  if (/[À-ÿ]/.test(name)) errors.push('contient des accents (interdits)')
  if (/\s/.test(name)) errors.push('contient des espaces (utiliser `_`)')

  const segments = name.split('__')
  if (segments.length !== 5) {
    errors.push(
      `${segments.length} segment(s) au lieu de 5 — format attendu : ` +
        'systeme__type__zone__niveau__index (séparateur `__`)'
    )
  } else {
    const [system, type, zone, level, index] = segments
    const normSystem = normalizeSegment(system)
    const normLevel = normalizeSegment(level)
    if (!SYSTEMS.includes(normSystem)) {
      errors.push(`système \`${system}\` inconnu (attendu : ${SYSTEMS.join(', ')})`)
    }
    if (type.length === 0) errors.push('segment type vide')
    if (zone.length === 0) errors.push('segment zone vide')
    if (!LEVELS.includes(normLevel)) {
      errors.push(`niveau \`${level}\` inconnu (attendu : ${LEVELS.join(', ')})`)
    }
    if (!/^\d{3}$/.test(index)) {
      errors.push(`index \`${index}\` invalide (3 chiffres attendus, ex : 001)`)
    }
  }

  if (errors.length === 0) {
    errors.push('ne respecte pas la convention de nommage')
  }

  // Suggestion : normalisation automatique si elle suffit à rendre le nom valide.
  let suggestion = null
  if (segments.length === 5) {
    const candidate = segments
      .map((seg, i) => {
        const norm = normalizeSegment(seg)
        // Index : re-padding sur 3 chiffres si numérique.
        if (i === 4 && /^\d+$/.test(norm)) return norm.padStart(3, '0').slice(-3)
        return norm
      })
      .join('__')
    if (NODE_NAME_REGEX.test(candidate) && candidate !== name) suggestion = candidate
  }

  return { valid: false, errors, suggestion, parsed: null }
}

/**
 * Extrait les métadonnées d'un nom de node valide (E2-04).
 * @returns {{ layer: string, type: string, zone: string, level: string, index: number }}
 */
export function parseNodeName(name) {
  const [layer, type, zone, level, index] = name.split('__')
  return { layer, type, zone, level, index: Number.parseInt(index, 10) }
}

/**
 * Un node est soumis à la convention s'il porte un mesh (objet affichable)
 * ou si son nom contient déjà le séparateur `__` (intention de convention).
 * Les nodes de pur regroupement (wrappers SketchUp) sont ignorés.
 */
export function isCandidateNode(node) {
  return node.getMesh() !== null || node.getName().includes('__')
}
