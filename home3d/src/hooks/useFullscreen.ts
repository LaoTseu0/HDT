import { useCallback, useEffect, useState } from 'react'

// E17-11 (issue #23) : plein écran natif de l'élément racine de l'app. L'API
// Fullscreen exige un geste utilisateur → exposée via un toggle appelé depuis un
// handler de clic. `supported` gate l'UI (Safari iPhone n'implémente pas
// l'API d'élément HTML — le bouton n'aurait aucun effet).

export const FULLSCREEN_SUPPORTED =
  typeof document !== 'undefined' &&
  typeof document.documentElement.requestFullscreen === 'function'

/** État + bascule du plein écran, synchronisés avec l'événement `fullscreenchange`. */
export default function useFullscreen(): {
  supported: boolean
  fullscreen: boolean
  toggle: () => void
} {
  // `fullscreen` : suivi via `fullscreenchange`, car l'utilisateur peut sortir
  // par un geste système (F11, ÉCHAP, bouton Retour). Init depuis l'état courant.
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  )

  useEffect(() => {
    if (!FULLSCREEN_SUPPORTED) return
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(() => {
    if (!FULLSCREEN_SUPPORTED) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  }, [])

  return { supported: FULLSCREEN_SUPPORTED, fullscreen, toggle }
}
