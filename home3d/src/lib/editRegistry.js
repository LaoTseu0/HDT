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

// sketch.circle — disque d'esquisse sur le plan d'esquisse, optionnellement
// extrudé en cylindre par Push/Pull (E12-08).
// params : { rayon_m, hauteur_m? (extrusion le long de la normale) }.
const CIRCLE_SEG = 48

function generateCircle(params, plane) {
  const r = Math.max(Number(params.rayon_m) || 0, 0.001)
  const h = Number(params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001

  // Géométrie locale : disque dans le plan XY (normal→Z). Pour un solide, un
  // cylindre d'axe Z (CylinderGeometry est axé Y → rotation), base sur le plan.
  let geo
  if (solid) {
    geo = new THREE.CylinderGeometry(r, r, Math.abs(h), CIRCLE_SEG)
    geo.rotateX(Math.PI / 2)
    geo.translate(0, 0, (Math.sign(h) * Math.abs(h)) / 2)
  } else {
    geo = new THREE.CircleGeometry(r, CIRCLE_SEG)
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

  // Seuil d'angle élevé : ne garder que les contours (cercles base/haut), pas les
  // segments radiaux/fuseaux du maillage circulaire (sinon une étoile de rayons).
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 30),
    new THREE.LineBasicMaterial({ color: EDGE_COLOR })
  )
  edges.name = '__edges'
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, edges)
  placeOnPlane(group, plane)
  return group
}

// sketch.arc — arc de cercle d'esquisse sur le plan d'esquisse (E13-03),
// optionnellement extrudé en MUR COURBE (ruban) par Push/Pull / hauteur.
// params : { rayon_m, angle_debut_deg, angle_balayage_deg, hauteur_m? }, repère
// u→X/v→Y/normal→Z (cf. placeOnPlane) ; origin = CENTRE du cercle support.
const ARC_FULL_SEG = 96 // segments pour un tour complet (densité du maillage)
const ARC_TUBE_R = 0.025 // rayon du « trait » d'un arc plat (m) — corps cliquable

// Échantillonne l'arc en points LOCAUX [x,y] (z=0) dans le plan XY du repère.
function arcLocalPoints(params) {
  const r = Math.max(Number(params.rayon_m) || 0, 0.001)
  const a0 = (Number(params.angle_debut_deg) || 0) * (Math.PI / 180)
  const sweep = (Number(params.angle_balayage_deg) || 0) * (Math.PI / 180)
  const seg = Math.max(2, Math.ceil((Math.abs(sweep) / (2 * Math.PI)) * ARC_FULL_SEG))
  const pts = []
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (sweep * i) / seg
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts
}

function generateArc(params, plane) {
  const h = Number(params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001
  const pts = arcLocalPoints(params)

  let fillGeo
  let edgeGeo
  if (solid) {
    // Ruban (mur courbe) : 2 anneaux (z=0 et z=h) cousus en quads.
    const z = h
    const position = []
    const index = []
    for (const [x, y] of pts) {
      position.push(x, y, 0, x, y, z)
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const b0 = i * 2
      const t0 = b0 + 1
      const b1 = b0 + 2
      const t1 = b0 + 3
      index.push(b0, b1, t1, b0, t1, t0)
    }
    fillGeo = new THREE.BufferGeometry()
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
    fillGeo.setIndex(index)
    fillGeo.computeVertexNormals()
    // Contours : polylignes base + haut + les deux montants d'extrémité.
    const ep = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[i + 1]
      ep.push(x0, y0, 0, x1, y1, 0, x0, y0, z, x1, y1, z)
    }
    const [xa, ya] = pts[0]
    const [xb, yb] = pts[pts.length - 1]
    ep.push(xa, ya, 0, xa, ya, z, xb, yb, 0, xb, yb, z)
    edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3))
  } else {
    // Plat : « trait » = fin tube le long de l'arc (corps cliquable/visible) ;
    // contour = la polyligne centrale (trait net par-dessus).
    const curve = new THREE.CatmullRomCurve3(
      pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'catmullrom',
      0
    )
    fillGeo = new THREE.TubeGeometry(curve, Math.max(pts.length - 1, 1), ARC_TUBE_R, 6, false)
    const lp = []
    for (const [x, y] of pts) lp.push(x, y, 0)
    edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3))
  }

  const fill = new THREE.Mesh(
    fillGeo,
    new THREE.MeshStandardMaterial({
      color: FILL_COLOR,
      transparent: true,
      opacity: solid ? 0.5 : 0.6,
      side: THREE.DoubleSide,
      depthWrite: solid,
    })
  )
  fill.name = '__fill'

  // Contour = ligne ouverte continue (Line, pas LineSegments) pour le plat ;
  // segments disjoints pour le ruban → LineSegments. On choisit selon `solid`.
  const edges = solid
    ? new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: EDGE_COLOR }))
    : new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: EDGE_COLOR }))
  edges.name = '__edges'
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, edges)
  placeOnPlane(group, plane)
  return group
}

