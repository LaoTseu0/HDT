import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { frameOfObjectPlane } from './workPlanes.js'
import { ELEC_COMPONENTS, ELEC_KINDS, isElecKind } from './elec.js'
import { runRings } from './routing.js'
import { CABLE_KIND } from './cable.js'
import { PIPE_KIND } from './plumbing.js'
import { JOINERY_KIND, DOOR_LEAF_KIND, joineryVariantOf } from './joinery.js'
import { WINDOW_KIND, DOOR_KIND, isOpeningKind } from './opening.js'

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

// opening.window — ouverture (fenêtre) posée sur une face de mur (E14-01).
// params : { largeur_m (axe u), hauteur_m (axe v, depuis le seuil), allege_m }.
// plane.origin = CENTRE DU SEUIL ; la géométrie monte de v=0 à v=hauteur (cf.
// lib/opening). Rendu = cadre translucide teinté « ouvertures » posé sur le mur
// (marqueur) ; le VRAI vide (CSG) viendra en E14-02.
const OPENING_FILL = 0x2ec4b6
const OPENING_EDGE = 0x9be7df

function generateOpening(params, plane) {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const h = Math.max(Number(params.hauteur_m) || 0, 0.001)

  // Géométrie locale : u→X, v→Y, normal→Z. Rectangle centré puis remonté d'½ h
  // pour que sa BASE (le seuil) soit à v=0 (= origin).
  const geo = new THREE.PlaneGeometry(w, h)
  geo.translate(0, h / 2, 0)

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: OPENING_FILL,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  )
  fill.name = '__fill'

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: OPENING_EDGE })
  )
  edges.name = '__edges'
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, edges)
  placeOnPlane(group, plane)
  return group
}

// joinery.frame — menuiserie (cadre + vitrage) posée DANS une ouverture (E14-05,
// cf. lib/joinery). params : { largeur_m (u), hauteur_m (v) — copiés de l'hôte à
// la pose —, epaisseur_m (section des montants), profondeur_m (dormant, le long
// de la normale), variante (E14-06 : fixe/battant/coulissant, repli fixe) }.
// plane = celui de l'ouverture hôte (origin = CENTRE DU SEUIL, géométrie de v=0
// à v=hauteur comme generateOpening) + `hostOf`. Composant posé (catégorie ①),
// AUCUN booléen : le cadre est ENCASTRÉ dans le vide creusé par l'ouverture
// (z ∈ [-profondeur, 0], face avant affleurant la face du mur).
const JOINERY_FILL = 0x1d9e75 // couleur du calque `ouvertures` (script/naming.mjs)
const JOINERY_EDGE = 0x9be7df
const GLASS_FILL = 0xbfe3f2
const GLASS_T = 0.008 // épaisseur du vitrage (m)

