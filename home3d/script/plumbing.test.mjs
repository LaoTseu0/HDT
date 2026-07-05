import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  pipePayloadFromPath,
  pipeLength,
  slopedPoints,
  pentePct,
  MAX_PENTE_PCT,
  PIPE_SECTIONS,
  PIPE_SECTION_KEYS,
  DEFAULT_PIPE_SECTION,
  PIPE_KIND,
} from '../src/lib/plumbing.js'
import {
  referencePoints,
  kindNaming,
  deriveDims,
  isKnownKind,
  generateObject,
} from '../src/lib/editRegistry.js'
import { nodeName, NODE_NAME_REGEX } from '../src/lib/naming.js'

// Tuyau de plomberie routé (E16-01) : catalogue de sections (cuivre + évac PVC),
// payload depuis un chemin, références d'accroche (sommets), dims (bbox), nommage
// conforme. Modules PURS — même mécanique que le câble E15-03 (lib/routing partagé).

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

describe('PIPE_SECTIONS (catalogue)', () => {
  it('cuivre Ø12→22 + évac PVC Ø32/40/100, défaut = cuivre Ø16, section = côté nominal', () => {
    assert.deepEqual(PIPE_SECTION_KEYS, [
      'cuivre12',
      'cuivre14',
      'cuivre16',
      'cuivre18',
      'cuivre22',
      'evac32',
      'evac40',
      'evac100',
    ])
    assert.equal(DEFAULT_PIPE_SECTION, 'cuivre16')
    for (const key of PIPE_SECTION_KEYS) {
      const s = PIPE_SECTIONS[key]
      assert.ok(s.dims.largeur_m > 0 && s.dims.hauteur_m > 0)
      // Emprise rectangulaire = côté nominal (Ø mm → m).
      assert.ok(close(s.dims.largeur_m, s.diametre_mm / 1000))
      assert.ok(['cuivre', 'evac'].includes(s.famille))
    }
  })
})

describe('pipePayloadFromPath', () => {
  const path = [
    [0, 0.3, 0],
    [2, 0.3, 0],
    [2, 0.3, 3],
  ]

  it('run plomberie routé : kind, chemin, section du catalogue (identité conservée)', () => {
    const p = pipePayloadFromPath(path, 'cuivre22')
    assert.equal(p.kind, PIPE_KIND)
    assert.equal(p.params.points.length, 3)
    assert.equal(p.params.diametre_mm, 22)
    assert.equal(p.params.famille, 'cuivre')
    assert.equal(p.params.section, 'cuivre22')
    assert.ok(close(p.params.largeur_m, 0.022) && close(p.params.hauteur_m, 0.022))
    assert.deepEqual(p.plane.origin, [0, 0.3, 0])
  })

  it("section d'évacuation : famille evac (support E16-02 pente)", () => {
    const p = pipePayloadFromPath(path, 'evac100')
    assert.equal(p.params.famille, 'evac')
    assert.equal(p.params.diametre_mm, 100)
    assert.ok(close(p.params.largeur_m, 0.1))
  })

  it('déduplique le chemin (doublon du double-clic de fin)', () => {
    const p = pipePayloadFromPath([...path, [2, 0.3, 3]], 'cuivre12')
    assert.equal(p.params.points.length, 3) // le doublon final est fusionné
  })

  it('< 2 sommets distincts → null', () => {
    assert.equal(pipePayloadFromPath([[1, 1, 1]]), null)
    assert.equal(pipePayloadFromPath([[1, 1, 1], [1, 1, 1]]), null)
    assert.equal(pipePayloadFromPath([]), null)
  })

  it('section inconnue → repli sur le défaut (cuivre Ø16)', () => {
    const p = pipePayloadFromPath(path, 'pvc_bogus')
    assert.equal(p.params.section, DEFAULT_PIPE_SECTION)
    assert.equal(p.params.diametre_mm, 16)
  })
})

