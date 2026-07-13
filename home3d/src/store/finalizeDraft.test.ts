import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import { finalizeDraft } from '@/store/useStore'
import { CABLE_KIND } from '@/features/mep/cable'
import { PIPE_KIND } from '@/features/mep/plumbing'
import type { AppObject } from '@/types'

// finalizeDraft (#28) : quitter l'outil câble/tuyau (Échap, Sélection, sortie
// d'édition) FINALISE le run en cours au lieu de jeter ses ancrages. Les autres
// tracés (rect/cercle/arc) restent abandonnés. `state` minimal = ce dont
// commitRun/buildAppObject ont besoin.
// Drafts de test volontairement partiels (le store est encore JS, param any).
const baseState = (draft: unknown) => ({
  objects: {},
  currentZone: 'sejour',
  currentLevel: 'rdc',
  cableSection: 'gaine20',
  pipeSection: 'cuivre16',
  draft,
})

describe('finalizeDraft (persistance run — #28)', () => {
  it('run câble ≥ 2 sommets : committé en objet, draft soldé', () => {
    const patch = finalizeDraft(
      baseState({
        tool: 'cable',
        points: [
          [0, 0.3, 0],
          [2, 0.3, 0],
          [2, 0.3, 3],
        ],
        current: [2, 0.3, 3],
      })
    )
    const created = Object.values(patch.objects ?? {}) as AppObject[]
    assert.equal(created.length, 1)
    assert.equal(created[0]!.kind, CABLE_KIND)
    assert.equal((created[0]!.params as { points: unknown[] }).points.length, 3)
    assert.equal(patch.selectedNode, created[0]!.id)
    assert.equal(patch.draft, null)
  })

  it('run tuyau ≥ 2 sommets : committé en objet', () => {
    const patch = finalizeDraft(
      baseState({
        tool: 'pipe',
        points: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        current: [1, 0, 0],
      })
    )
    const created = Object.values(patch.objects ?? {}) as AppObject[]
    assert.equal(created.length, 1)
    assert.equal(created[0]!.kind, PIPE_KIND)
    assert.equal(patch.draft, null)
  })

  it('run à 1 seul sommet (clic accidentel) : rien de créé, draft soldé', () => {
    const patch = finalizeDraft(
      baseState({ tool: 'cable', points: [[1, 1, 1]], current: [1, 1, 1] })
    )
    assert.equal(patch.objects, undefined) // pas de patch objects → aucun objet
    assert.equal(patch.draft, null)
  })

  it('tracé non-run (rectangle en cours) : abandonné, jamais committé', () => {
    const patch = finalizeDraft(
      baseState({ tool: 'rect', start: [0, 0], current: [2, 2], frame: {} })
    )
    assert.equal(patch.objects, undefined)
    assert.equal(patch.draft, null)
  })

  it('aucun tracé en cours : patch neutre (draft null)', () => {
    const patch = finalizeDraft(baseState(null))
    assert.equal(patch.objects, undefined)
    assert.equal(patch.draft, null)
  })
})
