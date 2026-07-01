// Câble électrique ROUTÉ (catégorie ② « linéaire/routé », E15-03, cf.
// docs/edit-mode-design.md § 5.3). Module PUR (pas de three, pas de react) →
// testable seul (script/cable.test.mjs).
//
// Le câble est un « run » : une polyligne balayée avec une SECTION RECTANGULAIRE
// (cf. lib/routing). Les gaines « catalogue » (ICT Ø16/20/25/32) deviennent des
// PRESETS de section rectangulaire d'emprise équivalente (côté = diamètre) ; on
// conserve l'identité nominale (`diametre_mm`) dans les params pour l'étiquetage,
// mais on REND un profil rectangulaire (4 faces/tronçon). La plomberie (E16)
// réutilisera lib/routing avec son propre catalogue de sections.

import { dedupePath, pathLength } from './routing.js'

export const CABLE_KIND = 'elec.cable'

// Catalogue des sections (gaines ICT courantes). `dims` = section rectangulaire
// d'emprise équivalente (côté = Ø nominal) ; `diametre_mm` = identité conservée.
export const CABLE_SECTIONS = {
  gaine16: { label: 'Gaine Ø16', diametre_mm: 16, dims: { largeur_m: 0.016, hauteur_m: 0.016 } },
  gaine20: { label: 'Gaine Ø20', diametre_mm: 20, dims: { largeur_m: 0.02, hauteur_m: 0.02 } },
  gaine25: { label: 'Gaine Ø25', diametre_mm: 25, dims: { largeur_m: 0.025, hauteur_m: 0.025 } },
  gaine32: { label: 'Gaine Ø32', diametre_mm: 32, dims: { largeur_m: 0.032, hauteur_m: 0.032 } },
}

export const CABLE_SECTION_KEYS = Object.keys(CABLE_SECTIONS)
export const DEFAULT_CABLE_SECTION = 'gaine20'

const round = (x) => Number(Number(x).toFixed(4))

/** Longueur totale (m) d'un câble depuis ses params (points). */
export function cableLength(params) {
  return pathLength(params?.points ?? [])
}

/**
 * Payload `{ kind, params, plane }` d'un câble routé le long de `points` (monde).
 * Le chemin est dédupliqué ; il faut au moins 2 sommets distincts (sinon `null`).
 * `plane` est nominal (le run vit en coordonnées MONDE dans `params.points` — le
 * générateur `generateRun` ignore le repère). On conserve la section nominale
 * (`diametre_mm`, `section`) pour l'inspecteur, et `largeur_m`/`hauteur_m` (§ 5.3)
 * pour le rendu du profil rectangulaire.
 * @param {number[][]} points chemin cliqué (monde)
 * @param {string} [sectionKey] preset du catalogue (défaut = gaine Ø20)
 * @returns payload prêt pour `createObject`, ou `null` si < 2 sommets distincts.
 */
export function cablePayloadFromPath(points, sectionKey = DEFAULT_CABLE_SECTION) {
  const pts = dedupePath(points)
  if (pts.length < 2) return null
  const key = CABLE_SECTIONS[sectionKey] ? sectionKey : DEFAULT_CABLE_SECTION
  const sec = CABLE_SECTIONS[key]
  return {
    kind: CABLE_KIND,
    params: {
      points: pts.map((p) => [round(p[0]), round(p[1]), round(p[2])]),
      largeur_m: sec.dims.largeur_m,
      hauteur_m: sec.dims.hauteur_m,
      diametre_mm: sec.diametre_mm,
      section: key,
    },
    plane: { type: 'run', origin: pts[0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  }
}
