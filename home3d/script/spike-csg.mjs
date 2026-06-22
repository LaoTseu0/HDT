// Spike CSG « vrai trou de fenêtre » — dérisquage V2, Slice 1 / E14-02.
// Suite de spike-solidity.mjs : au lieu de juste analyser la topologie, on
// PERCE réellement le bloc structure avec three-bvh-csg et on mesure le trou.
//
// Question tranchée : peut-on garder le workflow « maison en un seul bloc »
// (non-manifold) pour le booléen fenêtre, ou faut-il pré-nettoyer / modéliser
// les murs en solides séparés ?
//
// On teste DEUX entrées pour isoler l'effet d'un simple pré-nettoyage :
//   A. soupe brute (telle qu'exportée par SketchUp, sommets non soudés) ;
//   B. soupe soudée (mergeVertices 0.1 mm — le pré-nettoyage minimal).
//
// Mesures par test : triangles avant/après, trou réellement présent
// (raycast au centre de l'ouverture → doit traverser), mur intact autour
// (raycast en couronne → doit toucher), et dégradation topologique du résultat.
//
// Usage : node script/spike-csg.mjs [fichier.glb]

import process from 'node:process'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression, KHRTextureBasisu } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { parseNodeName, stripExporterPrefix, validateNodeName } from './naming.mjs'

// BVH accéléré pour les raycasts de vérification.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

const WIN = { largeur: 1.2, hauteur: 1.0, allege: 0.9 } // m (E14-01)
const WELD_TOL = 1e-4

// --- Extraction : soupe de triangles du calque structure, en mètres/Y-up ---

function bakeStructureGeometry(document) {
  const scenes = document.getRoot().listScenes()
  const scene = document.getRoot().getDefaultScene() ?? scenes[0]
  const out = []
  const tmp = new THREE.Vector3()
  const walk = (node, parentWorld, underStruct) => {
    const local = new THREE.Matrix4().fromArray(node.getMatrix())
    const world = new THREE.Matrix4().multiplyMatrices(parentWorld, local)
    const name = stripExporterPrefix(node.getName())
    const isStruct =
      underStruct ||
      (validateNodeName(name).valid && parseNodeName(name).layer === 'structure')
    const mesh = node.getMesh()
    if (mesh && isStruct) {
      for (const prim of mesh.listPrimitives()) {
        const posAcc = prim.getAttribute('POSITION')
        if (!posAcc) continue
        const pos = posAcc.getArray()
        const idxAcc = prim.getIndices()
        const idx = idxAcc
          ? idxAcc.getArray()
          : Uint32Array.from({ length: posAcc.getCount() }, (_, i) => i)
        for (let i = 0; i < idx.length; i++) {
          const j = idx[i] * 3
          tmp.set(pos[j], pos[j + 1], pos[j + 2]).applyMatrix4(world)
          out.push(tmp.x, tmp.y, tmp.z)
        }
      }
    }
    for (const child of node.listChildren()) walk(child, world, isStruct)
  }
  for (const node of scene.listChildren()) walk(node, new THREE.Matrix4(), false)

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  geom.computeVertexNormals()
  return geom
}

// --- Stat topologique d'un résultat (boundary / non-manifold) ---

function manifoldStats(geom) {
  const pos = geom.attributes.position.array
  const index = geom.index ? geom.index.array : null
  const triCount = (index ? index.length : pos.length / 3) / 3
  const q = (x) => Math.round(x / WELD_TOL)
  const map = new Map()
  const vid = (i) => {
    const k = `${q(pos[i * 3])},${q(pos[i * 3 + 1])},${q(pos[i * 3 + 2])}`
    let v = map.get(k)
    if (v === undefined) map.set(k, (v = map.size))
    return v
  }
  const edge = new Map()
  for (let t = 0; t < triCount; t++) {
    const a = vid(index ? index[t * 3] : t * 3)
    const b = vid(index ? index[t * 3 + 1] : t * 3 + 1)
    const c = vid(index ? index[t * 3 + 2] : t * 3 + 2)
    for (const [x, y] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      if (x === y) continue
      const key = x < y ? `${x}_${y}` : `${y}_${x}`
      edge.set(key, (edge.get(key) ?? 0) + 1)
    }
  }
  let boundary = 0
  let nonManifold = 0
  for (const n of edge.values()) {
    if (n === 1) boundary++
    else if (n > 2) nonManifold++
  }
  return { triCount, boundary, nonManifold }
}

// --- Placement de l'ouverture : trouver une portion de mur pleine ---

const raycaster = new THREE.Raycaster()
raycaster.firstHitOnly = false

