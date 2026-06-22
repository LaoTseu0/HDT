import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import useStore from '../store/useStore.js'
import { generateObject, disposeObject } from '../lib/editRegistry.js'

// Rendu des objets créés in-app (Edit mode, Slice 0) + outil de tracé.
// Vit dans le Canvas. Les objets sont DÉRIVÉS du store via le registre
// paramétrique : changer un param régénère la géométrie (ré-éditable).

const DRAFT_FILL = '#8fc7ff'
const DRAFT_EDGE = '#cfe4f8'
const MIN_SIZE = 0.05 // m — en deçà, le tracé est ignoré (clic accidentel)

// Un objet app : (re)généré dès que `obj` (donc ses params) change.
function EditObject({ obj, selected, selectable, onSelect }) {
  const object3d = useMemo(() => generateObject(obj), [obj])

  useEffect(() => () => object3d && disposeObject(object3d), [object3d])

  // Surbrillance de la sélection : renforce le remplissage + l'émissif.
  useEffect(() => {
    if (!object3d) return
    const fill = object3d.getObjectByName('__fill')
    if (fill) {
      fill.material.opacity = selected ? 0.6 : 0.35
      fill.material.emissive = new THREE.Color(selected ? 0x16344f : 0x000000)
    }
  }, [object3d, selected])

  if (!object3d) return null
  return (
    <primitive
      object={object3d}
      onClick={
        selectable
          ? (event) => {
              event.stopPropagation()
              onSelect(obj.id)
            }
          : undefined
      }
    />
  )
}

// Aperçu du rectangle en cours de tracé (suit le pointeur).
function DraftPreview({ draft }) {
  const w = Math.max(Math.abs(draft.current[0] - draft.start[0]), 0.001)
  const d = Math.max(Math.abs(draft.current[1] - draft.start[1]), 0.001)
  const cx = (draft.start[0] + draft.current[0]) / 2
  const cz = (draft.start[1] + draft.current[1]) / 2

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d)
    g.rotateX(-Math.PI / 2)
    return g
  }, [w, d])
  useEffect(() => () => geo.dispose(), [geo])

  return (
    <group position={[cx, 0.004, cz]}>
      <mesh geometry={geo}>
        <meshBasicMaterial
          color={DRAFT_FILL}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color={DRAFT_EDGE} />
      </lineSegments>
    </group>
  )
}

// Plan de sol (XZ, y=0) capteur des tracés. Rendu uniquement quand l'outil
// Rectangle est actif, pour ne pas intercepter la sélection en mode View.
function SketchPlane() {
  const setDraft = useStore((state) => state.setDraft)
  const createObject = useStore((state) => state.createObject)
  const drawing = useRef(false)

  const onPointerDown = (event) => {
    event.stopPropagation()
    drawing.current = true
    const p = event.point
    setDraft({ start: [p.x, p.z], current: [p.x, p.z] })
    event.target.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event) => {
    if (!drawing.current) return
    const d = useStore.getState().draft
    if (!d) return
    const p = event.point
    setDraft({ start: d.start, current: [p.x, p.z] })
  }
  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const d = useStore.getState().draft
    if (!d) return
    const w = Math.abs(d.current[0] - d.start[0])
    const depth = Math.abs(d.current[1] - d.start[1])
    if (w < MIN_SIZE || depth < MIN_SIZE) {
      setDraft(null)
      return
    }
    createObject({
      kind: 'sketch.rect',
      params: {
        largeur_m: Number(w.toFixed(3)),
        profondeur_m: Number(depth.toFixed(3)),
      },
      plane: {
        type: 'ground',
        origin: [(d.start[0] + d.current[0]) / 2, 0, (d.start[1] + d.current[1]) / 2],
      },
    })
  }

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <planeGeometry args={[400, 400]} />
      {/* invisible mais raycastable (un mesh visible=false n'est pas testé) */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function EditObjects() {
  const objects = useStore((state) => state.objects)
  const selectedNode = useStore((state) => state.selectedNode)
  const selectNode = useStore((state) => state.selectNode)
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const draft = useStore((state) => state.draft)

  const rectTool = editMode && activeTool === 'rect'
  const selectable = editMode && activeTool === 'select'

  return (
    <>
      {Object.values(objects).map((obj) => (
        <EditObject
          key={obj.id}
          obj={obj}
          selected={obj.id === selectedNode}
          selectable={selectable}
          onSelect={selectNode}
        />
      ))}
      {rectTool && <SketchPlane />}
      {draft && <DraftPreview draft={draft} />}
    </>
  )
}
