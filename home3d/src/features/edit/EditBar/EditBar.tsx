import { useState } from 'react'
import useStore, { useTemporal } from '@/store/useStore'
import { buildEditedGLB, downloadGLB } from '@/features/model-io/exportGLB'
import { GridIcon, ToolIcon } from './icons'
import { TOOLS, TOOL_HINTS } from './catalog'
import {
  CableSectionBar,
  DoorPresetBar,
  ElecComponentBar,
  JoineryVariantBar,
  OpeningPresetBar,
  PipeSectionBar,
} from './SubToolbars'
import type { ActiveTool } from '@/store/types'

// Section Edit de la barre latérale (E19-03, ex-panneau flottant Slice 0) :
// bascule View ↔ Edit, barre d'outils à ICÔNES + tooltips (directive IHM
// 2026-06-24), undo/redo (zundo, E10-03) et export. L'inspector de l'objet
// sélectionné vit dans le panneau Info détaché (ObjectInspector, E19 2026-07-07).
export default function EditBar() {
  const editMode = useStore((state) => state.editMode)
  const toggleEditMode = useStore((state) => state.toggleEditMode)
  const viewMode = useStore((state) => state.viewMode)
  const activeTool = useStore((state) => state.activeTool)
  const setActiveTool = useStore((state) => state.setActiveTool)
  const objects = useStore((state) => state.objects)
  const glb = useStore((state) => state.glb)
  const metadata = useStore((state) => state.metadata)
  const gridSnap = useStore((state) => state.gridSnap)
  const toggleGridSnap = useStore((state) => state.toggleGridSnap)
  const openingPreset = useStore((state) => state.openingPreset)
  const setOpeningPreset = useStore((state) => state.setOpeningPreset)
  const doorPreset = useStore((state) => state.doorPreset)
  const setDoorPreset = useStore((state) => state.setDoorPreset)
  const joineryVariant = useStore((state) => state.joineryVariant)
  const setJoineryVariant = useStore((state) => state.setJoineryVariant)
  const elecComponent = useStore((state) => state.elecComponent)
  const setElecComponent = useStore((state) => state.setElecComponent)
  const cableSection = useStore((state) => state.cableSection)
  const setCableSection = useStore((state) => state.setCableSection)
  const pipeSection = useStore((state) => state.pipeSection)
  const setPipeSection = useStore((state) => state.setPipeSection)

  // pastStates/futureStates du store temporel zundo (réactif).
  const canUndo = useTemporal((state) => state.pastStates.length > 0)
  const canRedo = useTemporal((state) => state.futureStates.length > 0)

  const [exporting, setExporting] = useState(false)

  // E10-04 : ré-export GLB (coquille importée + objets app paramétriques). Il faut
  // les extras de scène (model/layers) pour que le fichier soit rechargeable →
  // désactivé tant qu'aucun modèle n'est chargé.
  const onExport = async () => {
    setExporting(true)
    try {
      const buffer = await buildEditedGLB({
        scene: glb?.scene ?? null,
        objects,
        metadata,
      })
      const base = (glb?.fileName || 'maison.glb').replace(/\.glb$/i, '')
      downloadGLB(buffer, `${base}-edit.glb`)
    } finally {
      setExporting(false)
    }
  }

  // Hors édition : la section n'offre que l'entrée en mode édition (touche E).
  if (!editMode) {
    return (
      <>
        <button
          disabled={!glb || viewMode === 'visit'}
          title="Mode édition — créer des formes (E)"
          onClick={toggleEditMode}
        >
          Passer en édition
        </button>
        <p className="edit-hint">
          {glb
            ? 'La palette d’outils, l’annulation et l’export s’affichent ici en mode édition.'
            : 'Chargez un modèle pour pouvoir éditer.'}
        </p>
      </>
    )
  }

  const objectCount = Object.keys(objects).length

  return (
    <>
      <div className="edit-section-top">
        <button title="Revenir en visualisation (E)" onClick={toggleEditMode}>
          Quitter l&apos;édition
        </button>
        <div className="edit-history">
          <button
            className="small"
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
            onClick={() => useStore.temporal.getState().undo()}
          >
            ↶
          </button>
          <button
            className="small"
            disabled={!canRedo}
            title="Rétablir (Ctrl+Maj+Z)"
            onClick={() => useStore.temporal.getState().redo()}
          >
            ↷
          </button>
        </div>
      </div>

      <div className="edit-tools" role="toolbar" aria-label="Outils">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="edit-tool"
            aria-pressed={activeTool === tool.id}
            aria-label={tool.label}
            title={`${tool.label} — ${tool.hint}${tool.key ? ` (${tool.key})` : ''}`}
            onClick={() => setActiveTool(tool.id as ActiveTool)}
          >
            <ToolIcon id={tool.id} />
          </button>
        ))}
        {/* Toggle (pas un outil) : accroche à la grille du plan (E12-03). */}
        <button
          className="edit-tool"
          aria-pressed={gridSnap}
          aria-label="Accroche à la grille"
          title="Accroche à la grille (G) — aligne sur un pas de 0,1 m"
          onClick={toggleGridSnap}
        >
          <GridIcon />
        </button>
      </div>

      {activeTool === 'opening' && (
        <OpeningPresetBar value={openingPreset} onChange={setOpeningPreset} />
      )}
      {activeTool === 'door' && (
        <DoorPresetBar value={doorPreset} onChange={setDoorPreset} />
      )}
      {activeTool === 'joinery' && (
        <JoineryVariantBar value={joineryVariant} onChange={setJoineryVariant} />
      )}
      {activeTool === 'elec' && (
        <ElecComponentBar value={elecComponent} onChange={setElecComponent} />
      )}
      {activeTool === 'cable' && (
        <CableSectionBar value={cableSection} onChange={setCableSection} />
      )}
      {activeTool === 'pipe' && (
        <PipeSectionBar value={pipeSection} onChange={setPipeSection} />
      )}

      {TOOL_HINTS[activeTool] && <p className="edit-hint">{TOOL_HINTS[activeTool]}</p>}

      {/* Rectification PO E19 : l'inspector de l'objet sélectionné s'affiche dans
          le panneau Info détaché à droite (commun aux objets SketchUp). */}
      <p className="edit-hint">
        L&apos;objet sélectionné s&apos;édite dans le panneau Info, à droite.
      </p>

      <footer className="edit-footer">
        <button
          className="edit-export"
          disabled={!metadata || exporting}
          title={
            metadata
              ? 'Exporter la scène (coquille + objets créés) en GLB'
              : 'Chargez un modèle pour pouvoir exporter'
          }
          onClick={onExport}
        >
          {exporting ? 'Export…' : `Exporter GLB (${objectCount})`}
        </button>
      </footer>
    </>
  )
}
