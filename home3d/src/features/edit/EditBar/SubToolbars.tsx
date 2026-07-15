// Sous-barres contextuelles de la palette (E14-04/06, E15, E16) : gabarits
// d'ouverture / de porte, variantes de menuiserie, composants élec, sections de
// câble / tuyau. Chacune s'affiche selon l'outil actif et pilote une préférence
// d'outil du store. Extrait d'EditBar pour un composant principal plus lisible.

import { OPENING_PRESETS, DOOR_PRESETS } from '@/features/openings/opening'
import { ELEC_COMPONENTS } from '@/features/mep/elec'
import { CABLE_SECTIONS } from '@/features/mep/cable'
import { PIPE_SECTIONS } from '@/features/mep/plumbing'
import {
  CableSectionIcon,
  DoorPresetIcon,
  ElecCompIcon,
  JoineryVariantIcon,
  PipeSectionIcon,
  PresetIcon,
} from './icons'
import {
  CABLE_SECTION_LIST,
  DOOR_PRESET_LIST,
  ELEC_COMPONENT_LIST,
  JOINERY_VARIANT_LIST,
  OPENING_PRESET_LIST,
  PIPE_SECTION_LIST,
} from './catalog'
import type { JoineryVariant } from '@/types'

export function OpeningPresetBar({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="edit-tools" role="toolbar" aria-label="Gabarit d'ouverture">
      {OPENING_PRESET_LIST.map((preset) => {
        const dims = OPENING_PRESETS[preset.id]!
        return (
          <button
            key={preset.id}
            className="edit-tool"
            aria-pressed={value === preset.id}
            aria-label={preset.label}
            title={`${preset.label} — ${dims.largeur_m} × ${dims.hauteur_m} m`}
            onClick={() => onChange(preset.id)}
          >
            <PresetIcon id={preset.id} />
          </button>
        )
      })}
    </div>
  )
}

export function DoorPresetBar({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="edit-tools" role="toolbar" aria-label="Gabarit de porte">
      {DOOR_PRESET_LIST.map((preset) => {
        const dims = DOOR_PRESETS[preset.id]!
        return (
          <button
            key={preset.id}
            className="edit-tool"
            aria-pressed={value === preset.id}
            aria-label={preset.label}
            title={`${preset.label} — ${dims.largeur_m} × ${dims.hauteur_m} m`}
            onClick={() => onChange(preset.id)}
          >
            <DoorPresetIcon id={preset.id} />
          </button>
        )
      })}
    </div>
  )
}

export function JoineryVariantBar({
  value,
  onChange,
}: {
  value: JoineryVariant
  onChange: (id: JoineryVariant) => void
}) {
  return (
    <div className="edit-tools" role="toolbar" aria-label="Variante de menuiserie">
      {JOINERY_VARIANT_LIST.map((variant) => (
        <button
          key={variant.id}
          className="edit-tool"
          aria-pressed={value === variant.id}
          aria-label={variant.label}
          title={`${variant.label} — ${variant.hint}`}
          onClick={() => onChange(variant.id as JoineryVariant)}
        >
          <JoineryVariantIcon id={variant.id} />
        </button>
      ))}
    </div>
  )
}

export function ElecComponentBar({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="edit-tools" role="toolbar" aria-label="Composant électrique">
      {ELEC_COMPONENT_LIST.map((comp) => {
        const dims = ELEC_COMPONENTS[comp.id as keyof typeof ELEC_COMPONENTS].dims
        return (
          <button
            key={comp.id}
            className="edit-tool"
            aria-pressed={value === comp.id}
            aria-label={comp.label}
            title={`${comp.label} — ${dims.largeur_m} × ${dims.hauteur_m} m`}
            onClick={() => onChange(comp.id)}
          >
            <ElecCompIcon id={comp.id} />
          </button>
        )
      })}
    </div>
  )
}

export function CableSectionBar({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="edit-tools" role="toolbar" aria-label="Section de câble">
      {CABLE_SECTION_LIST.map((sec) => {
        const dims = CABLE_SECTIONS[sec.id]!.dims
        return (
          <button
            key={sec.id}
            className="edit-tool"
            aria-pressed={value === sec.id}
            aria-label={sec.label}
            title={`${sec.label} — section ${dims.largeur_m * 1000} × ${dims.hauteur_m * 1000} mm`}
            onClick={() => onChange(sec.id)}
          >
            <CableSectionIcon id={sec.id} />
          </button>
        )
      })}
    </div>
  )
}

export function PipeSectionBar({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="edit-tools" role="toolbar" aria-label="Section de tuyau">
      {PIPE_SECTION_LIST.map((sec) => {
        const dims = PIPE_SECTIONS[sec.id]!.dims
        return (
          <button
            key={sec.id}
            className="edit-tool"
            aria-pressed={value === sec.id}
            aria-label={sec.label}
            title={`${sec.label} — section ${dims.largeur_m * 1000} × ${dims.hauteur_m * 1000} mm`}
            onClick={() => onChange(sec.id)}
          >
            <PipeSectionIcon id={sec.id} />
          </button>
        )
      })}
    </div>
  )
}
