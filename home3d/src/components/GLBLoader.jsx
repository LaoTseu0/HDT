import { useCallback, useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore.js'

// Chargement d'un GLB par drag & drop (E3-01) ou file picker (E3-02),
// avec feedback de chargement et erreurs affichées dans l'UI (E3-05).
// Héberge aussi la toolbar, dont le recadrage caméra (E4-03).
export default function GLBLoader() {
  const glb = useStore((state) => state.glb)
  const isLoading = useStore((state) => state.isLoading)
  const loadError = useStore((state) => state.loadError)
  const requestLoad = useStore((state) => state.requestLoad)
  const requestFit = useStore((state) => state.requestFit)
  const setLoadError = useStore((state) => state.setLoadError)
  const clearLoadError = useStore((state) => state.clearLoadError)
  const viewMode = useStore((state) => state.viewMode)
  const toggleViewMode = useStore((state) => state.toggleViewMode)
  const editMode = useStore((state) => state.editMode)
  const toggleEditMode = useStore((state) => state.toggleEditMode)

  const fileInputRef = useRef(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    async (file) => {
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.glb')) {
        setLoadError(
          `Fichier non supporté : « ${file.name} » (seuls les .glb sont acceptés).`
        )
        return
      }
      try {
        const buffer = await file.arrayBuffer()
        requestLoad(buffer, file.name)
      } catch (err) {
        setLoadError(`Lecture du fichier impossible : ${err.message ?? err}`)
      }
    },
    [requestLoad, setLoadError]
  )

  // Drag & drop sur toute la fenêtre (E3-01), avec compteur enter/leave
  // pour un feedback visuel fiable malgré les éléments imbriqués.
  useEffect(() => {
    const onDragEnter = (event) => {
      event.preventDefault()
      dragDepth.current += 1
      setIsDragging(true)
    }
    const onDragOver = (event) => event.preventDefault()
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setIsDragging(false)
    }
    const onDrop = (event) => {
      event.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      handleFile(event.dataTransfer?.files?.[0])
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFile])

  // Modèle de démo servi depuis public/models/ (pratique en dev).
  const loadDemoModel = useCallback(async () => {
    const url = `${import.meta.env.BASE_URL}models/maison.glb`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      requestLoad(await response.arrayBuffer(), 'maison.glb')
    } catch (err) {
      setLoadError(`Modèle de démo introuvable (${url}) : ${err.message ?? err}`)
    }
  }, [requestLoad, setLoadError])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb"
        hidden
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <div className="toolbar">
        <button onClick={() => fileInputRef.current?.click()}>Ouvrir un GLB…</button>
        {glb && viewMode === 'orbit' && !editMode && (
          <button title="Recadrer la caméra sur le modèle (R)" onClick={requestFit}>
            Recentrer
          </button>
        )}
        {glb && viewMode === 'orbit' && (
          <button
            title="Mode édition — créer des formes (E)"
            aria-pressed={editMode}
            onClick={toggleEditMode}
          >
            {editMode ? "Quitter l'édition" : 'Éditer'}
          </button>
        )}
        {glb && !editMode && (
          <button
            title="Vue 1re personne — vol libre (V)"
            aria-pressed={viewMode === 'visit'}
            onClick={toggleViewMode}
          >
            {viewMode === 'visit' ? 'Quitter la visite' : 'Visiter'}
          </button>
        )}
        {glb && <span className="toolbar-file">{glb.fileName}</span>}
      </div>

      {loadError && (
        <div className="error-banner" role="alert">
          <span>{loadError}</span>
          <button aria-label="Fermer" onClick={clearLoadError}>
            ✕
          </button>
        </div>
      )}

      {isLoading && <div className="loading-badge">Chargement du modèle…</div>}

      {!glb && !isLoading && (
        <div className="empty-state">
          <div className="empty-card">
            <h1>Home3D Viewer</h1>
            <p>Déposez un fichier .glb n'importe où dans la fenêtre,</p>
            <p>ou choisissez-le manuellement :</p>
            <div className="empty-actions">
              <button onClick={() => fileInputRef.current?.click()}>
                Ouvrir un GLB…
              </button>
              <button className="secondary" onClick={loadDemoModel}>
                Modèle de démo
              </button>
            </div>
          </div>
        </div>
      )}

      {isDragging && (
        <div className="drop-overlay">
          <span>Déposer le fichier .glb pour le charger</span>
        </div>
      )}
    </>
  )
}
