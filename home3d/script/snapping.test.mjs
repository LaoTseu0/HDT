import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  midpoint,
  closestPointOnSegment,
  pickBestSnap,
  SNAP_PRIORITY,
} from '../src/lib/snapping.js'

// Module snapping PUR (maths sur tableaux) → testable hors navigateur.

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const vclose = (a, b, eps = 1e-9) => a.every((x, i) => close(x, b[i], eps))

describe('midpoint', () => {
  it('milieu d’un segment', () => {
    assert.ok(vclose(midpoint([0, 0, 0], [2, 4, -6]), [1, 2, -3]))
  })
})

describe('closestPointOnSegment', () => {
  it('projette à l’intérieur du segment', () => {
    assert.ok(
      vclose(closestPointOnSegment([0.5, 1, 0], [0, 0, 0], [1, 0, 0]), [0.5, 0, 0])
    )
  })

  it('borne avant le début (t<0 → a)', () => {
    assert.ok(vclose(closestPointOnSegment([-3, 5, 0], [0, 0, 0], [1, 0, 0]), [0, 0, 0]))
  })

  it('borne après la fin (t>1 → b)', () => {
    assert.ok(vclose(closestPointOnSegment([9, 5, 0], [0, 0, 0], [1, 0, 0]), [1, 0, 0]))
  })

  it('segment dégénéré (a==b) ne divise pas par zéro', () => {
    assert.ok(vclose(closestPointOnSegment([2, 2, 2], [1, 1, 1], [1, 1, 1]), [1, 1, 1]))
  })
})

describe('pickBestSnap', () => {
  const cursor = { x: 100, y: 100 }

  it('renvoie null si aucun candidat dans le seuil', () => {
    const cands = [{ type: 'endpoint', point: [0, 0, 0], sx: 200, sy: 200 }]
    assert.equal(pickBestSnap(cands, cursor, 12), null)
  })

  it('préfère la plus haute priorité dans le seuil (sommet > arête)', () => {
    const cands = [
      { type: 'edge', point: [1, 0, 0], sx: 102, sy: 100 }, // plus proche
      { type: 'endpoint', point: [2, 0, 0], sx: 108, sy: 100 }, // plus loin mais prioritaire
    ]
    const best = pickBestSnap(cands, cursor, 12)
    assert.equal(best.type, 'endpoint')
    assert.ok(vclose(best.point, [2, 0, 0]))
  })

  it('à priorité égale, prend le plus proche du curseur', () => {
    const cands = [
      { type: 'endpoint', point: [1, 0, 0], sx: 110, sy: 100 },
      { type: 'endpoint', point: [2, 0, 0], sx: 103, sy: 100 },
    ]
    assert.ok(vclose(pickBestSnap(cands, cursor, 12).point, [2, 0, 0]))
  })

  it('l’ordre de priorité est sommet > milieu > arête', () => {
    assert.ok(SNAP_PRIORITY.endpoint > SNAP_PRIORITY.midpoint)
    assert.ok(SNAP_PRIORITY.midpoint > SNAP_PRIORITY.edge)
  })
})
