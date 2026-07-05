import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import useStore from '../store/useStore.js'
import { PIPE_KIND, slopedPoints } from '../lib/plumbing.js'
import { detectFittings, fittingMesh } from '../lib/fittings.js'

// Raccords automatiques aux jonctions de tuyaux (E16-03, cf. lib/fittings).
// Vit dans le Canvas, actif en vue COMME en édition (le raccord fait partie du
// réseau). DÉRIVÉ des objets (comme le perçage CSG de WallCutter) : rien dans le
// store ni les params — déplacer/re-sectionner/supprimer un tuyau régénère les
// raccords, et le rechargement d'un GLB les recalcule gratuitement depuis les
// runs. Décoratif : non raycastable (ni sélection, ni accroche).

const FITTING_FILL = 0x655cc9 // calque plomberie, un ton plus soutenu que le tuyau
const FITTING_EDGE = 0xcbc7f2

export default function RunFittings() {
  const objects = useStore((state) => state.objects)

  // Un seul maillage pour tous les raccords du réseau (1 draw call).
  const geometry = useMemo(() => {
    // Détection sur la géométrie RENDUE : un tuyau d'évacuation applique sa
    // pente (E16-02) — le raccord suit le sommet pentu, pas le clic d'origine.
    const pipes = Object.values(objects)
      .filter((o) => o.kind === PIPE_KIND)
      .map((o) => ({ id: o.id, params: { ...o.params, points: slopedPoints(o.params) } }))
    const fittings = detectFittings(pipes)
    if (!fittings.length) return null
    const position = []
    const index = []
    for (const f of fittings) {
      const m = fittingMesh(f)
      const offset = position.length / 3
      position.push(...m.position)
      for (const i of m.index) index.push(offset + i)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
    g.setIndex(index)
    g.computeVertexNormals()
    return g
  }, [objects])

  const edges = useMemo(() => (geometry ? new THREE.EdgesGeometry(geometry, 20) : null), [geometry])

  useEffect(
    () => () => {
      geometry?.dispose()
      edges?.dispose()
    },
    [geometry, edges]
  )

  if (!geometry) return null
  return (
    <group>
      <mesh geometry={geometry} raycast={() => null}>
        <meshStandardMaterial color={FITTING_FILL} metalness={0.1} roughness={0.7} />
      </mesh>
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color={FITTING_EDGE} />
      </lineSegments>
    </group>
  )
}
