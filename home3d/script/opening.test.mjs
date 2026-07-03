import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { faceFrame } from '../src/lib/workPlanes.js'
import {
  openingPayload,
  DEFAULT_OPENING,
  OPENING_PRESETS,
  doorPayload,
  DOOR_PRESETS,
  DEFAULT_DOOR_PRESET,
  WINDOW_KIND,
  DOOR_KIND,
  isOpeningKind,
} from '../src/lib/opening.js'
import { referencePoints, kindNaming } from '../src/lib/editRegistry.js'
import { nodeName, NODE_NAME_REGEX } from '../src/lib/naming.js'

// Ouverture / fenêtre posée sur une face de mur (E14-01). Modules PURS : payload
// de pose (liaison au mur + seuil), références d'accroche, nommage conforme.

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const has = (pts, type, point, eps = 1e-6) =>
  pts.some((p) => p.type === type && p.point.every((x, i) => close(x, point[i], eps)))

describe('openingPayload', () => {
  it('pose centrée sur le clic : seuil = clic − ½ hauteur, référence le mur', () => {
    // Mur vertical face +Z : u=+X (horizontal), v=+Y (haut), normal=+Z.
    const frame = faceFrame([3, 2, 0], [0, 0, 1], 'ouvertures__fenetre__maison__rdc__001')
    const p = openingPayload([3, 2, 0], frame)
    assert.equal(p.kind, 'opening.window')
    assert.equal(p.params.largeur_m, DEFAULT_OPENING.largeur_m)
    assert.equal(p.params.hauteur_m, DEFAULT_OPENING.hauteur_m)
    // seuil descendu d'½ hauteur (1,2/2 = 0,6) sous le clic (y=2) → 1,4.
    assert.ok(close(p.plane.origin[1], 1.4))
    assert.equal(p.params.allege_m, 1.4)
    // liaison au mur conservée.
    assert.equal(p.plane.faceOf, 'ouvertures__fenetre__maison__rdc__001')
    assert.deepEqual(p.plane.normal, [0, 0, 1])
  })

  it('allège plancher : jamais négative', () => {
    const frame = faceFrame([0, 0.2, 0], [0, 0, 1]) // clic bas → seuil sous 0
    const p = openingPayload([0, 0.2, 0], frame)
    assert.equal(p.params.allege_m, 0)
  })
})

describe('OPENING_PRESETS (gabarits, E14-04)', () => {
  it('3 gabarits distincts, classique = défaut historique', () => {
    assert.deepEqual(Object.keys(OPENING_PRESETS).sort(), ['classique', 'etroite', 'large'])
    assert.deepEqual(OPENING_PRESETS.classique, DEFAULT_OPENING)
    assert.ok(OPENING_PRESETS.large.largeur_m > OPENING_PRESETS.classique.largeur_m)
    assert.ok(OPENING_PRESETS.etroite.largeur_m < OPENING_PRESETS.classique.largeur_m)
  })

  it('openingPayload applique le gabarit passé (largeur ET hauteur, seuil recalculé)', () => {
    const frame = faceFrame([3, 2, 0], [0, 0, 1])
    const p = openingPayload([3, 2, 0], frame, OPENING_PRESETS.large)
    assert.equal(p.params.largeur_m, OPENING_PRESETS.large.largeur_m)
    assert.equal(p.params.hauteur_m, OPENING_PRESETS.large.hauteur_m)
    // seuil descendu d'½ hauteur du gabarit (1,4/2 = 0,7) sous le clic (y=2) → 1,3.
    assert.ok(close(p.plane.origin[1], 1.3))
  })
})

