import useStore from '../store/useStore.js'

// E17-01 : invite affichée en mode visite tant que le verrou souris n'est
// pas pris. `pointer-events: none` : le clic traverse jusqu'au canvas, que
// PointerLockControls intercepte pour verrouiller la souris.
export default function VisitOverlay() {
  const viewMode = useStore((state) => state.viewMode)
  const pointerLocked = useStore((state) => state.pointerLocked)

  if (viewMode !== 'visit' || pointerLocked) return null

  return (
    <div className="visit-overlay">
      <div className="visit-overlay-card">
        <strong>Cliquez pour explorer</strong>
        <span>Déplacement : WASD / flèches · ÉCHAP pour quitter</span>
      </div>
    </div>
  )
}
