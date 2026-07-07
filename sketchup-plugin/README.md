# Home Designer — Extension SketchUp de nommage (E9-01)

Extension Ruby pour SketchUp qui nomme les Groupes/Composants selon la
convention Home3D et assigne le Tag correspondant, afin de produire un GLB
exploitable **du premier coup** par le pipeline (`home3d/script/process.mjs`).

Convention appliquée (source unique : [`home3d/script/naming.mjs`](../home3d/script/naming.mjs)) :

```
systeme__type__zone__niveau__index
ex. structure__mur_porteur__salon__rdc__001
```

## Ce que fait l'extension

- **Nommer la sélection…** — boîte de dialogue à dropdowns :
  - **Système** : liste fermée (`structure`, `ouvertures`, `elec`, `plomberie`, `vmc`, `reseau`, `terrain`).
  - **Type** : vocabulaire canonique du système (E20, miroir de `SUBTYPES` dans `home3d/script/naming.mjs`) + option « (autre…) » pour saisie libre — le segment reste ouvert.
  - **Zone** : suggestions + zones déjà présentes dans le modèle + « (autre…) ».
  - **Niveau** : liste fermée (`ss`, `rdc`, `r1`, `r2`, `combles`, `ext`), libellés FR.
  - **Index auto-incrémenté** par bucket (système, zone, niveau) en `max + 1`.
  - **Normalisation** identique au pipeline (minuscules, accents retirés,
    espaces/tirets → `_`) → le nom **passe toujours** la regex de validation.
  - **Assigne le Tag** = système (le crée s'il manque) — respecte la règle
    « le Tag d'un objet = son 1er segment ».
  - Sélection multiple : tous les objets reçoivent le même système/type/zone/niveau
    avec un index séquentiel ; re-nommer la même sélection ne fait pas grimper
    l'index (l'objet s'exclut lui-même du calcul).

- **Vérifier les noms du modèle** — parcourt les groupes/composants porteurs de
  géométrie, **sélectionne** ceux dont le nom est non conforme (ou absent : le
  fameux « bloc unique » exporté en `Geom3D`), et détaille les raisons dans la
  **Console Ruby** (Fenêtre > Console Ruby).

Accès : menu **Extensions > Home Designer**, ou **clic droit** sur une sélection.

## Installation

### Méthode A — Extension Manager (recommandée)

1. Zippe le contenu de ce dossier (le fichier `home_designer_namer.rb` **et** le
   dossier `home_designer_namer/`) à la racine d'une archive, puis renomme
   l'archive en `.rbz` :

   ```bash
   # depuis sketchup-plugin/
   cd sketchup-plugin
   zip -r home_designer_namer.rbz home_designer_namer.rb home_designer_namer
   ```

   > Important : `home_designer_namer.rb` doit être à la **racine** du `.rbz`,
   > pas dans un sous-dossier.

2. Dans SketchUp : **Fenêtre > Extension Manager > Install Extension**, puis
   sélectionne le `.rbz`.

### Méthode B — copie manuelle

Copie `home_designer_namer.rb` **et** le dossier `home_designer_namer/` dans le
dossier Plugins de SketchUp :

- Windows : `%AppData%\SketchUp\SketchUp 2025\SketchUp\Plugins\`
- macOS : `~/Library/Application Support/SketchUp 2025/SketchUp/Plugins/`

Puis redémarre SketchUp.

## Workflow recommandé

1. Si la maison est un seul bloc : explose-la, regroupe chaque élément (mur,
   dalle, fenêtre…) dans **son propre Groupe**.
2. Sélectionne un (ou plusieurs) groupe(s) de même nature → **Nommer la sélection…**.
3. Une fois tout nommé → **Vérifier les noms du modèle** (doit afficher ✅).
4. Exporte en GLB et lance le pipeline (cf. [`docs/workflow-sketchup.md`](../docs/workflow-sketchup.md)).

## Note

Le segment `index` est limité à **3 chiffres** (001–999) par la convention. Au-delà
dans un même bucket, découpe la zone (`salon` → `salon_nord` / `salon_sud`).
