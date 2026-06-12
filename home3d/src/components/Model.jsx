import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import useStore from '../store/useStore.js'
import { extractModelData, parseGLB, PipelineError } from '../lib/loadModel.js'

// Rendu du GLB chargé + parse des fichiers déposés (E3-03 → E3-06).
// Le parse vit dans le Canvas car le KTX2Loader a besoin du renderer.
export default function Model() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const pendingFile = useStore((state) => state.pendingFile)
  const glb = useStore((state) => state.glb)
  const layers = useStore((state) => state.layers)
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

  // E3-04 : visibilité pilotée par la config des calques (état initial
  // issu des extras scène ; les toggles E5 réutiliseront ce même effet).
  useEffect(() => {
    if (!glb) return
    glb.scene.traverse((object) => {
      const layer = object.userData?.layer
      if (layer && layers[layer]) object.visible = layers[layer].visible
    })
  }, [glb, layers])

  return glb ? <primitive object={glb.scene} /> : null
}