// Matériau double-face : le raycast doit voir les faces de SORTIE des murs
// (la face arrière), sinon on ne mesure jamais l'épaisseur. Sans ça, une
// géométrie propre (normales cohérentes) ne renvoie que la face d'entrée.
const RAY_MAT = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
function rayMesh(geom) {
  return new THREE.Mesh(geom, RAY_MAT)
}

function hitsAlong(mesh, origin, dir, far = 50) {
  raycaster.set(origin, dir)
  raycaster.far = far
  return raycaster.intersectObject(mesh, false)
}

// Cherche, sur les faces axiales du bbox, TOUTES les fenêtres dont l'emprise
// (grille 3×3) tombe sur du mur plein. Renvoie une liste de repères de découpe.
function findOpenings(mesh, bbox, max = 8) {
  const found = []
  const center = bbox.getCenter(new THREE.Vector3())
  const halfW = WIN.largeur / 2
  const yCenter = bbox.min.y + WIN.allege + WIN.hauteur / 2
  const halfH = WIN.hauteur / 2

  // Faces candidates : on tire vers +axe depuis l'extérieur du bbox.
  const faces = [
    { axis: 'z', dir: new THREE.Vector3(0, 0, 1), start: bbox.min.z - 1, uAxis: 'x' },
    { axis: 'z', dir: new THREE.Vector3(0, 0, -1), start: bbox.max.z + 1, uAxis: 'x' },
    { axis: 'x', dir: new THREE.Vector3(1, 0, 0), start: bbox.min.x - 1, uAxis: 'z' },
    { axis: 'x', dir: new THREE.Vector3(-1, 0, 0), start: bbox.max.x + 1, uAxis: 'z' },
  ]

  for (const face of faces) {
    const uMin = face.uAxis === 'x' ? bbox.min.x : bbox.min.z
    const uMax = face.uAxis === 'x' ? bbox.max.x : bbox.max.z
    // Balayage de la position latérale le long de la face.
    for (let u = uMin + halfW + 0.3; u <= uMax - halfW - 0.3; u += 0.5) {
      const probe = (du, dv) => {
        const o = new THREE.Vector3()
        const uVal = u + du
        const yVal = yCenter + dv
        if (face.uAxis === 'x') o.set(uVal, yVal, 0)
        else o.set(0, yVal, uVal)
        o[face.axis === 'z' ? 'z' : 'x'] = face.start
        return hitsAlong(mesh, o, face.dir)
      }
      // Grille 3×3 sur l'emprise de la fenêtre.
      let ok = true
      let frontDist = Infinity
      const slabs = [] // épaisseur de la DALLE de façade par rayon (front→face arrière proche)
      for (const du of [-halfW * 0.8, 0, halfW * 0.8]) {
        for (const dv of [-halfH * 0.8, 0, halfH * 0.8]) {
          const hits = probe(du, dv)
          if (hits.length < 2) {
            ok = false
            break
          }
          frontDist = Math.min(frontDist, hits[0].distance)
          // Épaisseur du mur de façade = écart front → 1re face arrière au-delà
          // d'un seuil anti-coïncidence (faces internes superposées de SketchUp).
          const back = hits.find((h) => h.distance - hits[0].distance > 0.02)
          if (back) slabs.push(back.distance - hits[0].distance)
        }
        if (!ok) break
      }
      if (!ok || slabs.length === 0) continue
      // La façade est la plus fine épaisseur cohérente (pas un mur intérieur lointain).
      const thickness = Math.min(...slabs)
      if (thickness > 0.6) continue // > 60 cm : ce n'est pas une simple cloison de façade

      // Centre de l'ouverture au milieu de l'épaisseur du mur de façade.
      const o0 = new THREE.Vector3()
      if (face.uAxis === 'x') o0.set(u, yCenter, 0)
      else o0.set(0, yCenter, u)
      o0[face.axis === 'z' ? 'z' : 'x'] = face.start
      const frontPoint = o0.clone().addScaledVector(face.dir, frontDist)
      const cutCenter = frontPoint.clone().addScaledVector(face.dir, thickness / 2)

      found.push({ face, cutCenter, thickness, frontDist, u, yCenter, center })
      if (found.length >= max) return found
    }
  }
  return found
}

// --- Construction de la boîte de découpe ---

function buildCutBox(opening) {
  const depth = opening.thickness + 0.1 // juste de quoi percer la dalle de façade
  const sizeX = opening.face.uAxis === 'x' ? WIN.largeur : depth
  const sizeZ = opening.face.uAxis === 'x' ? depth : WIN.largeur
  const box = new THREE.BoxGeometry(sizeX, WIN.hauteur, sizeZ)
  box.translate(opening.cutCenter.x, opening.cutCenter.y, opening.cutCenter.z)
  box.computeVertexNormals()
  return box
}

// --- Vérification du trou par raycast ---

