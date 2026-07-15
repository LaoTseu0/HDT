import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import {
  nodeName,
  nextIndex,
  normalizeZone,
  normalizeType,
  NODE_NAME_REGEX,
  DEFAULT_ZONE,
} from '@/core/naming'
import { validateNodeName } from '../../script/naming.mjs'
import type { ObjectsTable } from '@/types'

// Génération des node names conformes des objets créés in-app (E12-06). Module
// PUR : testable hors navigateur. La convention (regex) est partagée avec le
// pipeline (script/naming.mjs) → un nom généré ici DOIT la valider.

describe('nodeName', () => {
  it('compose système__type__zone__niveau__index et passe la regex', () => {
    const name = nodeName({
      system: 'structure',
      type: 'forme',
      zone: 'salon',
      level: 'rdc',
      index: 1,
    })
    assert.equal(name, 'structure__forme__salon__rdc__001')
    assert.ok(NODE_NAME_REGEX.test(name))
  })

  it('pad l’index sur 3 chiffres', () => {
    const at = (index: number) =>
      nodeName({ system: 'elec', type: 'prise', zone: 'sdb', level: 'r1', index })
    assert.equal(at(7).endsWith('__007'), true)
    assert.equal(at(42).endsWith('__042'), true)
    assert.equal(at(100).endsWith('__100'), true)
  })

  it('index nul/invalide retombe sur 001 (jamais 000, invalide)', () => {
    const name = nodeName({
      system: 'terrain',
      type: 'forme',
      zone: 'jardin',
      level: 'ext',
      index: 0,
    })
    assert.ok(name.endsWith('__001'))
    assert.ok(NODE_NAME_REGEX.test(name))
  })

  it('un type canonique passe la validation pipeline SANS avertissement (E20-02)', () => {
    const name = nodeName({
      system: 'plomberie',
      type: 'tuyau',
      zone: 'sdb',
      level: 'rdc',
      index: 1,
    })
    const result = validateNodeName(name)
    assert.equal(result.valid, true)
    assert.deepEqual(result.warnings, [])
  })

  it('un type hors vocabulaire reste VALIDE côté pipeline (vocabulaire ouvert)', () => {
    const name = nodeName({
      system: 'terrain',
      type: 'pergola',
      zone: 'jardin',
      level: 'ext',
      index: 1,
    })
    const result = validateNodeName(name)
    assert.equal(result.valid, true)
    assert.equal(result.warnings.length, 1)
  })
})

describe('nextIndex', () => {
  // nextIndex ne lit que id/system/zone/level/index : fixture partielle castée.
  const obj = (id: string, system: string, zone: string, level: string, index: number) =>
    ({ id, system, zone, level, index }) as unknown as ObjectsTable[string]

  it('bucket vide → 1', () => {
    assert.equal(nextIndex({}, { system: 'structure', zone: 'salon', level: 'rdc' }), 1)
  })

  it('max + 1 dans le bucket (et non count + 1 : pas de réutilisation après suppression)', () => {
    // Indices 1 et 3 présents (le 2 a été supprimé) → suivant = 4, pas 3.
    const objects = {
      a: obj('a', 'structure', 'salon', 'rdc', 1),
      c: obj('c', 'structure', 'salon', 'rdc', 3),
    }
    assert.equal(
      nextIndex(objects, { system: 'structure', zone: 'salon', level: 'rdc' }),
      4
    )
  })

  it('compte par bucket (système, zone, niveau) indépendant', () => {
    const objects = {
      a: obj('a', 'structure', 'salon', 'rdc', 1),
      b: obj('b', 'structure', 'salon', 'rdc', 2),
      c: obj('c', 'structure', 'cuisine', 'rdc', 1), // autre zone
      d: obj('d', 'elec', 'salon', 'rdc', 1), // autre système
    }
    assert.equal(
      nextIndex(objects, { system: 'structure', zone: 'salon', level: 'rdc' }),
      3
    )
    assert.equal(
      nextIndex(objects, { system: 'structure', zone: 'cuisine', level: 'rdc' }),
      2
    )
    assert.equal(
      nextIndex(objects, { system: 'structure', zone: 'salon', level: 'r1' }),
      1
    )
  })

  it('excludeId ignore l’objet lui-même (changement de zone)', () => {
    const objects = {
      a: obj('a', 'structure', 'salon', 'rdc', 1),
      b: obj('b', 'structure', 'salon', 'rdc', 2),
    }
    // `b` change de bucket : son propre index ne doit pas compter pour le nouveau.
    assert.equal(
      nextIndex(objects, { system: 'structure', zone: 'salon', level: 'rdc' }, 'b'),
      2
    )
  })
})

describe('normalizeZone', () => {
  it('minuscule, retire accents, espaces → _', () => {
    assert.equal(normalizeZone('Salle de Bain'), 'salle_de_bain')
    assert.equal(normalizeZone('Séjour'), 'sejour')
  })

  it('vide / nullish → zone par défaut', () => {
    assert.equal(normalizeZone(''), DEFAULT_ZONE)
    assert.equal(normalizeZone(null), DEFAULT_ZONE)
    assert.equal(normalizeZone('   '), DEFAULT_ZONE)
  })

  it('un type saisi librement est normalisé, repli sur le type courant (E20-03)', () => {
    assert.equal(normalizeType('Pergola Bois', 'forme'), 'pergola_bois')
    assert.equal(normalizeType('Évacuation', 'forme'), 'evacuation')
    assert.equal(normalizeType('', 'forme'), 'forme')
    assert.equal(normalizeType('   ', 'forme'), 'forme')
    assert.equal(normalizeType(null, 'forme'), 'forme')
  })

  it('un type normalisé produit bien un node name valide', () => {
    const name = nodeName({
      system: 'terrain',
      type: normalizeType('Pergola', 'forme'),
      zone: 'jardin',
      level: 'ext',
      index: 1,
    })
    assert.ok(NODE_NAME_REGEX.test(name))
  })

  it('une zone normalisée produit bien un node name valide', () => {
    const name = nodeName({
      system: 'plomberie',
      type: 'tuyau',
      zone: normalizeZone('Cellier Nord'),
      level: 'ss',
      index: 5,
    })
    assert.ok(NODE_NAME_REGEX.test(name))
  })
})
