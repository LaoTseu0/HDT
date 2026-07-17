// E10-02 : édition des métadonnées descriptives (matériau / notes), commune aux
// objets importés de SketchUp (extras pipeline, via setNodeMeta) et aux objets
// créés in-app (via setObjectMeta) — même panneau Info pour les deux origines
// (rectification PO E19).
//
// Champs NON contrôlés, commit au blur (Entrée valide le matériau, Échap
// annule) : pas d'écriture store à chaque frappe — une édition = une écriture,
// donc une seule entrée d'historique zundo côté objets app. L'appelant pose une
// `key` composée `${id} ${material} ${notes}` : changement d'objet OU valeur
// externe (undo/redo) → remontage, champs re-seedés.

export interface MetaPatch {
  material?: string
  notes?: string
}

export default function MetaFields({
  material,
  notes,
  onChange,
}: {
  material: string | undefined
  notes: string | undefined
  onChange: (patch: MetaPatch) => void
}) {
  const commitMaterial = (value: string) => {
    const v = value.trim()
    if (v !== (material ?? '')) onChange({ material: v })
  }
  const commitNotes = (value: string) => {
    const v = value.trim()
    if (v !== (notes ?? '')) onChange({ notes: v })
  }
  return (
    <>
      <label className="edit-field grow">
        <span>Matériau</span>
        <input
          type="text"
          defaultValue={material ?? ''}
          placeholder="ex : béton banché"
          onBlur={(event) => commitMaterial(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              event.currentTarget.value = material ?? ''
              event.currentTarget.blur()
            }
          }}
        />
      </label>
      <label className="edit-field notes">
        <span>Notes</span>
        <textarea
          rows={3}
          defaultValue={notes ?? ''}
          placeholder="Remarques libres…"
          onBlur={(event) => commitNotes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.value = notes ?? ''
              event.currentTarget.blur()
            }
          }}
        />
      </label>
    </>
  )
}
