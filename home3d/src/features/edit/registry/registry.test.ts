import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import type * as THREE from 'three'

import {
  referencePoints,
  generateObject,
  deriveDims,
  deformHandles,
  type ReferencePoint,
} from '@/features/edit/registry'
import { JOINERY_KIND, DOOR_LEAF_KIND } from '@/features/openings/joinery'
import { appObj, asAppObject } from '@/test/factory'
import type { ObjectPlane, Vec3 } from '@/types'

// referencePoints est PUR (params + repère du plan → points monde) : testable hors
// navigateur, sans rendu three. Il alimente l'« accroche à tes formes » (E12-03).

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps
const has = (pts: ReferencePoint[], type: string, point: Vec3, eps = 1e-9) =>
  pts.some(
    (p) => p.type === type && p.point.every((x, i) => close(x, point[i] ?? NaN, eps))
  )

// Meshes générés : accès typé aux enfants nommés du groupe.
const meshByName = (g: THREE.Object3D | null, name: string) =>
  g?.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry, THREE.Material> | undefined

describe('referencePoints', () => {
  it('kind inconnu → aucun point', () => {
    assert.deepEqual(
      referencePoints(asAppObject({ kind: 'does.not.exist', params: {}, plane: {} })),
      []
    )
  })

  it('rectangle plat (sol) : 4 coins + 4 milieux + centre = 9 points', () => {
    // Repère sol : u=+X, v=+Z, normal=+Y ; centre à l'origine.
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 4 },
      { plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] } }
    )
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
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 2, hauteur_m: 3 },
      { plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] } }
    )
    const pts = referencePoints(obj)
    assert.equal(pts.length, 22) // 9 base + 9 haut + 4 arêtes verticales
    assert.ok(has(pts, 'endpoint', [1, 0, 1])) // coin base (y=0)
    assert.ok(has(pts, 'endpoint', [1, 3, 1])) // coin haut (y=hauteur)
    assert.ok(has(pts, 'midpoint', [1, 1.5, 1])) // milieu arête verticale (mi-hauteur)
    assert.ok(has(pts, 'midpoint', [0, 3, 0])) // centre face haute
  })

  it('repère mural (face verticale) : v vertical → coins en hauteur', () => {
    // Mur dans le plan XY, normale +Z : u=+X (horizontal), v=+Y (vertical).
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 2 },
      { plane: { origin: [0, 1, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] } }
    )
    const pts = referencePoints(obj)
    assert.ok(has(pts, 'endpoint', [1, 2, 0])) // coin haut-droit (v=+Y monte)
    assert.ok(has(pts, 'endpoint', [-1, 0, 0])) // coin bas-gauche
  })

  it('menuiserie (E14-05) : même repère seuil que l’ouverture hôte', () => {
    // Mur dans le plan XY, seuil (origin) à y=1 : coins v∈[0,h], u∈[-w/2,w/2].
    const obj = appObj(
      JOINERY_KIND,
      { largeur_m: 1.6, hauteur_m: 1.4, epaisseur_m: 0.06, profondeur_m: 0.08 },
      { plane: { origin: [0, 1, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] } }
    )
    const pts = referencePoints(obj)
    assert.equal(pts.length, 9)
    assert.ok(has(pts, 'endpoint', [-0.8, 1, 0])) // coin seuil gauche
    assert.ok(has(pts, 'endpoint', [0.8, 2.4, 0])) // coin haut droit
    assert.ok(has(pts, 'midpoint', [0, 1.7, 0])) // centre
  })
})

