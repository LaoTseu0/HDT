import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { referencePoints, generateObject, deriveDims } from '../src/lib/editRegistry.js'
import { JOINERY_KIND, DOOR_LEAF_KIND } from '../src/lib/joinery.js'

// referencePoints est PUR (params + repère du plan → points monde) : testable hors
// navigateur, sans rendu three. Il alimente l'« accroche à tes formes » (E12-03).

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const has = (pts, type, point, eps = 1e-9) =>
  pts.some((p) => p.type === type && p.point.every((x, i) => close(x, point[i], eps)))

describe('referencePoints', () => {
  it('kind inconnu → aucun point', () => {
    assert.deepEqual(
      referencePoints({ kind: 'does.not.exist', params: {}, plane: {} }),
      []
    )
  })

  it('rectangle plat (sol) : 4 coins + 4 milieux + centre = 9 points', () => {
    // Repère sol : u=+X, v=+Z, normal=+Y ; centre à l'origine.
    const obj = {
      kind: 'sketch.rect',
      params: { largeur_m: 2, profondeur_m: 4 },
      plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 9)
    assert.equal(pts.filter((p) => p.type === 'endpoint').length, 4)
    // Coins (±largeur/2 sur u=X, ±profondeur/2 sur v=Z) :
    assert.ok(has(pts, 'endpoint', [1, 0, 2]))
    assert.ok(has(pts, 'endpoint', [-1, 0, -2]))
    // Milieu d'une arête + centre :
    assert.ok(has(pts, 'midpoint', [1, 0, 0]))
    assert.ok(has(pts, 'midpoint', [0, 0, 0])) // centre
  })

  it('boîte extrudée : faces base ET haute + milieux verticaux = 22 points', () => {
    const obj = {
      kind: 'sketch.rect',
      params: { largeur_m: 2, profondeur_m: 2, hauteur_m: 3 },
      plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 22) // 9 base + 9 haut + 4 arêtes verticales
    assert.ok(has(pts, 'endpoint', [1, 0, 1])) // coin base (y=0)
    assert.ok(has(pts, 'endpoint', [1, 3, 1])) // coin haut (y=hauteur)
    assert.ok(has(pts, 'midpoint', [1, 1.5, 1])) // milieu arête verticale (mi-hauteur)
    assert.ok(has(pts, 'midpoint', [0, 3, 0])) // centre face haute
  })

  it('repère mural (face verticale) : v vertical → coins en hauteur', () => {
    // Mur dans le plan XY, normale +Z : u=+X (horizontal), v=+Y (vertical).
    const obj = {
      kind: 'sketch.rect',
      params: { largeur_m: 2, profondeur_m: 2 },
      plane: { origin: [0, 1, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
    }
    const pts = referencePoints(obj)
    assert.ok(has(pts, 'endpoint', [1, 2, 0])) // coin haut-droit (v=+Y monte)
    assert.ok(has(pts, 'endpoint', [-1, 0, 0])) // coin bas-gauche
  })

  it('menuiserie (E14-05) : même repère seuil que l’ouverture hôte', () => {
    // Mur dans le plan XY, seuil (origin) à y=1 : coins v∈[0,h], u∈[-w/2,w/2].
    const obj = {
      kind: JOINERY_KIND,
      params: { largeur_m: 1.6, hauteur_m: 1.4, epaisseur_m: 0.06, profondeur_m: 0.08 },
      plane: { origin: [0, 1, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 9)
    assert.ok(has(pts, 'endpoint', [-0.8, 1, 0])) // coin seuil gauche
    assert.ok(has(pts, 'endpoint', [0.8, 2.4, 0])) // coin haut droit
    assert.ok(has(pts, 'midpoint', [0, 1.7, 0])) // centre
  })
})

// Générateur menuiserie (E14-05) : structure du groupe (cadre fusionné + vitrage
// + arêtes) et dims dérivées — pur three, exécutable hors navigateur.
describe('joinery.frame (générateur)', () => {
  const obj = {
    id: 'app-9',
    kind: JOINERY_KIND,
    params: { largeur_m: 1.6, hauteur_m: 1.4, epaisseur_m: 0.06, profondeur_m: 0.08 },
    plane: { origin: [2, 1, 0.15], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  }

  it('génère cadre (__fill), vitrage (__glass) et arêtes (__edges)', () => {
    const g = generateObject(obj)
    assert.ok(g)
    const fill = g.getObjectByName('__fill')
    const glass = g.getObjectByName('__glass')
    const edges = g.getObjectByName('__edges')
    assert.ok(fill?.isMesh)
    assert.ok(glass?.isMesh)
    assert.ok(edges?.isLineSegments)
    assert.ok(fill.geometry.attributes.position.count > 0)
    assert.ok(glass.material.transparent) // vitrage translucide
    assert.equal(g.userData.appObjectId, 'app-9')
  })

  it('deriveDims : u→largeur, v→hauteur, normal→profondeur', () => {
    assert.deepEqual(deriveDims(obj), {
      largeur_m: 1.6,
      profondeur_m: 0.08,
      hauteur_m: 1.4,
    })
  })

  // Variantes (E14-06) : même kind/emprise, seule la géométrie générée diffère.
  const withVariant = (variante) => ({ ...obj, params: { ...obj.params, variante } })
  const counts = (variante) => {
    const g = generateObject(withVariant(variante))
    return {
      frame: g.getObjectByName('__fill').geometry.attributes.position.count,
      glass: g.getObjectByName('__glass').geometry.attributes.position.count,
    }
  }

  it('battant : meneau central (cadre enrichi) + un vitrage par vantail', () => {
    const fixe = counts('fixe')
    const battant = counts('battant')
    assert.ok(battant.frame > fixe.frame) // + 1 boîte (meneau)
    assert.equal(battant.glass, 2 * fixe.glass) // 2 panneaux
  })

  it('coulissant : 2 montants de recouvrement + 2 vitrages sur des plans décalés', () => {
    const fixe = counts('fixe')
    const coulissant = counts('coulissant')
    assert.ok(coulissant.frame > fixe.frame) // + 2 boîtes (montants de vantail)
    assert.equal(coulissant.glass, 2 * fixe.glass)
    // Les 2 vitrages sont décalés le long de Z local (rails avant/arrière).
    const g = generateObject(withVariant('coulissant'))
    const pos = g.getObjectByName('__glass').geometry.attributes.position
    const zs = new Set()
    for (let i = 0; i < pos.count; i++) zs.add(Math.round(pos.getZ(i) * 1e6))
    assert.ok(zs.size >= 4) // ≥ 2 plaques × 2 faces à des Z distincts
  })

  it('variante inconnue ou absente → rendu fixe (rétro-compat E14-05)', () => {
    const fixe = counts('fixe')
    assert.deepEqual(counts('velux'), fixe)
    assert.deepEqual(counts(undefined), fixe)
  })
})

// Générateur vantail de porte (E14-07) : dormant 3 côtés + panneau plein +
// poignée fusionnés en un seul __fill, pas de vitrage.
describe('door.leaf (générateur)', () => {
  const obj = {
    id: 'app-10',
    kind: DOOR_LEAF_KIND,
    params: { largeur_m: 0.9, hauteur_m: 2.15, epaisseur_m: 0.06, profondeur_m: 0.08 },
    plane: { origin: [4, 0, 0.15], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  }

  it('génère vantail (__fill) et arêtes (__edges), SANS vitrage', () => {
    const g = generateObject(obj)
    assert.ok(g)
    const fill = g.getObjectByName('__fill')
    const edges = g.getObjectByName('__edges')
    assert.ok(fill?.isMesh)
    assert.ok(edges?.isLineSegments)
    assert.equal(g.getObjectByName('__glass'), undefined) // panneau plein, pas de vitrage
    // 5 boîtes fusionnées (2 montants + traverse + panneau + poignée) × 24 sommets.
    assert.equal(fill.geometry.attributes.position.count, 5 * 24)
    assert.ok(!fill.material.transparent) // vantail opaque
    assert.equal(g.userData.appObjectId, 'app-10')
  })

  it('la géométrie couvre le seuil (v=0) au linteau (v=h) en local', () => {
    const g = generateObject(obj)
    const geo = g.getObjectByName('__fill').geometry
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    // Local : X=u (centré), Y=v (depuis le seuil), Z=normal (encastré ≤ ~0).
    assert.ok(Math.abs(bb.min.y - 0) < 1e-6)
    assert.ok(Math.abs(bb.max.y - 2.15) < 1e-6)
    assert.ok(Math.abs(bb.min.x + 0.45) < 1e-6)
    assert.ok(Math.abs(bb.max.x - 0.45) < 1e-6)
    assert.ok(bb.min.z >= -0.08 - 1e-6) // encastré dans le vide, pas au-delà du dormant
  })

  it('deriveDims : u→largeur, v→hauteur, normal→profondeur', () => {
    assert.deepEqual(deriveDims(obj), {
      largeur_m: 0.9,
      profondeur_m: 0.08,
      hauteur_m: 2.15,
    })
  })

  it('referencePoints : même repère seuil que la porte hôte', () => {
    const pts = referencePoints(obj)
    assert.equal(pts.length, 9)
    assert.ok(has(pts, 'endpoint', [4 - 0.45, 0, 0.15])) // coin seuil gauche
    assert.ok(has(pts, 'endpoint', [4 + 0.45, 2.15, 0.15])) // coin linteau droit
  })
})
