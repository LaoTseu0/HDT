import { useEffect } from 'react'
import Viewer from './components/Viewer.jsx'
import GLBLoader from './components/GLBLoader.jsx'
import LayerPanel from './components/LayerPanel.jsx'
import InfoPanel from './components/InfoPanel.jsx'
import useStore from './store/useStore.js'

export default function App() {
  const requestFit = useStore((state) => state.requestFit)
  const togglePerf = useStore((state) => state.togglePerf)

  // Raccourcis clavier globaux : R = recentrer la caméra (E4-03),
  // P = overlay perf en dev (E8-01).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const key = event.key.toLowerCase()
      if (key === 'r') requestFit()
      if (key === 'p' && import.meta.env.DEV) togglePerf()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestFit, togglePerf])

  return (
    <div className="app">
      <Viewer />
      <GLBLoader />
      <LayerPanel />
      <InfoPanel />
    </div>
  )
}
