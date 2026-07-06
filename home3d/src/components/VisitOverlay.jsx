import useStore from '../store/useStore.js'

// E17-01 : invite affichée en mode visite tant que le verrou souris n'est
// pas pris. `pointer-events: none` : le clic traverse jusqu'au canvas, que
// PointerLockControls intercepte pour verrouiller la souris.
// E17-10 : sans pointeur fin (mobile/tablette), il n'y a rien à cliquer — le
// verrou n'existe pas, les joysticks virtuels (VisitSticks) suffisent.
const FINE_POINTER =
  typeof window !== 'undefined' && window.matchMedia('(any-pointer: fine)').matches

export default function VisitOverlay() {
  const viewMode = useStore((state) => state.viewMode)
  const pointerLocked = useStore((state) => state.pointerLocked)

  if (viewMode !== 'visit' || pointerLocked || !FINE_POINTER) return null

  return (
    <div className="visit-overlay">
      <div className="visit-overlay-card">
        <strong>Cliquez pour explorer</strong>
        <span>Déplacement : WASD / flèches ou manette · ÉCHAP pour quitter</span>
      </div>
    </div>
  )
}
