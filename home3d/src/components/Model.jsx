import { useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import useStore from '../store/useStore.js'
import { extractModelData, parseGLB, PipelineError } from '../lib/loadModel.js'
import { applyAppearance, isChainVisible } from '../lib/appearance.js'

// Rendu du GLB chargé + parse des fichiers déposés (E3-03 → E3-06),
// sélection au clic (E6-01, E6-03) et application de l'état des calques.
// Le parse vit dans le Canvas car le KTX2Loader a besoin du renderer.
export default function Model() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const pendingFile = useStore((state) => state.pendingFile)
  const glb = useStore((state) => state.glb)
  const layers = useStore((state) => state.layers)
  const colorByLayer = useStore((state) => state.colorByLayer)
  const selectedNode = useStore((state) => state.selectedNode)
  const nodes = useStore((state) => state.nodes)
  const selectNode = useStore((state) => state.selectNode)
  const setModel = useStore((state) => state.setModel)
  const setLoadError = useStore((state) => state.setLoadError)

  useEffect(() => {
    if (!pendingFile) return
    let cancelled = false
    ;(async () => {
      try {
        const gltf = await parseGLB(pendingFile.buffer, gl)
        if (cancelled) return
        const data = extractModelData(gltf)
        setModel({ scene: gltf.scene, fileName: pendingFile.name, ...data })
      } catch (err) {
        if (cancelled) return
        setLoadError(
          err instanceof PipelineError
            ? err.message
            : `GLB illisible ou corrompu : ${err.message ?? err}`
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pendingFile, gl, setModel, setLoadError])

  // E4-01 : au chargement, cible des controls centrée sur le modèle
  // et caméra reculée pour cadrer sa bounding box.
  useEffect(() => {
    if (!glb || !controls) return
    const box = new THREE.Box3().setFromObject(glb.scene)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.y, size.z, 1)
    camera.position.set(
      center.x + radius * 0.9,
      center.y + radius * 0.75,
      center.z + radius * 0.9
    )
    controls.target.copy(center)
    controls.update()
  }, [glb, controls, camera])

  // Visibilité (E3-04, E5-02), colorisation par calque (E5-04) et
  // surbrillance de la sélection (E6-01) : une seule passe sur la scène.
  useEffect(() => {
    if (!glb) return
    applyAppearance(glb.scene, { layers, colorByLayer, selectedNode })
  }, [glb, layers, colorByLayer, selectedNode])

  // E6-01 : sélection par raycasting (events R3F). On remonte du mesh
  // touché au node porteur des extras ; les objets des calques masqués
  // sont ignorés (E6-03).
  const handleClick = useCallback(
    (event) => {
      if (event.delta > 4) return // drag d'orbite, pas un clic
      const hit = event.intersections.find((i) => isChainVisible(i.object))
      if (!hit) return
      event.stopPropagation()
      let object = hit.object
      while (object && !(object.name && nodes[object.name])) object = object.parent
      // Mesh hors pipeline (« non classé ») : on retombe sur son propre nom.
      selectNode(object?.name || hit.object.name || null)
    },
    [nodes, selectNode]
  )

  return glb ? <primitive object={glb.scene} onClick={handleClick} /> : null
}