describe('pipeLength', () => {
  it('longueur du chemin en équerre', () => {
    const p = pipePayloadFromPath(
      [
        [0, 0, 0],
        [3, 0, 0],
        [3, 0, 4],
      ],
      'evac40'
    )
    assert.ok(close(pipeLength(p.params), 7))
  })

  it('la pente allonge légèrement le tuyau (hypoténuse)', () => {
    const p = pipePayloadFromPath([[0, 1, 0], [4, 1, 0]], 'evac40')
    const flat = pipeLength(p.params)
    const sloped = pipeLength({ ...p.params, pente_pct: 3 })
    assert.ok(close(flat, 4))
    assert.ok(close(sloped, Math.hypot(4, 0.12))) // 3 % de 4 m = 12 cm de chute
  })
})

describe('slopedPoints / pentePct (E16-02)', () => {
  const evac = (points, pente_pct) => ({
    ...pipePayloadFromPath(points, 'evac40').params,
    pente_pct,
  })

  it('payload : pente_pct présent (0) pour une évac, absent pour le cuivre', () => {
    const e = pipePayloadFromPath([[0, 0, 0], [1, 0, 0]], 'evac32')
    const c = pipePayloadFromPath([[0, 0, 0], [1, 0, 0]], 'cuivre16')
    assert.equal(e.params.pente_pct, 0)
    assert.ok(!('pente_pct' in c.params))
  })

  it('descente = pente % × longueur horizontale cumulée depuis l’amont', () => {
    const params = evac(
      [
        [0, 2, 0],
        [4, 2, 0],
        [4, 2, 2],
      ],
      2
    )
    const pts = slopedPoints(params)
    assert.deepEqual(pts[0], [0, 2, 0]) // amont intact
    assert.ok(close(pts[1][1], 2 - 0.08)) // 2 % de 4 m
    assert.ok(close(pts[2][1], 2 - 0.12)) // + 2 % de 2 m
    // x/z inchangés, params.points non modifié (non-destructif).
    assert.ok(close(pts[2][0], 4) && close(pts[2][2], 2))
    assert.ok(close(params.points[2][1], 2))
  })

  it('un tronçon vertical n’ajoute pas de descente', () => {
    const pts = slopedPoints(
      evac(
        [
          [0, 3, 0],
          [2, 3, 0],
          [2, 1, 0], // plongée verticale
        ],
        2
      )
    )
    assert.ok(close(pts[1][1], 3 - 0.04))
    assert.ok(close(pts[2][1], 1 - 0.04)) // même chute cumulée qu'au sommet 1
  })

  it('pente nulle / famille cuivre → points tels quels', () => {
    const path = [
      [0, 1, 0],
      [3, 1, 0],
    ]
    assert.deepEqual(slopedPoints(evac(path, 0)), path)
    const cuivre = { ...pipePayloadFromPath(path, 'cuivre16').params, pente_pct: 5 }
    assert.deepEqual(slopedPoints(cuivre), path)
    assert.equal(pentePct(cuivre), 0)
  })

  it('pente bornée [0, MAX_PENTE_PCT]', () => {
    assert.equal(pentePct(evac([[0, 0, 0], [1, 0, 0]], 50)), MAX_PENTE_PCT)
    assert.equal(pentePct(evac([[0, 0, 0], [1, 0, 0]], -3)), 0)
  })
})

