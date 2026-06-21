import { useEffect } from 'react'
import Viewer from './components/Viewer.jsx'
import GLBLoader from './components/GLBLoader.jsx'
import LayerPanel from './components/LayerPanel.jsx'
import InfoPanel from './components/InfoPanel.jsx'
import VisitOverlay from './components/VisitOverlay.jsx'
import useStore from './store/useStore.js'

export default function App() {
  const requestFit = useStore((state) => state.requestFit)
  const togglePerf = useStore((state) => state.togglePerf)
  const toggleViewMode = useStore((state) => state.toggleViewMode)
  const setViewMode = useStore((state) => state.setViewMode)

  // Raccourcis clavier globaux : R = recentrer la caméra (E4-03),
  // P = overlay perf en dev (E8-01), V = basculer Orbite/Visite (E17-01).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const { viewMode, pointerLocked } = useStore.getState()
      // Échap quitte la visite quand le verrou souris est déjà relâché
      // (le 1er Échap, lui, est consommé par le navigateur pour déverrouiller).
      if (event.key === 'Escape' && viewMode === 'visit' && !pointerLocked) {
        setViewMode('orbit')
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'v') toggleViewMode()
      // R recentre la caméra : sans objet en mode visite (la caméra y est
      // pilotée par le vol libre).
      if (key === 'r' && viewMode === 'orbit') requestFit()
      if (key === 'p' && import.meta.env.DEV) togglePerf()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestFit, togglePerf, toggleViewMode, setViewMode])

  return (
    <div className="app">
      <Viewer />
      <GLBLoader />
      <LayerPanel />
      <InfoPanel />
      <VisitOverlay />
    </div>
  )
}
