import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import { faceFrame } from '@/core/workPlanes'
import {
  elecPayload,
  ELEC_COMPONENTS,
  ELEC_KINDS,
  DEFAULT_ELEC_KIND,
  isElecKind,
} from '@/features/mep/elec'
import { referencePoints, kindNaming, deriveDims } from '@/features/edit/registry'
import { nodeName, NODE_NAME_REGEX } from '@/core/naming'
import { appObj } from '@/test/factory'
import type { ReferencePoint } from '@/features/edit/registry'
import type { Vec3 } from '@/types'

// Composants électriques ponctuels posés sur une face de mur (E15-01/02). Modules
// PURS : payload de pose (liaison au mur + centre), catalogue, références
// d'accroche, dims dérivées, nommage conforme.

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
const has = (pts: ReferencePoint[], type: string, point: Vec3, eps = 1e-6) =>
  pts.some(
    (p) => p.type === type && p.point.every((x, i) => close(x, point[i] ?? NaN, eps))
  )

describe('ELEC_COMPONENTS (catalogue)', () => {
  it('4 composants, prise = défaut, types conformes à la regex de nommage', () => {
    assert.deepEqual(ELEC_KINDS, [
      'elec.outlet',
      'elec.switch',
      'elec.junction',
      'elec.meter',
    ])
    assert.equal(DEFAULT_ELEC_KIND, 'elec.outlet')
    for (const kind of ELEC_KINDS) {
      assert.ok(isElecKind(kind))
      const c = ELEC_COMPONENTS[kind]!
      // type = segment de nommage → doit passer [a-z0-9_]+.
      assert.match(c.type, /^[a-z0-9_]+$/)
      assert.ok(c.dims.largeur_m > 0 && c.dims.hauteur_m > 0 && c.dims.profondeur_m > 0)
    }
    assert.ok(!isElecKind('sketch.rect'))
    assert.ok(!isElecKind('opening.window'))
  })
})

describe('elecPayload', () => {
  it('pose au clic : origin = point cliqué, référence le mur, dims du catalogue', () => {
    // Mur vertical face +Z : u=+X (horizontal), v=+Y (haut), normal=+Z.
    const frame = faceFrame([3, 0.3, 0], [0, 0, 1], 'elec__prise__sejour__rdc__001')
    const p = elecPayload([3, 0.3, 0], frame, 'elec.outlet')
    assert.equal(p.kind, 'elec.outlet')
    assert.deepEqual(p.params, ELEC_COMPONENTS['elec.outlet'].dims)
    assert.deepEqual(p.plane.origin, [3, 0.3, 0])
    assert.equal(p.plane.faceOf, 'elec__prise__sejour__rdc__001')
    assert.deepEqual(p.plane.normal, [0, 0, 1])
  })

  it('kind inconnu → repli sur le composant par défaut (prise)', () => {
    const frame = faceFrame([0, 1, 0], [0, 0, 1])
    const p = elecPayload([0, 1, 0], frame, 'elec.bogus')
    assert.equal(p.kind, DEFAULT_ELEC_KIND)
    assert.deepEqual(p.params, ELEC_COMPONENTS[DEFAULT_ELEC_KIND].dims)
  })

  it('applique les dims du composant demandé (compteur ≠ prise)', () => {
    const frame = faceFrame([1, 1.4, 0], [0, 0, 1])
    const p = elecPayload([1, 1.4, 0], frame, 'elec.meter')
    assert.equal(p.kind, 'elec.meter')
    assert.deepEqual(p.params, ELEC_COMPONENTS['elec.meter'].dims)
    assert.ok(p.params.hauteur_m > ELEC_COMPONENTS['elec.outlet'].dims.hauteur_m)
  })
})

describe('referencePoints (composant élec)', () => {
  it('centre + 4 coins de la face arrière (sur le mur, normal=0)', () => {
    const obj = appObj(
      'elec.junction',
      { largeur_m: 0.2, hauteur_m: 0.4, profondeur_m: 0.1 },
      { plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] } }
    )
    const pts = referencePoints(obj)
    assert.equal(pts.length, 5)
    assert.ok(has(pts, 'midpoint', [0, 0, 0])) // centre
    assert.ok(has(pts, 'endpoint', [-0.1, -0.2, 0])) // coin bas-gauche
    assert.ok(has(pts, 'endpoint', [0.1, 0.2, 0])) // coin haut-droit
  })
})

describe('deriveDims (composant élec)', () => {
  it('u→largeur, v→hauteur, normal→profondeur', () => {
    const obj = appObj(
      'elec.meter',
      { largeur_m: 0.4, hauteur_m: 0.6, profondeur_m: 0.18 },
      { plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] } }
    )
    assert.deepEqual(deriveDims(obj), {
      largeur_m: 0.4,
      profondeur_m: 0.18,
      hauteur_m: 0.6,
    })
  })
})

describe('nommage (composant élec)', () => {
  it('kindNaming → elec/<type>, node name conforme à la regex', () => {
    assert.deepEqual(kindNaming('elec.outlet'), { system: 'elec', type: 'prise' })
    assert.deepEqual(kindNaming('elec.junction'), {
      system: 'elec',
      type: 'boite_derivation',
    })
    for (const kind of ELEC_KINDS) {
      const { system, type } = kindNaming(kind)
      const name = nodeName({ system, type, zone: 'sejour', level: 'rdc', index: 2 })
      assert.match(name, NODE_NAME_REGEX)
    }
  })
})
