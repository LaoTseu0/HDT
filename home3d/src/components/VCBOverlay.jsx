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

  if (!editMode || activeTool !== 'rect') return null

  // Cotes vives du glissé (s,t du plan). Avant tout tracé : invite.
  const w = draft ? Math.abs(draft.current[0] - draft.start[0]) : null
  const d = draft ? Math.abs(draft.current[1] - draft.start[1]) : null

  return (
    <div className="vcb-box" aria-live="polite">
      <span className="vcb-label">Dimensions</span>
      {draft ? (
        <span className="vcb-value">
          {vcbText ? (
            <span className="vcb-typed">{vcbText}</span>
          ) : (
            `${fmt(w)} ; ${fmt(d)}`
          )}
          <span className="vcb-unit"> m</span>
        </span>
      ) : (
        <span className="vcb-value vcb-idle">cliquez-glissez pour tracer</span>
      )}
      <span className="vcb-hint">Tapez L ; P puis Entrée</span>
    </div>
  )
}
