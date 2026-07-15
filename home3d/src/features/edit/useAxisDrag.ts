import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Ray } from 'three'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import useStore from '@/store/useStore'
import { extrudeHeightFromRay } from '@/core/workPlanes'
import {
  midpoint,
  pickBestSnap,
  valueOnAxis,
  SNAP_THRESHOLD_PX,
  GRID_STEP_M,
} from '@/core/snapping'
import { worldToScreen, meshRefsNear } from '@/core/snapRefs'
import type { AnyCamera, MeshHit } from '@/core/snapRefs'
import { referencePoints } from '@/features/edit/registry'
import { parseVcbLength } from '@/features/sketch/vcb'
import { isChainVisible } from '@/features/layers/appearance'
import type { Vec3, Snap, SnapCandidate } from '@/types'

// Moteur « drag le long d'un axe CONNU » (E22-01), extrait du Push/Pull (E12-08).
// Tirer le long de `axisVec` (u/v/normal du repère de l'objet) change UNE cote
// paramétrique en gardant la face OPPOSÉE fixe (décalage d'origine compensé),
// avec aperçu éphémère (store.extrude) et commit en UNE SEULE entrée
// d'historique au relâché (updateObjectParams + planePatch).
//
// E22-03 — même confort que le tracé :
//   - ACCROCHE : la face/poignée tirée s'accroche aux références sous le
//     curseur (sommets/milieux du mesh importé via BVH + références des autres
//     objets app), projetées sur l'axe du drag (valueOnAxis) ; la grille
//     (pas GRID_STEP_M) arrondit la cote en dernier recours si activée ;
//   - VCB : taper une cote pendant le drag fixe la valeur exacte (Entrée
//     valide immédiatement, Échap annule le drag) — règle aussi la dette
//     « VCB du Push/Pull » notée en E12-08.
//
// Deux déclencheurs le consomment :
//   - le Push/Pull (ObjectsLayer) : axe déduit de la face cliquée (pickPushAxis) ;
//   - les poignées de déformation (DeformHandles, E22) : axe connu d'avance.

const MIN_VALUE = 0.01 // m — cote plancher pendant le drag (et seuil de commit)

/** Spécification d'un drag sur axe, fournie par le déclencheur (push/pull ou poignée). */
export interface DragSpec {
  id: string
  paramKey: string
  axisVec: Vec3
  sign: 1 | -1
  anchored: boolean
  refPoint?: Vec3
}

/** État interne du drag en cours (dragRef). */
interface DragState {
  id: string
  paramKey: string
  anchored: boolean
  axisVec: Vec3
  sign: 1 | -1
  outward: Vec3
  baseParam: number
  baseOrigin: Vec3
  refPoint: Vec3
  h0: number
}

/** Candidat d'accroche du drag : accroche + cote projetée sur l'axe. */
type DragCandidate = SnapCandidate & { value: number }
type DragSnap = Snap & { value: number }

const rayArrays = (ray: Ray): [Vec3, Vec3] => [
  [ray.origin.x, ray.origin.y, ray.origin.z],
  [ray.direction.x, ray.direction.y, ray.direction.z],
]

const addScaled3 = (a: Vec3, b: Vec3, s: number): Vec3 => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
  a[2] + b[2] * s,
]

// Décalage d'origine gardant la face opposée fixe : axe centré (u/v) →
// demi-décalage ; axe ancré à la base (normale, ou rayon à centre fixe avec
// sign=+1) → décalage seulement si on tire le côté « base » (sign=−1).
const originShift = (p: { anchored: boolean; sign: number }, delta: number): number =>
  p.anchored ? ((p.sign - 1) / 2) * delta : (p.sign * delta) / 2

/**
 * Hook du moteur de drag sur axe (vit dans le Canvas : caméra/raycaster R3F).
 * `startDrag(spec, event)` démarre le drag depuis un évènement pointeur R3F ; les
 * écouteurs fenêtre prennent le relais (le pointeur sort de la forme pendant le
 * tirage). `dragging` reflète le drag en cours.
 */
