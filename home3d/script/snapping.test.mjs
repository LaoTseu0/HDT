import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  midpoint,
  closestPointOnSegment,
  closestPointOnLine,
  closestPointBetweenLines,
  axisColorForDir,
  pickBestSnap,
  SNAP_PRIORITY,
  AXIS_COLORS,
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

  it('les points précis priment sur les inférences linéaires (intersection/axe)', () => {
    assert.ok(SNAP_PRIORITY.endpoint > SNAP_PRIORITY.intersection)
    assert.ok(SNAP_PRIORITY.intersection > SNAP_PRIORITY.midpoint)
    assert.ok(SNAP_PRIORITY.edge > SNAP_PRIORITY.axis)
  })

  it('la grille est l’accroche de plus basse priorité', () => {
    assert.ok(SNAP_PRIORITY.axis > SNAP_PRIORITY.grid)
    assert.equal(SNAP_PRIORITY.grid, Math.min(...Object.values(SNAP_PRIORITY)))
  })

  it('une référence géométrique l’emporte sur la grille à seuil égal', () => {
    const cands = [
      { type: 'grid', point: [1, 0, 0], sx: 102, sy: 100 }, // plus proche
      { type: 'axis', point: [2, 0, 0], sx: 106, sy: 100 }, // plus loin mais prioritaire
    ]
    assert.equal(pickBestSnap(cands, cursor, 12).type, 'axis')
  })

  it('la grille accroche en l’absence de toute autre référence', () => {
    const best = pickBestSnap([{ type: 'grid', point: [1, 0, 0], sx: 104, sy: 100 }], cursor, 12)
    assert.equal(best.type, 'grid')
  })

  it('conserve les champs d’inférence (color/lines) du candidat retenu', () => {
    const line = { origin: [0, 0, 0], dir: [1, 0, 0], color: '#abc' }
    const best = pickBestSnap(
      [
        {
          type: 'axis',
          point: [1, 0, 0],
          color: '#abc',
          lines: [line],
          sx: 101,
          sy: 100,
        },
      ],
      cursor,
      12
    )
    assert.equal(best.color, '#abc')
    assert.deepEqual(best.lines, [line])
    assert.equal(best.sx, undefined) // coordonnées écran retirées
  })
})

describe('closestPointOnLine', () => {
  it('projette sur la droite infinie (au-delà des bornes du segment)', () => {
    // p au-dessus de x=5 → projection (5,0,0) même si « hors » d’un segment unité.
    assert.ok(vclose(closestPointOnLine([5, 3, 0], [0, 0, 0], [2, 0, 0]), [5, 0, 0]))
  })
})

describe('closestPointBetweenLines', () => {
  it('intersection de deux droites coplanaires sécantes', () => {
    const p = closestPointBetweenLines([0, 0, 0], [1, 0, 0], [3, 0, 0], [0, 0, 1])
    assert.ok(vclose(p, [3, 0, 0]))
  })

  it('renvoie null pour des droites parallèles', () => {
    assert.equal(
      closestPointBetweenLines([0, 0, 0], [1, 0, 0], [0, 5, 0], [1, 0, 0]),
      null
    )
  })
})

describe('axisColorForDir', () => {
  it('colore selon l’axe monde quasi colinéaire (X/Y/Z)', () => {
    assert.equal(axisColorForDir([1, 0, 0]), AXIS_COLORS.x)
    assert.equal(axisColorForDir([0, -1, 0]), AXIS_COLORS.y) // signe indifférent
    assert.equal(axisColorForDir([0, 0, 2]), AXIS_COLORS.z) // non unitaire ok
  })

  it('direction en biais → couleur « off » (magenta)', () => {
    assert.equal(axisColorForDir([1, 1, 0]), AXIS_COLORS.off)
  })
})
