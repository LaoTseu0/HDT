import { useMemo, useState } from 'react'
import useStore from '../store/useStore.js'
import { subtypesOf } from '../lib/naming.js'

// Panneau de calques (E5-01 → E5-04) : liste label + pastille couleur
// issus des extras scène, toggle visibilité, actions globales
// (tout afficher / tout masquer / isoler) et colorisation par calque.
// E20-04 : chaque calque se déplie en sous-types (segment `type` des nodes
// importés) — visibilité et isolation par sous-type ; les types hors
// vocabulaire canonique sont agrégés dans un bucket « Autres ».

// Arborescence des sous-types PRÉSENTS dans le modèle, par calque, depuis les
// extras des nodes importés. Chaque ligne = { value, label, count, types } où
// `types` est le groupe de segments réels qu'elle pilote (un type canonique →
// [lui-même] ; « Autres » → tous les types hors vocabulaire du calque).
function subtypeTreeOf(nodes) {
  const countsByLayer = {}
  for (const extras of Object.values(nodes)) {
    if (!extras?.layer || !extras?.type) continue
    const counts = (countsByLayer[extras.layer] ??= new Map())
    counts.set(extras.type, (counts.get(extras.type) ?? 0) + 1)
  }
  const tree = {}
  for (const [layerId, counts] of Object.entries(countsByLayer)) {
    const vocab = subtypesOf(layerId)
    const rows = vocab
      .filter((s) => counts.has(s.value))
      .map((s) => ({
        value: s.value,
        label: s.label,
        count: counts.get(s.value),
        types: [s.value],
      }))
    const others = [...counts.keys()].filter((t) => !vocab.some((s) => s.value === t))
    if (others.length > 0) {
      rows.push({
        value: '__autres__',
        label: 'Autres',
        count: others.reduce((n, t) => n + counts.get(t), 0),
        types: others,
      })
    }
    tree[layerId] = { rows, allTypes: [...counts.keys()] }
  }
  return tree
}

export default function LayerPanel() {
  const layers = useStore((state) => state.layers)
  const nodes = useStore((state) => state.nodes)
  const hiddenSubtypes = useStore((state) => state.hiddenSubtypes)
  const toggleLayer = useStore((state) => state.toggleLayer)
  const toggleSubtypes = useStore((state) => state.toggleSubtypes)
  const isolateSubtypes = useStore((state) => state.isolateSubtypes)
  const setAllLayersVisible = useStore((state) => state.setAllLayersVisible)
  const isolateLayer = useStore((state) => state.isolateLayer)
  const colorByLayer = useStore((state) => state.colorByLayer)
  const toggleColorByLayer = useStore((state) => state.toggleColorByLayer)
  const editMode = useStore((state) => state.editMode)

  // Calques dépliés (état local d'UI, réinitialisé au remontage du panneau).
  const [expanded, setExpanded] = useState({})
  const tree = useMemo(() => subtypeTreeOf(nodes), [nodes])

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
        {entries.map(([id, layer]) => {
          const sub = tree[id]
          const isOpen = !!expanded[id] && !!sub
          return (
            <li key={id}>
              <div className={layer.visible ? 'layer-row' : 'layer-row hidden'}>
                {sub ? (
                  <button
                    className="layer-expand"
                    aria-expanded={isOpen}
                    title={isOpen ? 'Replier les sous-types' : 'Déplier les sous-types'}
                    onClick={() => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
                  >
                    {isOpen ? '▾' : '▸'}
                  </button>
                ) : (
                  <span className="layer-expand-spacer" />
                )}
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
              </div>
              {isOpen && (
                <ul className="subtype-list">
                  {sub.rows.map((row) => {
                    const rowHidden = row.types.every((t) => hiddenSubtypes[id]?.[t])
                    return (
                      <li
                        key={row.value}
                        className={rowHidden ? 'layer-row subtype-row hidden' : 'layer-row subtype-row'}
                      >
                        <button
                          className="layer-toggle"
                          aria-pressed={!rowHidden}
                          onClick={() => toggleSubtypes(id, row.types)}
                        >
                          <span className="layer-label">{row.label}</span>
                          <span className="subtype-count">{row.count}</span>
                          <span className="layer-eye">{rowHidden ? '○' : '●'}</span>
                        </button>
                        <button
                          className="small layer-isolate"
                          title={`Isoler « ${row.label} »`}
                          onClick={() => isolateSubtypes(id, row.types, sub.allTypes)}
                        >
                          Isoler
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
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
