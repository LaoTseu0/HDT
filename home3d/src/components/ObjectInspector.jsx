import { useState } from 'react'
import useStore from '../store/useStore.js'
import { LEVELS, subtypesOf, normalizeType } from '../lib/naming.js'
import { WINDOW_KIND, isOpeningKind } from '../lib/opening.js'
import { isElecKind } from '../lib/elec.js'
import {
  JOINERY_KIND,
  DOOR_LEAF_KIND,
  JOINERY_VARIANTS,
  JOINERY_VARIANT_KEYS,
} from '../lib/joinery.js'
import { CABLE_SECTIONS, CABLE_SECTION_KEYS, CABLE_KIND } from '../lib/cable.js'
import {
  PIPE_SECTIONS,
  PIPE_SECTION_KEYS,
  PIPE_KIND,
  pipeLength,
  MAX_PENTE_PCT,
} from '../lib/plumbing.js'
import { pathLength } from '../lib/routing.js'
import { VALVE_KIND } from '../lib/valve.js'

// Inspector éditable de l'objet app sélectionné (E12-01/E13-04), affiché dans
// le panneau Info détaché à droite — le MÊME panneau que les infos des objets
// importés de SketchUp (rectification PO E19, 2026-07-07). Historiquement logé
// sous la palette d'outils de l'EditBar.

// Libellés FR des niveaux (segment `level` de la convention de nommage).
const LEVEL_LABELS = {
  ss: 'Sous-sol',
  rdc: 'Rez-de-chaussée',
  r1: 'R+1',
  r2: 'R+2',
  combles: 'Combles',
  ext: 'Extérieur',
}

// Listes ordonnées des catalogues pour les dropdowns de l'inspector.
const JOINERY_VARIANT_LIST = JOINERY_VARIANT_KEYS.map((id) => ({
  value: id,
  label: JOINERY_VARIANTS[id].label,
}))
const CABLE_SECTION_LIST = CABLE_SECTION_KEYS.map((id) => ({
  value: id,
  label: CABLE_SECTIONS[id].label,
}))
const PIPE_SECTION_LIST = PIPE_SECTION_KEYS.map((id) => ({
  value: id,
  label: PIPE_SECTIONS[id].label,
}))

