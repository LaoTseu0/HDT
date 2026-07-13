import { useState } from 'react'
import useStore, { useTemporal } from '../store/useStore.js'
import { buildEditedGLB, downloadGLB } from '@/features/model-io/exportGLB'
import { OPENING_PRESETS, DOOR_PRESETS } from '@/features/openings/opening'
import { ELEC_COMPONENTS, ELEC_KINDS } from '@/features/mep/elec'
import { JOINERY_VARIANTS, JOINERY_VARIANT_KEYS } from '@/features/openings/joinery'
import { CABLE_SECTIONS, CABLE_SECTION_KEYS } from '@/features/mep/cable'
import { PIPE_SECTIONS, PIPE_SECTION_KEYS } from '@/features/mep/plumbing'

// Section Edit de la barre latérale (E19-03, ex-panneau flottant Slice 0) :
// bascule View ↔ Edit, barre d'outils à ICÔNES + tooltips (directive IHM
// 2026-06-24), undo/redo (zundo, E10-03) et export. L'inspector de l'objet
// sélectionné vit dans le panneau Info détaché (ObjectInspector,
// rectification PO E19 2026-07-07).

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
  if (id === 'circle') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (id === 'arc') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 18 A 14 14 0 0 1 20 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="4" cy="18" r="1.8" fill="currentColor" />
        <circle cx="20" cy="18" r="1.8" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'opening') {
    // Fenêtre : cadre + croisillons.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (id === 'door') {
    // Porte : cadre haut + battant entrouvert + poignée.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="15.5" cy="12.5" r="1.4" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'joinery') {
    // Menuiserie : dormant (cadre externe) + jour vitré (cadre interne).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="8"
          y="7"
          width="8"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    )
  }
  if (id === 'elec') {
    // Éclair (électricité).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M13 2L5 13h5l-1 9 8-12h-5z" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'cable') {
    // Câble routé : polyligne coudée + sommets (façon chemin de câble).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 20V10h8V4h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4" cy="20" r="1.8" fill="currentColor" />
        <circle cx="20" cy="4" r="1.8" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'pipe') {
    // Tuyau routé : conduite coudée (trait épais, coude arrondi) + goutte.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M5 21V10a4 4 0 0 1 4-4h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M19 12c1.5 2.2 2.4 3.5 2.4 4.8a2.4 2.4 0 0 1-4.8 0c0-1.3.9-2.6 2.4-4.8z"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (id === 'valve') {
    // Vanne : symbole schéma (deux triangles bout à bout) + tige et poignée.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 9v8l8-4zM20 9v8l-8-4z" fill="currentColor" />
        <path d="M12 13V7" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 6.5h8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
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

// Icônes des composants élec (sous-barre de l'outil Ouverture/Élec). Un pictogramme
// distinct par catalogue, façon ToolIcon.
function ElecCompIcon({ id }) {
  if (id === 'elec.switch') {
    // Interrupteur : cadre + bascule.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="6" y="3" width="12" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="9" y="6" width="6" height="7" rx="1" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'elec.junction') {
    // Boîte de dérivation : rond + 4 départs.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (id === 'elec.meter') {
    // Compteur : boîtier + afficheur.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="7" y="7" width="10" height="4" rx="1" fill="currentColor" />
        <circle cx="12" cy="16" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  // elec.outlet — prise : cadre + 2 trous.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="9.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="14.5" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

// Icônes des sections de câble (sous-barre de l'outil Câble, E15-03) : carré dont
// le côté grossit avec la gaine (Ø16→Ø32), façon jauge.
const CABLE_ICON_SIDE = { gaine16: 8, gaine20: 11, gaine25: 14, gaine32: 17 }

function CableSectionIcon({ id }) {
  const side = CABLE_ICON_SIDE[id] ?? 11
  const off = (24 - side) / 2
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x={off}
        y={off}
        width={side}
        height={side}
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

// Icônes des sections de tuyau (sous-barre de l'outil Tuyau, E16-01) : cercle
// (section nominale ronde, vs carré du câble) dont le Ø grossit avec la section,
// façon jauge — cuivre Ø12→22, puis évacuation PVC Ø32/40/100.
const PIPE_ICON_R = {
  cuivre12: 3,
  cuivre14: 3.5,
  cuivre16: 4,
  cuivre18: 4.5,
  cuivre22: 5.5,
  evac32: 6.5,
  evac40: 7.5,
  evac100: 9.5,
}

function PipeSectionIcon({ id }) {
  const r = PIPE_ICON_R[id] ?? 4
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// Icônes des variantes de menuiserie (sous-barre de l'outil Menuiserie, E14-06),
// façon PresetIcon : le dessin illustre la variante en élévation.
function JoineryVariantIcon({ id }) {
  if (id === 'battant') {
    // Battant : dormant + meneau central (2 vantaux).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3v18" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="10" cy="12" r="1.2" fill="currentColor" />
        <circle cx="14" cy="12" r="1.2" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'coulissant') {
    // Coulissant : 2 vantaux qui se recouvrent + flèche de coulissement.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="3" y="5" width="12" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="9" y="7" width="12" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 2.5h8M13.5 0.5L16 2.5l-2.5 2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  // fixe — dormant + jour vitré plein (même dessin que l'outil Menuiserie).
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="7" width="8" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
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

// Gabarits d'ouverture (E14-04) : rect + croisillon dont l'aspect (large/carré/
// étroit) illustre le preset, façon ToolIcon. Modifiable ensuite par instance.
const PRESET_RECTS = {
  classique: { x: 6, y: 4, w: 12, h: 16 },
  large: { x: 3, y: 6, w: 18, h: 12 },
  etroite: { x: 8, y: 3, w: 8, h: 18 },
}

function PresetIcon({ id }) {
  const { x, y, w, h } = PRESET_RECTS[id] ?? PRESET_RECTS.classique
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

const OPENING_PRESET_LIST = [
  { id: 'classique', label: 'Classique' },
  { id: 'large', label: 'Large' },
  { id: 'etroite', label: 'Étroite' },
]

// Gabarits de porte (E14-07) : porte stylisée dont la largeur illustre le
// gabarit (simple/double/étroite), façon PresetIcon.
const DOOR_PRESET_RECTS = {
  simple: { x: 7, w: 10 },
  double: { x: 3, w: 18 },
  etroite: { x: 9, w: 7 },
}

function DoorPresetIcon({ id }) {
  const { x, w } = DOOR_PRESET_RECTS[id] ?? DOOR_PRESET_RECTS.simple
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={`M${x} 21V4a1 1 0 0 1 1-1h${w - 2}a1 1 0 0 1 1 1v17`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 21h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {id === 'double' && <path d="M12 3v18" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  )
}

const DOOR_PRESET_LIST = [
  { id: 'simple', label: 'Simple' },
  { id: 'double', label: 'Double' },
  { id: 'etroite', label: 'Étroite' },
]

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
  {
    id: 'circle',
    label: 'Cercle',
    hint: 'Dessiner un cercle (centre puis rayon)',
  },
  {
    id: 'arc',
    label: 'Arc',
    hint: 'Dessiner un arc (centre, début, fin)',
  },
  {
    id: 'opening',
    label: 'Ouverture',
    hint: 'Poser une fenêtre sur une face de mur',
  },
  {
    id: 'door',
    label: 'Porte',
    hint: 'Poser une porte sur une face de mur (seuil au sol)',
  },
  {
    id: 'joinery',
    label: 'Menuiserie',
    hint: 'Équiper une ouverture existante (cadre + vitrage, ou vantail de porte)',
  },
  {
    id: 'elec',
    label: 'Électricité',
    hint: 'Poser un composant électrique sur une face de mur',
  },
  {
    id: 'cable',
    label: 'Câble',
    hint: 'Router un câble électrique (clics successifs, double-clic pour finir)',
  },
  {
    id: 'pipe',
    label: 'Tuyau',
    hint: 'Router un tuyau de plomberie (clics successifs, double-clic pour finir)',
  },
  {
    id: 'valve',
    label: 'Vanne',
    hint: 'Insérer une vanne sur un tuyau (coupe le run en deux)',
  },
  { id: 'pushpull', label: 'Push/Pull', hint: 'Donner du volume à une face (extrusion)' },
]

// Liste ordonnée des composants élec pour la sous-barre (E15-01/02).
const ELEC_COMPONENT_LIST = ELEC_KINDS.map((id) => ({ id, label: ELEC_COMPONENTS[id].label }))

// Liste ordonnée des variantes de menuiserie pour la sous-barre (E14-06).
const JOINERY_VARIANT_LIST = JOINERY_VARIANT_KEYS.map((id) => ({
  id,
  label: JOINERY_VARIANTS[id].label,
  hint: JOINERY_VARIANTS[id].hint,
}))

// Liste ordonnée des sections de câble pour la sous-barre (E15-03).
const CABLE_SECTION_LIST = CABLE_SECTION_KEYS.map((id) => ({ id, label: CABLE_SECTIONS[id].label }))

// Liste ordonnée des sections de tuyau pour la sous-barre (E16-01).
const PIPE_SECTION_LIST = PIPE_SECTION_KEYS.map((id) => ({ id, label: PIPE_SECTIONS[id].label }))

const TOOL_HINTS = {
  rect: 'Tracez un rectangle : sur le sol, ou directement sur une face survolée du modèle.',
  circle: 'Cliquez le centre puis glissez pour le rayon. Tapez une valeur pour le fixer.',
  arc: 'Cliquez le centre, puis le début (rayon), puis la fin (balayage). Tapez une valeur pour la fixer.',
  opening:
    'Choisissez un gabarit puis cliquez sur une face de mur pour y poser une fenêtre. Ajustez largeur / hauteur / allège dans l’inspecteur.',
  door:
    'Choisissez un gabarit puis cliquez sur une face de mur : la porte se pose avec son seuil au sol. Ajustez largeur / hauteur dans l’inspecteur.',
  joinery:
    'Choisissez une variante puis cliquez une ouverture déjà posée : une fenêtre reçoit un cadre + vitrage, une porte reçoit son vantail. Une ouverture déjà équipée sélectionne son composant.',
  elec:
    'Choisissez un composant puis cliquez sur une face de mur pour le poser. Ajustez la hauteur / sol dans l’inspecteur.',
  cable:
    'Choisissez une section, puis cliquez chaque point du trajet (sol ou faces de mur). Double-cliquez ou Entrée pour terminer, Échap pour annuler.',
  pipe:
    'Choisissez une section (cuivre ou évac PVC), puis cliquez chaque point du trajet (sol ou faces de mur). Double-cliquez ou Entrée pour terminer, Échap pour annuler.',
  valve:
    'Cliquez un tuyau déjà routé : une vanne s’insère au point cliqué et coupe le run en deux tronçons (annulable en une fois).',
  pushpull: 'Cliquez une forme et tirez pour l’extruder le long de sa normale.',
}

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
          Quitter l'édition
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

      {activeTool === 'opening' && (
        <div className="edit-tools" role="toolbar" aria-label="Gabarit d'ouverture">
          {OPENING_PRESET_LIST.map((preset) => {
            const dims = OPENING_PRESETS[preset.id]
            return (
              <button
                key={preset.id}
                className="edit-tool"
                aria-pressed={openingPreset === preset.id}
                aria-label={preset.label}
                title={`${preset.label} — ${dims.largeur_m} × ${dims.hauteur_m} m`}
                onClick={() => setOpeningPreset(preset.id)}
              >
                <PresetIcon id={preset.id} />
              </button>
            )
          })}
        </div>
      )}

      {activeTool === 'door' && (
        <div className="edit-tools" role="toolbar" aria-label="Gabarit de porte">
          {DOOR_PRESET_LIST.map((preset) => {
            const dims = DOOR_PRESETS[preset.id]
            return (
              <button
                key={preset.id}
                className="edit-tool"
                aria-pressed={doorPreset === preset.id}
                aria-label={preset.label}
                title={`${preset.label} — ${dims.largeur_m} × ${dims.hauteur_m} m`}
                onClick={() => setDoorPreset(preset.id)}
              >
                <DoorPresetIcon id={preset.id} />
              </button>
            )
          })}
        </div>
      )}

      {activeTool === 'joinery' && (
        <div className="edit-tools" role="toolbar" aria-label="Variante de menuiserie">
          {JOINERY_VARIANT_LIST.map((variant) => (
            <button
              key={variant.id}
              className="edit-tool"
              aria-pressed={joineryVariant === variant.id}
              aria-label={variant.label}
              title={`${variant.label} — ${variant.hint}`}
              onClick={() => setJoineryVariant(variant.id)}
            >
              <JoineryVariantIcon id={variant.id} />
            </button>
          ))}
        </div>
      )}

      {activeTool === 'elec' && (
        <div className="edit-tools" role="toolbar" aria-label="Composant électrique">
          {ELEC_COMPONENT_LIST.map((comp) => {
            const dims = ELEC_COMPONENTS[comp.id].dims
            return (
              <button
                key={comp.id}
                className="edit-tool"
                aria-pressed={elecComponent === comp.id}
                aria-label={comp.label}
                title={`${comp.label} — ${dims.largeur_m} × ${dims.hauteur_m} m`}
                onClick={() => setElecComponent(comp.id)}
              >
                <ElecCompIcon id={comp.id} />
              </button>
            )
          })}
        </div>
      )}

      {activeTool === 'cable' && (
        <div className="edit-tools" role="toolbar" aria-label="Section de câble">
          {CABLE_SECTION_LIST.map((sec) => {
            const dims = CABLE_SECTIONS[sec.id].dims
            return (
              <button
                key={sec.id}
                className="edit-tool"
                aria-pressed={cableSection === sec.id}
                aria-label={sec.label}
                title={`${sec.label} — section ${dims.largeur_m * 1000} × ${dims.hauteur_m * 1000} mm`}
                onClick={() => setCableSection(sec.id)}
              >
                <CableSectionIcon id={sec.id} />
              </button>
            )
          })}
        </div>
      )}

      {activeTool === 'pipe' && (
        <div className="edit-tools" role="toolbar" aria-label="Section de tuyau">
          {PIPE_SECTION_LIST.map((sec) => {
            const dims = PIPE_SECTIONS[sec.id].dims
            return (
              <button
                key={sec.id}
                className="edit-tool"
                aria-pressed={pipeSection === sec.id}
                aria-label={sec.label}
                title={`${sec.label} — section ${dims.largeur_m * 1000} × ${dims.hauteur_m * 1000} mm`}
                onClick={() => setPipeSection(sec.id)}
              >
                <PipeSectionIcon id={sec.id} />
              </button>
            )
          })}
        </div>
      )}

      {TOOL_HINTS[activeTool] && <p className="edit-hint">{TOOL_HINTS[activeTool]}</p>}

      {/* Rectification PO E19 : l'inspector de l'objet sélectionné s'affiche
          dans le panneau Info détaché à droite (commun aux objets SketchUp). */}
      <p className="edit-hint">
        L'objet sélectionné s'édite dans le panneau Info, à droite.
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
