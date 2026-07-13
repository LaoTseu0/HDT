import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import * as THREE from 'three'

import { ensureBoundsTree, meshReferencesNear } from '@/core/bvh'

// lib/bvh.js touche three + three-mesh-bvh mais pas react/r3f → testable headless.
// On vérifie la requête de proximité (E12-03) sur un cube unité : déduplication des
// sommets/arêtes partagés entre triangles, filtrage par rayon, prise en compte de la
// transformée monde du mesh.

const vclose = (a: readonly number[], b: readonly number[], eps = 1e-6) =>
  a.every((x, i) => Math.abs(x - (b[i] ?? NaN)) <= eps)
const hasVert = (verts: readonly number[][], target: readonly number[], eps = 1e-6) =>
  verts.some((v) => vclose(v, target, eps))

function unitCubeMesh() {
  // Cube 1×1×1 centré : 8 coins, 12 arêtes, 12 triangles. BoxGeometry est indexée
  // mais DÉDOUBLE les coins par face → bon cas de test pour la déduplication.
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
  mesh.updateMatrixWorld(true)
  ensureBoundsTree(mesh) // patche les prototypes + construit le boundsTree
  return mesh
}

describe('meshReferencesNear', () => {
  it('renvoie null sans boundsTree (repli appelant)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    assert.equal(meshReferencesNear(mesh, [0, 0, 0], 1), null)
  })

  it('déduplique les sommets et arêtes du cube (rayon englobant)', () => {
    const mesh = unitCubeMesh()
    const refs = meshReferencesNear(mesh, [0, 0, 0], 1.0)! // couvre tous les triangles
    assert.equal(refs.verts.length, 8, '8 coins dédupliqués')
    // 12 arêtes du cube + 6 diagonales de triangulation (chaque face = 2 triangles).
    // Les diagonales sont des candidats bénins (leur milieu = centre de face).
    assert.equal(refs.edges.length, 18, 'arêtes triangulées dédupliquées')
    assert.ok(hasVert(refs.verts, [0.5, 0.5, 0.5]), 'un coin attendu est présent')
    assert.ok(hasVert(refs.verts, [-0.5, -0.5, -0.5]))
  })

  it('ne capte que les références dans le rayon', () => {
    const mesh = unitCubeMesh()
    // Petit rayon autour d'un coin : on capte ce coin, pas le coin opposé.
    const refs = meshReferencesNear(mesh, [0.5, 0.5, 0.5], 0.2)!
    assert.ok(hasVert(refs.verts, [0.5, 0.5, 0.5]))
    assert.ok(!hasVert(refs.verts, [-0.5, -0.5, -0.5]))
  })

  it('rien à portée → listes vides', () => {
    const mesh = unitCubeMesh()
    const refs = meshReferencesNear(mesh, [10, 10, 10], 0.2)!
    assert.equal(refs.verts.length, 0)
    assert.equal(refs.edges.length, 0)
  })

  it('tient compte de la transformée monde (translation)', () => {
    const mesh = unitCubeMesh()
    mesh.position.set(10, 0, 0)
    mesh.updateMatrixWorld(true)
    const refs = meshReferencesNear(mesh, [10.5, 0.5, 0.5], 0.2)!
    assert.ok(hasVert(refs.verts, [10.5, 0.5, 0.5]), 'coin transformé en monde')
  })

  it('borne le nombre de triangles collectés (maxTris)', () => {
    const mesh = unitCubeMesh()
    const refs = meshReferencesNear(mesh, [0, 0, 0], 1.0, 1)! // 1 seul triangle
    // 1 triangle = 3 sommets, 3 arêtes au plus.
    assert.ok(refs.verts.length <= 3)
    assert.ok(refs.edges.length <= 3)
  })
})
