// Points de référence d'accroche d'un objet app (E12-03, « accroche à tes formes »).
// Renvoie des points MONDE typés (sommet/milieu) que le snapping ajoute à ses
// candidats. Calcul ANALYTIQUE depuis params + repère du plan (pas de lecture de
// géométrie three) → cohérent par construction avec ce que `generateRect` rend.
//   - rectangle plat : 4 coins (endpoint) + 4 milieux d'arête + centre (midpoint) ;
//   - boîte extrudée (hauteur_m) : idem sur la face base ET la face haute, plus le
//     milieu des 4 arêtes verticales.
// `origin` du plan = centre de la face BASE (cf. placeOnPlane/generateRect).

import { frameOfObjectPlane } from '@/core/workPlanes'
import { isElecKind } from '@/features/mep/elec'
import { VALVE_KIND } from '@/features/mep/valve'
import { isOpeningKind } from '@/features/openings/opening'
import { DOOR_LEAF_KIND, JOINERY_KIND } from '@/features/openings/joinery'
import { runPointsOf } from './generateMep'
import { isKnownKind } from './registry'
import type { AppObject, Vec3 } from '@/types'

/** Point d'accroche exposé par un objet app (sous-ensemble des types de snap). */
export interface ReferencePoint {
  type: 'endpoint' | 'midpoint'
  point: Vec3
}

export function referencePoints(obj: AppObject): ReferencePoint[] {
  if (!isKnownKind(obj.kind)) return []

  // Run routé (câble E15-03, tuyau E16-01) : chaque sommet du chemin est un point
  // d'accroche (monde) — permet de raccorder un nouveau run à un sommet existant.
  // Pas de repère de plan (le run vit en coordonnées monde dans params.points).
  // Le tuyau expose ses sommets PENTUS (E16-02) : on s'accroche à ce qu'on voit.
  if (obj.kind === 'elec.cable' || obj.kind === 'plomberie.pipe') {
    return runPointsOf(obj.kind, obj.params).map((p) => ({
      type: 'endpoint',
      point: [p[0], p[1], p[2]],
    }))
  }

  // Vanne inline (E16-04) : son centre (sur l'axe du tuyau coupé) est un point
  // d'accroche — pratique pour router un piquage jusqu'à la vanne.
  if (obj.kind === VALVE_KIND) {
    const c = obj.params.centre
    return c ? [{ type: 'midpoint', point: [c[0], c[1], c[2]] }] : []
  }

  const { origin, u, v, normal } = frameOfObjectPlane(obj.plane)
  const h = 'hauteur_m' in obj.params ? Number(obj.params.hauteur_m) || 0 : 0
  const solid = Math.abs(h) >= 0.001

  // Point = origin + su·u + sv·v + sn·normal.
  const at = (su: number, sv: number, sn: number): Vec3 => [
    origin[0] + u[0] * su + v[0] * sv + normal[0] * sn,
    origin[1] + u[1] * su + v[1] * sv + normal[1] * sn,
    origin[2] + u[2] * su + v[2] * sv + normal[2] * sn,
  ]

  if (obj.kind === 'sketch.rect') {
    const hu = Math.max(Number(obj.params.largeur_m) || 0, 0.001) / 2
    const hv = Math.max(Number(obj.params.profondeur_m) || 0, 0.001) / 2
    // Une face plane à l'altitude `sn` : coins, milieux, centre.
    const face = (sn: number): ReferencePoint[] => [
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
    const face = (sn: number): ReferencePoint[] => [
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
    const ang = (a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)]
    const [sx, sy] = ang(a0) // début
    const [mx, my] = ang(a0 + sweep / 2) // milieu de l'arc
    const [ex, ey] = ang(a0 + sweep) // fin
    // Centre + extrémités + milieu de l'arc, par face.
    const face = (sn: number): ReferencePoint[] => [
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

  if (
    isOpeningKind(obj.kind) ||
    obj.kind === JOINERY_KIND ||
    obj.kind === DOOR_LEAF_KIND
  ) {
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
