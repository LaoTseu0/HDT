// Dimensions dérivées des params (cohérent avec les `dims` V1, E2-10).

import { VALVE_KIND, valveMesh } from '@/features/mep/valve'
import { DOOR_LEAF_KIND, JOINERY_KIND } from '@/features/openings/joinery'
import { arcLocalPoints } from './generateSketch'
import { runPointsOf } from './generateMep'
import type { AppObject } from '@/types'

/** Emprise dérivée (bounding box) d'un objet app, en mètres. */
export interface DerivedDims {
  largeur_m: number
  profondeur_m: number
  hauteur_m: number
}

export function deriveDims(obj: AppObject): DerivedDims | null {
  if (obj.kind === VALVE_KIND) {
    // Emprise = bounding box monde du maillage (corps + tige + poignée).
    const { position } = valveMesh(obj.params)
    if (!position.length) return { largeur_m: 0, profondeur_m: 0, hauteur_m: 0 }
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < position.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const c = position[i + k]!
        if (c < min[k]!) min[k] = c
        if (c > max[k]!) max[k] = c
      }
    }
    return {
      largeur_m: Number((max[0]! - min[0]!).toFixed(3)),
      profondeur_m: Number((max[2]! - min[2]!).toFixed(3)),
      hauteur_m: Number((max[1]! - min[1]!).toFixed(3)),
    }
  }
  if (obj.kind === 'elec.cable' || obj.kind === 'plomberie.pipe') {
    // Emprise = bounding box monde du chemin RENDU (pente comprise pour un tuyau).
    const pts = runPointsOf(obj.kind, obj.params)
    if (!pts.length) return { largeur_m: 0, profondeur_m: 0, hauteur_m: 0 }
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
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
  // Comparaisons littérales (pas isElecKind) : seul le narrowing direct du
  // discriminant propage le type des params à travers l'union.
  if (
    obj.kind === 'elec.outlet' ||
    obj.kind === 'elec.switch' ||
    obj.kind === 'elec.junction' ||
    obj.kind === 'elec.meter' ||
    obj.kind === JOINERY_KIND ||
    obj.kind === DOOR_LEAF_KIND
  ) {
    // u→largeur, v→hauteur, normal→profondeur (emprise du composant sur le mur).
    return {
      largeur_m: Number(obj.params.largeur_m) || 0,
      profondeur_m: Number(obj.params.profondeur_m) || 0,
      hauteur_m: Number(obj.params.hauteur_m) || 0,
    }
  }
  return null
}