function checkHole(mesh, opening) {
  const { face, cutCenter, frontDist, thickness } = opening
  const halfW = WIN.largeur / 2
  const halfH = WIN.hauteur / 2
  // On ne regarde QUE la dalle de façade : une touche dans la bande
  // [front, front+épaisseur] = mur encore là ; aucune = percé. Les murs
  // intérieurs plus loin sur le rayon ne comptent pas.
  const bandMin = frontDist - 0.05
  const bandMax = frontDist + thickness + 0.05

  const hitsFront = (du, dv) => {
    const o = new THREE.Vector3().copy(cutCenter)
    o.y = cutCenter.y + dv
    if (face.uAxis === 'x') o.x = opening.u + du
    else o.z = opening.u + du
    o[face.axis] = face.start
    return hitsAlong(mesh, o, face.dir).some(
      (h) => h.distance >= bandMin && h.distance <= bandMax
    )
  }

  // Intérieur de l'ouverture : la façade doit être percée (0 touche).
  let insideHits = 0
  let insideRays = 0
  for (const du of [-halfW * 0.6, 0, halfW * 0.6]) {
    for (const dv of [-halfH * 0.6, 0, halfH * 0.6]) {
      insideRays++
      if (hitsFront(du, dv)) insideHits++
    }
  }
  // Couronne autour : la façade doit rester (toujours une touche). Juste à
  // côté de l'ouverture pour rester sur le mur (pas au-delà de son bord).
  let aroundHits = 0
  let aroundRays = 0
  for (const du of [-halfW - 0.15, halfW + 0.15]) {
    for (const dv of [-halfH * 0.6, 0, halfH * 0.6]) {
      aroundRays++
      if (hitsFront(du, dv)) aroundHits++
    }
  }
  return { insideHits, insideRays, aroundHits, aroundRays }
}

// --- Un test CSG complet sur une géométrie de mur donnée ---

function runCsg(label, wallGeom, opening) {
  const evaluator = new Evaluator()
  evaluator.useGroups = false
  evaluator.attributes = ['position', 'normal']

  const wallBrush = new Brush(wallGeom)
  wallBrush.updateMatrixWorld()
  const boxBrush = new Brush(buildCutBox(opening))
  boxBrush.updateMatrixWorld()

  const t0 = Date.now()
  let result
  try {
    result = evaluator.evaluate(wallBrush, boxBrush, SUBTRACTION)
  } catch (err) {
    return { label, error: err.message }
  }
  const ms = Date.now() - t0

  const resGeom = result.geometry
  const resMesh = rayMesh(resGeom)
  const hole = checkHole(resMesh, opening)
  const before = manifoldStats(wallGeom)
  const after = manifoldStats(resGeom)

  return { label, ms, before, after, hole }
}

function printTest(t) {
  console.log(`\n■ ${t.label}`)
  if (t.error) {
    console.log(`  ❌ CSG a levé une exception : ${t.error}`)
    return false
  }
  const holeOpen = t.hole.insideHits === 0
  const wallKept = t.hole.aroundHits === t.hole.aroundRays
  const explosion = (t.after.triCount / t.before.triCount).toFixed(2)
  console.log(`  durée            : ${t.ms} ms`)
  console.log(
    `  triangles        : ${t.before.triCount} → ${t.after.triCount} (×${explosion})`
  )
  console.log(
    `  trou (intérieur) : ${t.hole.insideHits}/${t.hole.insideRays} rayons touchent ` +
      `${holeOpen ? '→ ✅ traversé (trou présent)' : '→ ❌ pas de trou'}`
  )
  console.log(
    `  mur (couronne)   : ${t.hole.aroundHits}/${t.hole.aroundRays} rayons touchent ` +
      `${wallKept ? '→ ✅ mur conservé' : '→ ⚠️ mur abîmé autour'}`
  )
  console.log(
    `  topologie résultat: bord ${t.before.boundary}→${t.after.boundary} · ` +
      `non-manifold ${t.before.nonManifold}→${t.after.nonManifold}`
  )
  return holeOpen && wallKept
}

// Contrôle : un mur-boîte parfaitement watertight (manifold). Sert à prouver
// que le harnais SAIT produire un trou propre — donc qu'un échec sur un vrai
// export vient bien de la topologie du modèle, pas du script.
function selftestGeometry() {
  const box = new THREE.BoxGeometry(4, 2.6, 0.2) // 4 m × 2,6 m × 20 cm
  box.translate(0, 1.3, 0) // pose au sol : min.y = 0
  box.computeVertexNormals()
  return box
}

