import { useEffect, useRef } from 'react'
import type { ComponentType } from 'react'
import useStore from '@/store/useStore'
import LayerPanel from './LayerPanel'
import EditBar from '@/features/edit/EditBar'
import ViewSection from './ViewSection'
import MoreSection from './MoreSection'
import type { MenuSection } from '@/store/types'

// E19-01 : bouton burger + barre latérale unique, en OVERLAY au-dessus du canvas
// (choix tranché vs push : le canvas WebGL garde sa taille, pas de re-layout à
// chaque ouverture). Sections en accordéon — Calques (E19-02), Édition (E19-03),
// Vue (E19-04), Plus (E19-05) — une seule dépliée à la fois. ÉCHAP (App) et clic
// hors panneau ferment.

interface SectionDef {
  id: MenuSection
  label: string
  Body: ComponentType
}

const SECTIONS: SectionDef[] = [
  { id: 'calques', label: 'Calques', Body: LayerPanel },
  { id: 'edit', label: 'Édition', Body: EditBar },
  { id: 'vue', label: 'Vue', Body: ViewSection },
  { id: 'more', label: 'Plus', Body: MoreSection },
]

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 6h16M4 12h16M4 18h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

export default function Sidebar() {
  const menuOpen = useStore((state) => state.menuOpen)
  const toggleMenu = useStore((state) => state.toggleMenu)
  const setMenuOpen = useStore((state) => state.setMenuOpen)
  const menuSection = useStore((state) => state.menuSection)
  const setMenuSection = useStore((state) => state.setMenuSection)
  const pointerLocked = useStore((state) => state.pointerLocked)
  const rootRef = useRef<HTMLDivElement>(null)

  // Clic hors panneau → fermeture (E19-01). Pas de backdrop : le canvas reste
  // interactif sur desktop. Exception : en édition, le clic canvas EST l'action
  // (tracer, sélectionner) et la palette vit dans la barre — on ne ferme pas.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (useStore.getState().editMode) return
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen, setMenuOpen])

  // Verrou souris (visite clavier/souris) : plus de pointeur, on masque le menu.
  // Les joysticks tactiles (E17-10), eux, cohabitent avec la barre.
  if (pointerLocked) return null

  return (
    <div ref={rootRef}>
      <button
        className="burger"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={menuOpen}
        onClick={toggleMenu}
      >
        <BurgerIcon open={menuOpen} />
      </button>

      <aside
        className={menuOpen ? 'sidebar open' : 'sidebar'}
        aria-label="Menu"
        aria-hidden={!menuOpen}
      >
        {SECTIONS.map(({ id, label, Body }) => (
          <section key={id} className="menu-section">
            <button
              className="menu-section-header"
              aria-expanded={menuSection === id}
              onClick={() => setMenuSection(id)}
            >
              <span>{label}</span>
              <span className="menu-chevron">{menuSection === id ? '▾' : '▸'}</span>
            </button>
            {menuSection === id && (
              <div className="menu-section-body">
                <Body />
              </div>
            )}
          </section>
        ))}
      </aside>
    </div>
  )
}
