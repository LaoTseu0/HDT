import * as THREE from 'three'
import type { Object3D } from 'three'
import useDraftTool from '@/features/edit/canvas/useDraftTool'
import {
  ContextualPlanePreview,
  SnapMarker,
  InferenceLines,
} from '@/features/edit/canvas/previews'
import type { ActiveTool } from '@/store/types'
import type { NodesTable, ObjectsTable } from '@/types'

interface SketchSurfaceProps {
  tool: ActiveTool
  glbScene: Object3D | null | undefined
  nodes: NodesTable
  objects: ObjectsTable
}

// Surface de captation du tracé (E12-02) : un grand quad de sol invisible mais
// raycastable qui fournit le rayon souris. Toute la logique d'interaction vit
// dans useDraftTool ; ce composant ne fait que câbler les handlers au mesh et
// rendre l'aperçu du plan/accroche au survol.
export default function SketchSurface({ tool, glbScene, nodes, objects }: SketchSurfaceProps) {
  const { hover, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onPointerLeave } =
    useDraftTool({ tool, glbScene, nodes, objects })

  return (
    <>
      {hover && <ContextualPlanePreview hover={hover} />}
      {hover?.snap && <SnapMarker snap={hover.snap} />}
      {hover?.snap?.lines && <InferenceLines snap={hover.snap} />}
      <mesh
        rotation-x={-Math.PI / 2}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onPointerLeave={onPointerLeave}
      >
        <planeGeometry args={[800, 800]} />
        {/* invisible mais raycastable (un mesh visible=false n'est pas testé) */}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}
