import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Object3D } from 'three'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import useStore from '@/store/useStore'
import { probeSketch, computeSnap } from '@/features/edit/sketchSnap'
import { worldToPlane, planeToWorld } from '@/core/workPlanes'
import type { AnyCamera } from '@/core/snapRefs'
import { angleOf, nextSweep } from '@/features/sketch/sketchArc'
import {
  openingPayload,
  OPENING_PRESETS,
  DEFAULT_OPENING_PRESET,
  doorPayload,
  DOOR_PRESETS,
  DEFAULT_DOOR_PRESET,
} from '@/features/openings/opening'
import { elecPayload } from '@/features/mep/elec'
import type {
  Vec2,
  Vec3,
  WorkFrame,
  Snap,
  Draft,
  RectDraft,
  CircleDraft,
  ArcDraft,
  RunDraft,
  NodesTable,
  ObjectsTable,
} from '@/types'
import type { ActiveTool } from '@/store/types'

// Moteur d'interaction du tracé (étape C2b du découpage d'EditObjects, typé en F2).
// Encapsule tous les handlers pointeur de la surface d'esquisse + l'état de survol,
// en s'appuyant sur le moteur d'accroche pur (sketchSnap). Les ACTIONS du store sont
// prises par sélecteur (références stables) ; seule la LECTURE de `draft` reste en
// getState() — un handler doit lire le tracé COURANT, pas une valeur figée par la
// closure de rendu. Retourne l'état de survol + les handlers à câbler sur le mesh.
//
// NB typage (F2) : `Draft` est une union discriminée par `tool`. Les invariants
// « resolveOnLockedFrame ne reçoit jamais un RunDraft », « en branche cable/pipe le
// draft est un RunDraft », etc. sont garantis au RUNTIME par la structure des
// handlers mais non exprimables dans le type → assertions ciblées (aucun impact
// runtime, code identique).

/** Aperçu du plan/accroche au survol (hors tracé actif). */
interface Hover {
  point: Vec3
  u: Vec3
  v: Vec3
  normal: Vec3
  snap: Snap | null
}

/** Draft posé sur un plan verrouillé (jamais un run). */
type LockedDraft = RectDraft | CircleDraft | ArcDraft

interface UseDraftToolArgs {
  tool: ActiveTool
  glbScene: Object3D | null | undefined
  nodes: NodesTable
  objects: ObjectsTable
}