async function main() {
  const arg = process.argv[2]
  const selftest = arg === '--selftest'
  const input = selftest ? null : (arg ?? 'public/models/maison_raw.glb')

  console.log(
    `\nSpike CSG « vrai trou de fenêtre » — ${selftest ? 'CONTRÔLE (mur-boîte watertight)' : input}`
  )
  console.log(
    `Fenêtre : ${WIN.largeur}×${WIN.hauteur} m, allège ${WIN.allege} m\n${'─'.repeat(64)}`
  )

  let rawGeom
  if (selftest) {
    rawGeom = selftestGeometry()
  } else {
    const io = new NodeIO()
      .registerExtensions([KHRDracoMeshCompression, KHRTextureBasisu])
      .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
    const document = await io.read(input)
    rawGeom = bakeStructureGeometry(document)
  }
  rawGeom.computeBoundingBox()
  const bbox = rawGeom.boundingBox

  // Placement de l'ouverture sur la version soudée (raycast fiable).
  const weldedGeom = mergeVertices(rawGeom, WELD_TOL)
  weldedGeom.computeVertexNormals()
  weldedGeom.computeBoundsTree()
  const placerMesh = rayMesh(weldedGeom)
  const openings = findOpenings(placerMesh, bbox)

  if (openings.length === 0) {
    console.log(
      '❌ Impossible de trouver une portion de mur pleine pour poser la fenêtre.\n' +
        '   (modèle trop atypique ou orientation non axiale — à investiguer)'
    )
    process.exit(0)
  }
  console.log(`${openings.length} emplacement(s) de fenêtre candidats trouvés.`)

  // 1) Sur le 1er emplacement : brut vs soudé, pour isoler l'effet d'un weld.
  const first = openings[0]
  console.log(
    `\n1er emplacement (face ${first.face.axis}=${first.face.start.toFixed(2)}, ` +
      `mur ≈ ${(first.thickness * 100).toFixed(0)} cm) — brut vs soudé :`
  )
  const tests = [
    runCsg('A. soupe BRUTE (export SketchUp tel quel)', rawGeom, first),
    runCsg('B. soupe SOUDÉE (mergeVertices 0,1 mm)', weldedGeom, first),
  ]
  const passed = tests.map(printTest)

  if (selftest) {
    console.log(`\n${'─'.repeat(64)}`)
    console.log(
      passed[0]
        ? '✅ CONTRÔLE OK : le harnais perce un trou propre sur un mur watertight.\n' +
            '   → un échec sur un vrai export vient donc bien de SA topologie, pas du script.'
        : '⁉️ CONTRÔLE EN ÉCHEC : le harnais ne perce même pas un mur propre — bug à corriger.'
    )
    return
  }

  // 2) Balayage de TOUS les emplacements (sur le bloc soudé) → taux de réussite.
  console.log(
    `\nBalayage des ${openings.length} emplacements (trou traversant + mur conservé) :`
  )
  let clean = 0
  for (const [i, op] of openings.entries()) {
    const r = runCsg('x', weldedGeom, op)
    const ok =
      !r.error && r.hole.insideHits === 0 && r.hole.aroundHits === r.hole.aroundRays
    if (ok) clean++
    const tag = r.error
      ? `exception (${r.error})`
      : `trou ${r.hole.insideRays - r.hole.insideHits}/${r.hole.insideRays}, ` +
        `mur ${r.hole.aroundHits}/${r.hole.aroundRays}, ` +
        `bord ${r.after.boundary}, ×${(r.after.triCount / r.before.triCount).toFixed(2)}`
    console.log(
      `  #${i + 1} ${op.face.axis}=${op.face.start.toFixed(1)} : ${ok ? '✅' : '❌'} ${tag}`
    )
  }
  const rate = Math.round((clean / openings.length) * 100)

  console.log(`\n${'─'.repeat(64)}`)
  console.log(`Trous traversants nets : ${clean}/${openings.length} (${rate} %).`)
  if (rate >= 80) {
    console.log(
      '🟢 VERDICT : le CSG perce un vrai trou de façon fiable, même sur le bloc.\n' +
        '   → workflow « maison en un seul bloc » TENABLE pour les fenêtres. Garder\n' +
        '     une passe weld + le fallback E14-03 pour les cas dégénérés (topologie sale).'
    )
  } else if (rate >= 40) {
    console.log(
      '🟡 VERDICT : le CSG marche PARFOIS sur le bloc (résultats irréguliers).\n' +
        '   → fallback E14-03 indispensable ; envisager murs en solides séparés\n' +
        '     pour les façades où l’on veut vraiment des fenêtres.'
    )
  } else {
    console.log(
      '🟠 VERDICT : le CSG échoue le plus souvent sur ce bloc non-manifold.\n' +
        '   → modéliser les murs porteurs en solides séparés pour les fenêtres ;\n' +
        '     fallback E14-03 obligatoire en attendant.'
    )
  }
}

main()
