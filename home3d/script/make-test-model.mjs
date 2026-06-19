// Génère un GLB de test « brut » (équivalent export SketchUp) pour valider
// le pipeline (sprint S2). Mini-maison couvrant les 7 systèmes de calques,
// nodes nommés selon la convention du cahier des charges.
//
// Usage : node script/make-test-model.mjs [output.glb] [--invalid]
//   --invalid : ajoute des nodes mal nommés pour tester le rapport d'erreurs.
//
// Sortie par défaut : public/models/maison_raw.glb

import process from 'node:process'
import { Document, NodeIO } from '@gltf-transform/core'

const args = process.argv.slice(2)
const withInvalid = args.includes('--invalid')
const output = args.find((a) => !a.startsWith('--')) ?? 'public/models/maison_raw.glb'

// Couleurs sRGB par système (alignées sur LAYERS_CONFIG, pour un rendu lisible
// avant même la colorisation par calque de l'app).
const SYSTEM_COLORS = {
  structure: [0.22, 0.54, 0.87],
  ouvertures: [0.11, 0.62, 0.46],
  elec: [0.85, 0.35, 0.19],
  plomberie: [0.5, 0.47, 0.87],
  vmc: [0.73, 0.46, 0.09],
  reseau: [0.66, 0.33, 0.97],
  terrain: [0.3, 0.69, 0.31],
}

// Pavillon de test : [nom de node, position (x,y,z), dimensions (x,y,z) en mètres].
// Repère glTF : Y vers le haut. Dalle 8×6 m, murs h=2.5 m, ép. 0.2 m.
const OBJECTS = [
  ['terrain__jardin__ext__ext__001', [0, -0.05, 0], [20, 0.1, 16]],
  ['structure__dalle__salon__rdc__001', [0, 0.1, 0], [8, 0.2, 6]],
  ['structure__mur_porteur__salon__rdc__001', [0, 1.45, -2.9], [8, 2.5, 0.2]],
  ['structure__mur_porteur__salon__rdc__002', [0, 1.45, 2.9], [8, 2.5, 0.2]],
  ['structure__mur_porteur__salon__rdc__003', [-3.9, 1.45, 0], [0.2, 2.5, 5.6]],
  ['structure__mur_porteur__cuisine__rdc__004', [3.9, 1.45, 0], [0.2, 2.5, 5.6]],
  ['structure__mur_cloison__cuisine__rdc__001', [1, 1.45, 0], [0.1, 2.5, 5.6]],
  ['ouvertures__porte_int__cuisine__rdc__001', [1, 1.25, 1.5], [0.12, 2.1, 0.9]],
  ['ouvertures__fenetre__salon__rdc__001', [-1.5, 1.6, 2.9], [1.2, 1.2, 0.22]],
  ['elec__tableau__garage__rdc__001', [-3.75, 1.5, -1.5], [0.12, 0.5, 0.3]],
  ['elec__prise__salon__rdc__001', [-3.77, 0.4, 1], [0.06, 0.08, 0.08]],
  ['elec__prise__cuisine__rdc__002', [3.77, 0.4, -1], [0.06, 0.08, 0.08]],
  ['plomberie__eau_froide__sdb__rdc__001', [2.5, 0.35, 0], [0.05, 0.05, 5]],
  ['vmc__gaine__rdc__rdc__001', [0, 2.55, 0], [0.16, 0.16, 5.4]],
  ['reseau__rj45__bureau__rdc__001', [-3.77, 0.4, -1], [0.06, 0.08, 0.08]],
]

// Nodes volontairement fautifs pour démontrer le rapport E2-03.
const INVALID_OBJECTS = [
  ['Structure__Mur_Porteur__Salon__RDC__005', [0, 1.45, -3.5], [2, 2.5, 0.2]],
  ['elec__prise__salon__rdc__7', [-3.77, 0.8, 1.5], [0.06, 0.08, 0.08]],
  ['chauffage__radiateur__salon__rdc__001', [-3.7, 0.6, 2], [0.1, 0.6, 1]],
]

// Cube unitaire centré (24 sommets pour des normales correctes par face).
function makeUnitCube(document, buffer) {
  // prettier-ignore
  const positions = new Float32Array([
    -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5, // +Z
     0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5, // -Z
     0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5, // +X
    -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5, // -X
    -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5, // +Y
    -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5, // -Y
  ])
  // prettier-ignore
  const normals = new Float32Array([
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
  ])
  const indices = new Uint16Array(
    [0, 1, 2, 3, 4, 5].flatMap((f) => [
      4 * f,
      4 * f + 1,
      4 * f + 2,
      4 * f,
      4 * f + 2,
      4 * f + 3,
    ])
  )
  return {
    position: document
      .createAccessor()
      .setType('VEC3')
      .setArray(positions)
      .setBuffer(buffer),
    normal: document.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer),
    indices: document
      .createAccessor()
      .setType('SCALAR')
      .setArray(indices)
      .setBuffer(buffer),
  }
}

const document = new Document()
const buffer = document.createBuffer()
const scene = document.createScene('Scene')
document.getRoot().setDefaultScene(scene)
const cube = makeUnitCube(document, buffer)

const materials = Object.fromEntries(
  Object.entries(SYSTEM_COLORS).map(([system, [r, g, b]]) => [
    system,
    document
      .createMaterial(`mat_${system}`)
      .setBaseColorFactor([r, g, b, 1])
      .setRoughnessFactor(0.9)
      .setMetallicFactor(0),
  ])
)

const objects = withInvalid ? [...OBJECTS, ...INVALID_OBJECTS] : OBJECTS
for (const [name, position, size] of objects) {
  const system = name.split('__')[0].toLowerCase()
  const prim = document
    .createPrimitive()
    .setAttribute('POSITION', cube.position)
    .setAttribute('NORMAL', cube.normal)
    .setIndices(cube.indices)
    .setMaterial(materials[system] ?? materials.structure)
  // Reproduit l'arborescence d'un export SketchUp réel (issue #7) : un groupe
  // wrapper nommé selon la convention (sans mesh), contenant la géométrie brute
  // que l'exporteur préfixe `Geom3D_`. Le pipeline doit absorber ce préfixe.
  const mesh = document.createMesh(`Geom3D_${name}`).addPrimitive(prim)
  const geom = document.createNode(`Geom3D_${name}`).setMesh(mesh)
  const wrapper = document
    .createNode(name)
    .setTranslation(position)
    .setScale(size)
    .addChild(geom)
  scene.addChild(wrapper)
}

await new NodeIO().write(output, document)
console.log(
  `Modèle de test écrit : ${output} (${objects.length} objets${withInvalid ? ', dont 3 invalides' : ''})`
)
