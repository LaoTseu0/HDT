import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { faceFrame } from '../src/lib/workPlanes.js'
import { openingPayload, DEFAULT_OPENING } from '../src/lib/opening.js'
import { referencePoints, kindNaming } from '../src/lib/editRegistry.js'
import { nodeName, NODE_NAME_REGEX } from '../src/lib/naming.js'

// Ouverture / fenêtre posée sur une face de mur (E14-01). Modules PURS : payload
// de pose (liaison au mur + seuil), références d'accroche, nommage conforme.

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const has = (pts, type, point, eps = 1e-6) =>
  pts.some((p) => p.type === type && p.point.every((x, i) => close(x, point[i], eps)))

describe('openingPayload', () => {
  it('pose centrée sur le clic : seuil = clic − ½ hauteur, référence le mur', () => {
    // Mur vertical face +Z : u=+X (horizontal), v=+Y (haut), normal=+Z.
    const frame = faceFrame([3, 2, 0], [0, 0, 1], 'ouvertures__fenetre__maison__rdc__001')
    const p = openingPayload([3, 2, 0], frame)
    assert.equal(p.kind, 'opening.window')
    assert.equal(p.params.largeur_m, DEFAULT_OPENING.largeur_m)
    assert.equal(p.params.hauteur_m, DEFAULT_OPENING.hauteur_m)
    // seuil descendu d'½ hauteur (1,2/2 = 0,6) sous le clic (y=2) → 1,4.
    assert.ok(close(p.plane.origin[1], 1.4))
    assert.equal(p.params.allege_m, 1.4)
    // liaison au mur conservée.
    assert.equal(p.plane.faceOf, 'ouvertures__fenetre__maison__rdc__001')
    assert.deepEqual(p.plane.normal, [0, 0, 1])
  })

  it('allège plancher : jamais négative', () => {
    const frame = faceFrame([0, 0.2, 0], [0, 0, 1]) // clic bas → seuil sous 0
    const p = openingPayload([0, 0.2, 0], frame)
    assert.equal(p.params.allege_m, 0)
  })
})

describe('referencePoints (ouverture)', () => {
  it('4 coins + 4 milieux + centre = 9 points, seuil à v=0', () => {
    const obj = {
      kind: 'opening.window',
      params: { largeur_m: 2, hauteur_m: 1, allege_m: 0 },
      plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 9)
    assert.ok(has(pts, 'endpoint', [-1, 0, 0])) // coin bas-gauche (seuil)
    assert.ok(has(pts, 'endpoint', [1, 1, 0])) // coin haut-droit
    assert.ok(has(pts, 'midpoint', [0, 0.5, 0])) // centre
    assert.ok(has(pts, 'midpoint', [0, 0, 0])) // milieu du seuil
  })
})

describe('nommage (ouverture)', () => {
  it('kindNaming → ouvertures/fenetre, node name conforme à la regex', () => {
    assert.deepEqual(kindNaming('opening.window'), { system: 'ouvertures', type: 'fenetre' })
    const name = nodeName({
      system: 'ouvertures',
      type: 'fenetre',
      zone: 'maison',
      level: 'rdc',
      index: 3,
    })
    assert.equal(name, 'ouvertures__fenetre__maison__rdc__003')
    assert.match(name, NODE_NAME_REGEX)
  })
})