function generateJoinery(params, plane) {
  const w = Math.max(Number(params.largeur_m) || 0, 0.05)
  const h = Math.max(Number(params.hauteur_m) || 0, 0.05)
  // Section des montants bornée : au moins 1 cm, et jamais au point de fermer le
  // jour (il reste une baie vitrée d'au moins ~1 cm).
  const t = Math.min(
    Math.max(Number(params.epaisseur_m) || 0, 0.01),
    (Math.min(w, h) - 0.01) / 2
  )
  const d = Math.max(Number(params.profondeur_m) || 0, 0.01)
  const zc = -d / 2 // encastré : face avant à z=0 (plan du mur), corps vers le vide
  const variante = joineryVariantOf(params.variante)

  // Cadre = 2 traverses + 2 montants (boîtes locales u→X, v→Y, normal→Z),
  // fusionnés en UNE géométrie → un seul mesh `__fill` (sélection/émissif
  // d'EditObject uniformes sur tout le cadre). `bd`/`cz` optionnels : les pièces
  // des variantes (meneau, montants de recouvrement) ont leur propre profondeur/
  // position le long de la normale.
  const bar = (bw, bh, cx, cy, bd = d, cz = zc) => {
    const g = new THREE.BoxGeometry(bw, bh, bd)
    g.translate(cx, cy, cz)
    return g
  }
  const frameParts = [
    bar(w, t, 0, t / 2), // traverse basse (seuil)
    bar(w, t, 0, h - t / 2), // traverse haute
    bar(t, h - 2 * t, -(w - t) / 2, h / 2), // montant gauche
    bar(t, h - 2 * t, (w - t) / 2, h / 2), // montant droit
  ]

  // Vitrage(s) : fine(s) plaque(s) translucide(s) dans le jour du cadre, selon la
  // variante (E14-06). Jour = u ∈ ±(w/2 − t), v ∈ [t, h − t].
  const jourW = w - 2 * t
  const jourH = h - 2 * t
  const pane = (pw, cx, cz = zc) => {
    const g = new THREE.BoxGeometry(Math.max(pw, 0.001), jourH, GLASS_T)
    g.translate(cx, h / 2, cz)
    return g
  }
  const glassParts = []
  if (variante === 'battant') {
    // Meneau central + un vitrage par vantail (2 panneaux côte à côte).
    frameParts.push(bar(t, jourH, 0, h / 2))
    const pw = (w - 3 * t) / 2
    glassParts.push(pane(pw, -(w - t) / 4), pane(pw, (w - t) / 4))
  } else if (variante === 'coulissant') {
    // 2 vantaux sur rails décalés le long de la normale : chacun = vitrage d'une
    // demi-baie (+ recouvrement central de t) porté par son montant de
    // recouvrement — les deux montants se croisent au centre, sur des plans
    // différents (lecture immédiate du coulissant). Décalage borné pour rester
    // dans le dormant même à faible profondeur.
    const dz = Math.min(GLASS_T, d / 4)
    const dv = Math.min(d / 2, 0.04) // profondeur d'un montant de vantail
    const pw = (w - t) / 2
    frameParts.push(bar(t, jourH, 0, h / 2, dv, zc + dz)) // montant vantail avant
    frameParts.push(bar(t, jourH, 0, h / 2, dv, zc - dz)) // montant vantail arrière
    glassParts.push(pane(pw, -(w - 3 * t) / 4, zc + dz), pane(pw, (w - 3 * t) / 4, zc - dz))
  } else {
    // fixe (rendu E14-05) : un seul vitrage plein jour.
    glassParts.push(pane(jourW, 0))
  }

  const frameGeo = mergeGeometries(frameParts)

  const fill = new THREE.Mesh(
    frameGeo,
    new THREE.MeshStandardMaterial({ color: JOINERY_FILL, metalness: 0.1, roughness: 0.6 })
  )
  fill.name = '__fill'

  const glassGeo = mergeGeometries(glassParts)
  const glass = new THREE.Mesh(
    glassGeo,
    new THREE.MeshStandardMaterial({
      color: GLASS_FILL,
      transparent: true,
      opacity: 0.3,
      metalness: 0.3,
      roughness: 0.1,
      depthWrite: false,
    })
  )
  glass.name = '__glass'

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(frameGeo),
    new THREE.LineBasicMaterial({ color: JOINERY_EDGE })
  )
  edges.name = '__edges'
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, glass, edges)
  placeOnPlane(group, plane)
  return group
}

// door.leaf — vantail de porte posé DANS une ouverture PORTE (E14-07, cf.
// lib/joinery). Même mécanique que la menuiserie de fenêtre (composant hébergé,
// catégorie ①, AUCUN booléen), géométrie différente : dormant à 3 côtés (2
// montants + traverse haute, PAS de traverse basse — le seuil reste libre) +
// panneau plein (vantail fermé) + poignée. params : { largeur_m (u), hauteur_m
// (v, depuis le seuil au sol), epaisseur_m (section du dormant), profondeur_m
// (dormant, le long de la normale) }. plane = celui de la porte hôte + `hostOf`.
const LEAF_T = 0.04 // épaisseur du panneau de vantail (m)

