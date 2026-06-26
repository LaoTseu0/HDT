import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { referencePoints } from '../src/lib/editRegistry.js'

// referencePoints est PUR (params + repère du plan → points monde) : testable hors
// navigateur, sans rendu three. Il alimente l'« accroche à tes formes » (E12-03).

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const has = (pts, type, point, eps = 1e-9) =>
  pts.some((p) => p.type === type && p.point.every((x, i) => close(x, point[i], eps)))

describe('referencePoints', () => {
  it('kind inconnu → aucun point', () => {
    assert.deepEqual(
      referencePoints({ kind: 'opening.window', params: {}, plane: {} }),
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
})
