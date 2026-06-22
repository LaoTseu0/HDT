import useStore from '../store/useStore.js'

// Panneau de calques (E5-01 → E5-04) : liste label + pastille couleur
// issus des extras scène, toggle visibilité, actions globales
// (tout afficher / tout masquer / isoler) et colorisation par calque.
export default function LayerPanel() {
  const layers = useStore((state) => state.layers)
  const toggleLayer = useStore((state) => state.toggleLayer)
  const setAllLayersVisible = useStore((state) => state.setAllLayersVisible)
  const isolateLayer = useStore((state) => state.isolateLayer)
  const colorByLayer = useStore((state) => state.colorByLayer)
  const toggleColorByLayer = useStore((state) => state.toggleColorByLayer)
  const editMode = useStore((state) => state.editMode)

  const entries = Object.entries(layers)
  // En édition, le panneau de gauche affiche l'EditBar à la place des calques.
  if (entries.length === 0 || editMode) return null

  return (
    <aside className="layer-panel" aria-label="Calques">
      <header className="panel-header">
        <h2>Calques</h2>
        <div className="layer-global-actions">
          <button
            className="small"
            title="Tout afficher"
            onClick={() => setAllLayersVisible(true)}
          >
            Tout
          </button>
          <button
            className="small"
            title="Tout masquer"
            onClick={() => setAllLayersVisible(false)}
          >
            Aucun
          </button>
        </div>
      </header>

      <ul className="layer-list">
        {entries.map(([id, layer]) => (
          <li key={id} className={layer.visible ? 'layer-row' : 'layer-row hidden'}>
            <button
              className="layer-toggle"
              aria-pressed={layer.visible}
              onClick={() => toggleLayer(id)}
            >
              <span className="layer-swatch" style={{ background: layer.color }} />
              <span className="layer-label">{layer.label}</span>
              <span className="layer-eye">{layer.visible ? '●' : '○'}</span>
            </button>
            <button
              className="small layer-isolate"
              title={`Isoler « ${layer.label} »`}
              onClick={() => isolateLayer(id)}
            >
              Isoler
            </button>
          </li>
        ))}
      </ul>

      <label className="layer-colorize">
        <input
          type="checkbox"
          checked={colorByLayer}
          onChange={toggleColorByLayer}
        />
        Couleurs par calque
      </label>
    </aside>
  )
}
