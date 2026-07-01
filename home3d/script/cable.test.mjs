import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  cablePayloadFromPath,
  cableLength,
  CABLE_SECTIONS,
  CABLE_SECTION_KEYS,
  DEFAULT_CABLE_SECTION,
  CABLE_KIND,
} from '../src/lib/cable.js'
import { referencePoints, kindNaming, deriveDims, isKnownKind } from '../src/lib/editRegistry.js'
import { nodeName, NODE_NAME_REGEX } from '../src/lib/naming.js'

// Câble électrique routé (E15-03) : catalogue de sections, payload depuis un chemin,
// références d'accroche (sommets), dims (bbox), nommage conforme. Modules PURS.

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

describe('CABLE_SECTIONS (catalogue)', () => {
  it('gaines Ø16/20/25/32, défaut = Ø20, section = côté nominal', () => {
    assert.deepEqual(CABLE_SECTION_KEYS, ['gaine16', 'gaine20', 'gaine25', 'gaine32'])
    assert.equal(DEFAULT_CABLE_SECTION, 'gaine20')
    for (const key of CABLE_SECTION_KEYS) {
      const s = CABLE_SECTIONS[key]
      assert.ok(s.dims.largeur_m > 0 && s.dims.hauteur_m > 0)
      // Emprise rectangulaire = côté nominal (Ø mm → m).
      assert.ok(close(s.dims.largeur_m, s.diametre_mm / 1000))
    }
  })
})

describe('cablePayloadFromPath', () => {
  const path = [
    [0, 0.3, 0],
    [2, 0.3, 0],
    [2, 0.3, 3],
  ]

  it('run élec routé : kind, chemin, section du catalogue', () => {
    const p = cablePayloadFromPath(path, 'gaine20')
    assert.equal(p.kind, CABLE_KIND)
    assert.equal(p.params.points.length, 3)
    assert.equal(p.params.diametre_mm, 20)
    assert.equal(p.params.section, 'gaine20')
    assert.ok(close(p.params.largeur_m, 0.02) && close(p.params.hauteur_m, 0.02))
    assert.deepEqual(p.plane.origin, [0, 0.3, 0])
  })

  it('déduplique le chemin (doublon du double-clic de fin)', () => {
    const p = cablePayloadFromPath([...path, [2, 0.3, 3]], 'gaine16')
    assert.equal(p.params.points.length, 3) // le doublon final est fusionné
  })

  it('< 2 sommets distincts → null', () => {
    assert.equal(cablePayloadFromPath([[1, 1, 1]]), null)
    assert.equal(cablePayloadFromPath([[1, 1, 1], [1, 1, 1]]), null)
    assert.equal(cablePayloadFromPath([]), null)
  })

  it('section inconnue → repli sur le défaut (Ø20)', () => {
    const p = cablePayloadFromPath(path, 'gaine_bogus')
    assert.equal(p.params.section, DEFAULT_CABLE_SECTION)
    assert.equal(p.params.diametre_mm, 20)
  })
})

describe('cableLength', () => {
  it('longueur du chemin en équerre', () => {
    const p = cablePayloadFromPath(
      [
        [0, 0, 0],
        [3, 0, 0],
        [3, 0, 4],
      ],
      'gaine20'
    )
    assert.ok(close(cableLength(p.params), 7))
  })
})

describe('registre (elec.cable)', () => {
  it('kind connu, kindNaming → elec/cable, node name conforme', () => {
    assert.ok(isKnownKind(CABLE_KIND))
    assert.deepEqual(kindNaming(CABLE_KIND), { system: 'elec', type: 'cable' })
    const { system, type } = kindNaming(CABLE_KIND)
    const name = nodeName({ system, type, zone: 'sejour', level: 'rdc', index: 3 })
    assert.match(name, NODE_NAME_REGEX)
  })

  it('referencePoints = les sommets du chemin (accroche)', () => {
    const obj = {
      kind: CABLE_KIND,
      params: {
        points: [
          [0, 0, 0],
          [1, 0, 0],
          [1, 0, 2],
        ],
      },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 3)
    assert.ok(pts.every((p) => p.type === 'endpoint'))
    assert.deepEqual(pts[2].point, [1, 0, 2])
  })

  it('deriveDims = bounding box monde du chemin', () => {
    const obj = {
      kind: CABLE_KIND,
      params: {
        points: [
          [0, 0.3, 0],
          [2, 0.3, 0],
          [2, 1.3, 3],
        ],
      },
    }
    assert.deepEqual(deriveDims(obj), { largeur_m: 2, profondeur_m: 3, hauteur_m: 1 })
  })
})
