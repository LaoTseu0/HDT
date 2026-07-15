import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import {
  VALVE_KIND,
  VALVE_OVERSIZE,
  VALVE_BODY_FACTOR,
  VALVE_BODY_MIN,
  valveBodyLength,
  splitPipeAt,
  valveMesh,
  dropFittingsAtValves,
  isValvablePipe,
} from '@/features/mep/valve'
import { PIPE_KIND, PIPE_SECTIONS, slopedPoints } from '@/features/mep/plumbing'
import { closestOnPath } from '@/features/mep/routing'
import { appObj, asAppObject } from '@/test/factory'
import type { Fitting } from '@/features/mep/fittings'
import type { AppObjectOf, Vec3 } from '@/types'

// Vanne inline (E16-04) : coupe d'un run en deux tronçons + objet vanne au point
// de coupe (module PUR, cf. lib/valve). La pente d'évacuation (E16-02) reste NON
// destructive : le rendu pentu des deux tronçons prolonge exactement l'original.

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
const vclose = (a: readonly number[], b: readonly number[], eps = 1e-6) =>
  a.every((x, i) => close(x, b[i] ?? NaN, eps))

// Petit constructeur de tuyau app : section du catalogue (défaut cuivre16).
const pipe = (
  points: Vec3[],
  sectionKey = 'cuivre16',
  extra: { pente_pct?: number } = {}
): AppObjectOf<'plomberie.pipe'> => {
  const sec = PIPE_SECTIONS[sectionKey]!
  return appObj(
    PIPE_KIND,
    {
      points,
      ...sec.dims,
      diametre_mm: sec.diametre_mm,
      famille: sec.famille,
      section: sectionKey,
      ...(sec.famille === 'evac' ? { pente_pct: 0 } : {}),
      ...extra,
    },
    {
      plane: {
        type: 'run',
        origin: points[0]!,
        u: [1, 0, 0],
        v: [0, 1, 0],
        normal: [0, 0, 1],
      },
    }
  )
}

describe('closestOnPath (lib/routing, partagé raccords/vanne)', () => {
  it('projette sur le segment porteur avec le paramètre t', () => {
    const path: Vec3[] = [
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 4],
    ]
    const hit = closestOnPath(path, [1, 0.5, 0])!
    assert.equal(hit.seg, 0)
    assert.ok(close(hit.t, 0.25))
    assert.ok(vclose(hit.point, [1, 0, 0]))
    assert.ok(close(hit.d, 0.5))
  })

  it('clamp aux extrémités (t ∈ [0,1])', () => {
    const path: Vec3[] = [
      [0, 0, 0],
      [4, 0, 0],
    ]
    const hit = closestOnPath(path, [-2, 0, 0])!
    assert.equal(hit.t, 0)
    assert.ok(vclose(hit.point, [0, 0, 0]))
  })
})

