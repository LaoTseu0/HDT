import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore.js'
import { openGlbFile, loadDemoModel } from '@/features/model-io/openGlbFile'

// Chargement d'un GLB par drag & drop (E3-01) ou file picker (E3-02),
// avec feedback de chargement et erreurs affichées dans l'UI (E3-05).
// L'ex-toolbar (recentrer, éditer, visiter…) vit dans la barre latérale
// (E19) ; ne restent ici que l'état vide et les feedbacks de chargement.
export default function GLBLoader() {
  const glb = useStore((state) => state.glb)
  const isLoading = useStore((state) => state.isLoading)
  const loadError = useStore((state) => state.loadError)
  const clearLoadError = useStore((state) => state.clearLoadError)

  const fileInputRef = useRef(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

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
      openGlbFile(event.dataTransfer?.files?.[0])
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
  }, [])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb"
        hidden
        onChange={(event) => {
          openGlbFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

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
