import useStore from '@/store/useStore'
import useFullscreen from '@/hooks/useFullscreen'

// E17-11 (issue #23) : bouton ⛶ flottant dans l'UI du mode visite. Sur mobile, il
// masque la barre d'URL du navigateur pour une immersion type lecteur média.
// L'API Fullscreen exige un geste utilisateur → pas de plein écran forcé au
// chargement, d'où ce bouton. Coin haut-droit : dégage le burger (haut-gauche) et
// les joysticks (bas). Masqué si l'API d'élément HTML est absente (Safari iPhone).
export default function VisitFullscreen() {
  const viewMode = useStore((state) => state.viewMode)
  const { supported, fullscreen, toggle } = useFullscreen()

  if (viewMode !== 'visit' || !supported) return null

  return (
    <button
      className="visit-fullscreen"
      aria-pressed={fullscreen}
      title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      onClick={toggle}
    >
      {fullscreen ? '✕' : '⛶'}
    </button>
  )
}
