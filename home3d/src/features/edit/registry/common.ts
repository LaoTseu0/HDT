// Briques partagées des générateurs du registre (E12-05).
//
// Chaque `kind` est associé à une fonction PURE `generate(params, plane) →
// THREE.Object3D`. La géométrie est toujours DÉRIVÉE des params (jamais
// l'inverse) → un objet créé in-app est ré-éditable et régénérable au
// chargement depuis ses `extras.edit`.

import * as THREE from 'three'
import { frameOfObjectPlane } from '@/core/workPlanes'
import type { ObjectPlane } from '@/types'

/** Signature commune d'un générateur : params (du kind) + plan → Object3D. */
export type Generator<P> = (params: P, plane: ObjectPlane) => THREE.Object3D

/**
 * Oriente et positionne un groupe dans le repère d'un plan de travail (E12-02).
 * `plane` porte le CENTRE (`origin`) et le repère (`u`/`v`/`normal`) ; la
 * géométrie locale (plan XY de PlaneGeometry) est mappée u→X local, v→Y local,
 * normal→Z local. Léger offset le long de la normale pour éviter le z-fighting
 * avec le mur/la grille. Rétro-compat sol via frameOfObjectPlane.
 */
export function placeOnPlane(group: THREE.Object3D, plane: ObjectPlane): void {
  const { origin, u, v, normal } = frameOfObjectPlane(plane)
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...u),
    new THREE.Vector3(...v),
    new THREE.Vector3(...normal)
  )
  group.quaternion.setFromRotationMatrix(basis)
  group.position.set(...origin).addScaledVector(new THREE.Vector3(...normal), 0.003)
}

/**
 * Arêtes décoratives d'un générateur : LineSegments nommé `__edges`, jamais
 * raycasté — sinon elles intercepteraient le clic avant le mesh (pas de `face`)
 * et fausseraient la détection de face du Push/Pull.
 */
export function decorativeEdges(
  geo: THREE.BufferGeometry,
  color: number,
  thresholdAngle?: number
): THREE.LineSegments {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, thresholdAngle),
    new THREE.LineBasicMaterial({ color })
  )
  edges.name = '__edges'
  edges.raycast = () => {}
  return edges
}
