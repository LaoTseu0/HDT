import * as THREE from 'three'
import { meshReferencesNear, type MeshReferences } from './bvh'
import { SNAP_THRESHOLD_PX } from './snapping'
import type { Vec3 } from '@/types'

// Projection écran + collecte des références d'accroche du mesh importé —
// helpers partagés entre le tracé (EditObjects, E12-03) et le drag sur axe
// des poignées / du Push/Pull (useAxisDrag, E22-03). Dépendent de three
// (caméra, géométrie survolée) contrairement à core/snapping (maths pures).

const SNAP_QUERY_MARGIN = 1.6 // sur-collecte BVH vs seuil px (le gate exact reste pickBestSnap)

/** Caméras supportées par la projection écran (perspective ou ortho). */
export type AnyCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera

/** Zone écran du canvas (getBoundingClientRect suffit). */
export interface ViewportRect {
  width: number
  height: number
}

// Position écran (pixels, repère canvas) d'un point monde. Vecteur réutilisé : le
// snapping projette des dizaines de candidats par déplacement souris.
const _projV = new THREE.Vector3()
export function worldToScreen(
  point: Vec3,
  camera: AnyCamera,
  rect: ViewportRect
): { x: number; y: number } {
  _projV.set(point[0], point[1], point[2]).project(camera)
  return {
    x: (_projV.x * 0.5 + 0.5) * rect.width,
    y: (-_projV.y * 0.5 + 0.5) * rect.height,
  }
}

// Taille MONDE d'un pixel écran à la profondeur d'un point — pour dimensionner
// les requêtes de proximité BVH d'après le seuil d'accroche en pixels, et les
// poignées à taille écran constante (DeformHandles).
const _radV = new THREE.Vector3()
export function worldPerPixel(
  point: Vec3,
  camera: AnyCamera,
  viewportHeight: number
): number {
  if (camera instanceof THREE.OrthographicCamera) {
    return (camera.top - camera.bottom) / camera.zoom / viewportHeight
  }
  const dist = camera.position.distanceTo(_radV.set(point[0], point[1], point[2]))
  const worldHeight = 2 * dist * Math.tan((camera.fov * Math.PI) / 360)
  return worldHeight / viewportHeight
}

/** Impact de raycast minimal consommé ici (sous-ensemble de THREE.Intersection). */
export interface MeshHit {
  object: THREE.Mesh
  face: { a: number; b: number; c: number } | null
}

// Sommets monde du triangle touché.
function triangleWorldVerts(hit: MeshHit): [Vec3, Vec3, Vec3] {
  const pos = hit.object.geometry.attributes.position as THREE.BufferAttribute
  const m = hit.object.matrixWorld
  const v = new THREE.Vector3()
  const face = hit.face ?? { a: 0, b: 0, c: 0 }
  return [face.a, face.b, face.c].map((i): Vec3 => {
    v.fromBufferAttribute(pos, i).applyMatrix4(m)
    return [v.x, v.y, v.z]
  }) as [Vec3, Vec3, Vec3]
}

// Références d'accroche du MESH importé près du curseur. Requête de proximité
// `three-mesh-bvh` (E12-03) : sommets + arêtes des triangles à portée d'écran,
// PAS seulement le triangle directement survolé. Repli sur le triangle survolé si
// le mesh n'a pas de boundsTree. Renvoie sommets et arêtes en MONDE (non projetés).
export function meshRefsNear(
  hit: MeshHit,
  freeWorld: Vec3,
  camera: AnyCamera,
  rect: ViewportRect
): MeshReferences {
  const radius =
    SNAP_THRESHOLD_PX * SNAP_QUERY_MARGIN * worldPerPixel(freeWorld, camera, rect.height)
  const refs = meshReferencesNear(hit.object, freeWorld, radius)
  if (refs) return refs
  // Fallback : le seul triangle survolé (comportement E12-03 inc.1).
  const [a, b, c] = triangleWorldVerts(hit)
  return {
    verts: [a, b, c],
    edges: [
      [a, b],
      [b, c],
      [c, a],
    ],
  }
}
