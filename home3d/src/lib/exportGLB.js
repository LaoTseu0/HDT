// Ré-export GLB des objets créés in-app (E10-04, cf. docs/edit-mode-design.md § 5.6).
//
// On réécrit la scène en GLB via `GLTFExporter` (navigateur). Le principe
// paramétrique est conservé : chaque objet app est exporté comme un node glTF
// normal portant ses `extras.edit { kind, plane, params }` + `source: 'app'`.
// La géométrie est « bakée » (pour les autres viewers), mais au rechargement
// l'app la REGÉNÈRE depuis les params (cf. loadModel.extractModelData) → le
// fichier reste ré-éditable.
//
// NB Slice 0 : les primitives d'esquisse (sketch.*) ne relèvent d'aucun système
// technique, donc pas de `layer/type/zone/level/index` ni de nom conforme à la
// convention ici — c'est l'objet de E12-06 (génération des node names + zone)
// pour les vrais objets MEP/ouvertures. Le node name reste l'id app.
//
// La géométrie importée (coquille SketchUp) est ré-exportée telle quelle. Elle
// ressort DÉCOMPRESSÉE (GLTFExporter ne fait pas de Draco) : repasser le fichier
// par `script/process.mjs` pour recompresser/valider reste possible et prévu.

import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { generateObject, deriveDims } from './editRegistry.js'

// Extras d'un node créé in-app. `edit` est le bloc qui rend l'objet ré-éditable.
export function buildAppNodeExtras(obj) {
  const extras = {
    source: 'app',
    edit: { kind: obj.kind, plane: obj.plane, params: obj.params },
    material: '',
    notes: '',
  }
  const dims = deriveDims(obj)
  if (dims) extras.dims = dims
  return extras
}

/**
 * Construit le GLB binaire (ArrayBuffer) de la scène éditée : coquille importée
 * + objets app paramétriques.
 *
 * @param {{ scene: THREE.Object3D|null, objects: object, metadata: object|null }} input
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildEditedGLB({ scene, objects, metadata }) {
  const exportScene = new THREE.Scene()
  // Les extras de scène (model + layers) vivent sur la racine exportée → au
  // rechargement, `gltf.scene.userData` les retrouve (sinon PipelineError).
  exportScene.userData = metadata ? { ...metadata } : {}

  // Coquille importée : on clone (userData copié par valeur) puis on re-parente
  // ses enfants, pour ne pas dupliquer les extras de scène sur un node et pour
  // ne pas muter la scène vivante (montée dans le Canvas).
  if (scene) {
    const clone = scene.clone()
    for (const child of [...clone.children]) exportScene.add(child)
  }

  // Objets app : bakés depuis leurs params, porteurs de leurs extras.edit.
  for (const obj of Object.values(objects)) {
    const baked = generateObject(obj)
    if (!baked) continue
    baked.name = obj.id
    baked.userData = buildAppNodeExtras(obj)
    // Les enfants (remplissage/arêtes) ne portent pas de métadonnées métier.
    baked.traverse((child) => {
      if (child !== baked) child.userData = {}
    })
    exportScene.add(baked)
  }

  const exporter = new GLTFExporter()
  return exporter.parseAsync(exportScene, { binary: true })
}

/** Déclenche le téléchargement navigateur d'un GLB binaire. */
export function downloadGLB(arrayBuffer, fileName) {
  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
