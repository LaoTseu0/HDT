import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import { groundFrame } from '@/core/workPlanes'
import { circlePayloadFromDraft } from '@/features/sketch/sketchCircle'
import { parseVcbRadius, applyVcbRadiusToDraft } from '@/features/sketch/vcb'
import {
  referencePoints,
  deriveDims,
  type ReferencePoint,
} from '@/features/edit/registry'
import { appObj } from '@/test/factory'
import type { Vec2, Vec3 } from '@/types'

// Cercle paramétrique (E13-02). Modules PURS : payload de tracé, VCB rayon,
// références d'accroche, dims dérivées — testables hors navigateur.

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps
const has = (pts: ReferencePoint[], type: string, point: Vec3, eps = 1e-9) =>
  pts.some(
    (p) => p.type === type && p.point.every((x, i) => close(x, point[i] ?? NaN, eps))
  )

describe('circlePayloadFromDraft', () => {
  it('rayon = distance centre→bord, origin = centre monde', () => {
    const frame = groundFrame() // u=+X, v=-Z (= normal×u), normal=+Y, origin=0
    // Centre (1, 2) en (s,t), bord à (4, 6) → rayon = hypot(3,4) = 5.
    const payload = circlePayloadFromDraft([1, 2], [4, 6], frame)!
    assert.equal(payload.kind, 'sketch.circle')
    assert.equal(payload.params.rayon_m, 5)
    // origin monde de (s=1,t=2) sur le sol : X=1·u, Z=2·v=-2.
    assert.deepEqual(payload.plane.origin, [1, 0, -2])
  })

  it('rayon nul → null (clic sans glissé)', () => {
    assert.equal(circlePayloadFromDraft([2, 2], [2, 2], groundFrame()), null)
  })
})

describe('VCB rayon', () => {
  it('parseVcbRadius : une valeur = rayon ; vide/invalide = null', () => {
    assert.deepEqual(parseVcbRadius('1,5'), { radius: 1.5 })
    assert.deepEqual(parseVcbRadius('2'), { radius: 2 })
    assert.equal(parseVcbRadius(''), null)
    assert.equal(parseVcbRadius('abc'), null)
    assert.equal(parseVcbRadius('0'), null) // ≤ 0 rejeté
  })

  it('applyVcbRadiusToDraft : fixe le rayon en gardant la direction du glissé', () => {
    // Glissé du centre (0,0) vers (3,4) (longueur 5) ; on impose rayon 10 → (6,8).
    const draft = { start: [0, 0] as Vec2, current: [3, 4] as Vec2 }
    const out = applyVcbRadiusToDraft(draft, { radius: 10 })
    assert.ok(close(out.current[0], 6))
    assert.ok(close(out.current[1], 8))
  })

  it('applyVcbRadiusToDraft : parsed null → draft inchangé', () => {
    const draft = { start: [0, 0] as Vec2, current: [3, 4] as Vec2 }
    assert.strictEqual(applyVcbRadiusToDraft(draft, null), draft)
  })
})

describe('referencePoints (cercle)', () => {
  it('plat : centre + 4 quadrants = 5 points', () => {
    const obj = appObj(
      'sketch.circle',
      { rayon_m: 2 },
      { plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] } }
    )
    const pts = referencePoints(obj)
    assert.equal(pts.length, 5)
    assert.ok(has(pts, 'midpoint', [0, 0, 0])) // centre
    assert.ok(has(pts, 'endpoint', [2, 0, 0])) // quadrant +u
    assert.ok(has(pts, 'endpoint', [0, 0, 2])) // quadrant +v
  })

  it('extrudé : quadrants base ET face haute = 10 points', () => {
    const obj = appObj(
      'sketch.circle',
      { rayon_m: 1, hauteur_m: 3 },
      { plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] } }
    )
    const pts = referencePoints(obj)
    assert.equal(pts.length, 10)
    assert.ok(has(pts, 'midpoint', [0, 3, 0])) // centre face haute (le long de +Y)
  })
})

describe('deriveDims (cercle)', () => {
  it('emprise = diamètre sur largeur/profondeur, hauteur = |extrusion|', () => {
    assert.deepEqual(deriveDims(appObj('sketch.circle', { rayon_m: 2 })), {
      largeur_m: 4,
      profondeur_m: 4,
      hauteur_m: 0,
    })
    assert.deepEqual(
      deriveDims(appObj('sketch.circle', { rayon_m: 1.5, hauteur_m: -2 })),
      { largeur_m: 3, profondeur_m: 3, hauteur_m: 2 }
    )
  })
})
