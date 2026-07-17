// E10-02 — les métadonnées descriptives (matériau / notes) des objets app sont
// embarquées dans les extras du node exporté (et relues au chargement, cf.
// extractModelData).

import { describe, it, expect } from 'vitest'
import { buildAppNodeExtras } from './exportGLB'
import { appObj } from '@/test/factory'

describe('buildAppNodeExtras — matériau / notes', () => {
  it('embarque les valeurs saisies', () => {
    const obj = appObj(
      'sketch.rect',
      { largeur_m: 2, profondeur_m: 1, hauteur_m: 0.5 },
      { material: 'béton banché', notes: 'socle abri de jardin' }
    )
    const extras = buildAppNodeExtras(obj)
    expect(extras.material).toBe('béton banché')
    expect(extras.notes).toBe('socle abri de jardin')
  })

  it("écrit '' par défaut (champs jamais renseignés)", () => {
    const extras = buildAppNodeExtras(
      appObj('sketch.rect', { largeur_m: 2, profondeur_m: 1 })
    )
    expect(extras.material).toBe('')
    expect(extras.notes).toBe('')
  })
})
