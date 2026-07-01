// Booléen CSG « vrai trou de fenêtre » (E14-02, cf. docs/edit-mode-design.md § 5.4).
// Reprend l'approche VALIDÉE par le spike (script/spike-csg.mjs, verdict 🟢 fiable
// même sur un bloc SketchUp non-manifold) : weld (`mergeVertices`) puis
// `mur − volume` via `three-bvh-csg` (Evaluator SUBTRACTION).
//
// NON-DESTRUCTIF & ré-éditable : on NE modifie jamais la géométrie importée
// d'origine. Elle est conservée dans une WeakMap (`pristineGeom`) et la découpe est
// TOUJOURS recalculée DEPUIS elle — agrandir / rétrécir / déplacer une ouverture
// repart donc du mur plein (pas de « trou fantôme »). La géométrie percée est
// posée en place sur le mesh (même objet, même calque, même matériau → calques /
// teinte / raycast continuent de fonctionner). `restoreMesh`/`restoreAll` remettent
// la géométrie d'origine ; `withPristineGeometry` permet à l'export de repartir du
// mur plein (le fichier reste ré-éditable au rechargement).

import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'

const WELD_TOL = 1e-4
// Profondeur de la boîte de découpe le long de la normale du mur (±½). Assez
// généreuse pour percer tout mur « normal » (≤ ~1 m) sans mesurer l'épaisseur.
const CUT_DEPTH = 1.2

// mesh → géométrie d'origine (jamais mutée). Module-level : survit aux re-renders
// et partagé avec l'export.
const pristineGeom = new WeakMap()
// meshes portant actuellement une géométrie PERCÉE (pour tout restaurer).
const cutMeshes = new Set()

/**
 * Boîte de découpe (monde) d'une ouverture : emprise largeur×hauteur sur la face
 * du mur, profonde de CUT_DEPTH centrée sur la face (perce des deux côtés). La
 * base est au seuil (v=0 = `plane.origin`), comme le marqueur d'ouverture.
 */
export function openingCutBox(opening) {
  const w = Math.max(Number(opening.params.largeur_m) || 0, 0.01)
  const h = Math.max(Number(opening.params.hauteur_m) || 0, 0.01)
  const { origin, u, v, normal } = opening.plane
  const box = new THREE.BoxGeometry(w, h, CUT_DEPTH)
  box.translate(0, h / 2, 0) // base à v=0 (seuil)
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...u),
    new THREE.Vector3(...v),
    new THREE.Vector3(...normal)
  )
  m.setPosition(new THREE.Vector3(...origin))
  box.applyMatrix4(m)
  return box
}

/**
 * Perce `origGeometry` (locale au mesh, `worldMatrix` = matrice monde du mesh) par
 * les boîtes de découpe (monde). Travaille en MONDE (weld fiable), rend une
 * géométrie LOCALE au mesh (réappliquée telle quelle). Renvoie une nouvelle
 * BufferGeometry (ne mute pas l'entrée).
 */
export function cutWallGeometry(origGeometry, worldMatrix, cutBoxes) {
  // Attributs conservés : uv seulement si le mur en a (murs texturés) — sinon
  // three-bvh-csg exige que les deux brushes portent l'attribut listé.
  const attributes = ['position', 'normal']
  if (origGeometry.getAttribute('uv')) attributes.push('uv')

  const evaluator = new Evaluator()
  evaluator.useGroups = false
  evaluator.attributes = attributes

  let wall = origGeometry.clone()
  wall.applyMatrix4(worldMatrix) // → monde
  wall = mergeVertices(wall, WELD_TOL)
  wall.computeVertexNormals()

  let brush = new Brush(wall)
  brush.updateMatrixWorld()
  for (const boxGeo of cutBoxes) {
    const b = new Brush(boxGeo)
    b.updateMatrixWorld()
    brush = evaluator.evaluate(brush, b, SUBTRACTION)
  }

  const out = brush.geometry.clone()
  out.applyMatrix4(new THREE.Matrix4().copy(worldMatrix).invert()) // → local
  wall.dispose()
  return out
}

/**
 * Résultat CSG dégénéré (E14-03) : vide, NaN, ou explosion de triangles → on ne
 * perce pas (fallback : mur d'origine conservé + ouverture posée en surface).
 */
export function isCutDegenerate(origGeometry, resultGeometry) {
  const pos = resultGeometry.getAttribute('position')
  if (!pos || pos.count === 0) return true
  const arr = pos.array
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return true
  const before = origGeometry.index
    ? origGeometry.index.count / 3
    : (origGeometry.getAttribute('position')?.count ?? 0) / 3
  const after = pos.count / 3
  if (after > before * 12 + 500) return true // explosion topologique
  return false
}

// ── Gestion non-destructive des géométries (WeakMap) ────────────────────────

/** Mémorise (une fois) la géométrie d'origine du mesh et la renvoie. */
export function markPristine(mesh) {
  if (!pristineGeom.has(mesh)) pristineGeom.set(mesh, mesh.geometry)
  return pristineGeom.get(mesh)
}

/** Pose une géométrie percée sur le mesh (dispose la précédente découpe). */
export function applyCut(mesh, cutGeometry) {
  const pristine = pristineGeom.get(mesh)
  if (mesh.geometry !== pristine) mesh.geometry.dispose()
  mesh.geometry = cutGeometry
  cutMeshes.add(mesh)
}

/** Restaure la géométrie d'origine d'un mesh percé. */
export function restoreMesh(mesh) {
  const pristine = pristineGeom.get(mesh)
  if (pristine && mesh.geometry !== pristine) {
    mesh.geometry.dispose()
    mesh.geometry = pristine
  }
  cutMeshes.delete(mesh)
}

/** Restaure tous les meshes actuellement percés. */
export function restoreAll() {
  for (const mesh of [...cutMeshes]) restoreMesh(mesh)
}

/**
 * Exécute `fn` alors que les meshes percés portent temporairement leur géométrie
 * D'ORIGINE (mur plein), puis rétablit la découpe. Sert à l'export : le GLB écrit
 * le mur plein + les ouvertures paramétriques → rechargeable et ré-éditable (la
 * découpe est recalculée au chargement, pas figée dans le fichier).
 */
export function withPristineGeometry(scene, fn) {
  const swapped = []
  scene.traverse((m) => {
    if (!m.isMesh) return
    const pristine = pristineGeom.get(m)
    if (pristine && m.geometry !== pristine) {
      swapped.push([m, m.geometry])
      m.geometry = pristine
    }
  })
  try {
    return fn()
  } finally {
    for (const [m, g] of swapped) m.geometry = g
  }
}
