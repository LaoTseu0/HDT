// Spike « murs solides ? » — dérisquage V2 (cf. docs/edit-mode-design.md § 6.1).
//
// Vérifie qu'un export SketchUp passé au pipeline donne des murs exploitables
// comme VOLUMES (fermés / manifold), prérequis commun à :
//   - le booléen CSG des fenêtres (Slice 1, E14-02) — percer un trou suppose un
//     solide fermé en entrée ;
//   - la collision capsule du mode visite Niveau 2 (E17-05) — une capsule qui
//     traverse une simple surface plane n'est pas arrêtée de façon fiable.
//
// Analyse, par mesh du calque `structure`, la topologie une fois les sommets
// coïncidents soudés (SketchUp dédouble les sommets par face à l'export) :
//   - arêtes de bord (utilisées par 1 triangle)   → surface ouverte (pas un volume)
//   - arêtes non-manifold (utilisées par > 2 tri.) → topologie sale
//   - watertight = toutes les arêtes partagées par exactement 2 triangles.
//
// Usage : node script/spike-solidity.mjs <fichier.glb>

import process from 'node:process'
import { NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression, KHRTextureBasisu } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { parseNodeName, stripExporterPrefix, validateNodeName } from './naming.mjs'

const WELD_TOLERANCE = 1e-4 // m — sommets plus proches que ça = un seul sommet

function quantize(x) {
  return Math.round(x / WELD_TOLERANCE)
}

// Soude les sommets coïncidents : map index original → index de sommet soudé,
// par clé de position quantifiée. Indispensable avant toute analyse d'arêtes
// (sinon chaque face a ses propres sommets et aucune arête n'est « partagée »).
function weldVertices(positionArray) {
  const map = new Map()
  const remap = new Int32Array(positionArray.length / 3)
  let next = 0
  for (let i = 0; i < remap.length; i++) {
    const x = positionArray[i * 3]
    const y = positionArray[i * 3 + 1]
    const z = positionArray[i * 3 + 2]
    const key = `${quantize(x)},${quantize(y)},${quantize(z)}`
    let welded = map.get(key)
    if (welded === undefined) {
      welded = next++
      map.set(key, welded)
    }
    remap[i] = welded
  }
  return { remap, weldedCount: next }
}

function analyzePrimitive(prim) {
  const position = prim.getAttribute('POSITION')
  const positionArray = position.getArray()
  const indexAcc = prim.getIndices()
  // Sans indices : triangles implicites (0,1,2),(3,4,5)…
  const indices = indexAcc
    ? indexAcc.getArray()
    : Uint32Array.from({ length: position.getCount() }, (_, i) => i)

  const { remap, weldedCount } = weldVertices(positionArray)
  const triCount = indices.length / 3

  // Compte d'usage par arête non orientée (paire de sommets soudés triée).
  const edgeUse = new Map()
  const bumpEdge = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`
    edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1)
  }
  let degenerate = 0
  for (let t = 0; t < triCount; t++) {
    const a = remap[indices[t * 3]]
    const b = remap[indices[t * 3 + 1]]
    const c = remap[indices[t * 3 + 2]]
    if (a === b || b === c || c === a) {
      degenerate++ // triangle aplati après soudure : 2 sommets confondus
      continue
    }
    bumpEdge(a, b)
    bumpEdge(b, c)
    bumpEdge(c, a)
  }

  let boundary = 0
  let nonManifold = 0
  const hist = {} // usage d'arête → nombre d'arêtes (2 = manifold, 4 = cloison qui traverse…)
  for (const count of edgeUse.values()) {
    hist[count] = (hist[count] ?? 0) + 1
    if (count === 1) boundary++
    else if (count > 2) nonManifold++
  }

  return {
    rawVerts: position.getCount(),
    weldedVerts: weldedCount,
    triangles: triCount,
    degenerate,
    edges: edgeUse.size,
    boundary,
    nonManifold,
    hist,
    watertight: boundary === 0 && nonManifold === 0,
  }
}

// Tous les meshes du sous-arbre d'un node (la géométrie est sur l'enfant).
function collectPrimitives(node) {
  const prims = []
  const walk = (n) => {
    const mesh = n.getMesh()
    if (mesh) prims.push(...mesh.listPrimitives())
    for (const child of n.listChildren()) walk(child)
  }
  walk(node)
  return prims
}

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage : node script/spike-solidity.mjs <fichier.glb>')
    process.exit(2)
  }

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, KHRTextureBasisu])
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    })

  const document = await io.read(input)

  console.log(`\nSpike « murs solides ? » — ${input}\n${'─'.repeat(60)}`)

  // Dédup par nom : après export, le groupe SketchUp et sa géométrie partagent
  // le même nom (préfixe `Geom3D_` retiré) → on n'analyse l'élément qu'une fois.
  // `stripExporterPrefix` permet aussi de tourner sur un export BRUT (pré-pipeline).
  const seen = new Set()
  const structureNodes = []
  for (const node of document.getRoot().listNodes()) {
    const name = stripExporterPrefix(node.getName())
    if (!name || !validateNodeName(name).valid) continue
    if (parseNodeName(name).layer !== 'structure') continue
    if (seen.has(name)) continue
    seen.add(name)
    structureNodes.push({ node, name })
  }

  if (structureNodes.length === 0) {
    console.log('Aucun node `structure` valide trouvé.')
    process.exit(0)
  }

  let solids = 0
  for (const { node, name } of structureNodes) {
    const prims = collectPrimitives(node)
    const stats = prims.map(analyzePrimitive)
    const triangles = stats.reduce((s, p) => s + p.triangles, 0)
    const degenerate = stats.reduce((s, p) => s + p.degenerate, 0)
    const boundary = stats.reduce((s, p) => s + p.boundary, 0)
    const nonManifold = stats.reduce((s, p) => s + p.nonManifold, 0)
    const hist = {}
    for (const p of stats)
      for (const [k, v] of Object.entries(p.hist)) hist[k] = (hist[k] ?? 0) + v
    // Un node est « solide » si chacune de ses primitives est watertight.
    const watertight = stats.length > 0 && stats.every((p) => p.watertight)
    if (watertight) solids++

    const verdict = watertight
      ? '✅ SOLIDE (watertight)'
      : boundary > 0 && nonManifold === 0
        ? '⚠️  SURFACE OUVERTE (arêtes de bord → pas un volume fermé)'
        : '❌ TOPOLOGIE SALE (arêtes non-manifold)'

    const histStr = Object.entries(hist)
      .sort((a, b) => a[0] - b[0])
      .map(([usage, n]) => `${usage}→${n}`)
      .join(' ')
    console.log(`\n${name}`)
    console.log(
      `  ${triangles} tri (${degenerate} dégénérés) · arêtes bord=${boundary} · non-manifold=${nonManifold}`
    )
    console.log(`  arêtes par usage : ${histStr}`)
    console.log(`  ${verdict}`)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Bilan : ${solids}/${structureNodes.length} node(s) structure « solides ».`)
  if (solids === structureNodes.length) {
    console.log('→ Booléen CSG (fenêtres) et collision de visite : terrain favorable.')
  } else {
    console.log(
      '→ Au moins un mur n’est pas un volume fermé : prévoir le fallback CSG\n' +
        '  « pose en surface sans trou » (E14-03) et tester la collision sur ces cas.'
    )
  }
}

main()
