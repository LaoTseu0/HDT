// Chargement GLB + extraction des métadonnées `extras` (E3-03 → E3-06).
// Les loaders sont créés une seule fois ; les décodeurs Draco et le
// transcodeur Basis (KTX2) sont servis localement depuis public/
// (copiés par script/copy-decoders.mjs en postinstall).

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

// Calque de repli pour les meshes sans extras (E3-03) — seul élément
// de config côté app, tout le reste vient des extras du GLB.
export const UNCLASSIFIED_LAYER = 'non_classe'
const UNCLASSIFIED_CONFIG = { label: 'Non classé', color: '#9e9e9e', visible: true }

// GLB syntaxiquement valide mais sans les extras du pipeline (E3-05).
export class PipelineError extends Error {}

let loader = null

function getLoader(gl) {
  if (!loader) {
    const base = import.meta.env.BASE_URL
    const dracoLoader = new DRACOLoader().setDecoderPath(`${base}draco/`)
    const ktx2Loader = new KTX2Loader()
      .setTranscoderPath(`${base}basis/`)
      .detectSupport(gl)
    loader = new GLTFLoader().setDRACOLoader(dracoLoader).setKTX2Loader(ktx2Loader)
  }
  return loader
}

/** Parse un GLB depuis un ArrayBuffer. `gl` : renderer WebGL (detectSupport KTX2). */
export function parseGLB(buffer, gl) {
  return new Promise((resolve, reject) => {
    getLoader(gl).parse(buffer, '', resolve, reject)
  })
}

/**
 * Extrait les métadonnées d'un gltf parsé (GLTFLoader place les `extras`
 * glTF dans `userData`).
 *
 * - extras scène racine → config des calques + infos modèle (E3-04)
 * - extras par node → table { nodeName: extras } (E3-03)
 * - meshes sans calque (propre ou hérité) → calque « non classé » (E3-03),
 *   matérialisé par un `userData.layer` posé sur le mesh
 * - nodes créés in-app (`source: 'app'` + `edit`) → reconstruits en objets
 *   paramétriques et DÉTACHÉS de la scène : l'app régénère leur géométrie
 *   depuis les params (EditObjects), la version bakée n'est qu'un repli
 *   d'interopérabilité (E10-04, cf. exportGLB).
 *
 * @throws {PipelineError} si les extras scène sont absents (GLB non passé
 *   par le pipeline).
 * @returns {{ metadata: object, layers: object, nodes: object, objects: object }}
 */
export function extractModelData(gltf) {
  const sceneExtras = gltf.scene.userData
  if (!sceneExtras?.layers || !sceneExtras?.model) {
    throw new PipelineError(
      'Ce GLB ne contient pas les métadonnées attendues : ' +
        'fichier non passé par le pipeline (script/process.mjs).'
    )
  }

  // Copie : la config des calques vit dans le store, pas dans la scène.
  const layers = {}
  for (const [id, config] of Object.entries(sceneExtras.layers)) {
    layers[id] = { ...config }
  }

  const nodes = {}
  const objects = {}
  const appNodes = []
  let unclassified = 0
  const walk = (object, inheritedLayer) => {
    const ud = object.userData
    // Défensif : purge un résidu `__origMaterial` (interne à appearance.js)
    // qui aurait pu fuiter dans les extras d'un GLB ré-exporté avant le
    // correctif WeakMap — sinon applyAppearance le ré-utiliserait comme
    // matériau (couleur sérialisée en nombre → mesh non rendu).
    if (ud && '__origMaterial' in ud) delete ud.__origMaterial
    // Objet créé in-app : reconstruit depuis ses params, sous-arbre ignoré.
    if (ud?.source === 'app' && ud?.edit) {
      const { kind, params, plane } = ud.edit
      objects[object.name] = { id: object.name, kind, params, plane }
      appNodes.push(object)
      return
    }
    const ownLayer = ud?.layer
    if (ownLayer) nodes[object.name] = ud
    const layer = ownLayer ?? inheritedLayer
    if (object.isMesh && !layer) {
      ud.layer = UNCLASSIFIED_LAYER
      unclassified += 1
    }
    for (const child of object.children) walk(child, layer)
  }
  walk(gltf.scene, null)

  // Détacher après le parcours : la géométrie bakée des objets app ne doit pas
  // être rendue (EditObjects la régénère depuis les params).
  for (const node of appNodes) node.parent?.remove(node)

  if (unclassified > 0) {
    layers[UNCLASSIFIED_LAYER] = { ...UNCLASSIFIED_CONFIG }
  }

  return { metadata: sceneExtras, layers, nodes, objects }
}
