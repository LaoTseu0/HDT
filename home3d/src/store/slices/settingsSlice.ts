import { DEFAULT_OPENING_PRESET, DEFAULT_DOOR_PRESET } from '@/features/openings/opening'
import { DEFAULT_JOINERY_VARIANT } from '@/features/openings/joinery'
import { DEFAULT_ELEC_KIND } from '@/features/mep/elec'
import { DEFAULT_CABLE_SECTION } from '@/features/mep/cable'
import { DEFAULT_PIPE_SECTION } from '@/features/mep/plumbing'
import type { SettingsSlice, SliceCreator } from '../types'

// Préférences d'outil sélectionnées AVANT la pose (gabarits d'ouverture/porte,
// variante de menuiserie, composant élec, sections câble/tuyau). Non historisées ;
// l'instance posée reste modifiable ensuite dans l'inspector.
export const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => ({
  openingPreset: DEFAULT_OPENING_PRESET,
  doorPreset: DEFAULT_DOOR_PRESET,
  joineryVariant: DEFAULT_JOINERY_VARIANT,
  elecComponent: DEFAULT_ELEC_KIND,
  cableSection: DEFAULT_CABLE_SECTION,
  pipeSection: DEFAULT_PIPE_SECTION,
  setOpeningPreset: (preset) => set({ openingPreset: preset }),
  setDoorPreset: (preset) => set({ doorPreset: preset }),
  setJoineryVariant: (variant) => set({ joineryVariant: variant }),
  setElecComponent: (kind) => set({ elecComponent: kind }),
  setCableSection: (section) => set({ cableSection: section }),
  setPipeSection: (section) => set({ pipeSection: section }),
})