const REGISTRY = {
  'sketch.rect': generateRect,
  'sketch.circle': generateCircle,
  'sketch.arc': generateArc,
}

export function isKnownKind(kind) {
  return kind in REGISTRY
}

// Contrat de nommage par `kind` (E12-06) : système (= calque) + type composant le
// node name conforme `système__type__zone__niveau__index`. La zone/niveau viennent
// de l'inspector, l'index est auto-incrémenté (cf. lib/naming). Les primitives
// d'esquisse de Slice 0 (`sketch.*`) ne relèvent d'aucun système technique : on les
// rattache à `structure` (volume/forme). Les vrais objets MEP/ouvertures des slices
// suivantes déclareront ici leur propre système/type.
const KIND_NAMING = {
  'sketch.rect': { system: 'structure', type: 'forme' },
  'sketch.circle': { system: 'structure', type: 'disque' },
  'sketch.arc': { system: 'structure', type: 'arc' },
}

/** Système/type de nommage d'un `kind` (repli `structure`/`forme`). */
export function kindNaming(kind) {
  return KIND_NAMING[kind] ?? { system: 'structure', type: 'forme' }
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
  if (!isKnownKind(obj.kind)) return []
  const { origin, u, v, normal } = frameOfObjectPlane(obj.plane)
  const h = Number(obj.params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001

  // Point = origin + su·u + sv·v + sn·normal.
  const at = (su, sv, sn) => [
    origin[0] + u[0] * su + v[0] * sv + normal[0] * sn,
    origin[1] + u[1] * su + v[1] * sv + normal[1] * sn,
    origin[2] + u[2] * su + v[2] * sv + normal[2] * sn,
  ]

  if (obj.kind === 'sketch.rect') {
    const hu = Math.max(Number(obj.params.largeur_m) || 0, 0.001) / 2
    const hv = Math.max(Number(obj.params.profondeur_m) || 0, 0.001) / 2
    // Une face plane à l'altitude `sn` : coins, milieux, centre.
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

  if (obj.kind === 'sketch.circle') {
    const r = Math.max(Number(obj.params.rayon_m) || 0, 0.001)
    // Centre + 4 points cardinaux (quadrants) par face.
    const face = (sn) => [
      { type: 'midpoint', point: at(0, 0, sn) }, // centre
      { type: 'endpoint', point: at(r, 0, sn) },
      { type: 'endpoint', point: at(0, r, sn) },
      { type: 'endpoint', point: at(-r, 0, sn) },
      { type: 'endpoint', point: at(0, -r, sn) },
    ]
    const pts = face(0)
    if (solid) pts.push(...face(h))
    return pts
  }

  if (obj.kind === 'sketch.arc') {
    const r = Math.max(Number(obj.params.rayon_m) || 0, 0.001)
    const a0 = (Number(obj.params.angle_debut_deg) || 0) * (Math.PI / 180)
    const sweep = (Number(obj.params.angle_balayage_deg) || 0) * (Math.PI / 180)
    const ang = (a) => [r * Math.cos(a), r * Math.sin(a)]
    const [sx, sy] = ang(a0) // début
    const [mx, my] = ang(a0 + sweep / 2) // milieu de l'arc
    const [ex, ey] = ang(a0 + sweep) // fin
    // Centre + extrémités + milieu de l'arc, par face.
    const face = (sn) => [
      { type: 'midpoint', point: at(0, 0, sn) }, // centre
      { type: 'endpoint', point: at(sx, sy, sn) },
      { type: 'endpoint', point: at(ex, ey, sn) },
      { type: 'midpoint', point: at(mx, my, sn) },
    ]
    const pts = face(0)
    if (solid) pts.push(...face(h))
    return pts
  }

  return []
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
  if (obj.kind === 'sketch.circle') {
    const d = 2 * (Number(obj.params.rayon_m) || 0) // emprise = diamètre (bounding box)
    return {
      largeur_m: d,
      profondeur_m: d,
      hauteur_m: Math.abs(Number(obj.params.hauteur_m) || 0),
    }
  }
  if (obj.kind === 'sketch.arc') {
    // Emprise = bounding box de la polyligne de l'arc dans le plan (u/v).
    const pts = arcLocalPoints(obj.params)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [x, y] of pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return {
      largeur_m: Number((maxX - minX).toFixed(3)),
      profondeur_m: Number((maxY - minY).toFixed(3)),
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
