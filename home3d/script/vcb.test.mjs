import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseVcb, applyVcbToDraft } from '../src/lib/vcb.js'

// Module vcb PUR (parsing + maths sur (s,t)) → testable hors navigateur.

describe('parseVcb', () => {
  it('parse « L ; P » avec décimale virgule', () => {
    assert.deepEqual(parseVcb('1,2;0,8'), { width: 1.2, depth: 0.8 })
  })

  it('parse « L ; P » avec décimale point', () => {
    assert.deepEqual(parseVcb('1.2;0.8'), { width: 1.2, depth: 0.8 })
  })

  it('cote omise = garder (undefined absent de l’objet)', () => {
    assert.deepEqual(parseVcb('2;'), { width: 2 })
    assert.deepEqual(parseVcb(';0,8'), { depth: 0.8 })
  })

  it('un seul nombre = largeur seule', () => {
    assert.deepEqual(parseVcb('2'), { width: 2 })
  })

  it('tolère les espaces', () => {
    assert.deepEqual(parseVcb(' 2 ; 3 '), { width: 2, depth: 3 })
  })

  it('renvoie null pour vide / invalide / non-positif', () => {
    assert.equal(parseVcb(''), null)
    assert.equal(parseVcb(';'), null)
    assert.equal(parseVcb('abc'), null)
    assert.equal(parseVcb('0;2'), null) // cote ≤ 0 fournie → invalide
    assert.equal(parseVcb('-1;2'), null)
    assert.equal(parseVcb('2;x'), null) // 2e jeton fourni mais invalide
  })
})

describe('applyVcbToDraft', () => {
  const draft = { start: [0, 0], current: [1, 1], frame: { type: 'ground' } }

  it('fixe les magnitudes en conservant la direction (+,+)', () => {
    const r = applyVcbToDraft(draft, { width: 3, depth: 2 })
    assert.deepEqual(r.current, [3, 2])
    assert.deepEqual(r.start, [0, 0]) // coin de départ inchangé
  })

  it('conserve le signe d’un glissé négatif', () => {
    const neg = { start: [5, 5], current: [3, 4], frame: {} } // direction (-,-)
    const r = applyVcbToDraft(neg, { width: 2, depth: 1 })
    assert.deepEqual(r.current, [3, 4]) // 5-2 , 5-1
  })

  it('cote omise garde la valeur du glissé', () => {
    const r = applyVcbToDraft(draft, { width: 4 })
    assert.deepEqual(r.current, [4, 1])
  })

  it('parsed null → draft inchangé', () => {
    assert.equal(applyVcbToDraft(draft, null), draft)
  })

  it('direction nulle traitée comme positive (signe par défaut +1)', () => {
    const flat = { start: [2, 2], current: [2, 2], frame: {} }
    const r = applyVcbToDraft(flat, { width: 1, depth: 1 })
    assert.deepEqual(r.current, [3, 3])
  })
})
