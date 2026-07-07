import { useEffect } from 'react'
import Viewer from './components/Viewer.jsx'
import GLBLoader from './components/GLBLoader.jsx'
import Sidebar from './components/Sidebar.jsx'
import InfoPanel from './components/InfoPanel.jsx'
import VisitSticks from './components/VisitSticks.jsx'
import VCBOverlay from './components/VCBOverlay.jsx'
import ShortcutsOverlay from './components/ShortcutsOverlay.jsx'
import useStore from './store/useStore.js'

// Saisie VCB (E12-04) pendant un tracé : construit la chaîne tapée, valide à
// Entrée, efface à Échap (si non vide). Renvoie true si la touche est consommée.
function handleVcbKey(event) {
  const { vcbText, setVcbText, commitDraft } = useStore.getState()
  const k = event.key
  if (k === 'Enter') {
    event.preventDefault()
    commitDraft()
    return true
  }
  if (k === 'Escape') {
    // Non vide : effacer la saisie (le tracé continue). Vide : laisser Échap
    // annuler le tracé (retour outil Sélection, géré plus bas).
    if (vcbText) {
      event.preventDefault()
      setVcbText('')
      return true
    }
    return false
  }
  if (k === 'Backspace') {
    event.preventDefault()
    setVcbText(vcbText.slice(0, -1))
    return true
  }
  // Chiffres + séparateurs de cote/décimale + signe (angle d'arc négatif).
  if (/^[0-9]$/.test(k) || k === ',' || k === '.' || k === ';' || k === '-') {
    event.preventDefault()
    setVcbText(vcbText + k)
    return true
  }
  return false
}

export default function App() {
  const requestFit = useStore((state) => state.requestFit)
  const togglePerf = useStore((state) => state.togglePerf)
  const toggleViewMode = useStore((state) => state.toggleViewMode)
  const setViewMode = useStore((state) => state.setViewMode)
  const toggleEditMode = useStore((state) => state.toggleEditMode)

  // Raccourcis clavier globaux : R = recentrer (E4-03), P = perf dev (E8-01),
  // V = Orbite/Visite (E17-01), E = View/Edit, G = accroche grille (E12-03),
  // Ctrl+Z / Ctrl+Maj+Z = undo/redo, ? = overlay raccourcis (E19-07).
  // Tenir ShortcutsOverlay.jsx à jour à chaque ajout.
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const { viewMode, pointerLocked, editMode, setActiveTool } = useStore.getState()

      // VCB (E12-04) : pendant un tracé, on capte la saisie de cote AVANT les
      // raccourcis (sinon taper une cote déclencherait R/G/V/E…).
      if (editMode && useStore.getState().draft && handleVcbKey(event)) return

      // Undo/redo (Edit mode uniquement) : Ctrl/Cmd+Z, +Maj pour rétablir ; Ctrl+Y.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (!editMode) return
        event.preventDefault()
        const temporal = useStore.temporal.getState()
        event.shiftKey ? temporal.redo() : temporal.undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        if (!editMode) return
        event.preventDefault()
        useStore.temporal.getState().redo()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return

      // ? : overlay des raccourcis clavier (E19-07).
      if (event.key === '?') {
        const { shortcutsOpen, setShortcutsOpen } = useStore.getState()
        setShortcutsOpen(!shortcutsOpen)
        return
      }

      // Échap, par priorité : ferme l'overlay raccourcis, quitte la visite
      // (verrou déjà relâché), revient à l'outil Sélection en édition (la barre
      // latérale y héberge la palette : on ne la ferme pas), ferme le menu.
      if (event.key === 'Escape') {
        const { shortcutsOpen, setShortcutsOpen, menuOpen, setMenuOpen } =
          useStore.getState()
        if (shortcutsOpen) setShortcutsOpen(false)
        else if (viewMode === 'visit' && !pointerLocked) setViewMode('orbit')
        else if (editMode) setActiveTool('select')
        else if (menuOpen) setMenuOpen(false)
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'e') toggleEditMode()
      if (key === 'v') toggleViewMode()
      // G bascule l'accroche grille (utile uniquement en édition).
      if (key === 'g' && editMode) useStore.getState().toggleGridSnap()
      // R recentre la caméra (sans objet en mode visite : caméra pilotée par le vol libre).
      if (key === 'r' && viewMode === 'orbit') requestFit()
      if (key === 'p' && import.meta.env.DEV) togglePerf()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestFit, togglePerf, toggleViewMode, setViewMode, toggleEditMode])

  return (
    <div className="app">
      <Viewer />
      <GLBLoader />
      <Sidebar />
      <InfoPanel />
      <VCBOverlay />
      <VisitSticks />
      <ShortcutsOverlay />
    </div>
  )
}
