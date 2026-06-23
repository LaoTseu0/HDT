import { useState } from 'react'
import useStore, { useTemporal } from '../store/useStore.js'
import { buildEditedGLB, downloadGLB } from '../lib/exportGLB.js'

// Panneau d'édition (Edit mode, Slice 0) : palette d'outils, undo/redo (zundo,
// E10-03) et inspector éditable de l'objet app sélectionné (E12-01/E13-04).
// Remplace le panneau Calques à gauche tant qu'on édite.

function NumberField({ label, value, onChange }) {
  return (
    <label className="edit-field">
      <span>{label}</span>
      <input
        type="number"
        min="0.01"
        step="0.05"
        value={value}
        onChange={(event) => {
          const v = parseFloat(event.target.value)
          if (!Number.isNaN(v) && v > 0) onChange(Number(v.toFixed(3)))
        }}
      />
    </label>
  )
}

const TOOLS = [
  { id: 'select', label: 'Sélection' },
  { id: 'rect', label: 'Rectangle' },
]

export default function EditBar() {
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const setActiveTool = useStore((state) => state.setActiveTool)
  const objects = useStore((state) => state.objects)
  const selectedNode = useStore((state) => state.selectedNode)
  const updateObjectParams = useStore((state) => state.updateObjectParams)
  const deleteObject = useStore((state) => state.deleteObject)
  const glb = useStore((state) => state.glb)
  const metadata = useStore((state) => state.metadata)

  // pastStates/futureStates du store temporel zundo (réactif).
  const canUndo = useTemporal((state) => state.pastStates.length > 0)
  const canRedo = useTemporal((state) => state.futureStates.length > 0)

  const [exporting, setExporting] = useState(false)

  // E10-04 : ré-export GLB (coquille importée + objets app paramétriques). Il
  // faut les extras de scène (model/layers) pour que le fichier soit
  // rechargeable → désactivé tant qu'aucun modèle n'est chargé.
  const onExport = async () => {
    setExporting(true)
    try {
      const buffer = await buildEditedGLB({ scene: glb?.scene, objects, metadata })
      const base = (glb?.fileName || 'maison.glb').replace(/\.glb$/i, '')
      downloadGLB(buffer, `${base}-edit.glb`)
    } finally {
      setExporting(false)
    }
  }

  if (!editMode) return null
  const selectedObj = selectedNode ? objects[selectedNode] : null
  const objectCount = Object.keys(objects).length

  return (
    <aside className="edit-bar" aria-label="Édition">
      <header className="panel-header">
        <h2>Édition</h2>
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
      </header>

      <div className="edit-tools">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="edit-tool"
            aria-pressed={activeTool === tool.id}
            onClick={() => setActiveTool(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {activeTool === 'rect' && (
        <p className="edit-hint">Tracez un rectangle sur le sol (cliquer-glisser).</p>
      )}

      {selectedObj ? (
        <div className="edit-inspector">
          <code className="info-node-name">{selectedObj.id}</code>
          <NumberField
            label="Largeur (m)"
            value={selectedObj.params.largeur_m}
            onChange={(v) => updateObjectParams(selectedObj.id, { largeur_m: v })}
          />
          <NumberField
            label="Profondeur (m)"
            value={selectedObj.params.profondeur_m}
            onChange={(v) => updateObjectParams(selectedObj.id, { profondeur_m: v })}
          />
          <button className="edit-delete" onClick={() => deleteObject(selectedObj.id)}>
            Supprimer
          </button>
        </div>
      ) : (
        <p className="edit-hint">Sélectionnez une forme pour l'éditer.</p>
      )}

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
    </aside>
  )
}
