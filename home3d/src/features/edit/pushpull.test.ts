import { describe, it, expect } from 'vitest'
import { Vector3, Object3D } from 'three'
import { pickExtrudeAxis, pickPushAxis } from './pushpull'
import type { Vec3 } from '@/types'

// Repère par défaut (sol) utilisé quand `plane` est absent : u=X, v=−Z, n=Y.
const DEFAULT_U: Vec3 = [1, 0, 0]
const DEFAULT_V: Vec3 = [0, 0, -1]
const DEFAULT_N: Vec3 = [0, 1, 0]

// `vec * sign` produit un zéro NÉGATIF (-0) sur les composantes nulles (ex. −1·0).
// Sans effet numérique (outward est une direction), mais `toEqual` distingue
// −0 de +0 (Object.is) → on normalise avant comparaison.
const norm = (v: Vec3): Vec3 => v.map((c) => (c === 0 ? 0 : c)) as Vec3

describe('pickExtrudeAxis (décision pure)', () => {
  it('repère par défaut : normale vers le haut → axe hauteur (normal), ancré, +', () => {
    const axis = pickExtrudeAxis(undefined, 'sketch.rect', DEFAULT_N)
    expect(axis.vec).toEqual(DEFAULT_N)
    expect(axis.key).toBe('hauteur_m')
    expect(axis.anchored).toBe(true)
    expect(axis.sign).toBe(1)
    expect(norm(axis.outward)).toEqual([0, 1, 0])
  })

  it('normale alignée sur +u → largeur, non ancré, +', () => {
    const axis = pickExtrudeAxis(undefined, 'sketch.rect', [1, 0, 0])
    expect(axis.vec).toEqual(DEFAULT_U)
    expect(axis.key).toBe('largeur_m')
    expect(axis.anchored).toBe(false)
    expect(axis.sign).toBe(1)
    expect(norm(axis.outward)).toEqual([1, 0, 0])
  })

  it('normale alignée sur −u → largeur mais signe négatif, outward retourné', () => {
    const axis = pickExtrudeAxis(undefined, 'sketch.rect', [-1, 0, 0])
    expect(axis.key).toBe('largeur_m')
    expect(axis.sign).toBe(-1)
    expect(norm(axis.outward)).toEqual([-1, 0, 0])
  })

  it('normale alignée sur v (=[0,0,-1]) → profondeur', () => {
    const axis = pickExtrudeAxis(undefined, 'sketch.rect', DEFAULT_V)
    expect(axis.key).toBe('profondeur_m')
    expect(axis.sign).toBe(1)
    expect(norm(axis.outward)).toEqual([0, 0, -1])
  })

  it('normale oblique → axe au |produit scalaire| dominant', () => {
    // Plus proche de v que de u : 0.8·v + 0.6·u, la composante v l'emporte.
    const axis = pickExtrudeAxis(undefined, 'sketch.rect', [0.6, 0, -0.8])
    expect(axis.key).toBe('profondeur_m')
  })

  it('respecte un repère personnalisé (pas seulement les défauts)', () => {
    const plane = { u: [0, 1, 0] as Vec3, v: [0, 0, 1] as Vec3, normal: [1, 0, 0] as Vec3 }
    const axis = pickExtrudeAxis(plane, 'sketch.rect', [0, 1, 0])
    expect(axis.vec).toEqual([0, 1, 0])
    expect(axis.key).toBe('largeur_m') // u de ce repère
  })

  it('arc : restreint à la normale (hauteur), quel que soit l’axe touché', () => {
    const plane = { u: [1, 0, 0] as Vec3, v: [0, 1, 0] as Vec3, normal: [0, 0, 1] as Vec3 }
    // Normale de face alignée sur u : ignorée, l’arc ne s’extrude que le long de n.
    const axis = pickExtrudeAxis(plane, 'sketch.arc', [1, 0, 0])
    expect(axis.vec).toEqual([0, 0, 1])
    expect(axis.key).toBe('hauteur_m')
    expect(axis.anchored).toBe(true)
    // dot(n, faceNormal) = 0 → sign par défaut +1.
    expect(axis.sign).toBe(1)
  })

  it('normale nulle → défaut = axe normal, signe +', () => {
    const axis = pickExtrudeAxis(undefined, 'sketch.rect', [0, 0, 0])
    expect(axis.key).toBe('hauteur_m')
    expect(axis.vec).toEqual(DEFAULT_N)
    expect(axis.sign).toBe(1)
  })
})

describe('pickPushAxis (adaptateur event three)', () => {
  it('résout la normale monde depuis event.face (matrixWorld identité)', () => {
    const object = new Object3D() // matrixWorld = identité par défaut
    const event = { face: { normal: new Vector3(1, 0, 0) }, object }
    const axis = pickPushAxis({ kind: 'sketch.rect', plane: null }, event)
    expect(axis.key).toBe('largeur_m')
    expect(axis.sign).toBe(1)
  })

  it('sans face touchée → fallback sur la normale du plan de l’objet', () => {
    const axis = pickPushAxis(
      { kind: 'sketch.rect', plane: { normal: [0, 1, 0] } },
      {} // aucun face/intersections
    )
    expect(axis.key).toBe('hauteur_m')
    expect(axis.vec).toEqual([0, 1, 0])
  })

  it('remonte à la 1re intersection portant une face si event.face absent', () => {
    const object = new Object3D()
    const event = {
      intersections: [{ face: { normal: new Vector3(0, 0, -1) }, object }],
    }
    const axis = pickPushAxis({ kind: 'sketch.rect', plane: null }, event)
    expect(axis.key).toBe('profondeur_m') // v par défaut = [0,0,-1]
  })
})
