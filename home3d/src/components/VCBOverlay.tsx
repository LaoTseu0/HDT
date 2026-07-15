import useStore from '@/store/useStore'
import type { ActiveTool } from '@/store/types'
import type { ArcDraft, CircleDraft, Draft, RectDraft } from '@/types'

// Boîte de mesure (VCB SketchUp, E12-04) : affiche les cotes du tracé en cours
// (rectangle, cercle, arc) et la saisie clavier. HTML (hors Canvas) pour un texte
// net, ancrée en bas à droite. Le clavier est capté par App ; ici on AFFICHE.

const TOOLS_WITH_VCB = new Set<ActiveTool>(['rect', 'circle', 'arc'])
const fmt = (m: number) => Number(m.toFixed(2)).toString().replace('.', ',')

// Libellé de la cote tirée pendant un drag sur axe (poignée / Push/Pull, E22-03).
const PARAM_LABELS: Record<string, string> = {
  largeur_m: 'Largeur',
  profondeur_m: 'Profondeur',
  hauteur_m: 'Hauteur',
  rayon_m: 'Rayon',
}

interface VcbDisplay {
  label: string
  unit: string
  live: string | null
  hint: string
}

// Cote vive + libellé + invite, selon l'outil (et l'étape pour l'arc).
function describe(activeTool: ActiveTool, draft: Draft | null): VcbDisplay {
  if (activeTool === 'circle') {
    const d = draft as CircleDraft | null
    const live = d
      ? fmt(Math.hypot(d.current[0] - d.start[0], d.current[1] - d.start[1]))
      : null
    return { label: 'Rayon', unit: ' m', live, hint: 'Tapez R puis Entrée' }
  }
  if (activeTool === 'arc') {
    const d = draft as ArcDraft | null
    if (!d) {
      return { label: 'Arc', unit: '', live: null, hint: 'Cliquez le centre' }
    }
    if (d.stage === 'sweep') {
      const deg = ((d.sweepRad || 0) * 180) / Math.PI
      return {
        label: 'Balayage',
        unit: '°',
        live: fmt(deg),
        hint: 'Tapez l’angle puis Entrée',
      }
    }
    const r = Math.hypot(d.current[0] - d.center[0], d.current[1] - d.center[1])
    return { label: 'Rayon', unit: ' m', live: fmt(r), hint: 'Tapez R puis Entrée' }
  }
  // rectangle
  const d = draft as RectDraft | null
  const live = d
    ? `${fmt(Math.abs(d.current[0] - d.start[0]))} ; ${fmt(Math.abs(d.current[1] - d.start[1]))}`
    : null
  return { label: 'Dimensions', unit: ' m', live, hint: 'Tapez L ; P puis Entrée' }
}

export default function VCBOverlay() {
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)
  const extrude = useStore((state) => state.extrude)
  const vcbText = useStore((state) => state.vcbText)

  if (!editMode || (!extrude && !TOOLS_WITH_VCB.has(activeTool))) return null
  // Drag sur axe en cours (poignée / Push/Pull, E22-03) : la cote tirée prime sur
  // l'affichage d'outil — quel que soit l'outil actif (Sélection incluse).
  const { label, unit, live, hint } = extrude
    ? {
        label: PARAM_LABELS[extrude.paramKey] ?? 'Cote',
        unit: ' m',
        live: fmt(extrude.value),
        hint: 'Tapez la cote puis Entrée',
      }
    : describe(activeTool, draft)
  // Un tracé est « en cours » dès qu'il y a un draft (l'arc affiche une cote vive
  // même entre deux clics, sans glissé) — ou un drag de poignée.
  const active = !!draft || !!extrude

  return (
    <div className="vcb-box" aria-live="polite">
      <span className="vcb-label">{label}</span>
      {active ? (
        <span className="vcb-value">
          {vcbText ? <span className="vcb-typed">{vcbText}</span> : live}
          {unit && <span className="vcb-unit">{unit}</span>}
        </span>
      ) : (
        <span className="vcb-value vcb-idle">{hint}</span>
      )}
      <span className="vcb-hint">{hint}</span>
    </div>
  )
}
