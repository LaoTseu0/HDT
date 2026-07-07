import { useEffect, useState } from 'react'
import useStore from '../store/useStore.js'

// Section Vue de la barre latérale (E19-04) : bascule Orbite/Visite (E17-01),
// recentrage caméra (E4-03), FOV du mode visite (E17-04/09 gelés — seul
// réglage exposé), plein écran in-navigateur (E17-11, issue #23) et overlay
// perf dev (E8-01).

export default function ViewSection() {
  const glb = useStore((state) => state.glb)
  const viewMode = useStore((state) => state.viewMode)
  const toggleViewMode = useStore((state) => state.toggleViewMode)
  const requestFit = useStore((state) => state.requestFit)
  const editMode = useStore((state) => state.editMode)
  const visitFov = useStore((state) => state.visitFov)
  const setVisitFov = useStore((state) => state.setVisitFov)
  const showPerf = useStore((state) => state.showPerf)
  const togglePerf = useStore((state) => state.togglePerf)

  // E17-11 : plein écran navigateur — état natif du document, suivi via
  // fullscreenchange (la touche F11 / ÉCHAP sortent aussi du plein écran).
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  return (
    <>
      <button
        disabled={!glb || editMode}
        aria-pressed={viewMode === 'visit'}
        title="Vue 1re personne — vol libre (V)"
        onClick={toggleViewMode}
      >
        {viewMode === 'visit' ? 'Quitter la visite' : 'Visiter'}
      </button>
      <button
        disabled={!glb || viewMode !== 'orbit'}
        title="Recadrer la caméra sur le modèle (R)"
        onClick={requestFit}
      >
        Recentrer
      </button>
      <label className="edit-field view-fov">
        <span>FOV visite</span>
        <input
          type="range"
          min="50"
          max="100"
          step="1"
          value={visitFov}
          onChange={(event) => setVisitFov(Number(event.target.value))}
        />
        <span className="view-fov-value">{visitFov}°</span>
      </label>
      <button
        aria-pressed={fullscreen}
        title="Plein écran in-navigateur (E17-11)"
        onClick={toggleFullscreen}
      >
        {fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      </button>
      {import.meta.env.DEV && (
        <label className="layer-colorize">
          <input type="checkbox" checked={showPerf} onChange={togglePerf} />
          Overlay perf (P)
        </label>
      )}
    </>
  )
}