// deformHandles (E22-01) : poignées de déformation — positions/axes ANALYTIQUES
// depuis params + repère du plan (même contrat de pureté que referencePoints),
// consommées par DeformHandles + le moteur de drag (useAxisDrag).
describe('deformHandles', () => {
  // Repère sol : u=+X, v=+Z, normal=+Y.
  const ground: ObjectPlane = {
    origin: [0, 0, 0],
    u: [1, 0, 0],
    v: [0, 0, 1],
    normal: [0, 1, 0],
  }
  const byKey = (obj: Parameters<typeof deformHandles>[0]) =>
    Object.fromEntries(deformHandles(obj).map((h) => [h.key, h]))

  it('kind sans déformation géométrique → aucune poignée', () => {
    assert.deepEqual(
      deformHandles(appObj('elec.cable', { points: [] }, { plane: {} as ObjectPlane })),
      []
    )
    assert.deepEqual(
      deformHandles(asAppObject({ kind: 'does.not.exist', params: {}, plane: {} })),
      []
    )
  })

  it('rectangle plat : 5 poignées — ±u, ±v en bord + extrusion au centre', () => {
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 4 },
      { plane: ground }
    )
    const hs = deformHandles(obj)
    assert.equal(hs.length, 5)
    const h = byKey(obj)
    assert.deepEqual(h['+u']!.point, [1, 0, 0]) // milieu du bord +u
    assert.deepEqual(h['-v']!.point, [0, 0, -2])
    assert.deepEqual(h['+n']!.point, [0, 0, 0]) // extrusion depuis la forme plate
    assert.equal(h['+u']!.paramKey, 'largeur_m')
    assert.equal(h['+v']!.paramKey, 'profondeur_m')
    assert.equal(h['+n']!.paramKey, 'hauteur_m')
  })

  it('boîte extrudée : 6 poignées — faces latérales à mi-hauteur, ±n base/sommet', () => {
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 4, hauteur_m: 3 },
      { plane: ground }
    )
    assert.equal(deformHandles(obj).length, 6)
    const h = byKey(obj)
    assert.deepEqual(h['+u']!.point, [1, 1.5, 0]) // centre de la face +u (mi-hauteur)
    assert.deepEqual(h['-v']!.point, [0, 1.5, -2])
    assert.deepEqual(h['+n']!.point, [0, 3, 0]) // face sommet
    assert.deepEqual(h['-n']!.point, [0, 0, 0]) // base (sur le plan d'esquisse)
  })

  it('axes/ancrages conformes au Push/Pull (face opposée fixe)', () => {
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 4, hauteur_m: 3 },
      { plane: ground }
    )
    for (const h of deformHandles(obj)) {
      // u/v = géométrie centrée (demi-décalage) ; normale = base ancrée au plan.
      assert.equal(h.anchored, h.paramKey === 'hauteur_m')
      assert.equal(Math.abs(h.sign), 1)
    }
    const h = byKey(obj)
    assert.equal(h['+n']!.sign, 1)
    assert.equal(h['-n']!.sign, -1)
    assert.deepEqual(h['+v']!.axis, [0, 0, 1]) // l'axe est le v du plan
    assert.deepEqual(h['-v']!.axis, [0, 0, 1]) // même axe, signe opposé
    assert.equal(h['-v']!.sign, -1)
  })

  it('repère mural : les poignées suivent u/v/normal du plan de l’objet', () => {
    // Mur dans le plan XY, normale +Z : u=+X (horizontal), v=+Y (vertical).
    const wall: ObjectPlane = {
      origin: [0, 1, 0],
      u: [1, 0, 0],
      v: [0, 1, 0],
      normal: [0, 0, 1],
    }
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 1, hauteur_m: 0.5 },
      { plane: wall }
    )
    const h = byKey(obj)
    assert.deepEqual(h['+v']!.point, [0, 1.5, 0.25]) // v vertical, mi-épaisseur normale
    assert.deepEqual(h['+n']!.point, [0, 1, 0.5]) // extrémité de l'extrusion
    assert.deepEqual(h['+n']!.axis, [0, 0, 1])
  })

  it('cercle plat (E22-02) : 4 radiales cardinales + extrusion au centre', () => {
    const obj = appObj('sketch.circle', { rayon_m: 2 }, { plane: ground })
    const hs = deformHandles(obj)
    assert.equal(hs.length, 5)
    const h = byKey(obj)
    assert.deepEqual(h['+u']!.point, [2, 0, 0]) // cardinal +u (dans le plan)
    assert.deepEqual(h['-u']!.point, [-2, 0, 0])
    assert.deepEqual(h['+v']!.point, [0, 0, 2]) // v = +Z au sol
    assert.deepEqual(h['+n']!.point, [0, 0, 0]) // extrusion depuis la forme plate
    for (const k of ['+u', '-u', '+v', '-v']) assert.equal(h[k]!.paramKey, 'rayon_m')
    assert.equal(h['+n']!.paramKey, 'hauteur_m')
  })

  it('cylindre (E22-02) : radiales à mi-hauteur, ±n base/sommet = 6 poignées', () => {
    const obj = appObj('sketch.circle', { rayon_m: 2, hauteur_m: 3 }, { plane: ground })
    assert.equal(deformHandles(obj).length, 6)
    const h = byKey(obj)
    assert.deepEqual(h['+u']!.point, [2, 1.5, 0]) // radiale à mi-hauteur
    assert.deepEqual(h['-v']!.point, [0, 1.5, -2])
    assert.deepEqual(h['+n']!.point, [0, 3, 0]) // sommet
    assert.deepEqual(h['-n']!.point, [0, 0, 0]) // base
  })

  it('radiales du cercle : centre FIXE (axe sortant, sign=+1, anchored)', () => {
    const obj = appObj('sketch.circle', { rayon_m: 2, hauteur_m: 3 }, { plane: ground })
    const h = byKey(obj)
    for (const k of ['+u', '-u', '+v', '-v']) {
      // sign=+1 + anchored=true → décalage d'origine nul dans le moteur de
      // drag (shift = ((sign-1)/2)·delta = 0) : le rayon grandit, le centre
      // ne bouge pas.
      assert.equal(h[k]!.sign, 1)
      assert.equal(h[k]!.anchored, true)
    }
    // L'axe radial est SORTANT : la poignée −u se tire le long de −u.
    // (comparaison à tolérance : la négation produit des −0)
    assert.ok(h['-u']!.axis.every((x, i) => close(x, [-1, 0, 0][i] ?? NaN)))
    assert.ok(h['+u']!.axis.every((x, i) => close(x, [1, 0, 0][i] ?? NaN)))
  })

  it('extrusion descendante (hauteur < 0) : côtés base/sommet inversés', () => {
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 2, hauteur_m: -1 },
      { plane: ground }
    )
    const h = byKey(obj)
    assert.deepEqual(h['+n']!.point, [0, -1, 0]) // extrémité sous le plan
    assert.equal(h['+n']!.sign, -1) // on la tire vers −normale
    assert.equal(h['-n']!.sign, 1)
    assert.deepEqual(h['+u']!.point, [1, -0.5, 0]) // faces latérales à mi-hauteur
  })
})