function SelectField({ label, value, options, onChange }) {
  // Options acceptées en `'x'` ou `{ value, label }` → forme normalisée unique.
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
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
// (SUBTYPES, source unique script/naming.mjs) + « Autre… » pour une saisie
// libre normalisée — le vocabulaire est OUVERT, un type hors liste est accepté.
// Monté avec key={obj.id} : l'état de saisie libre se réinitialise par objet.
const OTHER_SUBTYPE = '__autre__'

function SubtypeField({ obj, onChange }) {
  const [freeEntry, setFreeEntry] = useState(false)
  const options = [
    ...subtypesOf(obj.system),
    { value: OTHER_SUBTYPE, label: 'Autre…' },
  ]
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

function NumberField({ label, value, onChange, allowZero = false, signed = false, step = '0.05' }) {
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

export default function ObjectInspector({ obj }) {
  const updateObjectParams = useStore((state) => state.updateObjectParams)
  const setOpeningAllege = useStore((state) => state.setOpeningAllege)
  const setObjectFloorHeight = useStore((state) => state.setObjectFloorHeight)
  const setObjectNaming = useStore((state) => state.setObjectNaming)
  const deleteObject = useStore((state) => state.deleteObject)
  const metadata = useStore((state) => state.metadata)
  const csgFallbackIds = useStore((state) => state.csgFallbackIds)

  // Catalogue de sections d'un run routé sélectionné (câble E15-03 / tuyau
  // E16-01) — l'inspector est commun, seul le catalogue change.
  const runCatalog =
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
        options={LEVELS.map((id) => ({ value: id, label: LEVEL_LABELS[id] ?? id }))}
        onChange={(level) => setObjectNaming(obj.id, { level })}
      />
      {runCatalog ? (
        <>
          <SelectField
            label="Section"
            value={obj.params.section}
            options={runCatalog.list}
            onChange={(section) => {
              const s = runCatalog.sections[section]
              if (!s) return
              updateObjectParams(obj.id, {
                section,
                diametre_mm: s.diametre_mm,
                // La famille (cuivre/évac) n'existe que côté plomberie.
                ...(s.famille ? { famille: s.famille } : {}),
                largeur_m: s.dims.largeur_m,
                hauteur_m: s.dims.hauteur_m,
              })
            }}
          />
          {/* Pente d'évacuation (E16-02) : % de descente par longueur
              horizontale, appliqué depuis l'AMONT (1er point tracé). Les
              runs d'alimentation (cuivre) n'ont pas de pente. */}
          {obj.kind === PIPE_KIND && obj.params.famille === 'evac' && (
            <NumberField
              label="Pente (%)"
              value={obj.params.pente_pct ?? 0}
              allowZero
              step="0.5"
              onChange={(v) =>
                updateObjectParams(obj.id, {
                  pente_pct: Math.min(v, MAX_PENTE_PCT),
                })
              }
            />
          )}
          <p className="edit-hint">
            {obj.params.points?.length ?? 0} sommets ·{' '}
            {(obj.kind === PIPE_KIND
              ? pipeLength(obj.params)
              : pathLength(obj.params.points ?? [])
            ).toFixed(2)}{' '}
            m
          </p>
        </>
      ) : obj.kind === VALVE_KIND ? (
        // Vanne inline (E16-04) : la section vient du tuyau coupé à
        // l'insertion — rien à éditer ici à part le nommage / suppression.
        <p className="edit-hint">
          Vanne{' '}
          {PIPE_SECTIONS[obj.params.section]?.label ??
            `Ø${obj.params.diametre_mm ?? '—'}`}{' '}
          — insérée sur l'axe du tuyau (run coupé en deux tronçons).
        </p>
      ) : isElecKind(obj.kind) ? (
        <>
          <NumberField
            label="Largeur (m)"
            value={obj.params.largeur_m}
            onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
          />
          <NumberField
            label="Hauteur (m)"
            value={obj.params.hauteur_m}
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
          <NumberField
            label="Profondeur (m)"
            value={obj.params.profondeur_m}
            onChange={(v) => updateObjectParams(obj.id, { profondeur_m: v })}
          />
          <NumberField
            label="Hauteur / sol (m)"
            value={obj.plane?.origin?.[1] ?? 0}
            allowZero
            onChange={(v) => setObjectFloorHeight(obj.id, v)}
          />
          <p className="edit-hint">
            Mur : <code>{obj.plane?.faceOf ?? '—'}</code>
          </p>
        </>
      ) : obj.kind === JOINERY_KIND || obj.kind === DOOR_LEAF_KIND ? (
        <>
          {/* La variante (fixe/battant/coulissant) est propre aux fenêtres ;
              un vantail de porte (E14-07) n'en a pas. */}
          {obj.kind === JOINERY_KIND && (
            <SelectField
              label="Variante"
              value={obj.params.variante ?? 'fixe'}
              options={JOINERY_VARIANT_LIST}
              onChange={(variante) => updateObjectParams(obj.id, { variante })}
            />
          )}
          <NumberField
            label="Largeur (m)"
            value={obj.params.largeur_m}
            onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
          />
          <NumberField
            label="Hauteur (m)"
            value={obj.params.hauteur_m}
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
          <NumberField
            label="Épaisseur cadre (m)"
            value={obj.params.epaisseur_m}
            step="0.01"
            onChange={(v) => updateObjectParams(obj.id, { epaisseur_m: v })}
          />
          <NumberField
            label="Profondeur (m)"
            value={obj.params.profondeur_m}
            step="0.01"
            onChange={(v) => updateObjectParams(obj.id, { profondeur_m: v })}
          />
          <p className="edit-hint">
            Ouverture : <code>{obj.plane?.hostOf ?? '—'}</code>
          </p>
        </>
      ) : isOpeningKind(obj.kind) ? (
        <>
          <NumberField
            label="Largeur (m)"
            value={obj.params.largeur_m}
            onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
          />
          <NumberField
            label="Hauteur (m)"
            value={obj.params.hauteur_m}
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
          {/* L'allège est propre aux fenêtres : le seuil d'une porte est au sol. */}
          {obj.kind === WINDOW_KIND && (
            <NumberField
              label="Allège (m)"
              value={obj.params.allege_m}
              allowZero
              onChange={(v) => setOpeningAllege(obj.id, v)}
            />
          )}
          <p className="edit-hint">
            Mur : <code>{obj.plane?.faceOf ?? '—'}</code>
          </p>
          {csgFallbackIds.includes(obj.id) && (
            <p className="edit-warning">
              ⚠ Mur non perçable (géométrie dégénérée) : ouverture posée en
              surface, sans trou.
            </p>
          )}
        </>
      ) : (
        <>
          {obj.kind === 'sketch.circle' ? (
            <NumberField
              label="Rayon (m)"
              value={obj.params.rayon_m}
              onChange={(v) => updateObjectParams(obj.id, { rayon_m: v })}
            />
          ) : obj.kind === 'sketch.arc' ? (
            <>
              <NumberField
                label="Rayon (m)"
                value={obj.params.rayon_m}
                onChange={(v) => updateObjectParams(obj.id, { rayon_m: v })}
              />
              <NumberField
                label="Balayage (°)"
                value={obj.params.angle_balayage_deg}
                signed
                step="5"
                onChange={(v) =>
                  updateObjectParams(obj.id, { angle_balayage_deg: v })
                }
              />
            </>
          ) : (
            <>
              <NumberField
                label="Largeur (m)"
                value={obj.params.largeur_m}
                onChange={(v) => updateObjectParams(obj.id, { largeur_m: v })}
              />
              <NumberField
                label="Profondeur (m)"
                value={obj.params.profondeur_m}
                onChange={(v) => updateObjectParams(obj.id, { profondeur_m: v })}
              />
            </>
          )}
          <NumberField
            label="Hauteur (m)"
            value={obj.params.hauteur_m}
            allowZero
            onChange={(v) => updateObjectParams(obj.id, { hauteur_m: v })}
          />
        </>
      )}
      <button className="edit-delete" onClick={() => deleteObject(obj.id)}>
        Supprimer
      </button>
    </div>
  )
}
