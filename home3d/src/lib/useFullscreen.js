import { useEffect, useState } from 'react'

// E17-11 (issue #23) : plein écran navigateur, partagé entre la section Vue
// (barre latérale) et le bouton flottant du mode visite.
// `supported` : l'API Fullscreen d'élément HTML existe (Safari iPhone ne
// l'expose que sur <video> → le bouton doit être masqué là-bas).
// `fullscreen` : suivi via l'événement `fullscreenchange`, car l'utilisateur
// peut sortir par un geste système (F11, ÉCHAP, bouton Retour).
export const FULLSCREEN_SUPPORTED =
  typeof document !== 'undefined' &&
  typeof document.documentElement.requestFullscreen === 'function'

export default function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  )

  useEffect(() => {
    if (!FULLSCREEN_SUPPORTED) return
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    if (!FULLSCREEN_SUPPORTED) return
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  return { supported: FULLSCREEN_SUPPORTED, fullscreen, toggle }
}
