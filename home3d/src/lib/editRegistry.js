import * as THREE from 'three'
import { frameOfObjectPlane } from './workPlanes.js'

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

// Oriente et positionne un groupe dans le repère d'un plan de travail (E12-02).
// `plane` porte le CENTRE (`origin`) et le repère (`u`/`v`/`normal`) ; la
// géométrie locale (plan XY de PlaneGeometry) est mappée u→X local, v→Y local,
// normal→Z local. Léger offset le long de la normale pour éviter le z-fighting
// avec le mur/la grille. Rétro-compat sol via frameOfObjectPlane.
function placeOnPlane(group, plane) {
  const { origin, u, v, normal } = frameOfObjectPlane(plane)
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...u),
    new THREE.Vector3(...v),
    new THREE.Vector3(...normal)
  )
  group.quaternion.setFromRotationMatrix(basis)
  group.position.set(...origin).addScaledVector(new THREE.Vector3(...normal), 0.003)
}

// sketch.rect — rectangle d'esquisse sur le plan d'esquisse, optionnellement
// extrudé en volume par Push/Pull (E12-08).
// params : { largeur_m (axe u), profondeur_m (axe v), hauteur_m? (extrusion le
//   long de la normale ; absente ou ~0 → forme plate) }.
// plane : { type, origin:[centre], u, v, normal } (cf. lib/workPlanes).
function generateRect(params, plane) {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const d = Math.max(Number(params.profondeur_m) || 0, 0.001)
  const h = Number(params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001

  // Géométrie locale : u→X, v→Y, normal→Z (cf. placeOnPlane). Pour un solide, on
  // décale d'½ hauteur le long de Z pour que la BASE reste sur le plan d'esquisse.
  let geo
  if (solid) {
    geo = new THREE.BoxGeometry(w, d, Math.abs(h))
    geo.translate(0, 0, (Math.sign(h) * Math.abs(h)) / 2)
  } else {
    geo = new THREE.PlaneGeometry(w, d)
  }

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: FILL_COLOR,
      transparent: true,
      opacity: solid ? 0.5 : 0.35,
      side: THREE.DoubleSide,
      depthWrite: solid,
    })
  )
  fill.name = '__fill'

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: EDGE_COLOR })
  )
  edges.name = '__edges'
  // Décoratif : ne pas raycaster les arêtes — sinon elles interceptent le clic
  // avant le mesh (pas de `face`) et faussent la détection de face du Push/Pull.
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, edges)
  placeOnPlane(group, plane)
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

// Points de référence d'accroche d'un objet app (E12-03, « accroche à tes formes »).
// Renvoie des points MONDE typés (sommet/milieu) que le snapping ajoute à ses
// candidats. Calcul ANALYTIQUE depuis params + repère du plan (pas de lecture de
// géométrie three) → cohérent par construction avec ce que `generateRect` rend.
//   - rectangle plat : 4 coins (endpoint) + 4 milieux d'arête + centre (midpoint) ;
//   - boîte extrudée (hauteur_m) : idem sur la face base ET la face haute, plus le
//     milieu des 4 arêtes verticales.
// `origin` du plan = centre de la face BASE (cf. placeOnPlane/generateRect).
export function referencePoints(obj) {
  if (obj.kind !== 'sketch.rect') return []
  const { origin, u, v, normal } = frameOfObjectPlane(obj.plane)
  const hu = Math.max(Number(obj.params.largeur_m) || 0, 0.001) / 2
  const hv = Math.max(Number(obj.params.profondeur_m) || 0, 0.001) / 2
  const h = Number(obj.params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001

  // Point = origin + su·u + sv·v + sn·normal.
  const at = (su, sv, sn) => [
    origin[0] + u[0] * su + v[0] * sv + normal[0] * sn,
    origin[1] + u[1] * su + v[1] * sv + normal[1] * sn,
    origin[2] + u[2] * su + v[2] * sv + normal[2] * sn,
  ]
  // Une face plane à l'altitude `sn` (le long de la normale) : coins, milieux, centre.
  const face = (sn) => [
    { type: 'endpoint', point: at(-hu, -hv, sn) },
    { type: 'endpoint', point: at(hu, -hv, sn) },
    { type: 'endpoint', point: at(hu, hv, sn) },
    { type: 'endpoint', point: at(-hu, hv, sn) },
    { type: 'midpoint', point: at(0, -hv, sn) },
    { type: 'midpoint', point: at(hu, 0, sn) },
    { type: 'midpoint', point: at(0, hv, sn) },
    { type: 'midpoint', point: at(-hu, 0, sn) },
    { type: 'midpoint', point: at(0, 0, sn) }, // centre
  ]

  const pts = face(0)
  if (solid) {
    pts.push(...face(h))
    // Milieux des arêtes verticales (mi-hauteur).
    pts.push(
      { type: 'midpoint', point: at(-hu, -hv, h / 2) },
      { type: 'midpoint', point: at(hu, -hv, h / 2) },
      { type: 'midpoint', point: at(hu, hv, h / 2) },
      { type: 'midpoint', point: at(-hu, hv, h / 2) }
    )
  }
  return pts
}

// Dimensions dérivées des params (cohérent avec les `dims` V1, E2-10).
export function deriveDims(obj) {
  if (obj.kind === 'sketch.rect') {
    return {
      largeur_m: Number(obj.params.largeur_m) || 0,
      profondeur_m: Number(obj.params.profondeur_m) || 0,
      hauteur_m: Math.abs(Number(obj.params.hauteur_m) || 0),
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
