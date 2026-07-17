// Chargement GLB + extraction des métadonnées `extras` (E3-03 → E3-06).
// Les loaders sont créés une seule fois ; les décodeurs Draco et le
// transcodeur Basis (KTX2) sont servis localement depuis public/
// (copiés par script/copy-decoders.mjs en postinstall).

import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { kindNaming } from '@/features/edit/registry'
import { DEFAULT_ZONE, DEFAULT_LEVEL } from '@/core/naming'
import { isAppNodeUserData, nodeExtrasOf } from '@/types'
import type {
  LayerConfig,
  LayersTable,
  ModelMetadata,
  NodesTable,
  ObjectsTable,
} from '@/types'

// Calque de repli pour les meshes sans extras (E3-03) — seul élément
// de config côté app, tout le reste vient des extras du GLB.
export const UNCLASSIFIED_LAYER = 'non_classe'
const UNCLASSIFIED_CONFIG: LayerConfig = {
  label: 'Non classé',
  color: '#9e9e9e',
  visible: true,
}

// GLB syntaxiquement valide mais sans les extras du pipeline (E3-05).
export class PipelineError extends Error {}

let loader: GLTFLoader | null = null

function getLoader(gl: THREE.WebGLRenderer): GLTFLoader {
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
export function parseGLB(buffer: ArrayBuffer, gl: THREE.WebGLRenderer): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    getLoader(gl).parse(buffer, '', resolve, reject)
  })
}

/** Données extraites d'un GLB parsé. */
export interface ModelData {
  metadata: ModelMetadata
  layers: LayersTable
  nodes: NodesTable
  objects: ObjectsTable
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
 */
export function extractModelData(gltf: GLTF): ModelData {
  const sceneExtras = gltf.scene.userData as Partial<ModelMetadata>
  if (!sceneExtras?.layers || !sceneExtras?.model) {
    throw new PipelineError(
      'Ce GLB ne contient pas les métadonnées attendues : ' +
        'fichier non passé par le pipeline (script/process.mjs).'
    )
  }
  const metadata = sceneExtras as ModelMetadata

  // Copie : la config des calques vit dans le store, pas dans la scène.
  const layers: LayersTable = {}
  for (const [id, config] of Object.entries(metadata.layers)) {
    layers[id] = { ...config }
  }

  const nodes: NodesTable = {}
  const objects: ObjectsTable = {}
  const appNodes: THREE.Object3D[] = []
  let unclassified = 0
  const walk = (object: THREE.Object3D, inheritedLayer: string | null) => {
    const ud = nodeExtrasOf(object)
    // Défensif : purge un résidu `__origMaterial` (interne à appearance) qui
    // aurait pu fuiter dans les extras d'un GLB ré-exporté avant le correctif
    // WeakMap — sinon applyAppearance le ré-utiliserait comme matériau
    // (couleur sérialisée en nombre → mesh non rendu).
    if (ud && '__origMaterial' in ud) delete ud.__origMaterial
    // Objet créé in-app : reconstruit depuis ses params, sous-arbre ignoré. Les
    // champs de nommage (E12-06) sont relus des extras ; repli sur le registre +
    // défauts pour un GLB exporté avant E12-06 (node name non conforme = id).
    if (isAppNodeUserData(ud)) {
      const { kind, params, plane } = ud.edit
      const fallback = kindNaming(kind)
      objects[object.name] = {
        id: object.name,
        kind,
        params,
        plane,
        system: ud.layer ?? fallback.system,
        type: ud.type ?? fallback.type,
        zone: ud.zone ?? DEFAULT_ZONE,
        level: ud.level ?? DEFAULT_LEVEL,
        index: Number(ud.index) || 1,
        // E10-02 : métadonnées descriptives relues telles quelles (absentes si
        // jamais renseignées — l'export écrit '' par défaut).
        ...(typeof ud.material === 'string' && ud.material
          ? { material: ud.material }
          : {}),
        ...(typeof ud.notes === 'string' && ud.notes ? { notes: ud.notes } : {}),
        // Cast : `edit` porte le couple kind/params apparié par construction
        // (buildAppNodeExtras) — TS ne peut pas le re-corréler après lecture.
      } as ObjectsTable[string]
      appNodes.push(object)
      return
    }
    const ownLayer = typeof ud?.layer === 'string' ? ud.layer : undefined
    if (ownLayer) nodes[object.name] = ud
    const layer = ownLayer ?? inheritedLayer
    if (object instanceof THREE.Mesh && !layer) {
      ud.layer = UNCLASSIFIED_LAYER
      unclassified += 1
    }
    for (const child of object.children) walk(child, layer ?? null)
  }
  walk(gltf.scene, null)

  // Détacher après le parcours : la géométrie bakée des objets app ne doit pas
  // être rendue (EditObjects la régénère depuis les params).
  for (const node of appNodes) node.parent?.remove(node)

  if (unclassified > 0) {
    layers[UNCLASSIFIED_LAYER] = { ...UNCLASSIFIED_CONFIG }
  }

  return { metadata, layers, nodes, objects }
}
