import useStore from '../store/useStore.js'

// Boîte de mesure (VCB SketchUp, E12-04) : affiche les cotes du tracé en cours
// (rectangle, cercle, arc) et la saisie clavier. HTML (hors Canvas) pour un texte
// net, ancrée en bas à droite. Le clavier est capté par App.jsx ; ici on AFFICHE.

const TOOLS_WITH_VCB = new Set(['rect', 'circle', 'arc'])
const fmt = (m) => Number(m.toFixed(2)).toString().replace('.', ',')

// Cote vive + libellé + invite, selon l'outil (et l'étape pour l'arc).
function describe(activeTool, draft) {
  if (activeTool === 'circle') {
    const live = draft
      ? fmt(Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]))
      : null
    return { label: 'Rayon', unit: ' m', live, hint: 'Tapez R puis Entrée' }
  }
  if (activeTool === 'arc') {
    if (!draft) {
      return { label: 'Arc', unit: '', live: null, hint: 'Cliquez le centre' }
    }
    if (draft.stage === 'sweep') {
      const deg = ((draft.sweepRad || 0) * 180) / Math.PI
      return { label: 'Balayage', unit: '°', live: fmt(deg), hint: 'Tapez l’angle puis Entrée' }
    }
    const r = Math.hypot(draft.current[0] - draft.center[0], draft.current[1] - draft.center[1])
    return { label: 'Rayon', unit: ' m', live: fmt(r), hint: 'Tapez R puis Entrée' }
  }
  // rectangle
  const live = draft
    ? `${fmt(Math.abs(draft.current[0] - draft.start[0]))} ; ${fmt(Math.abs(draft.current[1] - draft.start[1]))}`
    : null
  return { label: 'Dimensions', unit: ' m', live, hint: 'Tapez L ; P puis Entrée' }
}

export default function VCBOverlay() {
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)
  const vcbText = useStore((state) => state.vcbText)

  if (!editMode || !TOOLS_WITH_VCB.has(activeTool)) return null
  const { label, unit, live, hint } = describe(activeTool, draft)
  // Un tracé est « en cours » dès qu'il y a un draft (l'arc affiche une cote vive
  // même entre deux clics, sans glissé).
  const active = !!draft

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
