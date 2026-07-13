// Registre paramétrique d'Edit mode (E12-05, cf. docs/edit-mode-design.md § 5.1).
//
// Couture d'extensibilité : chaque `kind` est associé à une fonction PURE
// `generate(params, plane) → THREE.Object3D`. La géométrie est toujours DÉRIVÉE
// des params (jamais l'inverse) → un objet créé in-app est ré-éditable et
// régénérable au chargement depuis ses `extras.edit`. Ajouter un objet = ajouter
// une entrée ici.

import type * as THREE from 'three'
import { ELEC_COMPONENTS } from '@/features/mep/elec'
import { CABLE_KIND } from '@/features/mep/cable'
import { PIPE_KIND, slopedPoints } from '@/features/mep/plumbing'
import { VALVE_KIND } from '@/features/mep/valve'
import { DOOR_LEAF_KIND, JOINERY_KIND } from '@/features/openings/joinery'
import { DOOR_KIND, WINDOW_KIND } from '@/features/openings/opening'
import { tagAppObjectId } from '@/types'
import { generateArc, generateCircle, generateRect } from './generateSketch'
import { generateDoorLeaf, generateJoinery, generateOpening } from './generateOpenings'
import {
  ELEC_EDGE,
  ELEC_FILL,
  PLUMB_EDGE,
  PLUMB_FILL,
  generateElec,
  generateValve,
  makeGenerateRun,
} from './generateMep'
import type { AppObject, Kind, ObjectPlane, ParamsByKind } from '@/types'
import type { Generator } from './common'

const REGISTRY: { [K in Kind]: Generator<ParamsByKind[K]> } = {
  'sketch.rect': generateRect,
  'sketch.circle': generateCircle,
  'sketch.arc': generateArc,
  [WINDOW_KIND]: generateOpening,
  // La porte réemploie le marqueur d'ouverture (même repère seuil/largeur/hauteur) ;
  // seule la pose diffère (seuil au sol, cf. openings/opening doorPayload).
  [DOOR_KIND]: generateOpening,
  [JOINERY_KIND]: generateJoinery,
  [DOOR_LEAF_KIND]: generateDoorLeaf,
  [CABLE_KIND]: makeGenerateRun(ELEC_FILL, ELEC_EDGE),
  // Le tuyau rend ses points PENTUS (E16-02) — les clics restent dans params.
  [PIPE_KIND]: makeGenerateRun(PLUMB_FILL, PLUMB_EDGE, slopedPoints),
  [VALVE_KIND]: generateValve,
  // Tout le catalogue élec partage `generateElec` (seules les dims diffèrent).
  'elec.outlet': generateElec,
  'elec.switch': generateElec,
  'elec.junction': generateElec,
  'elec.meter': generateElec,
}

export function isKnownKind(kind: string | null | undefined): kind is Kind {
  return typeof kind === 'string' && kind in REGISTRY
}

// Contrat de nommage par `kind` (E12-06) : système (= calque) + type composant le
// node name conforme `système__type__zone__niveau__index`. La zone/niveau viennent
// de l'inspector, l'index est auto-incrémenté (cf. core/naming). Les primitives
// d'esquisse de Slice 0 (`sketch.*`) ne relèvent d'aucun système technique : on les
// rattache à `structure` (volume/forme). Les vrais objets MEP/ouvertures des slices
// suivantes déclarent ici leur propre système/type.
const KIND_NAMING: Record<Kind, { system: string; type: string }> = {
  'sketch.rect': { system: 'structure', type: 'forme' },
  'sketch.circle': { system: 'structure', type: 'disque' },
  'sketch.arc': { system: 'structure', type: 'arc' },
  [WINDOW_KIND]: { system: 'ouvertures', type: 'fenetre' },
  [DOOR_KIND]: { system: 'ouvertures', type: 'porte' }, // ouverture de porte (E14-07)
  [JOINERY_KIND]: { system: 'ouvertures', type: 'menuiserie' }, // cadre+vitrage (E14-05)
  [DOOR_LEAF_KIND]: { system: 'ouvertures', type: 'vantail' }, // vantail de porte (E14-07)
  [CABLE_KIND]: { system: 'elec', type: 'cable' }, // câble routé (E15-03)
  [PIPE_KIND]: { system: 'plomberie', type: 'tuyau' }, // tuyau routé (E16-01)
  [VALVE_KIND]: { system: 'plomberie', type: 'vanne' }, // vanne inline (E16-04)
  // elec.* → système `elec`, type = celui du catalogue (prise, interrupteur…).
  'elec.outlet': { system: 'elec', type: ELEC_COMPONENTS['elec.outlet'].type },
  'elec.switch': { system: 'elec', type: ELEC_COMPONENTS['elec.switch'].type },
  'elec.junction': { system: 'elec', type: ELEC_COMPONENTS['elec.junction'].type },
  'elec.meter': { system: 'elec', type: ELEC_COMPONENTS['elec.meter'].type },
}

/** Système/type de nommage d'un `kind` (repli `structure`/`forme`). */
export function kindNaming(kind: string | null | undefined): {
  system: string
  type: string
} {
  return (
    (isKnownKind(kind) ? KIND_NAMING[kind] : null) ?? {
      system: 'structure',
      type: 'forme',
    }
  )
}

/**
 * Génère l'Object3D d'un objet app. Tague son id sur le groupe et ses enfants
 * pour que le raycast de sélection remonte à l'objet métier.
 */
export function generateObject(obj: AppObject): THREE.Object3D | null {
  if (!isKnownKind(obj.kind)) return null
  // Cast localisé : TS ne corrèle pas REGISTRY[obj.kind] avec obj.params à
  // travers l'union — la table garantit pourtant l'appariement par K.
  const gen = REGISTRY[obj.kind] as Generator<unknown>
  const object3d = gen(obj.params, obj.plane satisfies ObjectPlane)
  object3d.name = obj.id
  tagAppObjectId(object3d, obj.id)
  object3d.traverse((child) => {
    tagAppObjectId(child, obj.id)
  })
  return object3d
}

/** Libère géométries et matériaux d'un Object3D généré (à l'unmount / régénération). */
export function disposeObject(object3d: THREE.Object3D): void {
  object3d.traverse((child) => {
    const mesh = child as Partial<THREE.Mesh>
    mesh.geometry?.dispose()
    const material = mesh.material
    if (Array.isArray(material)) material.forEach((m) => m.dispose())
    else material?.dispose()
  })
}