describe('splitPipeAt — coupe au milieu d’un segment', () => {
  it('deux tronçons qui se rejoignent au point de coupe, params hérités', () => {
    const p = pipe([
      [0, 0.3, 0],
      [4, 0.3, 0],
    ])
    // Clic légèrement à côté de l'axe (surface du tuyau) → projeté dessus.
    const split = splitPipeAt(p, [2.5, 0.31, 0.008])!
    assert.ok(split)
    const [a, b] = split.runs as [
      (typeof split.runs)[number],
      (typeof split.runs)[number],
    ]
    assert.deepEqual(a.points, [
      [0, 0.3, 0],
      [2.5, 0.3, 0],
    ])
    assert.deepEqual(b.points, [
      [2.5, 0.3, 0],
      [4, 0.3, 0],
    ])
    // La section (et la famille) suit le tuyau coupé.
    for (const half of [a, b]) {
      assert.equal(half.section, 'cuivre16')
      assert.equal(half.diametre_mm, 16)
      assert.equal(half.largeur_m, PIPE_SECTIONS.cuivre16!.dims.largeur_m)
    }
  })

  it('la vanne porte le point de coupe, l’axe du segment et la section', () => {
    const p = pipe([
      [0, 0.3, 0],
      [4, 0.3, 0],
    ])
    const { valve } = splitPipeAt(p, [1, 0.3, 0])!
    assert.equal(valve.kind, VALVE_KIND)
    assert.ok(vclose(valve.params.centre, [1, 0.3, 0]))
    assert.ok(vclose(valve.params.dir, [1, 0, 0]))
    assert.equal(valve.params.section, 'cuivre16')
    assert.equal(valve.params.famille, 'cuivre')
    assert.ok(vclose(valve.plane.origin, valve.params.centre))
  })

  it('coupe sur le 2e segment d’un run coudé : les sommets amont restent au tronçon amont', () => {
    const p = pipe([
      [0, 0.3, 0],
      [2, 0.3, 0],
      [2, 0.3, 4],
    ])
    const split = splitPipeAt(p, [2, 0.3, 3])!
    assert.deepEqual(split.runs[0]!.points, [
      [0, 0.3, 0],
      [2, 0.3, 0],
      [2, 0.3, 3],
    ])
    assert.deepEqual(split.runs[1]!.points, [
      [2, 0.3, 3],
      [2, 0.3, 4],
    ])
    assert.ok(vclose(split.valve.params.dir, [0, 0, 1]))
  })

  it('coupe PILE sur un sommet intérieur → les tronçons se partagent le sommet', () => {
    const p = pipe([
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 4],
    ])
    const split = splitPipeAt(p, [2, 0, 0])!
    assert.ok(split)
    assert.equal(split.runs[0]!.points.length, 2)
    assert.ok(vclose(split.runs[0]!.points[1]!, [2, 0, 0]))
    assert.ok(vclose(split.runs[1]!.points[0]!, [2, 0, 0]))
  })
})

describe('splitPipeAt — garde-fous', () => {
  it('coupe sur une extrémité du run → refusée (tronçon dégénéré)', () => {
    const p = pipe([
      [0, 0, 0],
      [4, 0, 0],
    ])
    assert.equal(splitPipeAt(p, [0, 0, 0]), null)
    assert.equal(splitPipeAt(p, [4, 0, 0]), null)
    // Clic au-delà du bout : la projection clampe sur l'extrémité → refusée aussi.
    assert.equal(splitPipeAt(p, [6, 0, 0]), null)
  })

  it('chemin dégénéré ou objet absent → null', () => {
    assert.equal(
      splitPipeAt(
        asAppObject({ kind: PIPE_KIND, params: { points: [[0, 0, 0]] } }),
        [0, 0, 0]
      ),
      null
    )
    assert.equal(splitPipeAt(null, [0, 0, 0]), null)
  })
})

describe('splitPipeAt — pente d’évacuation (E16-02) préservée', () => {
  it('le rendu pentu des deux tronçons prolonge exactement l’original', () => {
    // Évac Ø40, 2 % : rendu y = 1 − 0,02 × x. Coupe à x = 2 (clic sur l'axe pentu).
    const p = pipe(
      [
        [0, 1, 0],
        [4, 1, 0],
        [8, 1, 0],
      ],
      'evac40',
      { pente_pct: 2 }
    )
    const original = slopedPoints(p.params)
    const split = splitPipeAt(p, [2, 0.96, 0])!
    assert.ok(split)
    const [a, b] = split.runs as [
      (typeof split.runs)[number],
      (typeof split.runs)[number],
    ]

    // Tronçon amont : clics intacts + point de coupe NON pentu (la pente reste
    // appliquée au rendu) → rendu identique à l'original jusqu'à la coupe.
    assert.deepEqual(a.points, [
      [0, 1, 0],
      [2, 1, 0],
    ])
    const renderedA = slopedPoints(a)
    assert.ok(vclose(renderedA[0]!, original[0]!))
    assert.ok(vclose(renderedA[1]!, [2, 0.96, 0], 1e-4))

    // Tronçon aval : abaissé de la chute accumulée à la coupe (0,04) → son rendu
    // pentu (qui repart de son 1er point) recolle exactement à l'original.
    const renderedB = slopedPoints(b)
    assert.ok(vclose(renderedB[0]!, [2, 0.96, 0], 1e-4))
    assert.ok(vclose(renderedB[1]!, original[1]!, 1e-4)) // [4, 0.92, 0]
    assert.ok(vclose(renderedB[2]!, original[2]!, 1e-4)) // [8, 0.84, 0]

    // Les deux tronçons restent des évacuations pentues éditables.
    assert.equal(a.pente_pct, 2)
    assert.equal(b.pente_pct, 2)

    // La vanne est posée sur l'axe RENDU (pentu), orientée le long de la descente.
    assert.ok(vclose(split.valve.params.centre, [2, 0.96, 0], 1e-4))
    assert.ok(split.valve.params.dir[1] < 0) // l'axe descend
  })
})

