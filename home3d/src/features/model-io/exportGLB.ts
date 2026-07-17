// Export GLB de la scène éditée (E10-04) : coquille importée + objets app
// paramétriques, ré-éditable au rechargement (extras.edit).

import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { generateObject, deriveDims } from '@/features/edit/registry'
import { nodeName, subtypeLabel } from '@/core/naming'
import { withPristineGeometry } from '@/features/openings/csg'
import type { AppNodeExtras, AppObject, ModelMetadata, ObjectsTable } from '@/types'

// Extras d'un node créé in-app. `layer/type/zone/level/index` = métadonnées de
// convention (cohérentes avec un node pipeline) ; `edit` = bloc qui rend l'objet
// ré-éditable (régénération depuis params au chargement) ; `source: 'app'` le
// distingue de la coquille importée.
export function buildAppNodeExtras(obj: AppObject): AppNodeExtras {
  const extras: AppNodeExtras = {
    source: 'app',
    layer: obj.system,
    type: obj.type,
    zone: obj.zone,
    level: obj.level,
    index: obj.index,
    // Parité pipeline (E20-02) : sous-type + label FR (null hors vocabulaire).
    subtype: obj.type,
    subtypeLabel: subtypeLabel(obj.system, obj.type),
    edit: {
      kind: obj.kind,
      plane: obj.plane,
      params: obj.params,
    } as AppNodeExtras['edit'],
    // E10-02 : métadonnées descriptives saisies dans le panneau Info.
    material: obj.material ?? '',
    notes: obj.notes ?? '',
  }
  const dims = deriveDims(obj)
  if (dims) extras.dims = dims
  return extras
}

/**
 * Construit le GLB binaire (ArrayBuffer) de la scène éditée : coquille importée
 * + objets app paramétriques.
 */
export async function buildEditedGLB({
  scene,
  objects,
  metadata,
}: {
  scene: THREE.Object3D | null
  objects: ObjectsTable
  metadata: ModelMetadata | null
}): Promise<ArrayBuffer> {
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
    const clone = withPristineGeometry(scene, () => scene.clone())
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
  return exporter.parseAsync(exportScene, { binary: true }) as Promise<ArrayBuffer>
}

/** Déclenche le téléchargement navigateur d'un GLB binaire. */
export function downloadGLB(arrayBuffer: ArrayBuffer, fileName: string): void {
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
