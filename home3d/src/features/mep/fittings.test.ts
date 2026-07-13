import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import {
  detectFittings,
  fittingMesh,
  FITTING_OVERSIZE,
  FITTING_ARM_FACTOR,
  FITTING_ARM_MIN,
} from '@/features/mep/fittings'
import { PIPE_SECTIONS } from '@/features/mep/plumbing'
import type { Vec3 } from '@/types'

// Raccords automatiques aux jonctions entre runs (E16-03) : détection (té /
// coude / manchon), tolérance liée aux sections, dédup extrémité-contre-
// extrémité, bras prêts à mailler. Module PUR.

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
const vclose = (a: readonly number[], b: readonly number[], eps = 1e-6) =>
  a.every((x, i) => close(x, b[i] ?? NaN, eps))

// Petit constructeur de run : section du catalogue plomberie par défaut cuivre16.
const run = (id: string, points: Vec3[], sectionKey = 'cuivre16') => ({
  id,
  params: { points, ...PIPE_SECTIONS[sectionKey]!.dims },
})

describe('detectFittings — té', () => {
  it("extrémité sur le MILIEU d'un segment → té à 3 bras au point d'arrivée", () => {
    const main = run('app-1', [
      [0, 0.3, 0],
      [4, 0.3, 0],
    ])
    const branch = run('app-2', [
      [2, 0.3, 0], // extrémité posée sur le corps du run principal
      [2, 0.3, 2],
    ])
    const fittings = detectFittings([main, branch])
    assert.equal(fittings.length, 1)
    const f = fittings[0]!
    assert.equal(f.type, 'te')
    assert.ok(vclose(f.point, [2, 0.3, 0]))
    assert.deepEqual([...f.runIds].sort(), ['app-1', 'app-2'])
    assert.equal(f.arms.length, 3) // 2 bras le long du principal + 1 branche
    // Chaque bras part du point de jonction.
    for (const arm of f.arms) assert.ok(vclose(arm.a, f.point))
  })

  it('extrémité sur un SOMMET INTÉRIEUR → té (bras vers les 2 voisins)', () => {
    const main = run('app-1', [
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 3],
    ])
    const branch = run('app-2', [
      [2, 0, 0], // pile sur le coude du principal
      [2, 2, 0],
    ])
    const fittings = detectFittings([main, branch])
    assert.equal(fittings.length, 1)
    assert.equal(fittings[0]!.type, 'te')
    assert.equal(fittings[0]!.arms.length, 3)
  })

  it('les DEUX extrémités du même run branchées → 2 tés', () => {
    const main = run('app-1', [
      [0, 0, 0],
      [6, 0, 0],
    ])
    const bridge = run('app-2', [
      [1, 0, 0],
      [1, 0, 2],
      [5, 0, 2],
      [5, 0, 0],
    ])
    const fittings = detectFittings([main, bridge])
    assert.equal(fittings.length, 2)
    assert.ok(fittings.every((f) => f.type === 'te'))
  })
})

describe('detectFittings — coude / manchon (extrémité contre extrémité)', () => {
  it('en angle droit → coude, compté UNE fois (dédup des deux sens)', () => {
    const a = run('app-1', [
      [0, 0, 0],
      [2, 0, 0],
    ])
    const b = run('app-2', [
      [2, 0, 0],
      [2, 0, 2],
    ])
    const fittings = detectFittings([a, b])
    assert.equal(fittings.length, 1)
    const f = fittings[0]!
    assert.equal(f.type, 'coude')
    assert.ok(vclose(f.point, [2, 0, 0]))
    assert.equal(f.arms.length, 2) // un bras par tuyau
  })

  it('colinéaires → manchon', () => {
    const a = run('app-1', [
      [0, 0, 0],
      [2, 0, 0],
    ])
    const b = run('app-2', [
      [2, 0, 0],
      [5, 0, 0],
    ])
    const fittings = detectFittings([a, b])
    assert.equal(fittings.length, 1)
    assert.equal(fittings[0]!.type, 'manchon')
  })
})

