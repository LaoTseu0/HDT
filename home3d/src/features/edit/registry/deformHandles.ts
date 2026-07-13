// Poignées de déformation paramétrique d'un objet app (E22-01/02, manipulation
// directe). Renvoie des descripteurs { key, paramKey, axis, sign, anchored,
// point } consommés par DeformHandles + le moteur de drag (useAxisDrag) :
// tirer la poignée le long de `axis·sign` change `paramKey`. Calcul ANALYTIQUE
// depuis params + repère du plan (comme referencePoints) → cohérent par
// construction avec la géométrie générée.
//   - sketch.rect (E22-01) : 6 poignées de face en solide — ±u (largeur, à
//     mi-hauteur), ±v (profondeur, à mi-hauteur), ±normale (hauteur, base +
//     sommet) ; 5 en plat (±u, ±v dans le plan + UNE poignée d'extrusion au
//     centre, même geste que le Push/Pull sur la face plate) ;
//   - sketch.circle (E22-02) : 4 poignées RADIALES aux points cardinaux
//     (rayon_m, centre FIXE — le rayon grandit autour du centre, comportement
//     poignée de rayon SketchUp) + ±normale (hauteur) comme le rectangle ;
//     plat → radiales d'arête dans le plan + extrusion au centre.
// L'arc et les objets muraux viendront en E22-04 ; les kinds sans déformation
// géométrique (runs routés, vanne…) n'affichent PAS de poignées.

import { frameOfObjectPlane } from '@/core/workPlanes'
import type { AppObject, Vec3 } from '@/types'

/** Descripteur d'une poignée de déformation (E22-01/02). */
export interface DeformHandle {
  /** Identifiant stable de la poignée sur l'objet (+u, -n, …). */
  key: string
  /** Cote modifiée par le drag de cette poignée. */
  paramKey: 'largeur_m' | 'profondeur_m' | 'hauteur_m' | 'rayon_m'
  /** Axe monde du drag (unitaire). */
  axis: Vec3
  /** Sens du drag le long de l'axe. */
  sign: 1 | -1
  /** true = l'origine du plan reste fixe (rayon, hauteur) ; false = demi-décalage. */
  anchored: boolean
  /** Position monde de la poignée. */
  point: Vec3
}

export function deformHandles(obj: AppObject): DeformHandle[] {
  const kind = obj.kind
  if (kind !== 'sketch.rect' && kind !== 'sketch.circle') return []

  const { origin, u, v, normal } = frameOfObjectPlane(obj.plane)
  const h = Number(obj.params.hauteur_m) || 0
  const solid = Math.abs(h) >= 0.001
  const hs: 1 | -1 = h < 0 ? -1 : 1 // extrusion descendante : côtés base/sommet inversés
  const zc = solid ? h / 2 : 0 // poignées latérales/radiales : à mi-hauteur

  // Point = origin + su·u + sv·v + sn·normal (même repère que referencePoints).
  const at = (su: number, sv: number, sn: number): Vec3 => [
    origin[0] + u[0] * su + v[0] * sv + normal[0] * sn,
    origin[1] + u[1] * su + v[1] * sv + normal[1] * sn,
    origin[2] + u[2] * su + v[2] * sv + normal[2] * sn,
  ]

  const handles: DeformHandle[] = []

  if (kind === 'sketch.rect') {
    const hu = Math.max(Number(obj.params.largeur_m) || 0, 0.001) / 2
    const hv = Math.max(Number(obj.params.profondeur_m) || 0, 0.001) / 2
    // Mêmes axes/ancrages que pickPushAxis (Push/Pull E12-08) : u/v = géométrie
    // CENTRÉE (anchored=false, demi-décalage d'origine → face opposée fixe).
    // prettier-ignore
    handles.push(
      { key: '+u', paramKey: 'largeur_m', axis: u, sign: 1, anchored: false, point: at(hu, 0, zc) },
      { key: '-u', paramKey: 'largeur_m', axis: u, sign: -1, anchored: false, point: at(-hu, 0, zc) },
      { key: '+v', paramKey: 'profondeur_m', axis: v, sign: 1, anchored: false, point: at(0, hv, zc) },
      { key: '-v', paramKey: 'profondeur_m', axis: v, sign: -1, anchored: false, point: at(0, -hv, zc) }
    )
  }

  if (kind === 'sketch.circle') {
    const r = Math.max(Number(obj.params.rayon_m) || 0, 0.001)
    // Poignées radiales : l'axe du drag est la direction radiale SORTANTE
    // (±u/±v) avec sign=+1 et anchored=true → décalage d'origine nul, le
    // CENTRE reste fixe pendant que le rayon suit la poignée (contrairement
    // aux faces du rectangle, une « face opposée » n'a pas de sens ici).
    const neg = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]]
    // prettier-ignore
    handles.push(
      { key: '+u', paramKey: 'rayon_m', axis: u, sign: 1, anchored: true, point: at(r, 0, zc) },
      { key: '-u', paramKey: 'rayon_m', axis: neg(u), sign: 1, anchored: true, point: at(-r, 0, zc) },
      { key: '+v', paramKey: 'rayon_m', axis: v, sign: 1, anchored: true, point: at(0, r, zc) },
      { key: '-v', paramKey: 'rayon_m', axis: neg(v), sign: 1, anchored: true, point: at(0, -r, zc) }
    )
  }

  // Hauteur (commun) : normale ANCRÉE à la base sur le plan d'esquisse (mêmes
  // ancrages que le Push/Pull). Extrémité de l'extrusion (sommet) ; pour une
  // forme plate c'est LA poignée d'extrusion, posée au centre de la face.
  handles.push({
    key: '+n',
    paramKey: 'hauteur_m',
    axis: normal,
    sign: hs,
    anchored: true,
    point: at(0, 0, h),
  })
  if (solid) {
    handles.push({
      key: '-n',
      paramKey: 'hauteur_m',
      axis: normal,
      sign: -hs as 1 | -1,
      anchored: true,
      point: at(0, 0, 0), // base (sur le plan d'esquisse)
    })
  }
  return handles
}