function generateDoorLeaf(params, plane) {
  const w = Math.max(Number(params.largeur_m) || 0, 0.05)
  const h = Math.max(Number(params.hauteur_m) || 0, 0.05)
  // Section du dormant bornée comme la menuiserie : jamais au point de fermer le
  // passage (il reste un jour d'au moins ~1 cm).
  const t = Math.min(
    Math.max(Number(params.epaisseur_m) || 0, 0.01),
    (Math.min(w, h) - 0.01) / 2
  )
  const d = Math.max(Number(params.profondeur_m) || 0, 0.01)
  const zc = -d / 2 // encastré : face avant à z=0 (plan du mur), corps vers le vide
  const bar = (bw, bh, cx, cy, bd = d, cz = zc) => {
    const g = new THREE.BoxGeometry(bw, bh, bd)
    g.translate(cx, cy, cz)
    return g
  }

  // Dormant 3 côtés : montants pleine hauteur + traverse haute entre eux.
  const jourW = w - 2 * t
  const jourH = h - t
  const parts = [
    bar(t, h, -(w - t) / 2, h / 2), // montant gauche
    bar(t, h, (w - t) / 2, h / 2), // montant droit
    bar(jourW, t, 0, h - t / 2), // traverse haute
  ]
  // Vantail plein (fermé) dans le jour, épaisseur bornée par le dormant.
  const lt = Math.min(LEAF_T, d)
  parts.push(bar(jourW, jourH, 0, jourH / 2, lt, zc))
  // Poignée : petit barreau horizontal côté droit, ~1,05 m du seuil (borné au jour),
  // ressorti devant le panneau (lecture immédiate « porte », pas « panneau mural »).
  const hy = Math.min(1.05, jourH - 0.05)
  parts.push(bar(0.14, 0.03, Math.max(jourW / 2 - 0.12, 0), hy, 0.03, zc + lt / 2 + 0.015))

  // Tout fusionné en UNE géométrie → un seul mesh `__fill` (sélection/émissif
  // d'EditObject uniformes), même couleur calque `ouvertures` que la menuiserie.
  const leafGeo = mergeGeometries(parts)

  const fill = new THREE.Mesh(
    leafGeo,
    new THREE.MeshStandardMaterial({ color: JOINERY_FILL, metalness: 0.1, roughness: 0.6 })
  )
  fill.name = '__fill'

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(leafGeo),
    new THREE.LineBasicMaterial({ color: JOINERY_EDGE })
  )
  edges.name = '__edges'
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, edges)
  placeOnPlane(group, plane)
  return group
}

// elec.* — composants électriques ponctuels posés sur une face de mur (E15-01/02,
// cf. lib/elec). params : { largeur_m (u), hauteur_m (v), profondeur_m (normal) }.
// plane.origin = CENTRE du composant sur la face ; la boîte ressort le long de
// +normal (extérieur du mur), sa face arrière affleurant le mur. Un seul générateur
// pour tout le catalogue (seules les dims changent). Rendu = solide teinté « elec ».
const ELEC_FILL = 0xd85a30 // couleur du calque `elec` (script/naming.mjs)
const ELEC_EDGE = 0xf3b39a

function generateElec(params, plane) {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const hgt = Math.max(Number(params.hauteur_m) || 0, 0.001)
  const dep = Math.max(Number(params.profondeur_m) || 0, 0.001)

  // Géométrie locale : u→X, v→Y, normal→Z. Boîte centrée en (u,v) et décalée d'½
  // profondeur le long de +Z → la face arrière est à normal=0 (sur le mur).
  const geo = new THREE.BoxGeometry(w, hgt, dep)
  geo.translate(0, 0, dep / 2)

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: ELEC_FILL, metalness: 0.1, roughness: 0.7 })
  )
  fill.name = '__fill'

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: ELEC_EDGE })
  )
  edges.name = '__edges'
  edges.raycast = () => {}

  const group = new THREE.Group()
  group.add(fill, edges)
  placeOnPlane(group, plane)
  return group
}

