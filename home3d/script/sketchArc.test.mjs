import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { groundFrame } from '../src/lib/workPlanes.js'
import {
  radiusOf,
  angleOf,
  nextSweep,
  arcPayloadFromDraft,
} from '../src/lib/sketchArc.js'
import { parseVcbAngle } from '../src/lib/vcb.js'
import { referencePoints, deriveDims } from '../src/lib/editRegistry.js'

// Arc paramétrique (E13-03). Modules PURS : géométrie du tracé (rayon/angle/
// balayage accumulé), payload, VCB angle, références d'accroche, dims — testables
// hors navigateur.

const D2R = Math.PI / 180
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const has = (pts, type, point, eps = 1e-6) =>
  pts.some((p) => p.type === type && p.point.every((x, i) => close(x, point[i], eps)))

describe('radiusOf / angleOf', () => {
  it('rayon = distance, angle = atan2 autour du centre', () => {
    assert.ok(close(radiusOf([0, 0], [3, 4]), 5))
    assert.ok(close(angleOf([0, 0], [0, 2]), Math.PI / 2))
    assert.ok(close(angleOf([1, 1], [2, 1]), 0))
  })
})

describe('nextSweep (balayage accumulé)', () => {
  it('petit incrément : ajoute le delta vers le curseur', () => {
    assert.ok(close(nextSweep(0, 0, Math.PI / 2), Math.PI / 2))
  })

  it('franchit ±180° sans saut (arc majeur)', () => {
    // Balayage déjà à 170°, curseur à -170° (soit 190° en sens direct) → 190°.
    const out = nextSweep(170 * D2R, 0, -170 * D2R)
    assert.ok(close(out, 190 * D2R, 1e-9))
  })

  it('sens horaire : balayage négatif', () => {
    assert.ok(close(nextSweep(0, 0, -Math.PI / 2), -Math.PI / 2))
  })
})

describe('arcPayloadFromDraft', () => {
  it('rayon/angles/origine, origin = centre monde', () => {
    const frame = groundFrame() // u=+X, v=-Z, normal=+Y, origin=0
    const payload = arcPayloadFromDraft([1, 2], 5, 0, Math.PI / 2, frame)
    assert.equal(payload.kind, 'sketch.arc')
    assert.equal(payload.params.rayon_m, 5)
    assert.equal(payload.params.angle_debut_deg, 0)
    assert.equal(payload.params.angle_balayage_deg, 90)
    // origin monde de (s=1,t=2) sur le sol : X=1, Z=-2.
    assert.deepEqual(payload.plane.origin, [1, 0, -2])
  })

  it('rayon nul ou balayage nul → null', () => {
    const frame = groundFrame()
    assert.equal(arcPayloadFromDraft([0, 0], 0, 0, Math.PI / 2, frame), null)
    assert.equal(arcPayloadFromDraft([0, 0], 3, 0, 0, frame), null)
  })
})

describe('VCB angle', () => {
  it('parseVcbAngle : signé, décimale virgule ; vide/0/invalide = null', () => {
    assert.deepEqual(parseVcbAngle('90'), { angleDeg: 90 })
    assert.deepEqual(parseVcbAngle('-45'), { angleDeg: -45 })
    assert.deepEqual(parseVcbAngle('22,5'), { angleDeg: 22.5 })
    assert.equal(parseVcbAngle(''), null)
    assert.equal(parseVcbAngle('0'), null)
    assert.equal(parseVcbAngle('-'), null)
    assert.equal(parseVcbAngle('abc'), null)
  })
})

describe('referencePoints (arc)', () => {
  it('plat : centre + début + fin + milieu = 4 points', () => {
    const obj = {
      kind: 'sketch.arc',
      params: { rayon_m: 2, angle_debut_deg: 0, angle_balayage_deg: 90 },
      plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 4)
    assert.ok(has(pts, 'midpoint', [0, 0, 0])) // centre
    assert.ok(has(pts, 'endpoint', [2, 0, 0])) // début (angle 0)
    assert.ok(has(pts, 'endpoint', [0, 0, 2])) // fin (angle 90 → +v)
  })

  it('extrudé : base ET face haute = 8 points', () => {
    const obj = {
      kind: 'sketch.arc',
      params: { rayon_m: 1, angle_debut_deg: 0, angle_balayage_deg: 90, hauteur_m: 3 },
      plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] },
    }
    assert.equal(referencePoints(obj).length, 8)
  })
})

describe('deriveDims (arc)', () => {
  it('emprise = bounding box de l’arc dans le plan', () => {
    // Demi-cercle r=2 (0→180°) : x∈[-2,2] (largeur 4), y∈[0,2] (profondeur 2).
    const dims = deriveDims({
      kind: 'sketch.arc',
      params: { rayon_m: 2, angle_debut_deg: 0, angle_balayage_deg: 180 },
    })
    assert.ok(close(dims.largeur_m, 4, 1e-3))
    assert.ok(close(dims.profondeur_m, 2, 1e-3))
    assert.equal(dims.hauteur_m, 0)
  })
})
