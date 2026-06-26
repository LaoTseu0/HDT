import * as THREE from 'three'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

// three-mesh-bvh — accélère le raycast ET les requêtes de PROXIMITÉ sur les gros
// meshes importés (E12-03 snapping ; réutilisé plus tard par le CSG E14 et la
// collision du mode visite E17). Module PUR three (pas de react/r3f) → testable
// hors navigateur (script/bvh.test.mjs).
//
// On patche les prototypes three une seule fois (idempotent). Une géométrie SANS
// boundsTree retombe sur le raycast natif (acceleratedRaycast le gère) : patcher
// globalement est donc sûr même pour les meshes non indexés.

let patched = false
export function patchBVH() {
  if (patched) return
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
  THREE.Mesh.prototype.raycast = acceleratedRaycast
  patched = true
}

// Construit le boundsTree (BVH) de chaque mesh d'une scène qui n'en a pas déjà un.
// Idempotent. Coût one-time (à payer à l'entrée d'Edit mode, pas pour un simple
// viewer) ; un mesh déjà indexé est laissé tel quel.
export function ensureBoundsTree(root) {
  if (!root) return
  patchBVH()
  root.traverse((child) => {
    if (child.isMesh && child.geometry && !child.geometry.boundsTree) {
      child.geometry.computeBoundsTree()
    }
  })
}

// Vecteurs/matrices réutilisés (meshReferencesNear est appelé à chaque pointermove).
const _inv = new THREE.Matrix4()
const _center = new THREE.Vector3()
const _scale = new THREE.Vector3()
const _clamped = new THREE.Vector3()
const _closest = new THREE.Vector3()
const _w = new THREE.Vector3()

// Clé de déduplication d'un sommet (coords LOCALES arrondies au 0,1 mm) : les
// triangles partageant un sommet ont des coords locales identiques → même clé.
const vKey = (v) =>
  `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`

/**
 * Requête de proximité : sommets et arêtes des triangles d'un mesh situés à moins
 * de `radius` (unités MONDE) d'un point — pour accrocher aux références du mur
 * importé MÊME hors du triangle directement survolé (E12-03). Le BVH vit en espace
 * local du mesh : on y convertit centre + rayon, on collecte, puis on repasse en
 * monde. Sommets et arêtes sont DÉDUPLIQUÉS. Coût borné par `maxTris`.
 *
 * @param {THREE.Mesh} mesh  mesh porteur d'un `geometry.boundsTree`
 * @param {number[]} center  point de requête (monde, [x,y,z])
 * @param {number} radius    rayon de requête (monde)
 * @param {number} [maxTris] budget de triangles collectés (borne le coût)
 * @returns {{verts:number[][], edges:Array<[number[],number[]]>}|null}
 *          null si le mesh n'a pas de boundsTree (l'appelant retombe sur le
 *          triangle survolé).
 */
export function meshReferencesNear(mesh, center, radius, maxTris = 64) {
  const bvh = mesh?.geometry?.boundsTree
  if (!bvh) return null

  const mw = mesh.matrixWorld
  _inv.copy(mw).invert()
  _center.set(center[0], center[1], center[2]).applyMatrix4(_inv)
  mesh.getWorldScale(_scale)
  // Rayon local conservateur : on divise par la PLUS PETITE échelle (sur-collecte
  // un peu plutôt que de manquer une référence sur un mesh à échelle non uniforme).
  const minScale =
    Math.min(Math.abs(_scale.x), Math.abs(_scale.y), Math.abs(_scale.z)) || 1
  const localRadius = radius / minScale
  const r2 = localRadius * localRadius

  const verts = new Map() // clé → [x,y,z] monde
  const edgeKeys = new Set()
  const edges = []
  let count = 0

  bvh.shapecast({
    intersectsBounds: (box) => {
      box.clampPoint(_center, _clamped)
      return _clamped.distanceToSquared(_center) <= r2
    },
    intersectsTriangle: (tri) => {
      tri.closestPointToPoint(_center, _closest)
      if (_closest.distanceToSquared(_center) > r2) return false // hors rayon

      const tv = [tri.a, tri.b, tri.c]
      const keys = [vKey(tri.a), vKey(tri.b), vKey(tri.c)]
      const world = tv.map((v) => {
        _w.copy(v).applyMatrix4(mw)
        return [_w.x, _w.y, _w.z]
      })
      for (let i = 0; i < 3; i++) {
        if (!verts.has(keys[i])) verts.set(keys[i], world[i])
      }
      for (let i = 0; i < 3; i++) {
        const a = i
        const b = (i + 1) % 3
        const ek = keys[a] < keys[b] ? `${keys[a]}|${keys[b]}` : `${keys[b]}|${keys[a]}`
        if (!edgeKeys.has(ek)) {
          edgeKeys.add(ek)
          edges.push([world[a], world[b]])
        }
      }
      count++
      return count >= maxTris // budget atteint → on arrête la traversée
    },
  })

  return { verts: [...verts.values()], edges }
}