export default function useDraftTool({ tool, glbScene, nodes, objects }: UseDraftToolArgs) {
  const setDraft = useStore((state) => state.setDraft)
  const commitDraft = useStore((state) => state.commitDraft)
  const createObject = useStore((state) => state.createObject)
  const setVcbText = useStore((state) => state.setVcbText)
  const gridSnap = useStore((state) => state.gridSnap)
  const openingPreset = useStore((state) => state.openingPreset)
  const doorPreset = useStore((state) => state.doorPreset)
  const elecComponent = useStore((state) => state.elecComponent)
  const [hover, setHover] = useState<Hover | null>(null)
  const drawing = useRef(false)
  const rc = useMemo(() => new THREE.Raycaster(), [])
  const camera = useThree((state) => state.camera) as AnyCamera
  const gl = useThree((state) => state.gl)

  // Point monde du rayon de l'évènement projeté sur un plan verrouillé.
  const projectOnFrame = (event: ThreeEvent<PointerEvent>, frame: WorkFrame): Vec3 | null => {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(...frame.normal),
      new THREE.Vector3(...frame.origin)
    )
    const pt = new THREE.Vector3()
    return event.ray.intersectPlane(plane, pt) ? [pt.x, pt.y, pt.z] : null
  }

  const cursorOf = (event: ThreeEvent<PointerEvent>) => {
    const rect = gl.domElement.getBoundingClientRect()
    return { rect, cursor: { x: event.clientX - rect.left, y: event.clientY - rect.top } }
  }

  // Résout le point (s,t) accroché sur le plan VERROUILLÉ d'un tracé en cours, et
  // le balayage accumulé pour un arc en étape 'sweep'. Mutualisé entre le
  // déplacement (move) et les clics intermédiaires de l'arc (down).
  const resolveOnLockedFrame = (event: ThreeEvent<PointerEvent>, d: LockedDraft): Draft | null => {
    const { hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const freeWorld = projectOnFrame(event, d.frame)
    if (!freeWorld) return null
    const ref: Vec2 =
      d.tool === 'arc' ? (d.stage === 'sweep' ? d.start! : d.center) : d.start
    const startWorld = planeToWorld(ref[0], ref[1], d.frame)
    const snap = computeSnap({
      hit,
      objects,
      frame: d.frame,
      drawing: true,
      freeWorld,
      startWorld,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    const world = snap ? snap.point : freeWorld
    const [s, t] = worldToPlane(world, d.frame)
    const patch = { ...d, current: [s, t] as Vec2, snap } as Draft
    if (d.tool === 'arc' && d.stage === 'sweep') {
      ;(patch as ArcDraft).sweepRad = nextSweep(
        d.sweepRad || 0,
        d.startAngle!,
        angleOf(d.center, [s, t])
      )
    }
    return patch
  }

  // Run routé (câble E15-03, tuyau E16-01) : chaque sommet est résolu sur le plan
  // CONTEXTUEL frais (le run peut passer d'une face à l'autre, contrairement au plan
  // verrouillé d'un rectangle) avec accroche ; le dernier sommet posé sert de
  // référence d'inférence.
  const resolveRunPoint = (event: ThreeEvent<PointerEvent>) => {
    const { frame, hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const contextWorld: Vec3 = projectOnFrame(event, frame) ?? [
      event.point.x,
      event.point.y,
      event.point.z,
    ]
    const d = useStore.getState().draft as RunDraft | null
    const last = d?.points?.length ? d.points[d.points.length - 1] : null
    const snap = computeSnap({
      hit,
      objects,
      frame,
      drawing: !!d,
      freeWorld: contextWorld,
      startWorld: last ?? null,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    return { world: snap?.point ?? contextWorld, frame, snap }
  }

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    // E21-02 : Ctrl enfoncé = navigation caméra — on gèle le tracé/survol (masquer
    // l'aperçu évite un marqueur fantôme qui flotterait pendant l'orbite).
    if (event.ctrlKey) {
      setHover(null)
      return
    }
    // Run routé (câble/tuyau) : polyligne multi-clics ; suit le curseur sur le plan
    // contextuel, avec aperçu du tronçon en cours dès qu'un premier sommet est posé.
    if (tool === 'cable' || tool === 'pipe') {
      const { world, frame, snap } = resolveRunPoint(event)
      const d = useStore.getState().draft as RunDraft | null
      if (d) setDraft({ ...d, current: world, frame, snap })
      else setHover({ point: world, u: frame.u, v: frame.v, normal: frame.normal, snap })
      return
    }
    // Arc (multi-clics) : tant qu'un draft existe, suivre le curseur sans bouton
    // pressé (pas de drag) ; sinon retomber sur le survol comme les autres outils.
    if (tool === 'arc') {
      const d = useStore.getState().draft as LockedDraft | null
      if (d) {
        const patch = resolveOnLockedFrame(event, d)
        if (patch) setDraft(patch)
        return
      }
    } else if (drawing.current) {
      const d = useStore.getState().draft as LockedDraft | null
      if (!d) return
      const patch = resolveOnLockedFrame(event, d)
      if (patch) setDraft(patch)
      return
    }
    // Survol : accroche aux POINTS (sommets/milieux/centres) ; aperçu du plan
    // contextuel centré sur l'accroche le cas échéant.
    const { frame, hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const contextWorld: Vec3 = projectOnFrame(event, frame) ?? [
      event.point.x,
      event.point.y,
      event.point.z,
    ]
    const snap = computeSnap({
      hit,
      objects,
      frame,
      drawing: false,
      freeWorld: contextWorld,
      startWorld: null,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    const point = snap?.point ?? (frame.type === 'face' ? frame.origin : contextWorld)
    setHover({ point, u: frame.u, v: frame.v, normal: frame.normal, snap })
  }

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.ctrlKey) return // E21-02 : Ctrl+clic = navigation pure, pas de tracé
    event.stopPropagation()
    const { frame, hit } = probeSketch(event, glbScene, rc, nodes)
    const { rect, cursor } = cursorOf(event)
    const contextWorld: Vec3 = projectOnFrame(event, frame) ?? [
      event.point.x,
      event.point.y,
      event.point.z,
    ]
    const snap = computeSnap({
      hit,
      objects,
      frame,
      drawing: false,
      freeWorld: contextWorld,
      startWorld: null,
      cursor,
      camera,
      rect,
      gridSnap,
    })
    const world = snap?.point ?? contextWorld
    const [s, t] = worldToPlane(world, frame)

    // Ouverture (E14-01) : pose au CLIC sur une FACE de mur (pas sur le sol). Le
    // point cliqué devient le centre ; l'objet référence le mur par `frame.faceOf`.
    if (tool === 'opening') {
      if (frame.type !== 'face') return // ignore un clic sur le sol
      const dims = OPENING_PRESETS[openingPreset] ?? OPENING_PRESETS[DEFAULT_OPENING_PRESET]
      createObject(openingPayload(world, frame, dims))
      setHover(null)
      return
    }

    // Porte (E14-07) : même mécanique que l'ouverture fenêtre, mais le seuil
    // est posé AU SOL par doorPayload (pas d'allège).
    if (tool === 'door') {
      if (frame.type !== 'face') return // ignore un clic sur le sol
      const dims = DOOR_PRESETS[doorPreset] ?? DOOR_PRESETS[DEFAULT_DOOR_PRESET]
      createObject(doorPayload(world, frame, dims))
      setHover(null)
      return
    }

    // Composant élec (E15-01/02) : pose au CLIC sur une FACE de mur, même
    // mécanique que l'ouverture. Le composant sélectionné vient du store.
    if (tool === 'elec') {
      if (frame.type !== 'face') return // ignore un clic sur le sol
      createObject(elecPayload(world, frame, elecComponent))
      setHover(null)
      return
    }

    // Run routé (câble E15-03, tuyau E16-01) : polyligne multi-clics. 1er clic =
    // 1er sommet ; chaque clic ajoute un sommet ; double-clic ou Entrée termine
    // (cf. onDoubleClick / commitDraft). Sommets en MONDE (plan contextuel frais).
    if (tool === 'cable' || tool === 'pipe') {
      const { world, frame, snap } = resolveRunPoint(event)
      const d = useStore.getState().draft as RunDraft | null
      if (!d) {
        setHover(null)
        setVcbText('')
        setDraft({ tool, frame, points: [world], current: world, snap })
      } else {
        setDraft({ ...d, points: [...d.points, world], current: world, frame, snap })
      }
      return
    }

    // Arc : tracé en 3 CLICS (pas de glissé). 1er clic = centre ; clics suivants
    // = verrouille rayon (étape 'radius'→'sweep') puis fixe le balayage (commit).
    if (tool === 'arc') {
      const d = useStore.getState().draft as LockedDraft | null
      if (!d) {
        setHover(null)
        setVcbText('')
        setDraft({ tool: 'arc', stage: 'radius', frame, center: [s, t], current: [s, t], snap })
        return
      }
      const patch = resolveOnLockedFrame(event, d)
      if (patch) setDraft(patch)
      commitDraft()
      return
    }

    drawing.current = true
    setHover(null) // masque l'aperçu de survol pendant le tracé
    setVcbText('') // nouvelle saisie VCB pour ce tracé
    // `tool` distingue rectangle (2 coins) et cercle (centre + rayon) au commit.
    setDraft({ start: [s, t], current: [s, t], frame, snap, tool } as Draft)
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  // Relâché : committe le tracé via le store (gère cote VCB éventuelle + garde
  // clic accidentel). L'arc commit au clic (pas au relâché) → ignoré ici.
  const onPointerUp = () => {
    if (tool === 'arc' || tool === 'cable' || tool === 'pipe' || !drawing.current) return
    drawing.current = false
    if (useStore.getState().draft) commitDraft()
  }

  // Run routé : double-clic = fin du routage (les deux clics ajoutent un sommet
  // chacun, le doublon final est fusionné par la déduplication de commitRun).
  const onDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.ctrlKey) return // E21-02 : verrou d'action sous Ctrl
    if (tool !== 'cable' && tool !== 'pipe') return
    event.stopPropagation()
    if (useStore.getState().draft) commitDraft()
  }

  const onPointerLeave = () => setHover(null)

  return { hover, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onPointerLeave }
}
