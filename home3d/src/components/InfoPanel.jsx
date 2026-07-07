import useStore from '../store/useStore.js'
import { subtypeLabel } from '../lib/naming.js'

// Infos de l'objet sélectionné (E6-02) : extras formatés avec labels FR,
// champs vides grisés, nom de node complet visible.

const LEVEL_LABELS = {
  ss: 'Sous-sol',
  rdc: 'Rez-de-chaussée',
  r1: 'R+1',
  r2: 'R+2',
  combles: 'Combles',
  ext: 'Extérieur',
}

function formatDims(dims) {
  if (!dims || typeof dims !== 'object') return null
  const parts = Object.entries(dims).map(([key, value]) => {
    // Clés de la forme `thickness_m` → « thickness 0.2 m ».
    const metric = key.endsWith('_m')
    return `${key.replace(/_m$/, '').replaceAll('_', ' ')} : ${value}${metric ? ' m' : ''}`
  })
  return parts.length > 0 ? parts.join(' · ') : null
}

// Label FR du sous-type (E20-03) : priorité au label injecté par le pipeline
// (extras.subtypeLabel), sinon recalcul depuis le vocabulaire (GLB traité avant
// E20-02), sinon le segment brut humanisé — suffixé « hors vocabulaire » pour
// signaler un type libre (vocabulaire ouvert, jamais bloquant).
function formatSubtype(extras) {
  if (!extras.type) return null
  const label = extras.subtypeLabel ?? subtypeLabel(extras.layer, extras.type)
  if (label) return label
  return `${extras.type.replaceAll('_', ' ')} (hors vocabulaire)`
}

function Row({ label, value }) {
  const empty = value == null || value === ''
  return (
    <div className={empty ? 'info-row empty' : 'info-row'}>
      <dt>{label}</dt>
      <dd>{empty ? '—' : value}</dd>
    </div>
  )
}

export default function InfoPanel() {
  const selectedNode = useStore((state) => state.selectedNode)
  const nodes = useStore((state) => state.nodes)
  const layers = useStore((state) => state.layers)
  const selectNode = useStore((state) => state.selectNode)
  const isAppObject = useStore((state) => !!state.objects[state.selectedNode])

  // Les objets créés in-app ont leur propre inspector (EditBar) : on n'affiche
  // pas ce panneau d'infos d'objet importé pour eux.
  if (!selectedNode || isAppObject) return null
  const extras = nodes[selectedNode]

  return (
    <aside className="info-panel" aria-label="Objet sélectionné">
      <header className="panel-header">
        <h2>Objet sélectionné</h2>
        <button
          className="small"
          aria-label="Désélectionner"
          onClick={() => selectNode(null)}
        >
          ✕
        </button>
      </header>

      <code className="info-node-name">{selectedNode}</code>

      {extras ? (
        <dl className="info-rows">
          <Row label="Calque" value={layers[extras.layer]?.label ?? extras.layer} />
          <Row label="Type" value={formatSubtype(extras)} />
          <Row label="Zone" value={extras.zone} />
          <Row label="Niveau" value={LEVEL_LABELS[extras.level] ?? extras.level} />
          <Row
            label="Index"
            value={extras.index != null ? String(extras.index).padStart(3, '0') : null}
          />
          <Row label="Dimensions" value={formatDims(extras.dims)} />
          <Row label="Matériau" value={extras.material} />
          <Row label="Notes" value={extras.notes} />
        </dl>
      ) : (
        <p className="info-unclassified">
          Objet sans métadonnées (calque « Non classé ») : fichier non passé
          par le pipeline pour ce node.
        </p>
      )}
    </aside>
  )
}
