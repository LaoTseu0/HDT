// Tuyau de plomberie ROUTÉ (catégorie ② « linéaire/routé », E16-01, cf.
// docs/edit-mode-design.md § 5.3). Module PUR (pas de three, pas de react) →
// testable seul (script/plumbing.test.mjs).
//
// Même mécanique que le câble élec (E15-03, cf. lib/cable) : un « run » = une
// polyligne balayée avec une SECTION RECTANGULAIRE (lib/routing, réutilisé tel
// quel). Les Ø prédéfinis du catalogue (cuivre d'alimentation, évacuation PVC)
// deviennent des sections rectangulaires d'emprise équivalente (côté = Ø
// nominal) ; l'identité nominale (`diametre_mm`, `famille`) est conservée dans
// les params pour l'étiquetage — et pour E16-02 (la pente ne concerne que les
// runs d'évacuation).

import { dedupePath, pathLength } from './routing.js'

export const PIPE_KIND = 'plomberie.pipe'

// Catalogue des sections. `famille` : 'cuivre' (alimentation) | 'evac'
// (évacuation PVC). `dims` = section rectangulaire d'emprise équivalente.
export const PIPE_SECTIONS = {
  cuivre12: { label: 'Cuivre Ø12', famille: 'cuivre', diametre_mm: 12, dims: { largeur_m: 0.012, hauteur_m: 0.012 } },
  cuivre14: { label: 'Cuivre Ø14', famille: 'cuivre', diametre_mm: 14, dims: { largeur_m: 0.014, hauteur_m: 0.014 } },
  cuivre16: { label: 'Cuivre Ø16', famille: 'cuivre', diametre_mm: 16, dims: { largeur_m: 0.016, hauteur_m: 0.016 } },
  cuivre18: { label: 'Cuivre Ø18', famille: 'cuivre', diametre_mm: 18, dims: { largeur_m: 0.018, hauteur_m: 0.018 } },
  cuivre22: { label: 'Cuivre Ø22', famille: 'cuivre', diametre_mm: 22, dims: { largeur_m: 0.022, hauteur_m: 0.022 } },
  evac32: { label: 'Évac PVC Ø32', famille: 'evac', diametre_mm: 32, dims: { largeur_m: 0.032, hauteur_m: 0.032 } },
  evac40: { label: 'Évac PVC Ø40', famille: 'evac', diametre_mm: 40, dims: { largeur_m: 0.04, hauteur_m: 0.04 } },
  evac100: { label: 'Évac PVC Ø100', famille: 'evac', diametre_mm: 100, dims: { largeur_m: 0.1, hauteur_m: 0.1 } },
}

export const PIPE_SECTION_KEYS = Object.keys(PIPE_SECTIONS)
export const DEFAULT_PIPE_SECTION = 'cuivre16'

const round = (x) => Number(Number(x).toFixed(4))

/** Pente maximale d'un run d'évacuation (%) — au-delà, on route autrement. */
export const MAX_PENTE_PCT = 10

/** Pente effective d'un run (%) : bornée [0, MAX_PENTE_PCT], évac seulement. */
export function pentePct(params) {
  if (params?.famille !== 'evac') return 0
  return Math.min(Math.max(Number(params?.pente_pct) || 0, 0), MAX_PENTE_PCT)
}

/**
 * Points de RENDU d'un tuyau (E16-02) : sur un run d'évacuation portant une
 * pente, chaque sommet descend de `pente% × longueur HORIZONTALE cumulée`
 * depuis le départ (1er point cliqué = l'AMONT — on route de l'amont vers
 * l'aval). Les tronçons verticaux n'ajoutent pas de descente. NON-DESTRUCTIF :
 * `params.points` (les clics) n'est jamais modifié — la pente est appliquée à
 * la volée par le générateur, l'accroche et les raccords (E16-03).
 * @param {{points?:number[][], famille?:string, pente_pct?:number}} params
 * @returns {number[][]} points pentus (ou `points` tel quel si pente nulle)
 */
export function slopedPoints(params) {
  const pts = params?.points ?? []
  const pente = pentePct(params)
  if (!pente || pts.length < 2) return pts
  const out = [[...pts[0]]]
  let cumul = 0
  for (let i = 1; i < pts.length; i++) {
    cumul += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2])
    out.push([pts[i][0], round(pts[i][1] - (pente / 100) * cumul), pts[i][2]])
  }
  return out
}

/** Longueur totale (m) d'un tuyau depuis ses params (pente comprise). */
export function pipeLength(params) {
  return pathLength(slopedPoints(params))
}

/**
 * Payload `{ kind, params, plane }` d'un tuyau routé le long de `points` (monde).
 * Le chemin est dédupliqué ; il faut au moins 2 sommets distincts (sinon `null`).
 * `plane` est nominal (le run vit en coordonnées MONDE dans `params.points` — le
 * générateur `generateRun` ignore le repère). On conserve la section nominale
 * (`diametre_mm`, `famille`, `section`) pour l'inspecteur, et `largeur_m`/
 * `hauteur_m` (§ 5.3) pour le rendu du profil rectangulaire.
 * @param {number[][]} points chemin cliqué (monde)
 * @param {string} [sectionKey] preset du catalogue (défaut = cuivre Ø16)
 * @returns payload prêt pour `createObject`, ou `null` si < 2 sommets distincts.
 */
export function pipePayloadFromPath(points, sectionKey = DEFAULT_PIPE_SECTION) {
  const pts = dedupePath(points)
  if (pts.length < 2) return null
  const key = PIPE_SECTIONS[sectionKey] ? sectionKey : DEFAULT_PIPE_SECTION
  const sec = PIPE_SECTIONS[key]
  return {
    kind: PIPE_KIND,
    params: {
      points: pts.map((p) => [round(p[0]), round(p[1]), round(p[2])]),
      largeur_m: sec.dims.largeur_m,
      hauteur_m: sec.dims.hauteur_m,
      diametre_mm: sec.diametre_mm,
      famille: sec.famille,
      section: key,
      // Pente (E16-02) : paramétrable sur les runs d'évacuation seulement,
      // nulle à la pose (le tracé cliqué est rendu tel quel).
      ...(sec.famille === 'evac' ? { pente_pct: 0 } : {}),
    },
    plane: { type: 'run', origin: pts[0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  }
}
