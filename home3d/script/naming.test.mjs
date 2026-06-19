// Tests unitaires de la validation/extraction des noms de nodes (E2-09).
// Runner natif Node (`node --test`), aucune dépendance.
//
// Usage : npm test  (= node --test script/)

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  LAYERS_CONFIG,
  NODE_NAME_REGEX,
  SYSTEMS,
  computeDims,
  isCandidateNode,
  parseNodeName,
  stripExporterPrefix,
  validateNodeName,
} from './naming.mjs'

describe('validateNodeName — noms valides', () => {
  // Exemples du cahier des charges, un par système.
  const VALID_NAMES = [
    'structure__mur_porteur__salon__rdc__001',
    'structure__mur_cloison__chambre1__rdc__002',
    'ouvertures__porte_int__couloir__rdc__001',
    'elec__circuit_prises__rdc__rdc__001',
    'plomberie__evacuation__wc__rdc__001',
    'vmc__gaine__rdc__rdc__001',
    'reseau__rj45__bureau__rdc__001',
    'terrain__jardin__ext__ext__001',
  ]

  for (const name of VALID_NAMES) {
    it(`accepte ${name}`, () => {
      const result = validateNodeName(name)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
      assert.equal(result.suggestion, null)
      assert.ok(result.parsed)
    })
  }

  it('accepte tous les niveaux autorisés', () => {
    for (const level of ['ss', 'rdc', 'r1', 'r2', 'combles', 'ext']) {
      assert.equal(validateNodeName(`elec__prise__salon__${level}__001`).valid, true)
    }
  })

  it('retourne les segments parsés', () => {
    const { parsed } = validateNodeName('structure__mur_porteur__salon__rdc__001')
    assert.deepEqual(parsed, {
      layer: 'structure',
      type: 'mur_porteur',
      zone: 'salon',
      level: 'rdc',
      index: 1,
    })
  })
})

describe('validateNodeName — noms invalides', () => {
  it('rejette les majuscules avec un diagnostic et une suggestion', () => {
    const result = validateNodeName('Structure__Mur_Porteur__Salon__RDC__001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('majuscules')))
    assert.equal(result.suggestion, 'structure__mur_porteur__salon__rdc__001')
    assert.equal(result.parsed, null)
  })

  it('rejette les accents avec un diagnostic et une suggestion', () => {
    const result = validateNodeName('elec__prise__séjour__rdc__001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('accents')))
    assert.equal(result.suggestion, 'elec__prise__sejour__rdc__001')
  })

  it('rejette les espaces avec un diagnostic et une suggestion', () => {
    const result = validateNodeName('structure__mur porteur__salon__rdc__001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('espaces')))
    assert.equal(result.suggestion, 'structure__mur_porteur__salon__rdc__001')
  })

  it('rejette un nombre de segments ≠ 5 (segment manquant)', () => {
    const result = validateNodeName('structure__mur_porteur__salon__rdc')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('4 segment(s) au lieu de 5')))
    assert.equal(result.suggestion, null)
  })

  it('rejette un séparateur simple `_` entre segments (1 seul segment vu)', () => {
    const result = validateNodeName('structure_mur_porteur_salon_rdc_001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('segment(s) au lieu de 5')))
  })

  it('rejette un index qui ne fait pas 3 chiffres, avec re-padding suggéré', () => {
    const result = validateNodeName('elec__prise__salon__rdc__7')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('index')))
    assert.equal(result.suggestion, 'elec__prise__salon__rdc__007')
  })

  it('rejette un index non numérique sans suggérer de faux index', () => {
    const result = validateNodeName('elec__prise__salon__rdc__abc')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('index')))
    assert.equal(result.suggestion, null)
  })

  it('rejette un niveau inconnu', () => {
    const result = validateNodeName('elec__prise__salon__etage3__001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('niveau `etage3` inconnu')))
  })

  it('rejette un système inconnu', () => {
    const result = validateNodeName('chauffage__radiateur__salon__rdc__001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('système `chauffage` inconnu')))
  })

  it('rejette les segments type/zone vides', () => {
    const result = validateNodeName('elec____salon__rdc__001')
    // `elec____salon__rdc__001`.split('__') → ['elec', '', 'salon', 'rdc', '001']
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('type vide')))
  })

  it('cumule les diagnostics (majuscules + niveau + index)', () => {
    const result = validateNodeName('Elec__Prise__Salon__Etage__1x')
    assert.equal(result.valid, false)
    assert.ok(result.errors.length >= 3)
  })

  it('rejette un nom hors convention sans crasher (chaîne quelconque)', () => {
    const result = validateNodeName('Mesh.001')
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0)
  })
})

describe('parseNodeName', () => {
  it('extrait layer/type/zone/level et un index numérique', () => {
    assert.deepEqual(parseNodeName('plomberie__eau_froide__sdb__rdc__012'), {
      layer: 'plomberie',
      type: 'eau_froide',
      zone: 'sdb',
      level: 'rdc',
      index: 12,
    })
  })

  it('ne traite pas l’index comme de l’octal (008 → 8)', () => {
    assert.equal(parseNodeName('elec__prise__salon__rdc__008').index, 8)
  })
})