export default function useAxisDrag() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as AnyCamera
  const raycaster = useThree((state) => state.raycaster)
  const setExtrude = useStore((state) => state.setExtrude)
  const updateObjectParams = useStore((state) => state.updateObjectParams)

  // `dragRef` = données du drag ; `dragging` (re)branche les écouteurs fenêtre.
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)

  const rayFromClient = useCallback(
    (cx: number, cy: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      return { ray: raycaster.ray, rect }
    },
    [gl, camera, raycaster]
  )

  const startDrag = useCallback(
    (spec: DragSpec, event: ThreeEvent<PointerEvent>) => {
      const obj = useStore.getState().objects[spec.id]
      if (!obj) return
      const outward = spec.axisVec.map((c) => c * spec.sign) as Vec3
      const center: Vec3 = obj.plane?.origin ?? [0, 0, 0]
      const refPoint = spec.refPoint ?? center
      const params = obj.params as unknown as Record<string, unknown>
      const baseParam = Number(params[spec.paramKey]) || 0
      const [ro, rd] = rayArrays(event.ray)
      dragRef.current = {
        id: spec.id,
        paramKey: spec.paramKey,
        anchored: spec.anchored,
        axisVec: spec.axisVec,
        sign: spec.sign,
        outward,
        baseParam,
        baseOrigin: center,
        refPoint,
        // Mesure le long de la ligne (refPoint, outward) : le point saisi de la
        // face suit le curseur, quel que soit l'endroit où on l'a attrapée.
        h0: extrudeHeightFromRay(refPoint, outward, ro, rd),
      }
      useStore.getState().setVcbText('') // nouvelle saisie VCB pour ce drag (E22-03)
      setExtrude({ id: spec.id, paramKey: spec.paramKey, value: baseParam, origin: center })
      gl.domElement.setPointerCapture?.(event.pointerId)
      setDragging(true)
    },
    [gl, setExtrude]
  )

  // Meilleure accroche du drag (E22-03) : références du modèle importé sous le
  // curseur (raycast + BVH) et des AUTRES objets app, chacune projetée sur
  // l'axe → candidate { value, point } gardée si sa projection écran est à
  // portée du curseur (pickBestSnap, mêmes priorités que le tracé).
  // Contrat : appelé APRÈS rayFromClient — le raycaster partagé porte encore
  // le rayon souris courant.
  const resolveSnap = useCallback(
    (p: DragState, cursor: { x: number; y: number }, rect: DOMRect): DragSnap | null => {
      const { glb, objects } = useStore.getState()
      const candidates: SnapCandidate[] = []
      // Références du mesh importé : sommets + milieux d'arête près du curseur.
      if (glb?.scene) {
        const hit = raycaster
          .intersectObject(glb.scene, true)
          .filter((h) => h.face && isChainVisible(h.object))[0]
        if (hit) {
          const hp: Vec3 = [hit.point.x, hit.point.y, hit.point.z]
          const refs = meshRefsNear(hit as unknown as MeshHit, hp, camera, rect)
          for (const v of refs.verts) candidates.push({ type: 'endpoint', point: v })
          for (const [a, b] of refs.edges)
            candidates.push({ type: 'midpoint', point: midpoint(a, b) })
        }
      }
      // Références des autres objets app (l'objet tiré s'accroche à ses voisins,
      // pas à lui-même : ses propres références bougent avec l'aperçu).
      for (const o of Object.values(objects)) {
        if (o.id === p.id) continue
        for (const rp of referencePoints(o)) candidates.push(rp)
      }
      const scored = candidates as DragCandidate[]
      for (const cand of scored) {
        cand.value = valueOnAxis(cand.point, p.refPoint, p.outward, p.baseParam)
        const s = worldToScreen(cand.point, camera, rect)
        cand.sx = s.x
        cand.sy = s.y
      }
      // Une accroche qui écraserait la forme sous la cote plancher est ignorée.
      const valid = scored.filter((c) => c.value >= MIN_VALUE)
      return pickBestSnap(valid, cursor, SNAP_THRESHOLD_PX) as DragSnap | null
    },
    [raycaster, camera]
  )

  // Fin de drag mutualisée (relâché OU Entrée) : une cote VCB tapée prime sur
  // le glissé/l'accroche (E22-03) ; l'origine est recalculée pour la valeur
  // finale afin de garder la face opposée fixe.
  const finishDrag = useCallback(() => {
    const p = dragRef.current
    dragRef.current = null
    const ex = useStore.getState().extrude
    setExtrude(null)
    setDragging(false)
    if (!p || !ex) return
    const parsed = parseVcbLength(useStore.getState().vcbText)
    useStore.getState().setVcbText('')
    let value = ex.value
    let origin = ex.origin
    if (parsed) {
      value = Math.max(parsed.length, MIN_VALUE)
      origin = addScaled3(p.baseOrigin, p.axisVec, originShift(p, value - p.baseParam))
    }
    if (Math.abs(value - p.baseParam) >= MIN_VALUE) {
      updateObjectParams(p.id, { [p.paramKey]: value }, { origin })
    }
  }, [setExtrude, updateObjectParams])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const p = dragRef.current
      if (!p) return
      const { ray, rect } = rayFromClient(e.clientX, e.clientY)
      const [ro, rd] = rayArrays(ray)
      const disp = extrudeHeightFromRay(p.refPoint, p.outward, ro, rd) - p.h0
      let value = Math.max(p.baseParam + disp, MIN_VALUE)
      // Accroche aux références (prioritaire), sinon grille en dernier recours.
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const snap = resolveSnap(p, cursor, rect)
      if (snap) {
        value = snap.value
      } else if (useStore.getState().gridSnap) {
        value = Math.max(Math.round(value / GRID_STEP_M) * GRID_STEP_M, MIN_VALUE)
      }
      const origin = addScaled3(p.baseOrigin, p.axisVec, originShift(p, value - p.baseParam))
      setExtrude({
        id: p.id,
        paramKey: p.paramKey,
        value: Number(value.toFixed(3)),
        origin: origin.map((c) => Number(c.toFixed(4))) as Vec3,
        snap: snap ? { type: snap.type, point: snap.point } : null,
      })
    }
    // Entrée = valider (la cote VCB éventuelle prime) ; Échap = annuler le drag
    // (sauf saisie VCB en cours : App.jsx l'efface d'abord, le drag continue).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        finishDrag()
      } else if (e.key === 'Escape' && !useStore.getState().vcbText) {
        dragRef.current = null
        setExtrude(null)
        setDragging(false)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('keydown', onKey)
    }
  }, [dragging, rayFromClient, resolveSnap, finishDrag, setExtrude])

  return { startDrag, dragging }
}
