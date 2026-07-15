import { useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import useStore from '@/store/useStore'
import { generateObject, disposeObject } from '@/features/edit/registry'
import { pickPushAxis } from '@/features/edit/pushpull'
import useAxisDrag from '@/features/edit/useAxisDrag'
import DeformHandles from '@/components/canvas/DeformHandles'
import { isOpeningKind } from '@/features/openings/opening'
import { isValvablePipe } from '@/features/mep/valve'
import { nodeName } from '@/core/naming'
import { joineryPayloadFromOpening, findJoinery } from '@/features/openings/joinery'

// Rendu + interaction des objets créés in-app (étape B du découpage d'EditObjects).
// Concern « objets committés » : la carte objects → mesh (via le registre
// paramétrique), la sélection, le Push/Pull, la pose menuiserie/vanne et les
// poignées de déformation. Push/Pull et poignées PARTAGENT une seule instance
// useAxisDrag (aperçu store.extrude commun) — d'où leur cohabitation ici.
// Vit dans le Canvas. Le tracé (SketchSurface) et les aperçus draft restent dans
// EditObjects (concern « tracé »).

// Un objet app : (re)généré dès que `obj` (ou l'aperçu Push/Pull) change. `preview`
// = patch éphémère { paramKey, value, origin } d'un Push/Pull en cours.
function EditObject({
  obj,
  preview,
  selected,
  selectable,
  pushable,
  hostable,
  valvable,
  onSelect,
  onStartPush,
  onHost,
  onValve,
}) {
  const effective = useMemo(
    () =>
      preview
        ? {
            ...obj,
            params: { ...obj.params, [preview.paramKey]: preview.value },
            plane: { ...obj.plane, origin: preview.origin },
          }
        : obj,
    [obj, preview]
  )
  const object3d = useMemo(() => generateObject(effective), [effective])
  // Opacité de base posée par le générateur (0.5 solide / 0.35 plat).
  const baseOpacity =
    Math.abs(Number(effective.params.hauteur_m) || 0) >= 0.001 ? 0.5 : 0.35

  useEffect(() => () => object3d && disposeObject(object3d), [object3d])

  useEffect(() => {
    if (!object3d) return
    const fill = object3d.getObjectByName('__fill')
    if (fill) {
      fill.material.opacity = selected ? 0.65 : baseOpacity
      fill.material.emissive = new THREE.Color(selected ? 0x16344f : 0x000000)
    }
  }, [object3d, selected, baseOpacity])

  if (!object3d) return null
  const interactive = selectable || pushable || hostable || valvable
  return (
    <primitive
      object={object3d}
      onClick={
        selectable || hostable || valvable
          ? (event) => {
              // E21-02 : Ctrl enfoncé = navigation caméra, aucune action objet.
              if (event.ctrlKey) return
              // Outil Menuiserie (E14-05) : cliquer une ouverture y pose le cadre.
              if (hostable) {
                event.stopPropagation()
                onHost(obj.id)
                return
              }
              // Outil Vanne (E16-04) : cliquer un tuyau y insère une vanne, au
              // point cliqué (l'intersection monde sur la surface du run).
              if (valvable) {
                event.stopPropagation()
                onValve(obj.id, [event.point.x, event.point.y, event.point.z])
                return
              }
              // Sélection : en mode découverte l'orbite est active → ignorer un
              // drag (comme Model.jsx, E6-01) pour ne pas sélectionner en fin
              // de rotation caméra.
              if (event.delta > 4) return
              event.stopPropagation()
              onSelect(obj.id)
            }
          : undefined
      }
      onPointerDown={
        pushable
          ? (event) => {
              if (event.ctrlKey) return // E21-02 : verrou d'action sous Ctrl
              event.stopPropagation()
              onStartPush(obj.id, event)
            }
          : undefined
      }
      // sans handler, pas de raycast inutile en mode tracé.
      raycast={interactive ? undefined : () => null}
    />
  )
}

export default function ObjectsLayer() {
  const objects = useStore((state) => state.objects)
  const selectedNode = useStore((state) => state.selectedNode)
  const selectNode = useStore((state) => state.selectNode)
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  const viewMode = useStore((state) => state.viewMode)
  const extrude = useStore((state) => state.extrude)

  // Sélection des objets app : alignée sur les objets importés (Model.jsx) —
  // active en mode découverte (orbite) ET en Édition avec l'outil Sélection ;
  // exclue en visite et pendant les outils de tracé/édition (E6-01).
  const selectable = viewMode !== 'visit' && (!editMode || activeTool === 'select')
  // Menuiserie (E14-05) : pas de surface d'esquisse — l'hôte du clic est une
  // OUVERTURE déjà posée (son marqueur devient cliquable), pas une face de mur.
  const hosting = editMode && activeTool === 'joinery'
  // Vanne (E16-04) : même mécanique — la cible du clic est un TUYAU déjà routé.
  const valving = editMode && activeTool === 'valve'
  const pushable = editMode && activeTool === 'pushpull'

  // Pose de la menuiserie (E14-05) : clic sur une ouverture → cadre + vitrage
  // (fenêtre) ou vantail (porte, E14-07) ajustés à ses dims, liés par node name
  // (`plane.hostOf`) — le choix cadre/vantail est fait par lib/joinery selon le
  // kind de l'hôte. Une ouverture déjà équipée sélectionne son composant
  // existant (garde « un composant par ouverture »). La variante courante
  // (E14-06, sous-barre) est copiée dans les params à la pose (fenêtre
  // seulement) — modifiable ensuite par instance dans l'inspector.
  const onHostJoinery = useCallback((objId) => {
    const state = useStore.getState()
    const opening = state.objects[objId]
    if (!isOpeningKind(opening?.kind)) return
    const host = nodeName(opening)
    const existing = findJoinery(state.objects, host)
    if (existing) {
      state.selectNode(existing.id)
      return
    }
    const payload = joineryPayloadFromOpening(opening, host, state.joineryVariant)
    if (payload) state.createObject(payload)
  }, [])

  // Insertion d'une vanne (E16-04) : le store coupe le run en deux + crée la
  // vanne au point cliqué, en une seule entrée d'historique (cf. insertValve).
  const onValve = useCallback((objId, point) => {
    useStore.getState().insertValve(objId, point)
  }, [])

  // ── Push/Pull (E12-08) : extruder/redimensionner par la face cliquée ─────────
  // Marche sur TOUTE face d'une forme : la face détermine la cote modifiée
  // (largeur/profondeur/hauteur). Le moteur du drag (aperçu, face opposée fixe,
  // commit en une entrée d'historique) est PARTAGÉ avec les poignées de
  // déformation (E22-01) : lib/useAxisDrag.
  const { startDrag, dragging } = useAxisDrag()

  const onStartPush = useCallback(
    (objId, event) => {
      const obj = useStore.getState().objects[objId]
      if (!obj) return
      // Seules les primitives d'esquisse s'extrudent : une ouverture ou un
      // composant élec posé n'est pas un volume à tirer.
      if (!obj.kind.startsWith('sketch.')) return
      const axis = pickPushAxis(obj, event)
      startDrag(
        {
          id: objId,
          paramKey: axis.key,
          axisVec: axis.vec,
          sign: axis.sign,
          anchored: axis.anchored,
          // Le point saisi sur la face : ancre de la mesure et du snapping
          // (E22-03) — la face suit le curseur là où on l'a attrapée.
          refPoint: [event.point.x, event.point.y, event.point.z],
        },
        event
      )
    },
    [startDrag]
  )

  // E22-01 : poignées de déformation sur l'objet app sélectionné — visibles
  // seulement en (édition + outil Sélection), jamais en visite. Le registre
  // (deformHandles) décide quels kinds en portent (rect pour l'instant).
  const selectedObj =
    editMode && activeTool === 'select' && viewMode !== 'visit'
      ? objects[selectedNode]
      : undefined

  return (
    <>
      {Object.values(objects).map((obj) => (
        <EditObject
          key={obj.id}
          obj={obj}
          preview={extrude?.id === obj.id ? extrude : undefined}
          selected={obj.id === selectedNode}
          selectable={selectable}
          pushable={pushable}
          hostable={hosting && isOpeningKind(obj.kind)}
          valvable={valving && isValvablePipe(obj)}
          onSelect={selectNode}
          onStartPush={onStartPush}
          onHost={onHostJoinery}
          onValve={onValve}
        />
      ))}
      {selectedObj && (
        <DeformHandles
          obj={selectedObj}
          preview={extrude?.id === selectedObj.id ? extrude : undefined}
          onStartDrag={startDrag}
          dragging={dragging}
        />
      )}
    </>
  )
}
