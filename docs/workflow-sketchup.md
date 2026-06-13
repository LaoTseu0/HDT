# Workflow SketchUp → GLB → Home3D Viewer

> Checklist du workflow de modélisation (backlog E9-02).
> Objectif : exporter un GLB exploitable **du premier coup**.
> Référence : `HTD_cahier_des_charges.md`.

---

## 1. Tags SketchUp (= calques de l'app)

Créer **exactement** ces 7 Tags (anciennement « Layers », renommés depuis SketchUp 2020) :

```
structure | ouvertures | elec | plomberie | vmc | reseau | terrain
```

### Pièges Tags — à vérifier avant chaque export

- [ ] **Un objet = un seul Tag.** SketchUp ne supporte pas le multi-tag : pas de
  « cet objet est à la fois elec et reseau ». Choisir le système dominant.
- [ ] **Les Tags cachés ne sont PAS exportés dans le GLB.** Avant d'exporter,
  rendre **tous** les Tags visibles, sinon des pans entiers du modèle manqueront
  silencieusement.
- [ ] Le Tag d'un objet doit correspondre au 1er segment de son nom
  (un objet nommé `elec__...` porte le Tag `elec`).
- [ ] Pas d'objets laissés sur le Tag par défaut (« Untagged ») — sauf
  géométrie de construction à ne pas exporter.

---

## 2. Nommage des Groupes/Composants (= node names du GLB)

Chaque objet exportable est un **Groupe ou Composant nommé** selon le format
à 5 segments (séparateur `__`, double underscore) :

```
[système]__[type]__[zone]__[niveau]__[index 3 chiffres]
```

| Segment | Valeurs autorisées |
|---|---|
| système | `structure`, `ouvertures`, `elec`, `plomberie`, `vmc`, `reseau`, `terrain` |
| type | libre — minuscules, `_` (underscore simple) entre les mots |
| zone | nom de pièce : `salon`, `cuisine`, `sdb`, `chambre1`, `garage`… |
| niveau | `ss`, `rdc`, `r1`, `r2`, `combles`, `ext` |
| index | 3 chiffres : `001`, `002`… |

Exemples valides :

```
structure__mur_porteur__salon__rdc__001
ouvertures__fenetre__chambre1__rdc__001
elec__prise__salon__rdc__003
plomberie__evacuation__wc__rdc__001
terrain__jardin__ext__ext__001
```

### Pièges nommage — à vérifier avant chaque export

- [ ] **Minuscules uniquement** — pas de `Mur_Porteur`.
- [ ] **Pas d'accents** — `electricite`, pas `électricité`.
- [ ] **Pas d'espaces** — `mur_porteur`, pas `mur porteur`.
- [ ] Séparateur de **segments** : `__` (double) ; séparateur de **mots** : `_` (simple).
- [ ] Index sur **3 chiffres** : `001`, pas `1`.
- [ ] Tout ce qui est extérieur (terrain, jardin) utilise le niveau `ext`.
- [ ] Le nom est posé sur le **Groupe/Composant**, pas sur la géométrie brute.

> Le pipeline rejette tout nom non conforme avec un rapport détaillé
> (raison + suggestion de correction). Regex appliquée :
> `^(structure|ouvertures|elec|plomberie|vmc|reseau|terrain)__[a-z0-9_]+__[a-z0-9_]+__(ss|rdc|r1|r2|combles|ext)__\d{3}$`

> **V2 (backlog E9-01)** : un plugin Ruby SketchUp avec dropdowns générera ces
> noms automatiquement. En attendant : copier-coller un nom valide et modifier.

---

## 3. Export GLB depuis SketchUp

1. Rendre **tous les Tags visibles** (cf. piège n°2 ci-dessus).
2. Purger le modèle : `Window > Model Info > Statistics > Purge Unused`
   (composants/matériaux orphelins alourdissent le GLB).
3. `File > Export > 3D Model` → format **glTF/GLB** (natif depuis SketchUp 2025 ;
   versions antérieures : extension d'export glTF).
4. Nommer l'export avec le suffixe `_raw` : `maison_raw.glb`.
5. Déposer le fichier dans `home3d/public/models/`.

---

## 4. Exécution du pipeline

Depuis `home3d/` :

```bash
npm run process -- public/models/maison_raw.glb
# → produit public/models/maison.glb (validation + extras + Draco + KTX2)
```

Le pipeline :

1. **Valide** les noms de nodes — en cas d'erreur : rapport détaillé,
   aucun fichier produit, corriger dans SketchUp et ré-exporter.
2. **Injecte** les métadonnées `extras` (par node + config calques sur la scène).
3. **Compresse** la géométrie (Draco). Désactivable : `--no-draco`.
4. **Compresse** les textures en KTX2 si présentes (E2-07).
   Désactivable : `--no-ktx2`. Nécessite l'outil `toktx` de
   [KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases)
   dans le PATH — s'il est absent, le pipeline continue avec les textures
   d'origine (avertissement affiché, GLB toujours valide).
5. **Affiche** le budget taille :

| Taille GLB brut | Action requise |
|---|---|
| < 10 MB | Draco optionnel |
| 10 – 30 MB | Draco obligatoire |
| 30 – 100 MB | Draco + KTX2 + revoir instancing |
| > 100 MB | **Revoir la modélisation SketchUp** (sur-détail) |

Seul `maison.glb` (sortie du pipeline) doit être chargé dans l'app —
jamais l'export brut.

---

## 5. Modèle de test (sans SketchUp)

Pour travailler sur l'app sans export SketchUp sous la main :

```bash
npm run model:test          # génère public/models/maison_raw.glb (pavillon de test)
npm run process -- public/models/maison_raw.glb
```

Variante avec nodes volontairement fautifs (démo du rapport d'erreurs) :

```bash
node script/make-test-model.mjs public/models/maison_invalid_raw.glb --invalid
```
