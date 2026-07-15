// Générateurs des primitives d'esquisse (Slice 0) : rectangle, disque, arc.

import * as THREE from 'three'
import { decorativeEdges, placeOnPlane, type Generator } from './common'
import type { ArcParams, CircleParams, RectParams, Vec2 } from '@/types'

const FILL_COLOR = 0x378add
const EDGE_COLOR = 0x8fc7ff

// sketch.rect — rectangle d'esquisse sur le plan d'esquisse, optionnellement
// extrudé en volume par Push/Pull (E12-08).
// params : { largeur_m (axe u), profondeur_m (axe v), hauteur_m? (extrusion le
//   long de la normale ; absente ou ~0 → forme plate) }.
// plane : { type, origin:[centre], u, v, normal } (cf. core/workPlanes).
export const generateRect: Generator<RectParams> = (params, plane) => {
  const w = Math.max(Number(params.largeur_m) || 0, 0.001)
  const d = Math.max(Number(params.profondeur_m) || 0, 0.001)
  const h = Number(params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001

  // Géométrie locale : u→X, v→Y, normal→Z (cf. placeOnPlane). Pour un solide, on
  // décale d'½ hauteur le long de Z pour que la BASE reste sur le plan d'esquisse.
  let geo: THREE.BufferGeometry
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

  const group = new THREE.Group()
  group.add(fill, decorativeEdges(geo, EDGE_COLOR))
  placeOnPlane(group, plane)
  return group
}

// sketch.circle — disque d'esquisse sur le plan d'esquisse, optionnellement
// extrudé en cylindre par Push/Pull (E12-08).
// params : { rayon_m, hauteur_m? (extrusion le long de la normale) }.
const CIRCLE_SEG = 48

export const generateCircle: Generator<CircleParams> = (params, plane) => {
  const r = Math.max(Number(params.rayon_m) || 0, 0.001)
  const h = Number(params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001

  // Géométrie locale : disque dans le plan XY (normal→Z). Pour un solide, un
  // cylindre d'axe Z (CylinderGeometry est axé Y → rotation), base sur le plan.
  let geo: THREE.BufferGeometry
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
  const group = new THREE.Group()
  group.add(fill, decorativeEdges(geo, EDGE_COLOR, 30))
  placeOnPlane(group, plane)
  return group
}

// sketch.arc — arc de cercle d'esquisse sur le plan d'esquisse (E13-03),
// optionnellement extrudé en MUR COURBE (ruban) par Push/Pull / hauteur.
// params : { rayon_m, angle_debut_deg, angle_balayage_deg, hauteur_m? }, repère
// u→X/v→Y/normal→Z (cf. placeOnPlane) ; origin = CENTRE du cercle support.
const ARC_FULL_SEG = 96 // segments pour un tour complet (densité du maillage)
const ARC_TUBE_R = 0.025 // rayon du « trait » d'un arc plat (m) — corps cliquable

/** Échantillonne l'arc en points LOCAUX [x,y] (z=0) dans le plan XY du repère. */
export function arcLocalPoints(params: ArcParams): Vec2[] {
  const r = Math.max(Number(params.rayon_m) || 0, 0.001)
  const a0 = (Number(params.angle_debut_deg) || 0) * (Math.PI / 180)
  const sweep = (Number(params.angle_balayage_deg) || 0) * (Math.PI / 180)
  const seg = Math.max(2, Math.ceil((Math.abs(sweep) / (2 * Math.PI)) * ARC_FULL_SEG))
  const pts: Vec2[] = []
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (sweep * i) / seg
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts
}

export const generateArc: Generator<ArcParams> = (params, plane) => {
  const h = Number(params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001
  const pts = arcLocalPoints(params)

  let fillGeo: THREE.BufferGeometry
  let edgeGeo: THREE.BufferGeometry
  if (solid) {
    // Ruban (mur courbe) : 2 anneaux (z=0 et z=h) cousus en quads.
    const z = h
    const position: number[] = []
    const index: number[] = []
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
    const ep: number[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!
      const [x1, y1] = pts[i + 1]!
      ep.push(x0, y0, 0, x1, y1, 0, x0, y0, z, x1, y1, z)
    }
    const [xa, ya] = pts[0]!
    const [xb, yb] = pts[pts.length - 1]!
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
    fillGeo = new THREE.TubeGeometry(
      curve,
      Math.max(pts.length - 1, 1),
      ARC_TUBE_R,
      6,
      false
    )
    const lp: number[] = []
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
