// Application de l'état des calques, de la sélection et du survol sur la
// scène three.js (E5-02, E5-04, E6-01, E6-04). Une seule passe récursive gère :
//   - la visibilité par calque (object.visible sur le porteur du layer)
//   - la colorisation par calque (matériau teinté partagé par calque)
//   - la surbrillance de l'objet sélectionné ou survolé (clone émissif par mesh)
// Les matériaux d'origine sont conservés sur chaque mesh : tout est
// réversible sans rechargement du GLB.

import * as THREE from 'three'
import { nodeExtrasOf } from '@/types'
import type { HiddenSubtypes, LayersTable } from '@/types'

interface AppearanceCache {
  layerMaterials: Map<string, THREE.MeshStandardMaterial>
  highlightMaterials: THREE.Material[]
}

// Caches par scène : matériaux teintés (un par calque, partagé entre meshes)
// et clones émissifs de la sélection courante (à disposer à chaque passe).
const caches = new WeakMap<THREE.Object3D, AppearanceCache>()

// Matériau d'origine par mesh. IMPORTANT : stocké dans une WeakMap, JAMAIS dans
// `object.userData` — ce dernier est sérialisé en `extras` par GLTFExporter (un
// `THREE.Color` y devient un nombre), ce qui corrompait le matériau au ré-import
// du GLB ré-exporté (E10-04). La WeakMap reste hors du fichier.
const originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>()

function getCache(scene: THREE.Object3D): AppearanceCache {
  let cache = caches.get(scene)
  if (!cache) {
    cache = { layerMaterials: new Map(), highlightMaterials: [] }
    caches.set(scene, cache)
  }
  return cache
}

function getLayerMaterial(
  cache: AppearanceCache,
  layerId: string,
  color: string
): THREE.MeshStandardMaterial {
  let material = cache.layerMaterials.get(layerId)
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
    })
    cache.layerMaterials.set(layerId, material)
  }
  return material
}

/** État d'apparence à synchroniser (sous-ensemble du store). */
export interface AppearanceState {
  layers: LayersTable
  hiddenSubtypes?: HiddenSubtypes
  colorByLayer: boolean
  selectedNode: string | null
  hoveredNode: string | null
}

/**
 * Synchronise la scène avec l'état du store.
 *
 * @param scene scène du GLB chargé
 * @param state calques, sous-types masqués (E20-04), colorisation (E5-04),
 *   sélection (E6-01) et survol (E6-04)
 */
export function applyAppearance(
  scene: THREE.Object3D,
  {
    layers,
    hiddenSubtypes = {},
    colorByLayer,
    selectedNode,
    hoveredNode,
  }: AppearanceState
): void {
  const cache = getCache(scene)

  // Les clones émissifs de la passe précédente ne servent plus.
  for (const material of cache.highlightMaterials) material.dispose()
  cache.highlightMaterials.length = 0

  const walk = (
    object: THREE.Object3D,
    inheritedLayer: string | null,
    inheritedSelected: boolean,
    inheritedHovered: boolean
  ) => {
    const extras = nodeExtrasOf(object)
    const ownLayer = typeof extras.layer === 'string' ? extras.layer : null
    if (ownLayer && layers[ownLayer]) {
      // Visibilité à deux niveaux (E20-04) : calque ET sous-type. Le porteur du
      // layer porte aussi le `type` (mêmes extras pipeline) ; un node sans type
      // (« non classé ») ne relève que du calque.
      const typeHidden = !!(extras.type && hiddenSubtypes[ownLayer]?.[extras.type])
      object.visible = layers[ownLayer].visible && !typeHidden
    }
    const layer = ownLayer ?? inheritedLayer
    const selected =
      inheritedSelected || (selectedNode != null && object.name === selectedNode)
    const hovered =
      inheritedHovered || (hoveredNode != null && object.name === hoveredNode)

    if (object instanceof THREE.Mesh) {
      if (!originalMaterials.has(object)) {
        originalMaterials.set(object, object.material)
      }
      const config = layer ? layers[layer] : null
      const base =
        colorByLayer && config && layer
          ? getLayerMaterial(cache, layer, config.color)
          : originalMaterials.get(object)!

      // Sélection prioritaire sur le survol ; le survol reste léger (E6-04).
      if ((selected || hovered) && !Array.isArray(base)) {
        const highlight = base.clone()
        if ('emissive' in highlight && highlight.emissive instanceof THREE.Color) {
          highlight.emissive.set('#3da9fc')
          ;(highlight as THREE.MeshStandardMaterial).emissiveIntensity = selected
            ? 0.55
            : 0.18
        }
        cache.highlightMaterials.push(highlight)
        object.material = highlight
      } else {
        object.material = base
      }
    }

    for (const child of object.children) walk(child, layer, selected, hovered)
  }
  walk(scene, null, false, false)
}

/** Vrai si l'objet et tous ses ancêtres sont visibles (raycast E6-03). */
export function isChainVisible(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (current.visible === false) return false
  }
  return true
}
