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
// Label `reseau` aligné sur la taxonomie E20 (« Réseaux », ex-« Réseau/Fibre »).
export const LAYERS_CONFIG = {
  structure: { label: 'Structure', color: '#378ADD', visible: true },
  ouvertures: { label: 'Ouvertures', color: '#1D9E75', visible: true },
  elec: { label: 'Électricité', color: '#D85A30', visible: false },
  plomberie: { label: 'Plomberie', color: '#7F77DD', visible: false },
  vmc: { label: 'VMC/Chauffage', color: '#BA7517', visible: false },
  reseau: { label: 'Réseaux', color: '#A855F7', visible: false },
  terrain: { label: 'Terrain', color: '#4CAF50', visible: true },
}

// Taxonomie à deux niveaux (E20) : vocabulaire des sous-types par système.
// Le sous-type EST le segment `type` du node name — le vocabulaire est
// CANONIQUE/SUGGÉRÉ, pas fermé (décision PO 2026-07-07) : un `type` hors liste
// est accepté (avertissement, jamais rejet) et rangé en « Autres » côté UI.
// `value` = segment stocké (normalisé, [a-z0-9_]+) ; `label` = libellé FR.
// SOURCE UNIQUE : l'app (naming.js, editRegistry), le pipeline (process.mjs)
// et le plugin SketchUp (TYPES_BY_SYSTEM, miroir manuel) en héritent.
export const SUBTYPES = {
  structure: [
    { value: 'mur_porteur', label: 'Mur porteur' },
    { value: 'mur_cloison', label: 'Cloison' },
    { value: 'plancher', label: 'Plancher' },
    { value: 'dalle', label: 'Dalle' },
    { value: 'toiture', label: 'Toiture' },
    { value: 'escalier', label: 'Escalier' },
    { value: 'poutre', label: 'Poutre' },
    { value: 'poteau', label: 'Poteau' },
    { value: 'fondation', label: 'Fondation' },
    { value: 'forme', label: 'Forme libre' },
    { value: 'disque', label: 'Disque' },
    { value: 'arc', label: 'Arc' },
  ],
  ouvertures: [
    { value: 'fenetre', label: 'Fenêtre' },
    { value: 'porte', label: 'Porte' },
    { value: 'porte_int', label: 'Porte intérieure' },
    { value: 'porte_ext', label: 'Porte extérieure' },
    { value: 'porte_garage', label: 'Porte de garage' },
    { value: 'baie', label: 'Baie vitrée' },
    { value: 'velux', label: 'Velux' },
    { value: 'volet', label: 'Volet' },
    { value: 'menuiserie', label: 'Menuiserie' },
    { value: 'vantail', label: 'Vantail' },
  ],
  elec: [
    { value: 'cable', label: 'Câble' },
    { value: 'gaine', label: 'Gaine' },
    { value: 'prise', label: 'Prise' },
    { value: 'circuit_prises', label: 'Circuit de prises' },
    { value: 'interrupteur', label: 'Interrupteur' },
    { value: 'luminaire', label: 'Luminaire' },
    { value: 'tableau', label: 'Tableau électrique' },
    { value: 'boite_derivation', label: 'Boîte de dérivation' },
    { value: 'compteur', label: 'Compteur' },
  ],
  plomberie: [
    { value: 'tuyau', label: 'Tuyau' },
    { value: 'eau_froide', label: 'Eau froide' },
    { value: 'eau_chaude', label: 'Eau chaude' },
    { value: 'evacuation', label: 'Évacuation' },
    { value: 'robinetterie', label: 'Robinetterie' },
    { value: 'vanne', label: 'Vanne' },
    { value: 'evier', label: 'Évier' },
    { value: 'toilettes', label: 'Toilettes' },
    { value: 'sanitaire', label: 'Sanitaire' },
    { value: 'chauffe_eau', label: 'Chauffe-eau' },
  ],
  vmc: [
    { value: 'gaine', label: 'Gaine' },
    { value: 'bouche', label: 'Bouche' },
    { value: 'caisson', label: 'Caisson VMC' },
    { value: 'radiateur', label: 'Radiateur' },
    { value: 'chaudiere', label: 'Chaudière' },
    { value: 'thermostat', label: 'Thermostat' },
    { value: 'chauffage', label: 'Chauffage' },
  ],
  reseau: [
    { value: 'rj45', label: 'RJ45' },
    { value: 'fibre', label: 'Fibre' },
    { value: 'internet', label: 'Internet' },
    { value: 'telephone', label: 'Téléphone' },
    { value: 'tv', label: 'TV' },
    { value: 'coffret', label: 'Coffret' },
    { value: 'antenne', label: 'Antenne' },
    { value: 'securite', label: 'Sécurité' },
  ],
  terrain: [
    { value: 'jardin', label: 'Jardin' },
    { value: 'terrasse', label: 'Terrasse' },
    { value: 'potager', label: 'Potager' },
    { value: 'serre', label: 'Serre' },
    { value: 'arche', label: 'Arche' },
    { value: 'allee', label: 'Allée' },
    { value: 'cloture', label: 'Clôture' },
    { value: 'garage', label: 'Garage' },
    { value: 'piscine', label: 'Piscine' },
  ],
}

