import useStore from '@/store/useStore'

// E19-07 : overlay modal listant tous les raccourcis clavier de l'app. Ouvert par
// la touche « ? » (App) ou depuis la section More ; ÉCHAP / clic hors panneau / ✕
// ferme. Tenir à jour avec App (globaux, VCB), EditBar (outils) et VisitControls.

interface ShortcutGroup {
  title: string
  rows: [string, string][]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Général',
    rows: [
      ['E', 'Basculer le mode édition'],
      ['V', 'Basculer Orbite / Visite'],
      ['R', 'Recentrer la caméra (en orbite)'],
      ['P', 'Overlay de performances (dev)'],
      ['?', 'Afficher ces raccourcis'],
      ['Échap', 'Fermer l’overlay ou le menu, quitter la visite'],
    ],
  },
  {
    title: 'Navigation (orbite)',
    rows: [
      ['Ctrl+clic gauche', 'Orbiter autour du modèle'],
      ['Ctrl+clic droit', 'Panner (déplacer la vue)'],
      ['Molette', 'Zoomer (sans Ctrl)'],
      ['Ctrl enfoncé', 'Verrou de navigation : aucune action sur les objets'],
    ],
  },
  {
    title: 'Édition',
    rows: [
      ['G', 'Accroche à la grille (pas de 0,1 m)'],
      ['Ctrl+Z · Ctrl+Maj+Z', 'Annuler · rétablir (aussi Ctrl+Y)'],
      ['Échap', 'Revenir à l’outil Sélection ; effacer la cote tapée'],
      ['Entrée', 'Valider le tracé ou la cote'],
      ['0-9 ; , -', 'Cote VCB pendant un tracé (largeur;profondeur, rayon, angle)'],
      ['Retour arrière', 'Effacer le dernier caractère de la cote'],
      ['Double-clic', 'Terminer un câble ou un tuyau'],
    ],
  },
  {
    title: 'Visite',
    rows: [
      ['ZQSD / WASD / flèches', 'Se déplacer (touches physiques WASD)'],
      ['Souris', 'Regarder — clic pour verrouiller le pointeur'],
      ['Échap', 'Relâcher le verrou souris, puis quitter la visite'],
      [
        'Manette · sticks tactiles',
        'Stick gauche : se déplacer · stick droit : regarder',
      ],
    ],
  },
]

export default function ShortcutsOverlay() {
  const open = useStore((state) => state.shortcutsOpen)
  const setShortcutsOpen = useStore((state) => state.setShortcutsOpen)

  if (!open) return null

  return (
    <div className="shortcuts-overlay" onClick={() => setShortcutsOpen(false)}>
      <div
        className="shortcuts-card"
        role="dialog"
        aria-label="Raccourcis clavier"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="panel-header">
          <h2>Raccourcis clavier</h2>
          <button
            className="small"
            aria-label="Fermer"
            onClick={() => setShortcutsOpen(false)}
          >
            ✕
          </button>
        </header>

        <div className="shortcuts-groups">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.rows.map(([keys, label]) => (
                  <li key={keys}>
                    <kbd>{keys}</kbd>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