describe('valveBodyLength / valveMesh', () => {
  it('corps = facteur × plus grand côté, plancher pour le petit cuivre', () => {
    assert.ok(
      close(valveBodyLength({ largeur_m: 0.1, hauteur_m: 0.1 }), VALVE_BODY_FACTOR * 0.1)
    )
    assert.ok(
      close(valveBodyLength({ largeur_m: 0.012, hauteur_m: 0.012 }), VALVE_BODY_MIN)
    )
  })

  it('3 pièces (corps + tige + poignée) : positions/indices concaténés valides', () => {
    const { position, index } = valveMesh({
      centre: [1, 0.3, 0],
      dir: [1, 0, 0],
      ...PIPE_SECTIONS.cuivre16!.dims,
    })
    // 3 mini-runs × 2 anneaux × 4 coins × xyz.
    assert.equal(position.length, 3 * 2 * 4 * 3)
    // 3 mini-runs × (4 quads × 6 + 2 bouchons × 6).
    assert.equal(index.length, 3 * (4 * 6 + 2 * 6))
    const count = position.length / 3
    assert.ok(index.every((i) => i >= 0 && i < count))
  })

  it('corps centré sur la coupe, section sur-dimensionnée (collier)', () => {
    const params = {
      centre: [1, 0.3, 0] as Vec3,
      dir: [1, 0, 0] as Vec3,
      ...PIPE_SECTIONS.evac100!.dims,
    }
    const { position } = valveMesh(params)
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < position.length; i += 3) {
      const x = position[i]!
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    // Étendue le long de l'axe = longueur du corps (les autres pièces sont plus
    // courtes), centrée sur la coupe.
    const bodyLen = valveBodyLength(params)
    assert.ok(close(minX, 1 - bodyLen / 2))
    assert.ok(close(maxX, 1 + bodyLen / 2))
    // Sur-dimension : le corps déborde du tuyau (0,1 m) de chaque côté.
    assert.ok(VALVE_OVERSIZE > 1)
  })
})

describe('dropFittingsAtValves — pas de manchon sous la vanne', () => {
  const valve = {
    params: {
      centre: [2, 0.3, 0] as Vec3,
      dir: [1, 0, 0] as Vec3,
      ...PIPE_SECTIONS.cuivre16!.dims,
    },
  }

  it('un raccord au point de coupe est supprimé, les autres restent', () => {
    const fittings = [
      { type: 'manchon', point: [2, 0.3, 0], runIds: [], arms: [] },
      { type: 'te', point: [5, 0.3, 0], runIds: [], arms: [] },
    ] as Fitting[] // jonction des deux tronçons + vraie jonction ailleurs
    const kept = dropFittingsAtValves(fittings, [valve])
    assert.equal(kept.length, 1)
    assert.equal(kept[0]!.type, 'te')
  })

  it('sans vanne (ou liste vide) → raccords inchangés', () => {
    const fittings = [
      { type: 'manchon', point: [2, 0.3, 0], runIds: [], arms: [] },
    ] as Fitting[]
    assert.equal(dropFittingsAtValves(fittings, []).length, 1)
    assert.equal(dropFittingsAtValves(fittings, undefined).length, 1)
  })
})

describe('isValvablePipe', () => {
  it('tuyau routé valide → oui ; câble, tuyau dégénéré, absent → non', () => {
    assert.ok(
      isValvablePipe(
        pipe([
          [0, 0, 0],
          [1, 0, 0],
        ])
      )
    )
    assert.ok(
      !isValvablePipe(
        asAppObject({
          kind: 'elec.cable',
          params: {
            points: [
              [0, 0, 0],
              [1, 0, 0],
            ],
          },
        })
      )
    )
    assert.ok(
      !isValvablePipe(asAppObject({ kind: PIPE_KIND, params: { points: [[0, 0, 0]] } }))
    )
    assert.ok(!isValvablePipe(null))
  })
})
