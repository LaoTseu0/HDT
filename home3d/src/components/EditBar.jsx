import { useState } from 'react'
import useStore, { useTemporal } from '../store/useStore.js'
import { buildEditedGLB, downloadGLB } from '../lib/exportGLB.js'
import { nodeName, LEVELS } from '../lib/naming.js'

// Libellés FR des niveaux (segment `level` de la convention de nommage).
const LEVEL_LABELS = {
  ss: 'Sous-sol',
  rdc: 'Rez-de-chaussée',
  r1: 'R+1',
  r2: 'R+2',
  combles: 'Combles',
  ext: 'Extérieur',
}

// Panneau d'édition (Edit mode, Slice 0) : barre d'outils à ICÔNES + tooltips
// (directive IHM 2026-06-24), undo/redo (zundo, E10-03) et inspector éditable de
// l'objet app sélectionné (E12-01/E13-04). Remplace le panneau Calques à gauche.

// Icônes d'outils (stroke = currentColor) — pictogramme + tooltip natif (title).
function ToolIcon({ id }) {
  if (id === 'select') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M5 3l13 6-5.4 1.6L11 17z" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'rect') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="6"
          width="16"
          height="12"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    )
  }
  // pushpull
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="5"
        y="13"
        width="14"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 10V3M8.5 6.5L12 3l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Icône du toggle d'accroche à la grille (E12-03).
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 9h16M4 15h16M9 4v16M15 4v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function SelectField({ label, value, options, onChange }) {
  // Options acceptées en `'x'` ou `{ value, label }` → forme normalisée unique.
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
  // La valeur courante peut manquer des options (zone par défaut, ou zone d'un
  // objet rechargé absente du modèle courant) → on l'ajoute en tête.
  if (!opts.some((o) => o.value === value)) opts.unshift({ value, label: value })
  return (
    <label className="edit-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {opts.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function NumberField({ label, value, onChange, allowZero = false }) {
  return (
    <label className="edit-field">
      <span>{label}</span>
      <input
        type="number"
        min={allowZero ? '0' : '0.01'}
        step="0.05"
        value={value ?? 0}
        onChange={(event) => {
          const v = parseFloat(event.target.value)
          if (!Number.isNaN(v) && (allowZero ? v >= 0 : v > 0))
            onChange(Number(v.toFixed(3)))
        }}
      />
    </label>
  )
}

const TOOLS = [
  {
    id: 'select',
    label: 'Sélection',
    hint: 'Sélectionner / éditer un objet',
    key: 'Échap',
  },
  {
    id: 'rect',
    label: 'Rectangle',
    hint: 'Dessiner un rectangle (sol ou face survolée)',
  },
  { id: 'pushpull', label: 'Push/Pull', hint: 'Donner du volume à une face (extrusion)' },
]

const TOOL_HINTS = {
  rect: 'Tracez un rectangle : sur le sol, ou directement sur une face survolée du modèle.',
  pushpull: 'Cliquez une forme et tirez pour l’extruder le long de sa normale.',
}

export default function EditBar() {
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const setActiveTool = useStore((state) => state.setActiveTool)
  const objects = useStore((state) => state.objects)
  const selectedNode = useStore((state) => state.selectedNode)
  const updateObjectParams = useStore((state) => state.updateObjectParams)
  const setObjectNaming = useStore((state) => state.setObjectNaming)
  const deleteObject = useStore((state) => state.deleteObject)
  const glb = useStore((state) => state.glb)
  const metadata = useStore((state) => state.metadata)
  const gridSnap = useStore((state) => state.gridSnap)
  const toggleGridSnap = useStore((state) => state.toggleGridSnap)

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

      <div className="edit-tools" role="toolbar" aria-label="Outils">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="edit-tool"
            aria-pressed={activeTool === tool.id}
            aria-label={tool.label}
            title={`${tool.label} — ${tool.hint}${tool.key ? ` (${tool.key})` : ''}`}
            onClick={() => setActiveTool(tool.id)}
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

      {TOOL_HINTS[activeTool] && <p className="edit-hint">{TOOL_HINTS[activeTool]}</p>}

      {selectedObj ? (
        <div className="edit-inspector">
          <code className="info-node-name">{nodeName(selectedObj)}</code>
          <SelectField
            label="Zone"
            value={selectedObj.zone}
            options={metadata?.model?.zones ?? []}
            onChange={(zone) => setObjectNaming(selectedObj.id, { zone })}
          />
          <SelectField
            label="Niveau"
            value={selectedObj.level}
            options={LEVELS.map((id) => ({ value: id, label: LEVEL_LABELS[id] ?? id }))}
            onChange={(level) => setObjectNaming(selectedObj.id, { level })}
          />
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
          <NumberField
            label="Hauteur (m)"
            value={selectedObj.params.hauteur_m}
            allowZero
            onChange={(v) => updateObjectParams(selectedObj.id, { hauteur_m: v })}
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
