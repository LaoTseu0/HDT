import { useEffect } from 'react'
import useStore from '../../store/useStore.js'
import ObjectsLayer from '@/features/edit/canvas/ObjectsLayer'
import SketchSurface from '@/features/edit/canvas/SketchSurface'
import { DraftPreview, SnapMarker, InferenceLines } from '@/features/edit/canvas/previews'
import { ensureBoundsTree } from '@/core/bvh'

// Rendu des objets créés in-app (Edit mode, Slice 0) + outils de tracé sur le
// PLAN D'ESQUISSE CONTEXTUEL (E12-02, façon SketchUp), Push/Pull (E12-08) et
// poignées de déformation (E22-01, cf. DeformHandles + lib/useAxisDrag).
// Vit dans le Canvas. Les objets sont DÉRIVÉS du store via le registre
// paramétrique : changer un param régénère la géométrie.

export default function EditObjects() {
  const objects = useStore((state) => state.objects)
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)
  const extrude = useStore((state) => state.extrude)
  const glb = useStore((state) => state.glb)
  const nodes = useStore((state) => state.nodes)

  // Outils qui rendent la surface d'esquisse : tracés (rect/circle/arc) + pose
  // d'ouverture (E14-01, clic sur une face de mur).
  const drawing =
    editMode &&
    (activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'arc' ||
      activeTool === 'opening' ||
      activeTool === 'door' ||
      activeTool === 'elec' ||
      activeTool === 'cable' ||
      activeTool === 'pipe')

  // E12-03 : indexer le modèle importé (BVH three-mesh-bvh) à l'entrée d'Edit mode
  // — accélère le raycast du tracé ET les requêtes de proximité du snapping. Coût
  // one-time, payé seulement quand on édite (pas pour un simple viewer).
  useEffect(() => {
    if (editMode && glb?.scene) ensureBoundsTree(glb.scene)
  }, [editMode, glb])

  return (
    <>
      <ObjectsLayer />
      {drawing && (
        <SketchSurface
          tool={activeTool}
          glbScene={glb?.scene}
          nodes={nodes}
          objects={objects}
        />
      )}
      {draft && <DraftPreview draft={draft} />}
      {draft?.snap && <SnapMarker snap={draft.snap} />}
      {draft?.snap?.lines && <InferenceLines snap={draft.snap} />}
      {/* Accroche d'un drag sur axe (poignée / Push/Pull, E22-03). */}
      {extrude?.snap && <SnapMarker snap={extrude.snap} />}
    </>
  )
}
