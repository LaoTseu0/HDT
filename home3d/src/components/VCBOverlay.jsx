import useStore from '../store/useStore.js'

// Boîte de mesure (VCB SketchUp, E12-04) : affiche les cotes du rectangle en
// cours et la saisie clavier. HTML (hors Canvas) pour un texte net, ancrée en
// bas à droite. Le clavier est capté par App.jsx ; ici on ne fait qu'AFFICHER.

const fmt = (m) => Number(m.toFixed(2)).toString().replace('.', ',')

export default function VCBOverlay() {
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)
  const vcbText = useStore((state) => state.vcbText)

  if (!editMode || (activeTool !== 'rect' && activeTool !== 'circle')) return null
  const isCircle = activeTool === 'circle'

  // Cotes vives du glissé (s,t du plan). Avant tout tracé : invite.
  let live = null
  if (draft) {
    live = isCircle
      ? fmt(Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]))
      : `${fmt(Math.abs(draft.current[0] - draft.start[0]))} ; ${fmt(Math.abs(draft.current[1] - draft.start[1]))}`
  }

  return (
    <div className="vcb-box" aria-live="polite">
      <span className="vcb-label">{isCircle ? 'Rayon' : 'Dimensions'}</span>
      {draft ? (
        <span className="vcb-value">
          {vcbText ? <span className="vcb-typed">{vcbText}</span> : live}
          <span className="vcb-unit"> m</span>
        </span>
      ) : (
        <span className="vcb-value vcb-idle">cliquez-glissez pour tracer</span>
      )}
      <span className="vcb-hint">{isCircle ? 'Tapez R puis Entrée' : 'Tapez L ; P puis Entrée'}</span>
    </div>
  )
}