/** Sous-types canoniques d'un système (liste vide si système inconnu). */
export function subtypesOf(system) {
  return SUBTYPES[system] ?? []
}

/** Label FR du sous-type `type` dans `system`, ou null s'il est hors vocabulaire. */
export function subtypeLabel(system, type) {
  return subtypesOf(system).find((s) => s.value === type)?.label ?? null
}

/** Vrai si `type` appartient au vocabulaire canonique de `system`. */
export function isKnownSubtype(system, type) {
  return subtypeLabel(system, type) !== null
}

// Diacritiques combinants (U+0300–U+036F), produits par la décomposition NFD.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Normalise un segment : minuscules, accents retirés, espaces/tirets → `_`. */
export function normalizeSegment(segment) {
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

// Préfixe que l'exporteur glTF natif de SketchUp ajoute à la géométrie brute
// de chaque groupe/composant nommé : un groupe `structure__…__001` produit un
// enfant mesh `Geom3D_structure__…__001` (issue #7). Le préfixe n'est pas
// configurable depuis SketchUp. On le retire avant validation/parsing pour que
// le mesh hérite du nom propre du groupe.
//
// `Geom3D` seul (sans `_` suffixe) est le nom générique donné par l'exporteur
// à un morceau de géométrie sans nom propre. Il survient dans DEUX cas :
//   - géométrie réellement laissée hors d'un groupe nommé → faute à rejeter ;
//   - fragment par-matériau d'un groupe nommé : l'exporteur découpe la
//     géométrie en une mesh par matériau (issue #11), et seul le morceau au
//     matériau par défaut hérite du nom du groupe ; les morceaux texturés
//     sortent en `Geom3D`.
// On ne peut pas les distinguer sur le seul nom : la discrimination est faite
// au niveau de l'arbre par `collectCandidateNodes` (présence d'un ancêtre nommé).
const EXPORTER_GEOM_PREFIX = /^Geom3D_/

/** Retire le préfixe `Geom3D_` ajouté par l'exporteur SketchUp, s'il est présent. */
export function stripExporterPrefix(name) {
  return name.replace(EXPORTER_GEOM_PREFIX, '')
}

/**
 * Vrai si `name` est le nom générique `Geom3D` que l'exporteur donne à une
 * géométrie sans nom propre (géométrie hors groupe OU fragment par-matériau).
 */
export function isExporterGeomName(name) {
  return name === 'Geom3D'
}

/**
 * Un node est soumis à la convention s'il porte un mesh (objet affichable)
 * ou si son nom contient déjà le séparateur `__` (intention de convention).
 * Les nodes de pur regroupement (wrappers SketchUp) sont ignorés.
 */
export function isCandidateNode(node) {
  return node.getMesh() !== null || node.getName().includes('__')
}

/**
 * Sélectionne les nodes candidats à la convention dans un arbre de scène
 * (parcours préfixe, déjà normalisé : préfixe `Geom3D_` retiré en amont).
 *
 * Tree-aware (issue #11) : un fragment `Geom3D` (mesh par-matériau produit par
 * l'exporteur) situé sous un groupe valablement nommé est **absorbé** par ce
 * groupe — il n'est pas un candidat distinct, sa géométrie étant déjà couverte
 * par le parcours de sous-arbre des dims. Un `Geom3D` **sans ancêtre nommé**
 * reste candidat (vraie géométrie hors groupe → rejetée à la validation).
 *
 * Dédupliqué par nom : un groupe et sa géométrie partagent le même nom après
 * normalisation, on ne retient qu'une entité par nom. Les nodes anonymes (mesh
 * sans nom) sont tous conservés, chacun étant une erreur distincte.
 *
 * @param {Iterable} roots nodes racine de la scène (avec getName/getMesh/listChildren)
 */
export function collectCandidateNodes(roots) {
  const seen = new Set()
  const candidates = []
  const walk = (node, hasNamedAncestor) => {
    const name = node.getName()
    const absorbed = isExporterGeomName(name) && hasNamedAncestor
    if (!absorbed && isCandidateNode(node)) {
      if (name === '') {
        candidates.push(node)
      } else if (!seen.has(name)) {
        seen.add(name)
        candidates.push(node)
      }
    }
    const namedHere = validateNodeName(name).valid
    for (const child of node.listChildren()) walk(child, hasNamedAncestor || namedHere)
  }
  for (const node of roots) walk(node, false)
  return candidates
}

// --- Dimensions calculées depuis la géométrie (issue #9) ---

// Précision d'affichage des cotes : 3 décimales (le mm).
const DIMS_DECIMALS = 3

function roundDim(value) {
  const factor = 10 ** DIMS_DECIMALS
  // `+ 0` neutralise le `-0` (ex. taille nulle sur un axe).
  return Math.round(value * factor) / factor + 0
}

/**
 * Calcule les dimensions d'un élément à partir des bornes (min/max) des
 * accesseurs POSITION de ses meshes et du scale monde de chaque mesh.
 *
 * Repère : la géométrie exportée par SketchUp est dans le repère local du
 * groupe, en **Z-up** (la conversion Y-up de glTF est portée par le node
 * racine de la scène, au-dessus des éléments). D'où le mapping :
 *   X → largeur, Y → profondeur, Z → hauteur.
 * Les bornes sont en pouces côté SketchUp ; le scale monde du node (≈ 0.0254)
 * les ramène en mètres. Un scale négatif (composant miroir) inverse les
 * bornes : on prend min/max sur les deux produits pour rester robuste.
 *
 * @param {Array<{min:number[], max:number[], scale:number[]}>} parts
 *   Une entrée par primitive. `parts` vide → aucune géométrie.
 * @returns {{largeur_m:number, profondeur_m:number, hauteur_m:number}|{}}
 *   Objet vide si aucune géométrie (l'app affichera « — »).
 */
export function computeDims(parts) {
  if (!parts || parts.length === 0) return {}
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const { min, max, scale } of parts) {
    for (let i = 0; i < 3; i++) {
      const a = min[i] * scale[i]
      const b = max[i] * scale[i]
      lo[i] = Math.min(lo[i], a, b)
      hi[i] = Math.max(hi[i], a, b)
    }
  }
  return {
    largeur_m: roundDim(hi[0] - lo[0]),
    profondeur_m: roundDim(hi[1] - lo[1]),
    hauteur_m: roundDim(hi[2] - lo[2]),
  }
}
