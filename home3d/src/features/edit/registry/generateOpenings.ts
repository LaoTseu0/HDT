// Générateurs des ouvertures et de leurs composants hébergés (E14) :
// marqueur d'ouverture (fenêtre/porte), menuiserie, vantail de porte.

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { joineryVariantOf } from '@/features/openings/joinery'
import { decorativeEdges, placeOnPlane, type Generator } from './common'
import type { DoorLeafParams, DoorParams, JoineryParams, WindowParams } from '@/types'

// opening.window — ouverture (fenêtre) posée sur une face de mur (E14-01).
// params : { largeur_m (axe u), hauteur_m (axe v, depuis le seuil), allege_m }.
// plane.origin = CENTRE DU SEUIL ; la géométrie monte de v=0 à v=hauteur (cf.
// openings/opening). Rendu = cadre translucide teinté « ouvertures » posé sur le
// mur (marqueur) ; le VRAI vide (CSG) est recalculé par WallCutter (E14-02).
const OPENING_FILL = 0x2ec4b6
const OPENING_EDGE = 0x9be7df

export const generateOpening: Generator<WindowParams | DoorParams> = (params, plane) => {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const h = Math.max(Number(params.hauteur_m) || 0, 0.001)

  // Géométrie locale : u→X, v→Y, normal→Z. Rectangle centré puis remonté d'½ h
  // pour que sa BASE (le seuil) soit à v=0 (= origin).
  const geo = new THREE.PlaneGeometry(w, h)
  geo.translate(0, h / 2, 0)

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: OPENING_FILL,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  )
  fill.name = '__fill'

  const group = new THREE.Group()
  group.add(fill, decorativeEdges(geo, OPENING_EDGE))
  placeOnPlane(group, plane)
  return group
}

// joinery.frame — menuiserie (cadre + vitrage) posée DANS une ouverture (E14-05,
// cf. openings/joinery). params : { largeur_m (u), hauteur_m (v) — copiés de
// l'hôte à la pose —, epaisseur_m (section des montants), profondeur_m (dormant,
// le long de la normale), variante (E14-06 : fixe/battant/coulissant, repli
// fixe) }. plane = celui de l'ouverture hôte (origin = CENTRE DU SEUIL, géométrie
// de v=0 à v=hauteur comme generateOpening) + `hostOf`. Composant posé
// (catégorie ①), AUCUN booléen : le cadre est ENCASTRÉ dans le vide creusé par
// l'ouverture (z ∈ [-profondeur, 0], face avant affleurant la face du mur).
const JOINERY_FILL = 0x1d9e75 // couleur du calque `ouvertures` (script/naming.mjs)
const JOINERY_EDGE = 0x9be7df
const GLASS_FILL = 0xbfe3f2
const GLASS_T = 0.008 // épaisseur du vitrage (m)

export const generateJoinery: Generator<JoineryParams> = (params, plane) => {
  const w = Math.max(Number(params.largeur_m) || 0, 0.05)
  const h = Math.max(Number(params.hauteur_m) || 0, 0.05)
  // Section des montants bornée : au moins 1 cm, et jamais au point de fermer le
  // jour (il reste une baie vitrée d'au moins ~1 cm).
  const t = Math.min(
    Math.max(Number(params.epaisseur_m) || 0, 0.01),
    (Math.min(w, h) - 0.01) / 2
  )
  const d = Math.max(Number(params.profondeur_m) || 0, 0.01)
  const zc = -d / 2 // encastré : face avant à z=0 (plan du mur), corps vers le vide
  const variante = joineryVariantOf(params.variante)

  // Cadre = 2 traverses + 2 montants (boîtes locales u→X, v→Y, normal→Z),
  // fusionnés en UNE géométrie → un seul mesh `__fill` (sélection/émissif
  // d'EditObject uniformes sur tout le cadre). `bd`/`cz` optionnels : les pièces
  // des variantes (meneau, montants de recouvrement) ont leur propre profondeur/
  // position le long de la normale.
  const bar = (bw: number, bh: number, cx: number, cy: number, bd = d, cz = zc) => {
    const g = new THREE.BoxGeometry(bw, bh, bd)
    g.translate(cx, cy, cz)
    return g
  }
  const frameParts = [
    bar(w, t, 0, t / 2), // traverse basse (seuil)
    bar(w, t, 0, h - t / 2), // traverse haute
    bar(t, h - 2 * t, -(w - t) / 2, h / 2), // montant gauche
    bar(t, h - 2 * t, (w - t) / 2, h / 2), // montant droit
  ]

  // Vitrage(s) : fine(s) plaque(s) translucide(s) dans le jour du cadre, selon la
  // variante (E14-06). Jour = u ∈ ±(w/2 − t), v ∈ [t, h − t].
  const jourW = w - 2 * t
  const jourH = h - 2 * t
  const pane = (pw: number, cx: number, cz = zc) => {
    const g = new THREE.BoxGeometry(Math.max(pw, 0.001), jourH, GLASS_T)
    g.translate(cx, h / 2, cz)
    return g
  }
  const glassParts: THREE.BufferGeometry[] = []
  if (variante === 'battant') {
    // Meneau central + un vitrage par vantail (2 panneaux côte à côte).
    frameParts.push(bar(t, jourH, 0, h / 2))
    const pw = (w - 3 * t) / 2
    glassParts.push(pane(pw, -(w - t) / 4), pane(pw, (w - t) / 4))
  } else if (variante === 'coulissant') {
    // 2 vantaux sur rails décalés le long de la normale : chacun = vitrage d'une
    // demi-baie (+ recouvrement central de t) porté par son montant de
    // recouvrement — les deux montants se croisent au centre, sur des plans
    // différents (lecture immédiate du coulissant). Décalage borné pour rester
    // dans le dormant même à faible profondeur.
    const dz = Math.min(GLASS_T, d / 4)
    const dv = Math.min(d / 2, 0.04) // profondeur d'un montant de vantail
    const pw = (w - t) / 2
    frameParts.push(bar(t, jourH, 0, h / 2, dv, zc + dz)) // montant vantail avant
    frameParts.push(bar(t, jourH, 0, h / 2, dv, zc - dz)) // montant vantail arrière
    glassParts.push(
      pane(pw, -(w - 3 * t) / 4, zc + dz),
      pane(pw, (w - 3 * t) / 4, zc - dz)
    )
  } else {
    // fixe (rendu E14-05) : un seul vitrage plein jour.
    glassParts.push(pane(jourW, 0))
  }

  const frameGeo = mergeGeometries(frameParts)

  const fill = new THREE.Mesh(
    frameGeo,
    new THREE.MeshStandardMaterial({
      color: JOINERY_FILL,
      metalness: 0.1,
      roughness: 0.6,
    })
  )
  fill.name = '__fill'

  const glassGeo = mergeGeometries(glassParts)
  const glass = new THREE.Mesh(
    glassGeo,
    new THREE.MeshStandardMaterial({
      color: GLASS_FILL,
      transparent: true,
      opacity: 0.3,
      metalness: 0.3,
      roughness: 0.1,
      depthWrite: false,
    })
  )
  glass.name = '__glass'

  const group = new THREE.Group()
  group.add(fill, glass, decorativeEdges(frameGeo, JOINERY_EDGE))
  placeOnPlane(group, plane)
  return group
}

