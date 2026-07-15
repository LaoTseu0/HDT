import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import {
  JOINERY_KIND,
  DOOR_LEAF_KIND,
  DEFAULT_JOINERY,
  JOINERY_VARIANTS,
  JOINERY_VARIANT_KEYS,
  DEFAULT_JOINERY_VARIANT,
  joineryVariantOf,
  isJoineryKind,
  isHostedKind,
  joineryPayloadFromOpening,
  findJoinery,
} from '@/features/openings/joinery'
import { kindNaming } from '@/features/edit/registry'
import { NODE_NAME_REGEX, nodeName } from '@/core/naming'
import { appObj, asAppObject } from '@/test/factory'

// La variante n'existe que sur le cadre de fenetre : narrow par le kind.
const variantOf = (p: ReturnType<typeof joineryPayloadFromOpening>) =>
  p?.kind === JOINERY_KIND ? p.params.variante : undefined

// Ouverture hôte type (posée sur un mur vertical, seuil à 1 m du sol).
const opening = appObj(
  'opening.window',
  { largeur_m: 1.6, hauteur_m: 1.4, allege_m: 1 },
  {
    plane: {
      type: 'face',
      origin: [2, 1, 0.15],
      u: [1, 0, 0],
      v: [0, 1, 0],
      normal: [0, 0, 1],
      faceOf: 'structure__mur_porteur__sejour__rdc__005',
    },
  }
)

describe('joineryPayloadFromOpening', () => {
  it('copie les dims de l’ouverture + profil de cadre par défaut', () => {
    const p = joineryPayloadFromOpening(opening, 'ouvertures__fenetre__sejour__rdc__001')!
    assert.equal(p.kind, JOINERY_KIND)
    assert.equal(p.params.largeur_m, 1.6)
    assert.equal(p.params.hauteur_m, 1.4)
    assert.equal(p.params.epaisseur_m, DEFAULT_JOINERY.epaisseur_m)
    assert.equal(p.params.profondeur_m, DEFAULT_JOINERY.profondeur_m)
  })

  it('reprend le plan de l’hôte (repère du seuil) + hostOf + faceOf', () => {
    const p = joineryPayloadFromOpening(opening, 'ouvertures__fenetre__sejour__rdc__001')!
    assert.deepEqual(p.plane.origin, [2, 1, 0.15])
    assert.deepEqual(p.plane.u, [1, 0, 0])
    assert.deepEqual(p.plane.v, [0, 1, 0])
    assert.deepEqual(p.plane.normal, [0, 0, 1])
    assert.equal(p.plane.hostOf, 'ouvertures__fenetre__sejour__rdc__001')
    assert.equal(p.plane.faceOf, opening.plane.faceOf)
  })

  it('copie le plan PAR VALEUR (pas de partage de tableaux avec l’hôte)', () => {
    const p = joineryPayloadFromOpening(opening, 'x')!
    assert.notEqual(p.plane.origin, opening.plane.origin)
    assert.notEqual(p.plane.u, opening.plane.u)
    assert.notEqual(p.plane.v, opening.plane.v)
    assert.notEqual(p.plane.normal, opening.plane.normal)
  })

  it('hôte non-ouverture → null', () => {
    assert.equal(
      joineryPayloadFromOpening(asAppObject({ kind: 'sketch.rect', params: {} }), 'x'),
      null
    )
    assert.equal(joineryPayloadFromOpening(null, 'x'), null)
  })

  it('porte la variante demandée (E14-06), défaut fixe', () => {
    assert.equal(
      variantOf(joineryPayloadFromOpening(opening, 'x')),
      DEFAULT_JOINERY_VARIANT
    )
    assert.equal(
      variantOf(joineryPayloadFromOpening(opening, 'x', 'coulissant')),
      'coulissant'
    )
  })

  it('variante inconnue → repli sur la variante par défaut', () => {
    assert.equal(
      variantOf(joineryPayloadFromOpening(opening, 'x', 'oscillo_battant')),
      DEFAULT_JOINERY_VARIANT
    )
  })
})

// Porte hôte type (seuil au sol, E14-07).
const door = appObj(
  'opening.door',
  { largeur_m: 0.9, hauteur_m: 2.15 },
  {
    id: 'app-3',
    plane: {
      type: 'face',
      origin: [4, 0, 0.15],
      u: [1, 0, 0],
      v: [0, 1, 0],
      normal: [0, 0, 1],
      faceOf: 'structure__mur_porteur__sejour__rdc__005',
    },
  }
)

