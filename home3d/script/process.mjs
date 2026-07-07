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
  collectCandidateNodes,
  computeDims,
  parseNodeName,
  stripExporterPrefix,
  subtypeLabel,
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

// --- 0. Normalisation des noms exportés par SketchUp (issue #7) ---

// L'exporteur glTF natif de SketchUp préfixe `Geom3D_` la géométrie brute de
// chaque groupe nommé. On le retire en amont (sur les nodes ET les meshes) pour
// que la géométrie porte le nom propre du groupe : elle passe alors la
// validation et le GLB de sortie ne garde aucune trace de l'artefact d'export.
// `Geom3D` seul reste tel quel (rejeté).
function normalizeExporterNames(document) {
  let renamed = 0
  for (const named of [
    ...document.getRoot().listNodes(),
    ...document.getRoot().listMeshes(),
  ]) {
    const name = named.getName()
    const stripped = stripExporterPrefix(name)
    if (stripped !== name) {
      named.setName(stripped)
      renamed += 1
    }
  }
  return renamed
}

// Candidats à la convention : sélection tree-aware déléguée à `naming.mjs`
// (dédup par nom, absorption des fragments `Geom3D` par-matériau sous un groupe
// nommé — issue #11). On part des racines de scène pour disposer de la
// hiérarchie (ancêtres) que `listNodes()` à plat ne donne pas.
function listCandidateNodes(document) {
  const roots = document
    .getRoot()
    .listScenes()
    .flatMap((scene) => scene.listChildren())
  return collectCandidateNodes(roots)
}

// --- 1. Validation des noms de nodes (E2-02) + rapport d'erreurs (E2-03) ---

function validateNodes(document) {
  const report = []
  const warnings = []
  const nodes = listCandidateNodes(document)
  for (const node of nodes) {
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
    // E20-02 : vocabulaire de `type` OUVERT — un type hors liste canonique
    // avertit (rapport ciblé) mais ne bloque jamais le pipeline.
    else if (result.warnings.length > 0) warnings.push({ name, warnings: result.warnings })
  }
  return { report, warnings, candidates: nodes.length }
}

function printSubtypeWarnings(warnings) {
  console.warn(`\n⚠ ${warnings.length} node(s) avec un type hors vocabulaire canonique :`)
  for (const { name, warnings: reasons } of warnings) {
    console.warn(`  ${name}`)
    for (const reason of reasons) console.warn(`    – ${reason}`)
  }
  console.warn(
    '  (accepté : le vocabulaire est ouvert — cf. SUBTYPES dans script/naming.mjs ' +
      'pour les types suggérés)\n'
  )
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

// --- 2. Injection des extras par node (E2-04 + dims auto, issue #9) ---

// Scale monde de chaque node = produit des scales depuis la racine de la
// scène. Sert à ramener les bornes locales (pouces côté SketchUp) en mètres :
// le node groupe porte un scale ≈ 0.0254 (1 pouce). On ignore translation et
// rotation : on ne veut que l'encombrement propre de l'élément, pas son
// emprise alignée au monde. Posé sur l'enfant `Geom3D_` comme sur son parent,
// donc le calcul est indépendant de quel node (parent/enfant dédupliqué)
// porte finalement les extras.
function computeWorldScales(document) {
  const scales = new Map()
  const walk = (node, parentScale) => {
    const s = node.getScale()
    const worldScale = [s[0] * parentScale[0], s[1] * parentScale[1], s[2] * parentScale[2]]
    scales.set(node, worldScale)
    for (const child of node.listChildren()) walk(child, worldScale)
  }
  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) walk(node, [1, 1, 1])
  }
  return scales
}

// Bornes POSITION + scale monde de tous les meshes du sous-arbre d'un node.
// Le candidat (groupe SketchUp) ne porte pas le mesh directement : la
// géométrie est sur l'enfant `Geom3D_`. On descend donc tout le sous-arbre et
// on unit toutes les primitives trouvées (élément au sens métier).
function collectDimsParts(node, worldScales) {
  const parts = []
  const walk = (n) => {
    const mesh = n.getMesh()
    if (mesh) {
      const scale = worldScales.get(n) ?? [1, 1, 1]
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION')
        if (!position) continue
        parts.push({ min: position.getMin([]), max: position.getMax([]), scale })
      }
    }
    for (const child of n.listChildren()) walk(child)
  }
  walk(node)
  return parts
}

function injectNodeExtras(document) {
  const worldScales = computeWorldScales(document)
  const levels = new Set()
  const zones = new Set()
  let injected = 0
  for (const node of listCandidateNodes(document)) {
    const parsed = parseNodeName(node.getName())
    levels.add(parsed.level)
    zones.add(parsed.zone)
    // `dims` calculé depuis la bounding box (issue #9) ; material/notes
    // restent vides, réservés à l'édition in-app (E10-02, V2).
    // `subtype`/`subtypeLabel` (E20-02) : le sous-type EST le segment `type` ;
    // le label FR vient du vocabulaire canonique, null si hors liste (ouvert).
    node.setExtras({
      layer: parsed.layer,
      type: parsed.type,
      zone: parsed.zone,
      level: parsed.level,
      index: parsed.index,
      subtype: parsed.type,
      subtypeLabel: subtypeLabel(parsed.layer, parsed.type),
      dims: computeDims(collectDimsParts(node, worldScales)),
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
    for (const texture of [
      material.getBaseColorTexture(),
      material.getEmissiveTexture(),
    ]) {
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
        [
          '--t2',
          '--genmipmap',
          '--encode',
          'etc1s',
          '--assign_oetf',
          oetf,
          output,
          input,
        ],
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
    console.log(
      `Compression   : KTX2 appliqué à ${converted} texture(s) (etc1s via toktx)`
    )
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

  // 0. Normalisation des noms exportés (préfixe `Geom3D_` de SketchUp)
  const renamed = normalizeExporterNames(document)
  if (renamed > 0) {
    console.log(
      `Normalisation : ${renamed} préfixe(s) \`Geom3D_\` retiré(s) (export SketchUp)`
    )
  }

  // 1. Validation
  const { report, warnings, candidates } = validateNodes(document)
  if (report.length > 0) {
    printValidationReport(report)
    process.exit(1)
  }
  console.log(`Validation    : ${candidates} node(s) conformes à la convention`)
  if (warnings.length > 0) printSubtypeWarnings(warnings)

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
