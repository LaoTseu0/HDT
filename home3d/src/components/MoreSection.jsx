import { useRef } from 'react'
import useStore from '../store/useStore.js'
import { openGlbFile, loadDemoModel } from '../lib/openGlbFile.js'
import pkg from '../../package.json'

// Section More de la barre latérale (E19-05) : actions secondaires — ouvrir
// un modèle, infos du modèle chargé (métadonnées scène du pipeline),
// raccourcis clavier (E19-07) et à-propos/version.

function Row({ label, value }) {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

export default function MoreSection() {
  const glb = useStore((state) => state.glb)
  const metadata = useStore((state) => state.metadata)
  const nodeCount = useStore((state) => Object.keys(state.nodes).length)
  const layerCount = useStore((state) => Object.keys(state.layers).length)
  const setShortcutsOpen = useStore((state) => state.setShortcutsOpen)
  const fileInputRef = useRef(null)
  const model = metadata?.model

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
      <button onClick={() => fileInputRef.current?.click()}>Ouvrir un GLB…</button>
      <button className="secondary" onClick={loadDemoModel}>
        Modèle de démo
      </button>
      <button className="secondary" onClick={() => setShortcutsOpen(true)}>
        Raccourcis clavier…
      </button>

      {glb ? (
        <dl className="info-rows menu-model-info">
          <Row label="Fichier" value={glb.fileName} />
          <Row label="Calques" value={layerCount} />
          <Row label="Objets" value={nodeCount} />
          <Row label="Zones" value={model?.zones?.join(', ')} />
          <Row label="Niveaux" value={model?.levels?.join(', ')} />
          <Row label="Schéma" value={model?.version} />
        </dl>
      ) : (
        <p className="edit-hint">Aucun modèle chargé.</p>
      )}

      <p className="menu-about">Home3D Viewer — v{pkg.version}</p>
    </>
  )
}
