// Pipeline GLB (E2-01 → E2-08) — cf. HTD_cahier_des_charges.md.
//
//   SketchUp → maison_raw.glb → [ce script] → maison.glb (production-ready)
//
// Étapes : validation des noms de nodes, injection des extras (node + scène),
// compression Draco, compression KTX2 des textures, rapport budget taille.
//
// Usage :
//   node script/process.mjs <input.glb> [output.glb] [--no-draco] [--no-ktx2]
//
// Sortie par défaut : <input> avec le suffixe `_raw` retiré, sinon `<input>.processed.glb`.
// Exit code ≠ 0 si le nommage est invalide ou si le fichier est illisible.

import { statSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression, KHRTextureBasisu } from '@gltf-transform/extensions'
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
    console.error(
      'Usage : node script/process.mjs <input.glb> [output.glb] [--no-draco] [--no-ktx2]'
    )
    process.exit(2)
  }
  const defaultOutput = input.includes('_raw')
    ? input.replace('_raw', '')
    : input.replace(/\.glb$/i, '.processed.glb')
  return {
    input,
    output: output ?? defaultOutput,
    useDraco: !flags.includes('--no-draco'),
    useKtx2: !flags.includes('--no-ktx2'),
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

// --- 4bis. Compression KTX2 des textures (E2-07) ---

// Échec d'encodage toktx : levé pour que le `finally` nettoie le workDir
// temporaire avant que `main` ne logge et quitte avec un code ≠ 0.
class KTX2Error extends Error {}

// L'encodage Basis Universal passe par `toktx` (KTX-Software, outil de
// référence Khronos) : aucun encodeur pur JS n'existe côté gltf-transform.
// S'il n'est pas installé, le pipeline continue avec les textures d'origine
// (le GLB reste valide), avec un avertissement explicite.
function isToktxAvailable() {
  try {
    return spawnSync('toktx', ['--version'], { stdio: 'ignore' }).status === 0
  } catch {
    return false
  }
}

// Les textures couleur (baseColor, émissive) s'encodent en sRGB ; les
// données (normales, métal/rugosité, occlusion…) en linéaire.
function listColorTextures(document) {
  const colorTextures = new Set()
  for (const material of document.getRoot().listMaterials()) {
    for (const texture of [material.getBaseColorTexture(), material.getEmissiveTexture()]) {
      if (texture) colorTextures.add(texture)
    }
  }
  return colorTextures
}

async function compressTexturesKTX2(document) {
  const textures = document.getRoot().listTextures()
  if (textures.length === 0) {
    console.log('Compression   : KTX2 sauté (aucune texture dans le GLB)')
    return
  }
  if (!isToktxAvailable()) {
    console.warn(
      `⚠ ${textures.length} texture(s) présentes mais \`toktx\` introuvable : textures laissées telles quelles.\n` +
        '  Installer KTX-Software pour activer la compression KTX2 :\n' +
        '  https://github.com/KhronosGroup/KTX-Software/releases'
    )
    return
  }

  const colorTextures = listColorTextures(document)
  const workDir = await mkdtemp(join(tmpdir(), 'home3d-ktx2-'))
  let converted = 0
  try {
    for (const [i, texture] of textures.entries()) {
      const mime = texture.getMimeType()
      const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : null
      if (!ext) continue // déjà en KTX2, ou format que toktx ne lit pas
      const input = join(workDir, `tex_${i}.${ext}`)
      const output = join(workDir, `tex_${i}.ktx2`)
      await writeFile(input, texture.getImage())
      const oetf = colorTextures.has(texture) ? 'srgb' : 'linear'
      const result = spawnSync(
        'toktx',
        ['--t2', '--genmipmap', '--encode', 'etc1s', '--assign_oetf', oetf, output, input],
        { encoding: 'utf8' }
      )
      if (result.status !== 0) {
        // On lève plutôt que d'appeler process.exit ici : l'exit couperait
        // le process avant le `finally` et laisserait le workDir temporaire.
        throw new KTX2Error(
          `toktx a échoué sur la texture « ${texture.getName() || i} » :\n${result.stderr}`
        )
      }
      texture.setImage(await readFile(output)).setMimeType('image/ktx2')
      converted += 1
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }

  if (converted > 0) {
    // KHR_texture_basisu : requis pour référencer des images KTX2 en glTF.
    document.createExtension(KHRTextureBasisu).setRequired(true)
    console.log(`Compression   : KTX2 appliqué à ${converted} texture(s) (etc1s via toktx)`)
  }
}

// --- Pipeline ---

async function main() {
  const { input, output, useDraco, useKtx2 } = parseArgs(process.argv.slice(2))

  let rawSize
  try {
    rawSize = statSync(input).size
  } catch {
    console.error(`✗ Fichier introuvable : ${input}`)
    process.exit(2)
  }

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, KHRTextureBasisu])
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

  // 4bis. Compression KTX2 des textures (E2-07)
  if (useKtx2) {
    try {
      await compressTexturesKTX2(document)
    } catch (err) {
      if (err instanceof KTX2Error) {
        console.error(`✗ ${err.message}`)
        process.exit(2)
      }
      throw err
    }
  } else {
    console.log('Compression   : KTX2 désactivé (--no-ktx2)')
  }

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
