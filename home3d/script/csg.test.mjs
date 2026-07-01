import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'

import { openingCutBox, cutWallGeometry, isCutDegenerate } from '../src/lib/csg.js'

// CSG « vrai trou de fenêtre » (E14-02). Testé headless comme le spike : on perce
// un mur-boîte watertight et on vérifie le trou par raycast (traverse au centre de
// l'ouverture, touche autour). three-bvh-csg tourne en Node (cf. spike-csg.mjs).

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// Ouverture posée sur la face +Z d'un mur : seuil (origin) sur la face, u=+X
// (largeur), v=+Y (hauteur), normal=+Z.
function makeOpening(allege = 0.8) {
  return {
    kind: 'opening.window',
    params: { largeur_m: 1.2, hauteur_m: 1.0, allege_m: allege },
    plane: { origin: [0, allege, 0.1], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  }
}

describe('openingCutBox', () => {
  it('emprise largeur×hauteur, profonde, centrée sur la face au seuil', () => {
    const box = openingCutBox(makeOpening(0.8))
    box.computeBoundingBox()
    const b = box.boundingBox
    const size = b.getSize(new THREE.Vector3())
    const center = b.getCenter(new THREE.Vector3())
    assert.ok(close(size.x, 1.2)) // largeur
    assert.ok(close(size.y, 1.0)) // hauteur
    assert.ok(size.z >= 1.0) // profonde (perce le mur des deux côtés)
    assert.ok(close(center.x, 0)) // centrée en x
    assert.ok(close(center.y, 0.8 + 0.5)) // seuil 0,8 + ½ hauteur
    assert.ok(close(center.z, 0.1)) // centrée sur la face
    box.dispose()
  })
})

// Mur-boîte watertight : 4 m × 2,6 m × 20 cm, posé au sol (min.y=0).
function wallGeometry() {
  const g = new THREE.BoxGeometry(4, 2.6, 0.2)
  g.translate(0, 1.3, 0)
  return g
}

// Un rayon touche-t-il le mesh dans la bande de la façade (z ∈ [-0.1, 0.1]) ?
function raycastHitsFront(mesh, x, y) {
  const rc = new THREE.Raycaster(new THREE.Vector3(x, y, -1), new THREE.Vector3(0, 0, 1), 0, 5)
  return rc.intersectObject(mesh, false).some((h) => h.point.z >= -0.15 && h.point.z <= 0.15)
}

describe('cutWallGeometry + isCutDegenerate', () => {
  it('perce un vrai trou (centre traversé, mur conservé autour)', () => {
    const wall = wallGeometry()
    const box = openingCutBox(makeOpening(0.8)) // ouverture x∈[-0.6,0.6], y∈[0.8,1.8]
    const result = cutWallGeometry(wall, new THREE.Matrix4(), [box])

    assert.equal(isCutDegenerate(wall, result), false)

    const mesh = new THREE.Mesh(result, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    mesh.updateMatrixWorld()
    // Centre de l'ouverture (0, 1.3) → percé (aucune touche de façade).
    assert.equal(raycastHitsFront(mesh, 0, 1.3), false)
    // Loin de l'ouverture (1,5, 1,3) → mur conservé (touche).
    assert.equal(raycastHitsFront(mesh, 1.5, 1.3), true)
    // Au-dessus de l'ouverture (0, 2,3) → mur conservé (touche).
    assert.equal(raycastHitsFront(mesh, 0, 2.3), true)

    wall.dispose()
    box.dispose()
    result.dispose()
  })

  it('isCutDegenerate : géométrie vide → dégénérée', () => {
    const empty = new THREE.BufferGeometry()
    empty.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    assert.equal(isCutDegenerate(wallGeometry(), empty), true)
  })
})
