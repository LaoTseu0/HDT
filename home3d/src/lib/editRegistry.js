import * as THREE from 'three'

// Registre paramétrique d'Edit mode (E12-05, cf. docs/edit-mode-design.md § 5.1).
//
// Couture d'extensibilité : chaque `kind` est associé à une fonction PURE
// `generate(params, plane) → THREE.Object3D`. La géométrie est toujours DÉRIVÉE
// des params (jamais l'inverse) → un objet créé in-app est ré-éditable et
// régénérable au chargement depuis ses `extras.edit`. Ajouter un objet = ajouter
// une entrée ici.
//
// Slice 0 ne porte que des primitives d'esquisse (aucun booléen). D'autres
// `kind` (opening.window, elec.outlet, mep.run…) viendront aux slices suivantes.

const FILL_COLOR = 0x378add
const EDGE_COLOR = 0x8fc7ff

// sketch.rect — rectangle posé à plat sur un plan de sol (XZ).
// params : { largeur_m (X), profondeur_m (Z) }. plane : { type:'ground', origin:[x,y,z] }.
function generateRect(params, plane) {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const d = Math.max(Number(params.profondeur_m) || 0, 0.001)

  const geo = new THREE.PlaneGeometry(w, d)
  geo.rotateX(-Math.PI / 2) // du plan XY de PlaneGeometry vers le plan de sol XZ

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: FILL_COLOR,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  )
  fill.name = '__fill'

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: EDGE_COLOR })
  )
  edges.name = '__edges'

  const group = new THREE.Group()
  group.add(fill, edges)

  const [ox, oy, oz] = plane.origin ?? [0, 0, 0]
  group.position.set(ox, oy + 0.003, oz) // léger offset anti z-fighting avec la grille
  return group
}

const REGISTRY = {
  'sketch.rect': generateRect,
}

export function isKnownKind(kind) {
  return kind in REGISTRY
}

// Génère l'Object3D d'un objet app. Le tag son id sur le groupe et ses enfants
// pour que le raycast de sélection remonte à l'objet métier.
export function generateObject(obj) {
  const gen = REGISTRY[obj.kind]
  if (!gen) return null
  const object3d = gen(obj.params, obj.plane)
  object3d.name = obj.id
  object3d.userData.appObjectId = obj.id
  object3d.traverse((child) => {
    child.userData.appObjectId = obj.id
  })
  return object3d
}

// Dimensions dérivées des params (cohérent avec les `dims` V1, E2-10).
export function deriveDims(obj) {
  if (obj.kind === 'sketch.rect') {
    return {
      largeur_m: Number(obj.params.largeur_m) || 0,
      profondeur_m: Number(obj.params.profondeur_m) || 0,
      hauteur_m: 0,
    }
  }
  return null
}

// Libère géométries et matériaux d'un Object3D généré (à l'unmount / régénération).
export function disposeObject(object3d) {
  object3d.traverse((child) => {
    child.geometry?.dispose()
    const material = child.material
    if (Array.isArray(material)) material.forEach((m) => m.dispose())
    else material?.dispose()
  })
}
