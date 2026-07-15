// Générateurs MEP : composants élec ponctuels (E15-01/02), runs routés
// (câble E15-03 / tuyau E16-01) et vanne inline (E16-04).

import * as THREE from 'three'
import { runMesh } from '@/features/mep/routing'
import { PIPE_KIND, slopedPoints } from '@/features/mep/plumbing'
import { CABLE_KIND } from '@/features/mep/cable'
import { valveMesh } from '@/features/mep/valve'
import { decorativeEdges, placeOnPlane, type Generator } from './common'
import type {
  CableParams,
  ElecParams,
  Kind,
  PipeParams,
  ValveParams,
  Vec3,
} from '@/types'

// elec.* — composants électriques ponctuels posés sur une face de mur (E15-01/02,
// cf. mep/elec). params : { largeur_m (u), hauteur_m (v), profondeur_m (normal) }.
// plane.origin = CENTRE du composant sur la face ; la boîte ressort le long de
// +normal (extérieur du mur), sa face arrière affleurant le mur. Un seul générateur
// pour tout le catalogue (seules les dims changent). Rendu = solide teinté « elec ».
export const ELEC_FILL = 0xd85a30 // couleur du calque `elec` (script/naming.mjs)
export const ELEC_EDGE = 0xf3b39a

export const generateElec: Generator<ElecParams> = (params, plane) => {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const hgt = Math.max(Number(params.hauteur_m) || 0, 0.001)
  const dep = Math.max(Number(params.profondeur_m) || 0, 0.001)

  // Géométrie locale : u→X, v→Y, normal→Z. Boîte centrée en (u,v) et décalée d'½
  // profondeur le long de +Z → la face arrière est à normal=0 (sur le mur).
  const geo = new THREE.BoxGeometry(w, hgt, dep)
  geo.translate(0, 0, dep / 2)

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: ELEC_FILL, metalness: 0.1, roughness: 0.7 })
  )
  fill.name = '__fill'

  const group = new THREE.Group()
  group.add(fill, decorativeEdges(geo, ELEC_EDGE))
  placeOnPlane(group, plane)
  return group
}

// Runs ROUTÉS — elec.cable (E15-03) et plomberie.pipe (E16-01), cf. mep/routing
// + mep/cable + mep/plumbing. params : { points:[[x,y,z]…] (monde), largeur_m,
// hauteur_m (section rect.), diametre_mm, section }. Contrairement aux autres
// générateurs, la géométrie est construite en coordonnées MONDE depuis
// `params.points` → on N'appelle PAS placeOnPlane (le groupe reste à l'origine,
// identité) ; le `plane` stocké est purement nominal. Balayage d'une section
// rectangulaire le long du chemin, coudes d'onglet (mitre) aux sommets —
// géométrie basse résolution (4 faces/tronçon). Seule la couleur de calque
// distingue les deux kinds → fabrique paramétrée.
export const PLUMB_FILL = 0x7f77dd // couleur du calque `plomberie` (script/naming.mjs)
export const PLUMB_EDGE = 0xcbc7f2

/** Vrai si `kind` est un run routé (câble ou tuyau). */
export const isRunKind = (
  kind: Kind | string | null | undefined
): kind is 'elec.cable' | 'plomberie.pipe' => kind === CABLE_KIND || kind === PIPE_KIND

/**
 * Points de RENDU d'un run : le tuyau applique sa pente d'évacuation (E16-02,
 * cf. mep/plumbing slopedPoints) ; le câble rend ses clics tels quels. Utilisé
 * partout où la géométrie compte (générateur, accroche, dims) pour rester
 * cohérent avec ce que l'utilisateur voit.
 */
export const runPointsOf = (kind: Kind, params: CableParams | PipeParams): Vec3[] =>
  kind === PIPE_KIND ? slopedPoints(params as PipeParams) : (params.points ?? [])

export function makeGenerateRun<P extends CableParams | PipeParams>(
  fillColor: number,
  edgeColor: number,
  resolvePoints: (params: P) => Vec3[] = (params) => params.points ?? []
): Generator<P> {
  return function generateRun(params) {
    // Balayage de la section le long du chemin : maillage pur (mep/routing),
    // partagé avec les raccords automatiques (E16-03, mep/fittings).
    const { position, index } = runMesh(resolvePoints(params), params)

    const fillGeo = new THREE.BufferGeometry()
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
    fillGeo.setIndex(index)
    fillGeo.computeVertexNormals()

    // Matériau OPAQUE (comme les composants élec) : l'effet d'opacité générique
    // d'EditObject ne teinte que les matériaux `transparent` → le run reste plein.
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshStandardMaterial({ color: fillColor, metalness: 0.1, roughness: 0.7 })
    )
    fill.name = '__fill'

    const group = new THREE.Group()
    group.add(fill, decorativeEdges(fillGeo, edgeColor, 20))
    return group // déjà en coordonnées monde — pas de placeOnPlane
  }
}

// plomberie.valve — vanne INLINE insérée sur un tuyau (E16-04, cf. mep/valve).
// params : { centre (monde, sur l'axe du tuyau), dir (axe unitaire), largeur_m,
// hauteur_m, diametre_mm, famille, section — section du tuyau hôte }. Comme les
// runs : géométrie en coordonnées MONDE (pas de placeOnPlane), maillage pur
// (valveMesh). Un ton plus soutenu que le tuyau, comme les raccords E16-03.
export const VALVE_FILL = 0x655cc9
export const VALVE_EDGE = 0xcbc7f2

export const generateValve: Generator<ValveParams> = (params) => {
  const { position, index } = valveMesh(params)

  const fillGeo = new THREE.BufferGeometry()
  fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  fillGeo.setIndex(index)
  fillGeo.computeVertexNormals()

  const fill = new THREE.Mesh(
    fillGeo,
    new THREE.MeshStandardMaterial({ color: VALVE_FILL, metalness: 0.1, roughness: 0.7 })
  )
  fill.name = '__fill'

  const group = new THREE.Group()
  group.add(fill, decorativeEdges(fillGeo, VALVE_EDGE, 20))
  return group // déjà en coordonnées monde — pas de placeOnPlane
}