// Runs ROUTÉS — elec.cable (E15-03) et plomberie.pipe (E16-01), cf. lib/routing
// + lib/cable + lib/plumbing. params : { points:[[x,y,z]…] (monde), largeur_m,
// hauteur_m (section rect.), diametre_mm, section }. Contrairement aux autres
// générateurs, la géométrie est construite en coordonnées MONDE depuis
// `params.points` → on N'appelle PAS placeOnPlane (le groupe reste à l'origine,
// identité) ; le `plane` stocké est purement nominal. Balayage d'une section
// rectangulaire le long du chemin, coudes d'onglet (mitre) aux sommets —
// géométrie basse résolution (4 faces/tronçon). Seule la couleur de calque
// distingue les deux kinds → fabrique paramétrée.
const PLUMB_FILL = 0x7f77dd // couleur du calque `plomberie` (script/naming.mjs)
const PLUMB_EDGE = 0xcbc7f2

const isRunKind = (kind) => kind === CABLE_KIND || kind === PIPE_KIND

function makeGenerateRun(fillColor, edgeColor) {
  return function generateRun(params) {
    const rings = runRings(params.points ?? [], params)
    const position = []
    const index = []
    // 4 sommets par anneau. Faces latérales : 4 quads (8 tris) entre anneaux voisins.
    for (const ring of rings) {
      for (const c of ring.corners) position.push(c[0], c[1], c[2])
    }
    for (let i = 0; i < rings.length - 1; i++) {
      const a = i * 4
      const b = a + 4
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4
        // quad (a+k, a+k2, b+k2, b+k) → 2 triangles.
        index.push(a + k, a + k2, b + k2, a + k, b + k2, b + k)
      }
    }
    // Bouchons d'extrémité (2 tris chacun) si le run a au moins un tronçon.
    if (rings.length >= 2) {
      const last = (rings.length - 1) * 4
      index.push(0, 2, 1, 0, 3, 2) // départ
      index.push(last, last + 1, last + 2, last, last + 2, last + 3) // arrivée
    }

    const fillGeo = new THREE.BufferGeometry()
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
    fillGeo.setIndex(index)
    fillGeo.computeVertexNormals()

    // Matériau OPAQUE (comme les composants élec) : l'effet d'opacité générique
    // d'EditObject ne teinte que les matériaux `transparent` → le run reste plein.
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshStandardMaterial({ color: fillColor, metalness: 0.1, roughness: 0.7 })
    )
    fill.name = '__fill'

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(fillGeo, 20),
      new THREE.LineBasicMaterial({ color: edgeColor })
    )
    edges.name = '__edges'
    edges.raycast = () => {}

    const group = new THREE.Group()
    group.add(fill, edges)
    return group // déjà en coordonnées monde — pas de placeOnPlane
  }
}

