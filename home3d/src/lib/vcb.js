// Saisie de cote au clavier pendant un tracé — la « VCB » de SketchUp (Value
// Control Box), E12-04. Module PUR (pas de three, pas de react) → testable seul
// (script/vcb.test.mjs).
//
// Pour l'outil Rectangle, on saisit « Largeur ; Profondeur » en mètres. Le
// séparateur de cotes est `;` (façon liste SketchUp) ; le séparateur décimal
// accepté est `,` ou `.`. Une cote omise garde la valeur du glissé en cours :
//   "1,2;0,8" → L 1,2  P 0,8       "2;"  → L 2  (P inchangée)
//   ";0,8"    → P 0,8 (L inchangée)  "2"  → L 2  (P inchangée)

// Un jeton numérique : undefined si vide (= « garder »), null si invalide
// (NaN / ≤ 0), sinon le nombre en mètres.
function parseToken(tok) {
  const t = tok.trim().replace(',', '.')
  if (t === '') return undefined
  const v = Number(t)
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Parse la saisie VCB d'un rectangle.
 * @param {string} text saisie brute (ce que l'utilisateur a tapé)
 * @returns {{ width?:number, depth?:number } | null}
 *   `null` si la saisie est vide ou invalide (aucune cote exploitable) →
 *   l'appelant retombe alors sur les cotes du glissé.
 */
export function parseVcb(text) {
  if (!text) return null
  const parts = text.split(';')
  const width = parseToken(parts[0])
  const depth = parts.length > 1 ? parseToken(parts[1]) : undefined
  if (width === null || depth === null) return null // un jeton fourni mais invalide
  if (width === undefined && depth === undefined) return null
  const out = {}
  if (width !== undefined) out.width = width
  if (depth !== undefined) out.depth = depth
  return out
}

/**
 * Applique des cotes VCB à un tracé en cours, en CONSERVANT la direction du
 * glissé (le coin de départ reste fixe, on ne change que la magnitude). Les
 * coordonnées sont les (s,t) du plan d'esquisse.
 * @param {{start:number[], current:number[]}} draft
 * @param {{ width?:number, depth?:number } | null} parsed
 * @returns nouveau draft (mêmes champs) avec `current` ajusté
 */
export function applyVcbToDraft(draft, parsed) {
  if (!parsed) return draft
  const [s0, t0] = draft.start
  const [s1, t1] = draft.current
  const sgnW = Math.sign(s1 - s0) || 1
  const sgnD = Math.sign(t1 - t0) || 1
  const ns = parsed.width != null ? s0 + sgnW * parsed.width : s1
  const nt = parsed.depth != null ? t0 + sgnD * parsed.depth : t1
  return { ...draft, current: [ns, nt] }
}

/**
 * Parse la saisie VCB d'un cercle : une seule valeur = le rayon en mètres.
 * @returns {{ radius:number } | null} `null` si vide ou invalide.
 */
export function parseVcbRadius(text) {
  if (!text) return null
  const v = parseToken(text.split(';')[0])
  return v == null || v === undefined ? null : { radius: v }
}

/**
 * Applique un rayon VCB à un tracé de cercle, en CONSERVANT la direction du
 * glissé (le centre reste fixe, on n'ajuste que la distance centre→bord).
 * @param {{start:number[], current:number[]}} draft
 * @param {{ radius:number } | null} parsed
 */
export function applyVcbRadiusToDraft(draft, parsed) {
  if (!parsed) return draft
  const [s0, t0] = draft.start
  const [s1, t1] = draft.current
  const len = Math.hypot(s1 - s0, t1 - t0) || 1
  const k = parsed.radius / len
  return { ...draft, current: [s0 + (s1 - s0) * k, t0 + (t1 - t0) * k] }
}

/**
 * Parse la saisie VCB d'un angle (balayage d'arc, E13-03) : une valeur en DEGRÉS,
 * signe et magnitude > 360 admis (arc majeur, sens horaire/anti-horaire).
 * Diffère de parseToken (qui rejette ≤ 0) : un angle peut être négatif.
 * @returns {{ angleDeg:number } | null} `null` si vide ou non numérique.
 */
export function parseVcbAngle(text) {
  if (!text) return null
  const t = String(text).split(';')[0].trim().replace(',', '.')
  if (t === '' || t === '-' || t === '.') return null
  const v = Number(t)
  return Number.isFinite(v) && v !== 0 ? { angleDeg: v } : null
}