// Générateur menuiserie (E14-05) : structure du groupe (cadre fusionné + vitrage
// + arêtes) et dims dérivées — pur three, exécutable hors navigateur.
describe('joinery.frame (générateur)', () => {
  const obj = appObj(
    JOINERY_KIND,
    { largeur_m: 1.6, hauteur_m: 1.4, epaisseur_m: 0.06, profondeur_m: 0.08 },
    {
      id: 'app-9',
      plane: { origin: [2, 1, 0.15], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
    }
  )

  it('génère cadre (__fill), vitrage (__glass) et arêtes (__edges)', () => {
    const g = generateObject(obj)
    assert.ok(g)
    const fill = meshByName(g, '__fill')
    const glass = meshByName(g, '__glass')
    const edges = g.getObjectByName('__edges') as THREE.LineSegments | undefined
    assert.ok(fill?.isMesh)
    assert.ok(glass?.isMesh)
    assert.ok(edges?.isLineSegments)
    assert.ok(fill.geometry.attributes.position!.count > 0)
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
  const withVariant = (variante: string | undefined) =>
    appObj(
      JOINERY_KIND,
      { ...obj.params, variante: variante as 'fixe' },
      { id: obj.id, plane: obj.plane }
    )
  const counts = (variante: string | undefined) => {
    const g = generateObject(withVariant(variante))
    return {
      frame: meshByName(g, '__fill')!.geometry.attributes.position!.count,
      glass: meshByName(g, '__glass')!.geometry.attributes.position!.count,
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
    const pos = meshByName(g, '__glass')!.geometry.attributes
      .position as THREE.BufferAttribute
    const zs = new Set<number>()
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
  const obj = appObj(
    DOOR_LEAF_KIND,
    { largeur_m: 0.9, hauteur_m: 2.15, epaisseur_m: 0.06, profondeur_m: 0.08 },
    {
      id: 'app-10',
      plane: { origin: [4, 0, 0.15], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
    }
  )

  it('génère vantail (__fill) et arêtes (__edges), SANS vitrage', () => {
    const g = generateObject(obj)
    assert.ok(g)
    const fill = meshByName(g, '__fill')
    const edges = g.getObjectByName('__edges') as THREE.LineSegments | undefined
    assert.ok(fill?.isMesh)
    assert.ok(edges?.isLineSegments)
    assert.equal(g.getObjectByName('__glass'), undefined) // panneau plein, pas de vitrage
    // 5 boîtes fusionnées (2 montants + traverse + panneau + poignée) × 24 sommets.
    assert.equal(fill.geometry.attributes.position!.count, 5 * 24)
    assert.ok(!fill.material.transparent) // vantail opaque
    assert.equal(g.userData.appObjectId, 'app-10')
  })

  it('la géométrie couvre le seuil (v=0) au linteau (v=h) en local', () => {
    const g = generateObject(obj)
    const geo = meshByName(g, '__fill')!.geometry
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
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