const REGISTRY = {
  'sketch.rect': generateRect,
  'sketch.circle': generateCircle,
  'sketch.arc': generateArc,
  [WINDOW_KIND]: generateOpening,
  // La porte réemploie le marqueur d'ouverture (même repère seuil/largeur/hauteur) ;
  // seule la pose diffère (seuil au sol, cf. lib/opening doorPayload).
  [DOOR_KIND]: generateOpening,
  [JOINERY_KIND]: generateJoinery,
  [DOOR_LEAF_KIND]: generateDoorLeaf,
  [CABLE_KIND]: makeGenerateRun(ELEC_FILL, ELEC_EDGE),
  [PIPE_KIND]: makeGenerateRun(PLUMB_FILL, PLUMB_EDGE),
  // Tout le catalogue élec partage `generateElec` (seules les dims diffèrent).
  ...Object.fromEntries(ELEC_KINDS.map((k) => [k, generateElec])),
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
  [WINDOW_KIND]: { system: 'ouvertures', type: 'fenetre' },
  [DOOR_KIND]: { system: 'ouvertures', type: 'porte' }, // ouverture de porte (E14-07)
  [JOINERY_KIND]: { system: 'ouvertures', type: 'menuiserie' }, // cadre+vitrage (E14-05)
  [DOOR_LEAF_KIND]: { system: 'ouvertures', type: 'vantail' }, // vantail de porte (E14-07)
  [CABLE_KIND]: { system: 'elec', type: 'cable' }, // câble routé (E15-03)
  [PIPE_KIND]: { system: 'plomberie', type: 'tuyau' }, // tuyau routé (E16-01)
  // elec.* → système `elec`, type = celui du catalogue (prise, interrupteur…).
  ...Object.fromEntries(
    Object.entries(ELEC_COMPONENTS).map(([kind, c]) => [kind, { system: 'elec', type: c.type }])
  ),
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

  // Run routé (câble E15-03, tuyau E16-01) : chaque sommet du chemin est un point
  // d'accroche (monde) — permet de raccorder un nouveau run à un sommet existant.
  // Pas de repère de plan (le run vit en coordonnées monde dans params.points).
  if (isRunKind(obj.kind)) {
    return (obj.params.points ?? []).map((p) => ({
      type: 'endpoint',
      point: [p[0], p[1], p[2]],
    }))
  }

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

  if (isElecKind(obj.kind)) {
    // Composant sur le mur : centre + 4 coins de la face arrière (plan du mur,
    // normal=0). Repère centré en (u,v) (cf. generateElec).
    const hw = Math.max(Number(obj.params.largeur_m) || 0, 0.001) / 2
    const hh = Math.max(Number(obj.params.hauteur_m) || 0, 0.001) / 2
    return [
      { type: 'midpoint', point: at(0, 0, 0) }, // centre (sur le mur)
      { type: 'endpoint', point: at(-hw, -hh, 0) },
      { type: 'endpoint', point: at(hw, -hh, 0) },
      { type: 'endpoint', point: at(hw, hh, 0) },
      { type: 'endpoint', point: at(-hw, hh, 0) },
    ]
  }

  if (isOpeningKind(obj.kind) || obj.kind === JOINERY_KIND || obj.kind === DOOR_LEAF_KIND) {
    const hw = Math.max(Number(obj.params.largeur_m) || 0, 0.001) / 2
    const hh = Math.max(Number(obj.params.hauteur_m) || 0, 0.001)
    // Rectangle u∈[-hw,hw], v∈[0,hh] (origin = seuil) : coins, milieux, centre.
    // La menuiserie (E14-05) et le vantail (E14-07) partagent ce repère avec
    // l'ouverture qui les héberge.
    return [
      { type: 'endpoint', point: at(-hw, 0, 0) },
      { type: 'endpoint', point: at(hw, 0, 0) },
      { type: 'endpoint', point: at(hw, hh, 0) },
      { type: 'endpoint', point: at(-hw, hh, 0) },
      { type: 'midpoint', point: at(0, 0, 0) }, // milieu du seuil
      { type: 'midpoint', point: at(hw, hh / 2, 0) },
      { type: 'midpoint', point: at(0, hh, 0) },
      { type: 'midpoint', point: at(-hw, hh / 2, 0) },
      { type: 'midpoint', point: at(0, hh / 2, 0) }, // centre
    ]
  }

  return []
}

// Dimensions dérivées des params (cohérent avec les `dims` V1, E2-10).
export function deriveDims(obj) {
  if (isRunKind(obj.kind)) {
    // Emprise = bounding box monde du chemin (le run n'a pas de repère u/v/normal).
    const pts = obj.params.points ?? []
    if (!pts.length) return { largeur_m: 0, profondeur_m: 0, hauteur_m: 0 }
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    for (const [x, y, z] of pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
    return {
      largeur_m: Number((maxX - minX).toFixed(3)),
      profondeur_m: Number((maxZ - minZ).toFixed(3)),
      hauteur_m: Number((maxY - minY).toFixed(3)),
    }
  }
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
  if (isElecKind(obj.kind) || obj.kind === JOINERY_KIND || obj.kind === DOOR_LEAF_KIND) {
    // u→largeur, v→hauteur, normal→profondeur (emprise du composant sur le mur).
    return {
      largeur_m: Number(obj.params.largeur_m) || 0,
      profondeur_m: Number(obj.params.profondeur_m) || 0,
      hauteur_m: Number(obj.params.hauteur_m) || 0,
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
