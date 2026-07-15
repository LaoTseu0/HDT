// Icônes SVG de la barre d'édition (E19-03) : pictogrammes stroke=currentColor,
// façon jeu d'icônes cohérent. Purement présentationnel — extrait d'EditBar pour
// alléger le composant (directive IHM 2026-06-24).

interface IconProps {
  id: string
}

// Icônes d'outils (pictogramme + tooltip natif porté par le bouton parent).
export function ToolIcon({ id }: IconProps) {
  if (id === 'select') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M5 3l13 6-5.4 1.6L11 17z" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'rect') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="6"
          width="16"
          height="12"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    )
  }
  if (id === 'circle') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (id === 'arc') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 18 A 14 14 0 0 1 20 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="4" cy="18" r="1.8" fill="currentColor" />
        <circle cx="20" cy="18" r="1.8" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'opening') {
    // Fenêtre : cadre + croisillons.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (id === 'door') {
    // Porte : cadre haut + battant entrouvert + poignée.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="15.5" cy="12.5" r="1.4" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'joinery') {
    // Menuiserie : dormant (cadre externe) + jour vitré (cadre interne).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="8"
          y="7"
          width="8"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    )
  }
  if (id === 'elec') {
    // Éclair (électricité).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M13 2L5 13h5l-1 9 8-12h-5z" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'cable') {
    // Câble routé : polyligne coudée + sommets (façon chemin de câble).
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 20V10h8V4h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4" cy="20" r="1.8" fill="currentColor" />
        <circle cx="20" cy="4" r="1.8" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'pipe') {
    // Tuyau routé : conduite coudée (trait épais, coude arrondi) + goutte.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M5 21V10a4 4 0 0 1 4-4h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M19 12c1.5 2.2 2.4 3.5 2.4 4.8a2.4 2.4 0 0 1-4.8 0c0-1.3.9-2.6 2.4-4.8z"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (id === 'valve') {
    // Vanne : symbole schéma (deux triangles bout à bout) + tige et poignée.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 9v8l8-4zM20 9v8l-8-4z" fill="currentColor" />
        <path d="M12 13V7" stroke="currentColor" strokeWidth="2" />
        <path d="M8 6.5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  // pushpull
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="5"
        y="13"
        width="14"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 10V3M8.5 6.5L12 3l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Icônes des composants élec (sous-barre de l'outil Élec, E15-01/02).
export function ElecCompIcon({ id }: IconProps) {
  if (id === 'elec.switch') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="6"
          y="3"
          width="12"
          height="18"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect x="9" y="6" width="6" height="7" rx="1" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'elec.junction') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2v4M12 18v4M2 12h4M18 12h4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (id === 'elec.meter') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect x="7" y="7" width="10" height="4" rx="1" fill="currentColor" />
        <circle
          cx="12"
          cy="16"
          r="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    )
  }
  // elec.outlet — prise : cadre + 2 trous.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="9.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="14.5" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

// Icônes des sections de câble (E15-03) : carré dont le côté grossit avec la gaine.
const CABLE_ICON_SIDE: Record<string, number> = {
  gaine16: 8,
  gaine20: 11,
  gaine25: 14,
  gaine32: 17,
}

export function CableSectionIcon({ id }: IconProps) {
  const side = CABLE_ICON_SIDE[id] ?? 11
  const off = (24 - side) / 2
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x={off}
        y={off}
        width={side}
        height={side}
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

// Icônes des sections de tuyau (E16-01) : cercle dont le Ø grossit avec la section.
const PIPE_ICON_R: Record<string, number> = {
  cuivre12: 3,
  cuivre14: 3.5,
  cuivre16: 4,
  cuivre18: 4.5,
  cuivre22: 5.5,
  evac32: 6.5,
  evac40: 7.5,
  evac100: 9.5,
}

export function PipeSectionIcon({ id }: IconProps) {
  const r = PIPE_ICON_R[id] ?? 4
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// Icônes des variantes de menuiserie (E14-06) : la variante en élévation.
export function JoineryVariantIcon({ id }: IconProps) {
  if (id === 'battant') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M12 3v18" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="10" cy="12" r="1.2" fill="currentColor" />
        <circle cx="14" cy="12" r="1.2" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'coulissant') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect
          x="3"
          y="5"
          width="12"
          height="14"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <rect
          x="9"
          y="7"
          width="12"
          height="14"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M8 2.5h8M13.5 0.5L16 2.5l-2.5 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  // fixe — dormant + jour vitré plein.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="8"
        y="7"
        width="8"
        height="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

// Icône du toggle d'accroche à la grille (E12-03).
export function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 9h16M4 15h16M9 4v16M15 4v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}

// Gabarits d'ouverture (E14-04) : rect + croisillon illustrant le preset.
const PRESET_RECTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  classique: { x: 6, y: 4, w: 12, h: 16 },
  large: { x: 3, y: 6, w: 18, h: 12 },
  etroite: { x: 8, y: 3, w: 8, h: 18 },
}

export function PresetIcon({ id }: IconProps) {
  const { x, y, w, h } = PRESET_RECTS[id] ?? PRESET_RECTS.classique!
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

// Gabarits de porte (E14-07) : porte stylisée dont la largeur illustre le gabarit.
const DOOR_PRESET_RECTS: Record<string, { x: number; w: number }> = {
  simple: { x: 7, w: 10 },
  double: { x: 3, w: 18 },
  etroite: { x: 9, w: 7 },
}

export function DoorPresetIcon({ id }: IconProps) {
  const { x, w } = DOOR_PRESET_RECTS[id] ?? DOOR_PRESET_RECTS.simple!
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={`M${x} 21V4a1 1 0 0 1 1-1h${w - 2}a1 1 0 0 1 1 1v17`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 21h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {id === 'double' && <path d="M12 3v18" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  )
}
