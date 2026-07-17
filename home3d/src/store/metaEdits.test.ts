// E10-02 — édition des métadonnées descriptives (matériau / notes) :
// - objets app : setObjectMeta, historisé (une entrée zundo par commit) ;
// - nodes importés : setNodeMeta, table `nodes` + userData du node de la scène
//   vive re-synchronisés (l'export clone la scène, E10-04).

import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import useStore from './useStore'
import { appObj } from '@/test/factory'
import type { GlbState, NodeExtras } from '@/types'

const NODE = 'structure__mur__ext__rdc__001'

function seedImportedNode() {
  const scene = new THREE.Group()
  const node = new THREE.Group()
  node.name = NODE
  const extras: NodeExtras = { layer: 'structure', type: 'mur', material: '', notes: '' }
  node.userData = extras
  scene.add(node)
  useStore.setState({
    glb: { scene, fileName: 'test.glb' } as GlbState,
    nodes: { [NODE]: node.userData },
  })
  return node
}

beforeEach(() => {
  useStore.setState({ objects: {}, nodes: {}, glb: null })
  useStore.temporal.getState().clear()
})

describe('setObjectMeta (objet app)', () => {
  it('écrit matériau et notes sur l’objet', () => {
    const obj = appObj('sketch.rect', { largeur_m: 1, profondeur_m: 1 })
    useStore.setState({ objects: { [obj.id]: obj } })
    useStore.getState().setObjectMeta(obj.id, { material: 'béton banché' })
    useStore.getState().setObjectMeta(obj.id, { notes: 'à vérifier' })
    const next = useStore.getState().objects[obj.id]!
    expect(next.material).toBe('béton banché')
    expect(next.notes).toBe('à vérifier')
  })

  it('crée une entrée d’historique par commit, aucune pour un no-op', () => {
    const obj = appObj('sketch.rect', { largeur_m: 1, profondeur_m: 1 })
    useStore.setState({ objects: { [obj.id]: obj } })
    useStore.temporal.getState().clear()
    useStore.getState().setObjectMeta(obj.id, { material: 'chêne' })
    expect(useStore.temporal.getState().pastStates.length).toBe(1)
    // No-op : même valeur → pas de nouvelle référence, pas d'entrée.
    useStore.getState().setObjectMeta(obj.id, { material: 'chêne' })
    expect(useStore.temporal.getState().pastStates.length).toBe(1)
    // '' ≡ absent : effacer un champ jamais renseigné est aussi un no-op.
    useStore.getState().setObjectMeta(obj.id, { notes: '' })
    expect(useStore.temporal.getState().pastStates.length).toBe(1)
    // Undo : le matériau revient à son état antérieur (absent).
    useStore.temporal.getState().undo()
    expect(useStore.getState().objects[obj.id]!.material).toBeUndefined()
  })

  it('ignore un id inconnu', () => {
    const before = useStore.getState().objects
    useStore.getState().setObjectMeta('app-404', { material: 'x' })
    expect(useStore.getState().objects).toBe(before)
  })
})

describe('setNodeMeta (node importé)', () => {
  it('met à jour la table nodes ET le userData du node de la scène', () => {
    const node = seedImportedNode()
    useStore.getState().setNodeMeta(NODE, { material: 'parpaing', notes: 'mur nord' })
    const extras = useStore.getState().nodes[NODE]!
    expect(extras.material).toBe('parpaing')
    expect(extras.notes).toBe('mur nord')
    // La scène vive porte les MÊMES extras (c'est elle que l'export clone).
    expect(node.userData).toBe(extras)
    // Les autres champs sont préservés.
    expect(extras.layer).toBe('structure')
  })

  it('no-op : même valeur → aucune nouvelle référence de table', () => {
    seedImportedNode()
    const before = useStore.getState().nodes
    useStore.getState().setNodeMeta(NODE, { material: '' })
    expect(useStore.getState().nodes).toBe(before)
  })

  it('ignore un node inconnu', () => {
    seedImportedNode()
    const before = useStore.getState().nodes
    useStore.getState().setNodeMeta('structure__mur__ext__rdc__999', { notes: 'x' })
    expect(useStore.getState().nodes).toBe(before)
  })

  it('non historisé : pas d’entrée zundo', () => {
    seedImportedNode()
    useStore.temporal.getState().clear()
    useStore.getState().setNodeMeta(NODE, { material: 'parpaing' })
    expect(useStore.temporal.getState().pastStates.length).toBe(0)
  })
})
