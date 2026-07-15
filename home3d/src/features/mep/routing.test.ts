import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import { dedupePath, pathLength, runRings, runMesh, dist } from '@/features/mep/routing'
import type { Vec3 } from '@/types'

// Routage des objets linéaires (E15-03) : dédup du chemin, longueur, et anneaux de
// section balayés (coude d'onglet aux sommets). Module PUR.

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
const vclose = (a: readonly number[], b: readonly number[], eps = 1e-6) =>
  a.every((x, i) => close(x, b[i] ?? NaN, eps))

describe('dedupePath', () => {
  it('supprime les sommets consécutifs confondus, garde l’ordre', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 0.0001], // sous le seuil → fusionné
      [2, 0, 0],
    ]
    assert.deepEqual(dedupePath(pts), [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ])
  })

  it('chemin vide / nul → []', () => {
    assert.deepEqual(dedupePath([]), [])
    assert.deepEqual(dedupePath(null), [])
  })
})

describe('pathLength', () => {
  it('somme des tronçons (L en équerre)', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [3, 0, 0],
      [3, 0, 4],
    ]
    assert.ok(close(pathLength(pts), 7))
  })
  it('< 2 points → 0', () => {
    assert.equal(pathLength([[1, 2, 3]]), 0)
    assert.equal(pathLength([]), 0)
  })
})

describe('runRings', () => {
  const section = { largeur_m: 0.02, hauteur_m: 0.02 }

  it('un anneau par sommet dédupliqué, 4 coins chacun', () => {
    const rings = runRings(
      [
        [0, 0, 0],
        [0, 0, 0], // doublon
        [1, 0, 0],
      ],
      section
    )
    assert.equal(rings.length, 2)
    for (const r of rings) assert.equal(r.corners.length, 4)
  })

  it('tronçon horizontal droit : section de niveau (largeur ⟂ tangente, hauteur verticale)', () => {
    // Chemin le long de +X : tangente = X, la section doit s’étendre en Z (largeur)
    // et Y (hauteur), centrée sur le sommet.
    const rings = runRings(
      [
        [0, 1, 0],
        [1, 1, 0],
      ],
      section
    )
    const c = rings[0]!.corners
    // Tous les coins à ±0,01 du centre en Y et Z, X = 0 (dans le plan de section).
    for (const corner of c) {
      assert.ok(close(corner[0], 0)) // section ⟂ à X
      assert.ok(close(Math.abs(corner[1] - 1), 0.01)) // hauteur ±1cm
      assert.ok(close(Math.abs(corner[2]), 0.01)) // largeur ±1cm
    }
  })

  it('coude à 90° : le sommet central porte une section sur le plan bissecteur', () => {
    // L horizontal : (0,0,0)→(1,0,0)→(1,0,1). Bissecteur au sommet (1,0,0) =
    // normalize(+X) + normalize(+Z) → direction (1,0,1)/√2. La section y est ⟂.
    const rings = runRings(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
      ],
      section
    )
    assert.equal(rings.length, 3)
    const mid = rings[1]!
    assert.ok(vclose(mid.center, [1, 0, 0]))
    // Les 4 coins sont équidistants du centre (rectangle non dégénéré).
    for (const corner of mid.corners) {
      const d = dist(corner, mid.center)
      assert.ok(d > 0.01 && d < 0.02) // ~√(0.01²+0.01²) ≈ 0.0141
    }
  })

  it('coins partagés au sommet → jonction sans trou (mêmes points pour les 2 tronçons)', () => {
    // Un run droit A-B-C : l’anneau B est unique et sert aux deux tronçons.
    const rings = runRings(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      section
    )
    // Anneau central identique quel que soit le tronçon → pas de duplication.
    assert.equal(rings.length, 3)
    assert.ok(vclose(rings[1]!.center, [1, 0, 0]))
  })
})

describe('runMesh', () => {
  const section = { largeur_m: 0.02, hauteur_m: 0.02 }

  it('équerre 3 sommets : 12 positions (4/anneau), 4 quads/tronçon + 2 bouchons', () => {
    const { position, index } = runMesh(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
      ],
      section
    )
    assert.equal(position.length, 3 * 4 * 3) // 3 anneaux × 4 coins × xyz
    // 2 tronçons × 4 quads × 6 indices + 2 bouchons × 6 indices.
    assert.equal(index.length, 2 * 4 * 6 + 2 * 6)
    // Tous les indices pointent dans le tableau de positions.
    const count = position.length / 3
    assert.ok(index.every((i) => i >= 0 && i < count))
  })

  it('< 2 sommets distincts → maillage vide (pas de bouchons)', () => {
    const { position, index } = runMesh([[0, 0, 0]], section)
    assert.equal(position.length, 4 * 3) // l'anneau seul existe…
    assert.equal(index.length, 0) // …mais aucune face
  })
})
