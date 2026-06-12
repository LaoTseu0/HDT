// Pipeline GLB (E2-01 → E2-06, E2-08) — cf. HTD_cahier_des_charges.md.
//
//   SketchUp → maison_raw.glb → [ce script] → maison.glb (production-ready)
//
// Étapes : validation des noms de nodes, injection des extras (node + scène),
// compression Draco, rapport budget taille.
//
// Usage :
//   node script/process.mjs <input.glb> [output.glb] [--no-draco]
//
// Sortie par défaut : <input> avec le suffixe `_raw` retiré, sinon `<input>.processed.glb`.
// Exit code ≠ 0 si le nommage est invalide ou si le fichier est illisible.

import { statSync } from 'node:fs'
import process from 'node:process'
import { NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { draco } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import {
  LAYERS_CONFIG,
  isCandidateNode,
  parseNodeName,
  validateNodeName,
} from './naming.mjs'

const MB = 1024 * 1024

// Barème budget taille du cahier des charges (E2-08).
const SIZE_BUDGET = [
  { maxMB: 10, action: 'Draco optionnel' },
  { maxMB: 30, action: 'Draco obligatoire' },
  { maxMB: 100, action: 'Draco + KTX2 + revoir instancing' },
  { maxMB: Infinity, action: 'REVOIR LA MODÉLISATION SKETCHUP (sur-détail à corriger)' },
]

function budgetAction(sizeBytes) {
  return SIZE_BUDGET.find((tier) => sizeBytes / MB < tier.maxMB).action
}

function formatMB(bytes) {
  return `${(bytes / MB).toFixed(2)} MB`
}

function parseArgs(argv) {
  const flags = argv.filter((a) => a.startsWith('--'))
  const positional = argv.filter((a) => !a.startsWith('--'))
  const [input, output] = positional
  if (!input) {
    console.error('Usage : node script/process.mjs <input.glb> [output.glb] [--no-draco]')
    process.exit(2)
  }
  const defaultOutput = input.includes('_raw')
    ? input.replace('_raw', '')
    : input.replace(/\.glb$/i, '.processed.glb')
  return {
    input,
    output: output ?? defaultOutput,
    useDraco: !flags.includes('--no-draco'),
  }
}

// --- 1. Validation des noms de nodes (E2-02) + rapport d'erreurs (E2-03) ---

function validateNodes(document) {
  const report = []
  let candidates = 0
  for (const node of document.getRoot().listNodes()) {
    if (!isCandidateNode(node)) continue
    candidates += 1
    const name = node.getName()
    if (name === '') {
      report.push({
        name: '(node sans nom)',
        errors: ['node avec mesh sans nom'],
        suggestion: null,
      })
      continue
    }
    const result = validateNodeName(name)
    if (!result.valid) report.push({ name, ...result })
  }
  return { report, candidates }
}

function printValidationReport(report) {
  console.error(
    `\n✗ ${report.length} node(s) ne respectent pas la convention de nommage :\n`
  )
  for (const { name, errors, suggestion } of report) {
    console.error(`  ${name}`)
    for (const reason of errors) console.error(`    – ${reason}`)
    if (suggestion) console.error(`    → suggestion : ${suggestion}`)
  }
  console.error(
    '\nFormat attendu : systeme__type__zone__niveau__index (ex : structure__mur_porteur__salon__rdc__001)'
  )
  console.error(
    'Corriger les noms de groupes/composants dans SketchUp puis ré-exporter.\n'
  )
}

// --- 2. Injection des extras par node (E2-04) ---

function injectNodeExtras(document) {
  const levels = new Set()
  const zones = new Set()
  let injected = 0
  for (const node of document.getRoot().listNodes()) {
    if (!isCandidateNode(node)) continue
    const parsed = parseNodeName(node.getName())
    levels.add(parsed.level)
    zones.add(parsed.zone)
    // Champs dims/material/notes vides : réservés à l'édition V2.
    node.setExtras({
      layer: parsed.layer,
      type: parsed.type,
      zone: parsed.zone,
      level: parsed.level,
      index: parsed.index,
      dims: {},
      material: '',
      notes: '',
    })
    injected += 1
  }
  return { injected, levels: [...levels].sort(), zones: [...zones].sort() }
}

// --- 3. Injection des extras de la scène racine (E2-05) ---

function injectSceneExtras(document, { levels, zones }) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0]
  scene.setExtras({
    model: { version: '1.0.0', levels, zones },
    layers: LAYERS_CONFIG,
  })
}

// --- Pipeline ---

async function main() {
  const { input, output, useDraco } = parseArgs(process.argv.slice(2))

  let rawSize
  try {
    rawSize = statSync(input).size
  } catch {
    console.error(`✗ Fichier introuvable : ${input}`)
    process.exit(2)
  }

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })

  console.log(`Lecture       : ${input} (${formatMB(rawSize)})`)
  let document
  try {
    document = await io.read(input)
  } catch (err) {
    console.error(`✗ GLB illisible ou corrompu : ${err.message}`)
    process.exit(2)
  }

  // 1. Validation
  const { report, candidates } = validateNodes(document)
  if (report.length > 0) {
    printValidationReport(report)
    process.exit(1)
  }
  console.log(`Validation    : ${candidates} node(s) conformes à la convention`)

  // 2 + 3. Extras
  const { injected, levels, zones } = injectNodeExtras(document)
  injectSceneExtras(document, { levels, zones })
  console.log(`Extras nodes  : ${injected} node(s) enrichis`)
  console.log(
    `Extras scène  : ${Object.keys(LAYERS_CONFIG).length} calques, levels=[${levels}], zones=[${zones}]`
  )

  // 4. Compression Draco (E2-06)
  if (useDraco) {
    await document.transform(draco())
    console.log('Compression   : Draco appliqué à la géométrie')
  } else if (rawSize > 10 * MB) {
    console.warn(
      '⚠ --no-draco demandé mais GLB > 10 MB : Draco est OBLIGATOIRE (budget taille)'
    )
  } else {
    console.log('Compression   : Draco désactivé (--no-draco)')
  }

  // (E2-07 KTX2 : prévu sprint S5 — aucune texture requise sur le modèle V1.)

  await io.write(output, document)
  const finalSize = statSync(output).size

  // 5. Budget taille (E2-08)
  console.log(`Écriture      : ${output}`)
  console.log(`\nBudget taille (barème CdC, basé sur le GLB brut) :`)
  console.log(`  Taille brute  : ${formatMB(rawSize)}`)
  const deltaPct = Math.round((1 - finalSize / rawSize) * 100)
  const delta =
    deltaPct >= 0
      ? `-${deltaPct}% vs brut`
      : `+${-deltaPct}% vs brut (surcoût Draco, normal sur un petit fichier)`
  console.log(`  Taille finale : ${formatMB(finalSize)} (${delta})`)
  console.log(`  Action requise: ${budgetAction(rawSize)}`)
}

main()