// door.leaf — vantail de porte posé DANS une ouverture PORTE (E14-07, cf.
// openings/joinery). Même mécanique que la menuiserie de fenêtre (composant
// hébergé, catégorie ①, AUCUN booléen), géométrie différente : dormant à 3 côtés
// (2 montants + traverse haute, PAS de traverse basse — le seuil reste libre) +
// panneau plein (vantail fermé) + poignée. params : { largeur_m (u), hauteur_m
// (v, depuis le seuil au sol), epaisseur_m (section du dormant), profondeur_m
// (dormant, le long de la normale) }. plane = celui de la porte hôte + `hostOf`.
const LEAF_T = 0.04 // épaisseur du panneau de vantail (m)

export const generateDoorLeaf: Generator<DoorLeafParams> = (params, plane) => {
  const w = Math.max(Number(params.largeur_m) || 0, 0.05)
  const h = Math.max(Number(params.hauteur_m) || 0, 0.05)
  // Section du dormant bornée comme la menuiserie : jamais au point de fermer le
  // passage (il reste un jour d'au moins ~1 cm).
  const t = Math.min(
    Math.max(Number(params.epaisseur_m) || 0, 0.01),
    (Math.min(w, h) - 0.01) / 2
  )
  const d = Math.max(Number(params.profondeur_m) || 0, 0.01)
  const zc = -d / 2 // encastré : face avant à z=0 (plan du mur), corps vers le vide
  const bar = (bw: number, bh: number, cx: number, cy: number, bd = d, cz = zc) => {
    const g = new THREE.BoxGeometry(bw, bh, bd)
    g.translate(cx, cy, cz)
    return g
  }

  // Dormant 3 côtés : montants pleine hauteur + traverse haute entre eux.
  const jourW = w - 2 * t
  const jourH = h - t
  const parts = [
    bar(t, h, -(w - t) / 2, h / 2), // montant gauche
    bar(t, h, (w - t) / 2, h / 2), // montant droit
    bar(jourW, t, 0, h - t / 2), // traverse haute
  ]
  // Vantail plein (fermé) dans le jour, épaisseur bornée par le dormant.
  const lt = Math.min(LEAF_T, d)
  parts.push(bar(jourW, jourH, 0, jourH / 2, lt, zc))
  // Poignée : petit barreau horizontal côté droit, ~1,05 m du seuil (borné au jour),
  // ressorti devant le panneau (lecture immédiate « porte », pas « panneau mural »).
  const hy = Math.min(1.05, jourH - 0.05)
  parts.push(
    bar(0.14, 0.03, Math.max(jourW / 2 - 0.12, 0), hy, 0.03, zc + lt / 2 + 0.015)
  )

  // Tout fusionné en UNE géométrie → un seul mesh `__fill` (sélection/émissif
  // d'EditObject uniformes), même couleur calque `ouvertures` que la menuiserie.
  const leafGeo = mergeGeometries(parts)

  const fill = new THREE.Mesh(
    leafGeo,
    new THREE.MeshStandardMaterial({
      color: JOINERY_FILL,
      metalness: 0.1,
      roughness: 0.6,
    })
  )
  fill.name = '__fill'

  const group = new THREE.Group()
  group.add(fill, decorativeEdges(leafGeo, JOINERY_EDGE))
  placeOnPlane(group, plane)
  return group
}
