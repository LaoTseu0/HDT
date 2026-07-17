import { useState } from 'react'
import useStore from '@/store/useStore'
import { LEVELS, subtypesOf, normalizeType } from '@/core/naming'
import { WINDOW_KIND, isOpeningKind } from '@/features/openings/opening'
import { isElecKind } from '@/features/mep/elec'
import {
  JOINERY_KIND,
  DOOR_LEAF_KIND,
  JOINERY_VARIANTS,
  JOINERY_VARIANT_KEYS,
} from '@/features/openings/joinery'
import { CABLE_SECTIONS, CABLE_SECTION_KEYS, CABLE_KIND } from '@/features/mep/cable'
import type { CableSectionPreset } from '@/features/mep/cable'
import {
  PIPE_SECTIONS,
  PIPE_SECTION_KEYS,
  PIPE_KIND,
  pipeLength,
  MAX_PENTE_PCT,
} from '@/features/mep/plumbing'
import type { PipeSectionPreset } from '@/features/mep/plumbing'
import { pathLength } from '@/features/mep/routing'
import { VALVE_KIND } from '@/features/mep/valve'
import MetaFields from './MetaFields'
import type { AppObject, Vec3 } from '@/types'

// Inspector éditable de l'objet app sélectionné (E12-01/E13-04), affiché dans le
// panneau Info détaché à droite — le MÊME panneau que les infos des objets
// importés de SketchUp (rectification PO E19, 2026-07-07).

// Libellés FR des niveaux (segment `level` de la convention de nommage).
const LEVEL_LABELS: Record<string, string> = {
  ss: 'Sous-sol',
  rdc: 'Rez-de-chaussée',
  r1: 'R+1',
  r2: 'R+2',
  combles: 'Combles',
  ext: 'Extérieur',
}

/** Option de dropdown normalisée. */
interface Opt {
  value: string
  label: string
}

// Listes ordonnées des catalogues pour les dropdowns de l'inspector.
const JOINERY_VARIANT_LIST: Opt[] = JOINERY_VARIANT_KEYS.map((id) => ({
  value: id,
  label: JOINERY_VARIANTS[id].label,
}))
const CABLE_SECTION_LIST: Opt[] = CABLE_SECTION_KEYS.map((id) => ({
  value: id,
  label: CABLE_SECTIONS[id]!.label,
}))
const PIPE_SECTION_LIST: Opt[] = PIPE_SECTION_KEYS.map((id) => ({
  value: id,
  label: PIPE_SECTIONS[id]!.label,
}))

/**
 * Vue permissive des params pour l'affichage : le formulaire branche sur
 * `obj.kind` mais les guards (isElecKind…) portent sur `kind` seul et ne
 * re-corrèlent pas l'union `params`. On lit donc les cotes via cette vue (tous
 * champs optionnels) — les écritures passent par des actions store typées.
 */