describe('joineryPayloadFromOpening — hôte PORTE (E14-07)', () => {
  it('hôte porte → vantail (door.leaf), dims copiées, SANS variante', () => {
    const p = joineryPayloadFromOpening(door, 'ouvertures__porte__sejour__rdc__001')!
    assert.equal(p.kind, DOOR_LEAF_KIND)
    assert.equal(p.params.largeur_m, 0.9)
    assert.equal(p.params.hauteur_m, 2.15)
    assert.equal(p.params.epaisseur_m, DEFAULT_JOINERY.epaisseur_m)
    assert.equal(p.params.profondeur_m, DEFAULT_JOINERY.profondeur_m)
    assert.ok(!('variante' in p.params)) // la variante est propre aux fenêtres
  })

  it('reprend le plan de la porte + hostOf + faceOf', () => {
    const p = joineryPayloadFromOpening(door, 'ouvertures__porte__sejour__rdc__001')!
    assert.deepEqual(p.plane.origin, [4, 0, 0.15])
    assert.equal(p.plane.hostOf, 'ouvertures__porte__sejour__rdc__001')
    assert.equal(p.plane.faceOf, door.plane.faceOf)
    // Une variante passée est ignorée pour une porte.
    const p2 = joineryPayloadFromOpening(door, 'x', 'coulissant')!
    assert.ok(!('variante' in p2.params))
  })

  it('isHostedKind : cadre ET vantail, pas les ouvertures', () => {
    assert.ok(isHostedKind(JOINERY_KIND))
    assert.ok(isHostedKind(DOOR_LEAF_KIND))
    assert.ok(!isHostedKind('opening.window'))
    assert.ok(!isHostedKind('opening.door'))
  })
})

describe('variantes (E14-06)', () => {
  it('catalogue : fixe / battant / coulissant, avec label + hint', () => {
    assert.deepEqual(JOINERY_VARIANT_KEYS, ['fixe', 'battant', 'coulissant'])
    for (const key of JOINERY_VARIANT_KEYS) {
      assert.ok(JOINERY_VARIANTS[key]!.label)
      assert.ok(JOINERY_VARIANTS[key]!.hint)
    }
    assert.ok(DEFAULT_JOINERY_VARIANT in JOINERY_VARIANTS)
  })

  it('joineryVariantOf : valide → identité, inconnu/absent → défaut', () => {
    assert.equal(joineryVariantOf('battant'), 'battant')
    assert.equal(joineryVariantOf('velux'), DEFAULT_JOINERY_VARIANT)
    assert.equal(joineryVariantOf(undefined), DEFAULT_JOINERY_VARIANT)
  })
})

describe('findJoinery', () => {
  const frame = asAppObject({
    id: 'app-2',
    kind: JOINERY_KIND,
    params: {},
    plane: { hostOf: 'ouvertures__fenetre__sejour__rdc__001' },
  })

  it('retrouve le cadre posé dans une ouverture par son node name', () => {
    const objects = { 'app-1': opening, 'app-2': frame }
    assert.equal(findJoinery(objects, 'ouvertures__fenetre__sejour__rdc__001'), frame)
  })

  it('ouverture sans cadre (ou table vide) → null', () => {
    assert.equal(
      findJoinery({ 'app-1': opening }, 'ouvertures__fenetre__sejour__rdc__001'),
      null
    )
    assert.equal(findJoinery({}, 'x'), null)
    assert.equal(findJoinery(undefined, 'x'), null)
  })

  it('ignore les autres kinds même avec un hostOf', () => {
    const impostor = asAppObject({
      kind: 'sketch.rect',
      plane: { hostOf: 'ouvertures__fenetre__sejour__rdc__001' },
    })
    assert.equal(
      findJoinery({ a: impostor }, 'ouvertures__fenetre__sejour__rdc__001'),
      null
    )
  })

  it('retrouve aussi un VANTAIL posé dans une porte (E14-07)', () => {
    const leaf = asAppObject({
      id: 'app-4',
      kind: DOOR_LEAF_KIND,
      params: {},
      plane: { hostOf: 'ouvertures__porte__sejour__rdc__001' },
    })
    const objects = { 'app-3': door, 'app-4': leaf }
    assert.equal(findJoinery(objects, 'ouvertures__porte__sejour__rdc__001'), leaf)
  })
})

describe('nommage (E12-06)', () => {
  it('isJoineryKind ne reconnaît que joinery.frame', () => {
    assert.ok(isJoineryKind(JOINERY_KIND))
    assert.ok(!isJoineryKind('opening.window'))
  })

  it('kindNaming → système ouvertures / type menuiserie, node name conforme', () => {
    const { system, type } = kindNaming(JOINERY_KIND)
    assert.equal(system, 'ouvertures')
    assert.equal(type, 'menuiserie')
    const name = nodeName({ system, type, zone: 'sejour', level: 'rdc', index: 1 })
    assert.match(name, NODE_NAME_REGEX)
  })

  it('kindNaming vantail → ouvertures/vantail, node name conforme (E14-07)', () => {
    const { system, type } = kindNaming(DOOR_LEAF_KIND)
    assert.equal(system, 'ouvertures')
    assert.equal(type, 'vantail')
    const name = nodeName({ system, type, zone: 'sejour', level: 'rdc', index: 2 })
    assert.match(name, NODE_NAME_REGEX)
  })
})