describe('stripExporterPrefix — préfixe `Geom3D_` de SketchUp (issue #7)', () => {
  it('retire le préfixe `Geom3D_` → nom propre valide', () => {
    const name = stripExporterPrefix('Geom3D_structure__bloc__maison__rdc__001')
    assert.equal(name, 'structure__bloc__maison__rdc__001')
    assert.equal(validateNodeName(name).valid, true)
  })

  it('laisse `Geom3D` seul inchangé (géométrie non groupée → reste rejetée)', () => {
    assert.equal(stripExporterPrefix('Geom3D'), 'Geom3D')
    assert.equal(validateNodeName('Geom3D').valid, false)
  })

  it('ne retire que le préfixe en tête, pas une occurrence interne', () => {
    assert.equal(
      stripExporterPrefix('structure__Geom3D_mur__salon__rdc__001'),
      'structure__Geom3D_mur__salon__rdc__001'
    )
  })

  it('est idempotent et neutre sur un nom déjà propre', () => {
    const name = 'elec__prise__salon__rdc__001'
    assert.equal(stripExporterPrefix(name), name)
    assert.equal(stripExporterPrefix(stripExporterPrefix(`Geom3D_${name}`)), name)
  })
})

describe('isCandidateNode', () => {
  const fakeNode = (name, mesh) => ({ getName: () => name, getMesh: () => mesh })

  it('retient un node porteur de mesh, quel que soit son nom', () => {
    assert.equal(isCandidateNode(fakeNode('Group', {})), true)
  })

  it('retient un node sans mesh dont le nom suit la convention `__`', () => {
    assert.equal(isCandidateNode(fakeNode('elec__prise__salon__rdc__001', null)), true)
  })

  it('ignore un wrapper de regroupement sans mesh ni `__`', () => {
    assert.equal(isCandidateNode(fakeNode('SketchUp_Group', null)), false)
  })
})

describe('computeDims — dimensions depuis la bounding box (issue #9)', () => {
  const INCH = 0.0254
  const NO_SCALE = [1, 1, 1]

  it('retourne un objet vide quand il n’y a aucune géométrie', () => {
    assert.deepEqual(computeDims([]), {})
    assert.deepEqual(computeDims(undefined), {})
  })

  it('convertit les bornes en pouces vers des mètres via le scale du node', () => {
    // Cas réel du GLB de test : node `…__rdc__001`, scale 0.0254.
    const dims = computeDims([
      { min: [0, 0, 0], max: [318.5039, 392.5197, 0], scale: [INCH, INCH, INCH] },
    ])
    assert.deepEqual(dims, { largeur_m: 8.09, profondeur_m: 9.97, hauteur_m: 0 })
  })

  it('mappe X→largeur, Y→profondeur, Z→hauteur (repère SketchUp Z-up)', () => {
    const dims = computeDims([{ min: [0, 0, 0], max: [100, 50, 80], scale: NO_SCALE }])
    assert.deepEqual(dims, { largeur_m: 100, profondeur_m: 50, hauteur_m: 80 })
  })

  it('gère des bornes décalées de l’origine (taille = max − min)', () => {
    const dims = computeDims([{ min: [10, 10, 10], max: [20, 30, 40], scale: NO_SCALE }])
    assert.deepEqual(dims, { largeur_m: 10, profondeur_m: 20, hauteur_m: 30 })
  })

  it('reste correct avec un scale négatif (composant miroir)', () => {
    const dims = computeDims([{ min: [0, 0, 0], max: [10, 5, 2], scale: [-2, 1, 1] }])
    assert.deepEqual(dims, { largeur_m: 20, profondeur_m: 5, hauteur_m: 2 })
  })

  it('unit les bornes de plusieurs primitives (élément multi-mesh)', () => {
    const dims = computeDims([
      { min: [0, 0, 0], max: [10, 10, 10], scale: NO_SCALE },
      { min: [5, -5, 0], max: [30, 0, 25], scale: NO_SCALE },
    ])
    assert.deepEqual(dims, { largeur_m: 30, profondeur_m: 15, hauteur_m: 25 })
  })

  it('arrondit au millimètre (3 décimales)', () => {
    const dims = computeDims([{ min: [0, 0, 0], max: [1, 1, 1], scale: [INCH, INCH, INCH] }])
    assert.deepEqual(dims, { largeur_m: 0.025, profondeur_m: 0.025, hauteur_m: 0.025 })
  })
})

describe('cohérence de la config', () => {
  it('LAYERS_CONFIG couvre exactement les systèmes autorisés', () => {
    assert.deepEqual(Object.keys(LAYERS_CONFIG).sort(), [...SYSTEMS].sort())
  })

  it('la regex du module est celle du cahier des charges', () => {
    assert.equal(
      NODE_NAME_REGEX.source,
      '^(structure|ouvertures|elec|plomberie|vmc|reseau|terrain)__[a-z0-9_]+__[a-z0-9_]+__(ss|rdc|r1|r2|combles|ext)__\\d{3}$'
    )
  })
})