interface InspectorParams {
  section?: string
  diametre_mm?: number
  famille?: string
  largeur_m?: number
  hauteur_m?: number
  profondeur_m?: number
  epaisseur_m?: number
  rayon_m?: number
  angle_balayage_deg?: number
  allege_m?: number
  variante?: string
  pente_pct?: number
  points?: Vec3[]
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<string | Opt>
  onChange: (value: string) => void
}) {
  // Options acceptées en `'x'` ou `{ value, label }` → forme normalisée unique.
  const opts: Opt[] = options.map((o) =>
    typeof o === 'object' ? o : { value: o, label: o }
  )
  // La valeur courante peut manquer des options (zone par défaut, ou zone d'un
  // objet rechargé absente du modèle courant) → on l'ajoute en tête.
  if (!opts.some((o) => o.value === value)) opts.unshift({ value, label: value })
  return (
    <label className="edit-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {opts.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// Sous-type de l'objet (E20-03) : dropdown du vocabulaire canonique du système
// (SUBTYPES, source unique script/naming.mjs) + « Autre… » pour une saisie libre
// normalisée — le vocabulaire est OUVERT, un type hors liste est accepté. Monté
// avec key={obj.id} : l'état de saisie libre se réinitialise par objet.
const OTHER_SUBTYPE = '__autre__'

function SubtypeField({
  obj,
  onChange,
}: {
  obj: AppObject
  onChange: (type: string) => void
}) {
  const [freeEntry, setFreeEntry] = useState(false)
  const vocab = subtypesOf(obj.system) as Opt[]
  const options: Opt[] = [...vocab, { value: OTHER_SUBTYPE, label: 'Autre…' }]
  if (freeEntry) {
    return (
      <label className="edit-field">
        <span>Type</span>
        <input
          type="text"
          autoFocus
          placeholder="ex : pergola"
          defaultValue={obj.type}
          onBlur={(event) => {
            onChange(normalizeType(event.target.value, obj.type))
            setFreeEntry(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setFreeEntry(false)
          }}
        />
      </label>
    )
  }
  return (
    <SelectField
      label="Type"
      value={obj.type}
      options={options}
      onChange={(value) => {
        if (value === OTHER_SUBTYPE) setFreeEntry(true)
        else onChange(value)
      }}
    />
  )
}

function NumberField({
  label,
  value,
  onChange,
  allowZero = false,
  signed = false,
  step = '0.05',
}: {
  label: string
  value: number | undefined
  onChange: (value: number) => void
  allowZero?: boolean
  signed?: boolean
  step?: string
}) {
  // `signed` : valeur réelle non nulle (ex. balayage d'arc en degrés, ±360).
  const min = signed ? undefined : allowZero ? '0' : '0.01'
  return (
    <label className="edit-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value ?? 0}
        onChange={(event) => {
          const v = parseFloat(event.target.value)
          if (Number.isNaN(v)) return
          const ok = signed ? v !== 0 : allowZero ? v >= 0 : v > 0
          if (ok) onChange(Number(v.toFixed(3)))
        }}
      />
    </label>
  )
}

export default function ObjectInspector({ obj }: { obj: AppObject }) {
  const updateObjectParams = useStore((state) => state.updateObjectParams)
  const setOpeningAllege = useStore((state) => state.setOpeningAllege)
  const setObjectFloorHeight = useStore((state) => state.setObjectFloorHeight)
  const setObjectNaming = useStore((state) => state.setObjectNaming)
  const setObjectMeta = useStore((state) => state.setObjectMeta)
  const deleteObject = useStore((state) => state.deleteObject)
  const metadata = useStore((state) => state.metadata)
  const csgFallbackIds = useStore((state) => state.csgFallbackIds)

  const params = obj.params as InspectorParams
  const plane = obj.plane

  // Catalogue de sections d'un run routé sélectionné (câble E15-03 / tuyau
  // E16-01) — l'inspector est commun, seul le catalogue change.
  const runCatalog: {
    sections: Record<string, CableSectionPreset | PipeSectionPreset>
    list: Opt[]
  } | null =
    obj.kind === CABLE_KIND
      ? { sections: CABLE_SECTIONS, list: CABLE_SECTION_LIST }
      : obj.kind === PIPE_KIND
        ? { sections: PIPE_SECTIONS, list: PIPE_SECTION_LIST }
        : null

  return (
    <div className="edit-inspector">
      <SubtypeField
        key={obj.id}
        obj={obj}
        onChange={(type) => setObjectNaming(obj.id, { type })}
      />
      <SelectField
        label="Zone"
        value={obj.zone}
        options={metadata?.model?.zones ?? []}
        onChange={(zone) => setObjectNaming(obj.id, { zone })}
      />
      <SelectField
        label="Niveau"
        value={obj.level}
        options={LEVELS.map((id: string) => ({
          value: id,
          label: LEVEL_LABELS[id] ?? id,
        }))}
        onChange={(level) => setObjectNaming(obj.id, { level })}
      />
      {runCatalog ? (
        <>
          <SelectField
            label="Section"
            value={params.section ?? ''}
            options={runCatalog.list}
            onChange={(section) => {
              const s = runCatalog.sections[section]
              if (!s) return
              updateObjectParams(obj.id, {
                section,
                diametre_mm: s.diametre_mm,
                // La famille (cuivre/évac) n'existe que côté plomberie.
                ...('famille' in s ? { famille: s.famille } : {}),
                largeur_m: s.dims.largeur_m,
                hauteur_m: s.dims.hauteur_m,
              })
            }}
          />
          {/* Pente d'évacuation (E16-02) : % de descente par longueur horizontale,
              appliqué depuis l'AMONT (1er point tracé). Les runs d'alimentation
              (cuivre) n'ont pas de pente. */}
          {obj.kind === PIPE_KIND && params.famille === 'evac' && (
            <NumberField
              label="Pente (%)"
              value={params.pente_pct ?? 0}
              allowZero
              step="0.5"
              onChange={(v) =>
                updateObjectParams(obj.id, { pente_pct: Math.min(v, MAX_PENTE_PCT) })
              }
            />
          )}
          <p className="edit-hint">
            {params.points?.length ?? 0} sommets ·{' '}
            {(obj.kind === PIPE_KIND
              ? pipeLength(obj.params as never)
              : pathLength(params.points ?? [])
            ).toFixed(2)}{' '}
            m
          </p>
        </>
      ) : obj.kind === VALVE_KIND ? (
        // Vanne inline (E16-04) : la section vient du tuyau coupé à l'insertion —
        // rien à éditer ici à part le nommage / suppression.
        <p className="edit-hint">
          Vanne{' '}
          {(params.section && PIPE_SECTIONS[params.section]?.label) ??
            `Ø${params.diametre_mm ?? '—'}`}{' '}
          — insérée sur l&apos;axe du tuyau (run coupé en deux tronçons).
        </p>
      ) : isElecKind(obj.kind) ? (
        <>
          <NumberField
            label="Largeur (m)"
            value={params.largeur_m}
            onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
          />
          <NumberField
            label="Hauteur (m)"
            value={params.hauteur_m}
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
          <NumberField
            label="Profondeur (m)"
            value={params.profondeur_m}
            onChange={(v) => updateObjectParams(obj.id, { profondeur_m: v })}
          />
          <NumberField
            label="Hauteur / sol (m)"
            value={plane?.origin?.[1] ?? 0}
            allowZero
            onChange={(v) => setObjectFloorHeight(obj.id, v)}
          />
          <p className="edit-hint">
            Mur : <code>{plane?.faceOf ?? '—'}</code>
          </p>
        </>
      ) : obj.kind === JOINERY_KIND || obj.kind === DOOR_LEAF_KIND ? (
        <>
          {/* La variante (fixe/battant/coulissant) est propre aux fenêtres ; un
              vantail de porte (E14-07) n'en a pas. */}
          {obj.kind === JOINERY_KIND && (
            <SelectField
              label="Variante"
              value={params.variante ?? 'fixe'}
              options={JOINERY_VARIANT_LIST}
              onChange={(variante) => updateObjectParams(obj.id, { variante })}
            />
          )}
          <NumberField
            label="Largeur (m)"
            value={params.largeur_m}
            onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
          />
          <NumberField
            label="Hauteur (m)"
            value={params.hauteur_m}
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
          <NumberField
            label="Épaisseur cadre (m)"
            value={params.epaisseur_m}
            step="0.01"
            onChange={(v) => updateObjectParams(obj.id, { epaisseur_m: v })}
          />
          <NumberField
            label="Profondeur (m)"
            value={params.profondeur_m}
            step="0.01"
            onChange={(v) => updateObjectParams(obj.id, { profondeur_m: v })}
          />
          <p className="edit-hint">
            Ouverture : <code>{plane?.hostOf ?? '—'}</code>
          </p>
        </>
      ) : isOpeningKind(obj.kind) ? (
        <>
          <NumberField
            label="Largeur (m)"
            value={params.largeur_m}
            onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
          />
          <NumberField
            label="Hauteur (m)"
            value={params.hauteur_m}
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
          {/* L'allège est propre aux fenêtres : le seuil d'une porte est au sol. */}
          {obj.kind === WINDOW_KIND && (
            <NumberField
              label="Allège (m)"
              value={params.allege_m}
              allowZero
              onChange={(v) => setOpeningAllege(obj.id, v)}
            />
          )}
          <p className="edit-hint">
            Mur : <code>{plane?.faceOf ?? '—'}</code>
          </p>
          {csgFallbackIds.includes(obj.id) && (
            <p className="edit-warning">
              ⚠ Mur non perçable (géométrie dégénérée) : ouverture posée en surface, sans
              trou.
            </p>
          )}
        </>
      ) : (
        <>
          {obj.kind === 'sketch.circle' ? (
            <NumberField
              label="Rayon (m)"
              value={params.rayon_m}
              onChange={(v) => updateObjectParams(obj.id, { rayon_m: v })}
            />
          ) : obj.kind === 'sketch.arc' ? (
            <>
              <NumberField
                label="Rayon (m)"
                value={params.rayon_m}
                onChange={(v) => updateObjectParams(obj.id, { rayon_m: v })}
              />
              <NumberField
                label="Balayage (°)"
                value={params.angle_balayage_deg}
                signed
                step="5"
                onChange={(v) => updateObjectParams(obj.id, { angle_balayage_deg: v })}
              />
            </>
          ) : (
            <>
              <NumberField
                label="Largeur (m)"
                value={params.largeur_m}
                onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
              />
              <NumberField
                label="Profondeur (m)"
                value={params.profondeur_m}
                onChange={(v) => updateObjectParams(obj.id, { profondeur_m: v })}
              />
            </>
          )}
          <NumberField
            label="Hauteur (m)"
            value={params.hauteur_m}
            allowZero
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
        </>
      )}
      {/* E10-02 : matériau / notes — mêmes champs que les objets importés
          (panneau Info commun) ; commit au blur → une entrée d'historique. */}
      <MetaFields
        key={`${obj.id} ${obj.material ?? ''} ${obj.notes ?? ''}`}
        material={obj.material}
        notes={obj.notes}
        onChange={(patch) => setObjectMeta(obj.id, patch)}
      />
      <button className="edit-delete" onClick={() => deleteObject(obj.id)}>
        Supprimer
      </button>
    </div>
  )
}
