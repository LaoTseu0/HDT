// Ré-export GLB des objets créés in-app (E10-04, cf. docs/edit-mode-design.md § 5.6).
//
// On réécrit la scène en GLB via `GLTFExporter` (navigateur). Le principe
// paramétrique est conservé : chaque objet app est exporté comme un node glTF
// normal portant ses `extras.edit { kind, plane, params }` + `source: 'app'`.
// La géométrie est « bakée » (pour les autres viewers), mais au rechargement
// l'app la REGÉNÈRE depuis les params (cf. loadModel.extractModelData) → le
// fichier reste ré-éditable.
//
// E12-06 : chaque objet app porte un node name CONFORME
// (`système__type__zone__niveau__index`, dérivé via lib/naming) ET les extras
// `layer/type/zone/level/index` correspondants — comme un node issu du pipeline.
// Le fichier ré-exporté passe donc la regex de validation (`script/process.mjs`).
//
// La géométrie importée (coquille SketchUp) est ré-exportée telle quelle. Elle
// ressort DÉCOMPRESSÉE (GLTFExporter ne fait pas de Draco) : repasser le fichier
// par `script/process.mjs` pour recompresser/valider reste possible et prévu.

import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { generateObject, deriveDims } from './editRegistry.js'
import { nodeName } from './naming.js'
import { withPristineGeometry } from './csg.js'

// Extras d'un node créé in-app. `layer/type/zone/level/index` = métadonnées de
// convention (cohérentes avec un node pipeline) ; `edit` = bloc qui rend l'objet
// ré-éditable (régénération depuis params au chargement) ; `source: 'app'` le
// distingue de la coquille importée.
export function buildAppNodeExtras(obj) {
  const extras = {
    source: 'app',
    layer: obj.system,
    type: obj.type,
    zone: obj.zone,
    level: obj.level,
    index: obj.index,
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
  // ne pas muter la scène vivante (montée dans le Canvas). `withPristineGeometry`
  // rétablit le temps du clone les murs PLEINS (E14-02) : le GLB écrit le mur non
  // percé + les ouvertures paramétriques → la découpe est recalculée au
  // chargement (fichier ré-éditable), pas figée dans la géométrie exportée.
  if (scene) {
    let clone
    withPristineGeometry(scene, () => {
      clone = scene.clone()
    })
    for (const child of [...clone.children]) exportScene.add(child)
  }

  // Objets app : bakés depuis leurs params, porteurs de leurs extras.edit.
  for (const obj of Object.values(objects)) {
    const baked = generateObject(obj)
    if (!baked) continue
    baked.name = nodeName(obj) // node name conforme (E12-06), pas l'id interne
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