describe('detectFittings — tolérance & garde-fous', () => {
  it('extrémité trop loin → aucun raccord', () => {
    const a = run('app-1', [
      [0, 0, 0],
      [4, 0, 0],
    ])
    const b = run('app-2', [
      [2, 0.5, 0], // 50 cm au-dessus : hors tolérance cuivre16
      [2, 0.5, 2],
    ])
    assert.deepEqual(detectFittings([a, b]), [])
  })

  it('la tolérance suit les sections (évac Ø100 attrape à ~7 cm)', () => {
    const a = run(
      'app-1',
      [
        [0, 0, 0],
        [4, 0, 0],
      ],
      'evac100'
    )
    const b = run(
      'app-2',
      [
        [2, 0.07, 0],
        [2, 2, 0],
      ],
      'evac40'
    )
    // (0,1 + 0,04)/2 = 0,07 m de tolérance → jonction détectée.
    const fittings = detectFittings([a, b])
    assert.equal(fittings.length, 1)
    assert.equal(fittings[0]!.type, 'te')
  })

  it('run seul / liste vide / chemin dégénéré → rien', () => {
    assert.deepEqual(detectFittings([]), [])
    assert.deepEqual(
      detectFittings([
        run('app-1', [
          [0, 0, 0],
          [1, 0, 0],
        ]),
      ]),
      []
    )
    assert.deepEqual(
      detectFittings([
        run('app-1', [[0, 0, 0]]),
        run('app-2', [
          [0, 0, 0],
          [1, 0, 0],
        ]),
      ]),
      []
    )
  })
})

describe('detectFittings — bras (dimensions du raccord)', () => {
  it('section surdimensionnée (collier) et longueur liée au plus gros tuyau', () => {
    const main = run(
      'app-1',
      [
        [0, 0, 0],
        [4, 0, 0],
      ],
      'evac100'
    )
    const branch = run(
      'app-2',
      [
        [2, 0, 0],
        [2, 2, 0],
      ],
      'evac40'
    )
    const [f] = detectFittings([main, branch]) as [
      ReturnType<typeof detectFittings>[number],
    ]
    const expectedLen = Math.max(FITTING_ARM_FACTOR * 0.1, FITTING_ARM_MIN)
    for (const arm of f.arms) {
      const len = Math.hypot(
        arm.b[0] - arm.a[0],
        arm.b[1] - arm.a[1],
        arm.b[2] - arm.a[2]
      )
      assert.ok(close(len, expectedLen))
    }
    // 2 bras principaux à la section du principal, la branche à la sienne.
    const sides = f.arms.map((arm) => arm.section.largeur_m).sort((x, y) => x - y)
    assert.ok(close(sides[0]!, 0.04 * FITTING_OVERSIZE))
    assert.ok(close(sides[1]!, 0.1 * FITTING_OVERSIZE))
    assert.ok(close(sides[2]!, 0.1 * FITTING_OVERSIZE))
  })

  it('petit cuivre : longueur de bras plancher (lisibilité)', () => {
    const a = run(
      'app-1',
      [
        [0, 0, 0],
        [2, 0, 0],
      ],
      'cuivre12'
    )
    const b = run(
      'app-2',
      [
        [2, 0, 0],
        [2, 0, 2],
      ],
      'cuivre12'
    )
    const [f] = detectFittings([a, b]) as [ReturnType<typeof detectFittings>[number]]
    const arm = f.arms[0]!
    const len = Math.hypot(arm.b[0] - arm.a[0], arm.b[1] - arm.a[1], arm.b[2] - arm.a[2])
    assert.ok(close(len, FITTING_ARM_MIN)) // 1,6 × 0,012 < plancher
  })
})

describe('fittingMesh', () => {
  it('un mini-run par bras : positions/indices concaténés, indices valides', () => {
    const main = run('app-1', [
      [0, 0, 0],
      [4, 0, 0],
    ])
    const branch = run('app-2', [
      [2, 0, 0],
      [2, 2, 0],
    ])
    const [f] = detectFittings([main, branch]) as [
      ReturnType<typeof detectFittings>[number],
    ]
    const { position, index } = fittingMesh(f)
    // 3 bras × 2 anneaux × 4 coins × xyz.
    assert.equal(position.length, 3 * 2 * 4 * 3)
    // 3 bras × (1 tronçon × 4 quads × 6 + 2 bouchons × 6).
    assert.equal(index.length, 3 * (4 * 6 + 2 * 6))
    const count = position.length / 3
    assert.ok(index.every((i) => i >= 0 && i < count))
  })

  it('raccord sans bras → maillage vide', () => {
    assert.deepEqual(fittingMesh({ arms: [] }), { position: [], index: [] })
  })
})