describe('registre (plomberie.pipe)', () => {
  it('kind connu, kindNaming → plomberie/tuyau, node name conforme', () => {
    assert.ok(isKnownKind(PIPE_KIND))
    assert.deepEqual(kindNaming(PIPE_KIND), { system: 'plomberie', type: 'tuyau' })
    const { system, type } = kindNaming(PIPE_KIND)
    const name = nodeName({ system, type, zone: 'sdb', level: 'rdc', index: 3 })
    assert.match(name, NODE_NAME_REGEX)
  })

  it('referencePoints = les sommets du chemin (accroche)', () => {
    const obj = {
      kind: PIPE_KIND,
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
      kind: PIPE_KIND,
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

// Générateur (fabrique makeGenerateRun partagée avec le câble) : balayage
// rectangulaire en coordonnées MONDE, groupe à l'identité (pas de placeOnPlane),
// couleur du calque plomberie — pur three, exécutable hors navigateur.
describe('plomberie.pipe (générateur)', () => {
  const payload = pipePayloadFromPath(
    [
      [0, 0.3, 0],
      [2, 0.3, 0],
      [2, 0.3, 3],
    ],
    'evac40'
  )
  const obj = { id: 'app-3', ...payload }

  it('génère tuyau (__fill opaque, teinte plomberie) et arêtes (__edges)', () => {
    const g = generateObject(obj)
    assert.ok(g)
    const fill = g.getObjectByName('__fill')
    const edges = g.getObjectByName('__edges')
    assert.ok(fill?.isMesh)
    assert.ok(edges?.isLineSegments)
    assert.equal(fill.geometry.attributes.position.count, 3 * 4) // 4 coins par sommet
    assert.equal(fill.material.color.getHex(), 0x7f77dd) // couleur calque plomberie
    assert.ok(!fill.material.transparent) // opaque (l'opacité générique ne le teinte pas)
    assert.equal(g.userData.appObjectId, 'app-3')
  })

  it('géométrie en MONDE : groupe à l’identité, emprise autour du chemin', () => {
    const g = generateObject(obj)
    assert.deepEqual([g.position.x, g.position.y, g.position.z], [0, 0, 0])
    const geo = g.getObjectByName('__fill').geometry
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    // Chemin en équerre à y=0,3, section 0,04 → bbox ~[0..2]×[0,28..0,32]×[0..3].
    assert.ok(Math.abs(bb.min.y - 0.28) < 1e-6 && Math.abs(bb.max.y - 0.32) < 1e-6)
    assert.ok(bb.max.x >= 2 && bb.max.z >= 3)
  })
})

// Pente d'évacuation (E16-02) appliquée par le REGISTRE : le générateur, les
// points d'accroche et les dims suivent la géométrie pentue ; les clics
// (params.points) restent intacts.
describe('plomberie.pipe (pente E16-02 dans le registre)', () => {
  const payload = pipePayloadFromPath(
    [
      [0, 1, 0],
      [4, 1, 0],
    ],
    'evac40'
  )
  const obj = { id: 'app-9', ...payload, params: { ...payload.params, pente_pct: 2 } }

  it('générateur : l’aval descend (bbox plus basse côté fin)', () => {
    const g = generateObject(obj)
    const geo = g.getObjectByName('__fill').geometry
    geo.computeBoundingBox()
    // Amont : y ≈ 1,02 ; aval : centre à 1 − 0,08 → min ≈ 0,90. Tolérance en mm :
    // la section est ⟂ à la tangente PENTUE (coins à ±0,02 × cos θ).
    assert.ok(Math.abs(geo.boundingBox.max.y - 1.02) < 1e-3)
    assert.ok(Math.abs(geo.boundingBox.min.y - 0.9) < 1e-3)
  })

  it('referencePoints : sommets pentus (on s’accroche à ce qu’on voit)', () => {
    const pts = referencePoints(obj)
    assert.ok(close(pts[0].point[1], 1)) // amont
    assert.ok(close(pts[1].point[1], 0.92)) // aval : 2 % de 4 m
  })

  it('deriveDims : la hauteur d’emprise inclut la chute', () => {
    assert.ok(close(deriveDims(obj).hauteur_m, 0.08))
  })

  it('le câble n’est pas affecté (pas de pente hors plomberie)', () => {
    const cable = {
      kind: 'elec.cable',
      params: { points: [[0, 1, 0], [4, 1, 0]], largeur_m: 0.02, hauteur_m: 0.02, pente_pct: 5 },
    }
    assert.ok(close(referencePoints(cable)[1].point[1], 1))
  })
})
