import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  makeBasisFromNormal,
  groundFrame,
  faceFrame,
  frameOfObjectPlane,
  worldToPlane,
  planeToWorld,
  extrudeHeightFromRay,
} from '../src/lib/workPlanes.js'

// Le module workPlanes est PUR (maths sur tableaux) → testable hors navigateur.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const vclose = (a, b, eps = 1e-9) => a.every((x, i) => close(x, b[i], eps))

function assertOrthonormalDirect({ u, v, normal }) {
  assert.ok(close(dot(u, u), 1), 'u unitaire')
  assert.ok(close(dot(v, v), 1), 'v unitaire')
  assert.ok(close(dot(normal, normal), 1), 'normal unitaire')
  assert.ok(close(dot(u, v), 0), 'u ⊥ v')
  assert.ok(close(dot(u, normal), 0), 'u ⊥ normal')
  assert.ok(close(dot(v, normal), 0), 'v ⊥ normal')
  assert.ok(vclose(cross(u, v), normal, 1e-9), 'u × v = normal (direct)')
}

describe('makeBasisFromNormal', () => {
  it('produit un repère orthonormé direct', () => {
    assertOrthonormalDirect(makeBasisFromNormal([0, 1, 0], [1, 0, 0]))
    assertOrthonormalDirect(makeBasisFromNormal([0, 0, 1], [1, 0, 0]))
    assertOrthonormalDirect(makeBasisFromNormal([0.3, 0.7, -0.2], [1, 0, 0]))
  })

  it('normalise une normale non unitaire', () => {
    assert.ok(vclose(makeBasisFromNormal([0, 5, 0]).normal, [0, 1, 0]))
  })

  it('replie sur une autre graine si seed ∥ normale', () => {
    assertOrthonormalDirect(makeBasisFromNormal([0, 1, 0], [0, 1, 0]))
  })
})

describe('groundFrame', () => {
  it('plan horizontal au niveau 0 (normale +Y)', () => {
    const f = groundFrame()
    assert.equal(f.type, 'ground')
    assert.ok(vclose(f.origin, [0, 0, 0]))
    assert.ok(vclose(f.normal, [0, 1, 0]))
    assertOrthonormalDirect(f)
  })
})

describe('faceFrame', () => {
  it('origine au point d’impact, normale = normale de la face', () => {
    const f = faceFrame([1, 2, 3], [0, 0, 5], 'structure__mur__salon__rdc__001')
    assert.equal(f.type, 'face')
    assert.ok(vclose(f.origin, [1, 2, 3]))
    assert.ok(vclose(f.normal, [0, 0, 1]))
    assert.equal(f.faceOf, 'structure__mur__salon__rdc__001')
    assertOrthonormalDirect(f)
  })

  it('mur vertical → u horizontal (largeur le long du sol)', () => {
    const f = faceFrame([0, 1, 0], [0, 0, 1]) // normale horizontale
    assert.ok(close(f.u[1], 0), 'u sans composante verticale')
  })

  it('sans faceOf → pas de clé faceOf', () => {
    assert.equal('faceOf' in faceFrame([0, 0, 0], [0, 1, 0]), false)
  })
})

describe('worldToPlane / planeToWorld', () => {
  it('aller-retour cohérent sur une face', () => {
    const f = faceFrame([1, 2, 3], [0, 0, 1])
    const [s, t] = worldToPlane([2, 4, 3], f)
    assert.ok(vclose(planeToWorld(s, t, f), [2, 4, 3]))
  })

  it('un point du sol projette puis revient', () => {
    const f = groundFrame()
    const world = [4, 0, -7]
    const [s, t] = worldToPlane(world, f)
    assert.ok(vclose(planeToWorld(s, t, f), world))
  })
})

describe('frameOfObjectPlane — rétro-compat', () => {
  it('objet sans repère (avant E12-02) → base sol par défaut', () => {
    const fr = frameOfObjectPlane({ type: 'ground', origin: [1, 0, 2] })
    assert.ok(vclose(fr.origin, [1, 0, 2]))
    assert.ok(vclose(fr.normal, [0, 1, 0]))
    assertOrthonormalDirect(fr)
  })

  it('objet avec repère explicite → repère conservé', () => {
    const fr = frameOfObjectPlane({
      origin: [1, 1, 1],
      u: [1, 0, 0],
      v: [0, 1, 0],
      normal: [0, 0, 1],
    })
    assert.ok(vclose(fr.normal, [0, 0, 1]))
  })
})

describe('extrudeHeightFromRay (Push/Pull)', () => {
  it('rayon perpendiculaire à la normale, passant à distance d → hauteur = d', () => {
    // face au sol (normale +Y) centrée à l'origine ; rayon horizontal à y=2
    // visant l'axe Y → le point le plus proche sur l'axe normal est à y=2.
    const h = extrudeHeightFromRay([0, 0, 0], [0, 1, 0], [5, 2, 0], [-1, 0, 0])
    assert.ok(close(h, 2, 1e-6), `attendu 2, obtenu ${h}`)
  })

  it('rayon ∥ à la normale → projection directe (dénominateur dégénéré)', () => {
    // rayon vertical : projection de (centre - origine rayon) sur la normale.
    const h = extrudeHeightFromRay([0, 3, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0])
    assert.ok(close(h, 3, 1e-6), `attendu 3, obtenu ${h}`)
  })

  it('hauteur signée (négative de l’autre côté)', () => {
    const h = extrudeHeightFromRay([0, 0, 0], [0, 1, 0], [5, -1.5, 0], [-1, 0, 0])
    assert.ok(close(h, -1.5, 1e-6), `attendu -1.5, obtenu ${h}`)
  })
})