describe('doorPayload (porte, E14-07)', () => {
  it('seuil posé AU SOL (y=0) le long de v, sur le plan de la face', () => {
    // Mur vertical face +Z : clic à 1,2 m de haut → seuil descendu à y=0.
    const frame = faceFrame([3, 1.2, 0.15], [0, 0, 1], 'structure__mur_porteur__sejour__rdc__005')
    const p = doorPayload([3, 1.2, 0.15], frame)
    assert.equal(p.kind, DOOR_KIND)
    assert.ok(close(p.plane.origin[0], 3))
    assert.ok(close(p.plane.origin[1], 0)) // seuil au sol
    assert.ok(close(p.plane.origin[2], 0.15)) // reste sur le plan du mur
    assert.equal(p.plane.faceOf, 'structure__mur_porteur__sejour__rdc__005')
  })

  it('pas d’allège : une porte n’en a pas', () => {
    const frame = faceFrame([0, 1, 0], [0, 0, 1])
    const p = doorPayload([0, 1, 0], frame)
    assert.ok(!('allege_m' in p.params))
    assert.equal(p.params.largeur_m, DOOR_PRESETS[DEFAULT_DOOR_PRESET].largeur_m)
    assert.equal(p.params.hauteur_m, DOOR_PRESETS[DEFAULT_DOOR_PRESET].hauteur_m)
  })

  it('applique le gabarit passé (double)', () => {
    const frame = faceFrame([0, 1, 0], [0, 0, 1])
    const p = doorPayload([0, 1, 0], frame, DOOR_PRESETS.double)
    assert.equal(p.params.largeur_m, DOOR_PRESETS.double.largeur_m)
    assert.equal(p.params.hauteur_m, DOOR_PRESETS.double.hauteur_m)
  })

  it('face non verticale (v non vertical) → repli centré comme la fenêtre', () => {
    // Face horizontale (plafond/sol) : v n'est pas vertical → pas de « descente
    // au sol » possible, on centre sur le clic (t = H/2).
    const frame = faceFrame([1, 2.5, 1], [0, 1, 0])
    const H = DOOR_PRESETS[DEFAULT_DOOR_PRESET].hauteur_m
    const p = doorPayload([1, 2.5, 1], frame)
    const o = p.plane.origin
    const d = Math.hypot(1 - o[0], 2.5 - o[1], 1 - o[2])
    assert.ok(close(d, H / 2, 1e-6))
  })

  it('3 gabarits distincts, simple = défaut', () => {
    assert.deepEqual(Object.keys(DOOR_PRESETS).sort(), ['double', 'etroite', 'simple'])
    assert.equal(DEFAULT_DOOR_PRESET, 'simple')
    assert.ok(DOOR_PRESETS.double.largeur_m > DOOR_PRESETS.simple.largeur_m)
    assert.ok(DOOR_PRESETS.etroite.largeur_m < DOOR_PRESETS.simple.largeur_m)
  })

  it('isOpeningKind : fenêtre ET porte, rien d’autre', () => {
    assert.ok(isOpeningKind(WINDOW_KIND))
    assert.ok(isOpeningKind(DOOR_KIND))
    assert.ok(!isOpeningKind('joinery.frame'))
    assert.ok(!isOpeningKind('door.leaf'))
  })
})

describe('referencePoints (ouverture)', () => {
  it('4 coins + 4 milieux + centre = 9 points, seuil à v=0', () => {
    const obj = {
      kind: 'opening.window',
      params: { largeur_m: 2, hauteur_m: 1, allege_m: 0 },
      plane: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
    }
    const pts = referencePoints(obj)
    assert.equal(pts.length, 9)
    assert.ok(has(pts, 'endpoint', [-1, 0, 0])) // coin bas-gauche (seuil)
    assert.ok(has(pts, 'endpoint', [1, 1, 0])) // coin haut-droit
    assert.ok(has(pts, 'midpoint', [0, 0.5, 0])) // centre
    assert.ok(has(pts, 'midpoint', [0, 0, 0])) // milieu du seuil
  })
})

describe('nommage (ouverture)', () => {
  it('kindNaming → ouvertures/fenetre, node name conforme à la regex', () => {
    assert.deepEqual(kindNaming('opening.window'), { system: 'ouvertures', type: 'fenetre' })
    const name = nodeName({
      system: 'ouvertures',
      type: 'fenetre',
      zone: 'maison',
      level: 'rdc',
      index: 3,
    })
    assert.equal(name, 'ouvertures__fenetre__maison__rdc__003')
    assert.match(name, NODE_NAME_REGEX)
  })

  it('kindNaming porte → ouvertures/porte, node name conforme (E14-07)', () => {
    assert.deepEqual(kindNaming(DOOR_KIND), { system: 'ouvertures', type: 'porte' })
    const name = nodeName({
      system: 'ouvertures',
      type: 'porte',
      zone: 'maison',
      level: 'rdc',
      index: 1,
    })
    assert.equal(name, 'ouvertures__porte__maison__rdc__001')
    assert.match(name, NODE_NAME_REGEX)
  })
})
