# Projet : Home3D Viewer — Cahier des charges V2

---

## Objectif

Application web personnelle de visualisation 3D d'une maison avec système
de calques techniques (structure, électricité, plomberie, VMC, réseau).
Usage perso en premier lieu. Stack web moderne.

---

## Roadmap validée

- **V1** : Viewer 3D web + système de calques. Modélisation externe dans SketchUp.
- **V2** : Édition/correction du modèle directement dans l'app (raycasting,
           transform controls, undo/redo).
- **V3** : Modélisation complète in-app (hors scope pour l'instant).

---

## Stack V1

- **Frontend** : Vite + React + React Three Fiber + Drei + Zustand
- **Format 3D** : GLB (glTF 2.0 binaire) exporté depuis SketchUp
- **Métadonnées** : embarquées dans le champ `extras` du GLB (pas de fichier companion)
- **Pipeline** : script Node.js (`@gltf-transform`) de validation + injection + compression
- **Pas de backend** pour la V1 (app locale/statique)

> **Pourquoi Vite et non Next.js ?**
> La V1 est une app locale/statique sans SSR, API routes ni middleware.
> Next.js apporterait une complexité inutile (Server Components incompatibles
> avec WebGL, build lourd). Migration vers Next.js possible en V2/V3 si besoin
> d'hébergement partagé ou d'API routes pour la persistence des métadonnées.

---

## Source du modèle 3D : SketchUp

L'utilisateur modélise dans SketchUp Free/Pro et exporte en GLB.

Points clés sur SketchUp :
- Les "Layers" s'appellent désormais **"Tags"** (depuis v2020)
- Un objet = un seul Tag possible (pas multi-tag natif)
- Les Tags cachés ne sont **PAS** exportés dans le GLB
- Les noms de groupes/composants SketchUp → noms de nodes glTF
- SketchUp 2025 supporte nativement l'export glTF/GLB
- Le champ `extras` du glTF supporte des métadonnées custom par node

> **Note V2 (backlog)** : Envisager un plugin Ruby SketchUp (.rb) qui expose
> une UI avec dropdowns pour générer les noms de nodes automatiquement,
> évitant toute faute de frappe dans le workflow de modélisation.

---

## Format GLB et métadonnées

### GLB vs glTF

| | glTF | GLB |
|---|---|---|
| Structure | Multi-fichiers (JSON + .bin + textures) | Fichier binaire unique |
| Lisibilité | JSON lisible à la main | Binaire |
| Usage | Debug / édition manuelle | **Production ← notre choix** |

**glTF est la spécification, GLB est le format de fichier.**
C'est un standard ouvert du Khronos Group (même consortium qu'OpenGL/WebGL),
supporté nativement par Three.js, Blender, Unity, Unreal, SketchUp 2021+.

### Stratégie métadonnées : champ `extras` du GLB

Les métadonnées sémantiques sont injectées dans le champ `extras` de chaque
node glTF par le script de post-processing, après l'export SketchUp.

**Avantages vs fichier companion JSON :**
- Un seul fichier à gérer et à distribuer
- Pas de risque de désynchronisation GLB ↔ JSON
- Standard glTF, compatible avec tous les loaders

**Structure `extras` par node :**
```json
{
  "layer": "structure",
  "type": "mur_porteur",
  "zone": "salon",
  "level": "rdc",
  "index": 1,
  "dims": { "largeur_m": 0.20, "profondeur_m": 0.15, "hauteur_m": 2.50 },
  "material": "beton",
  "notes": ""
}
```

> `dims` est **calculé automatiquement** par le pipeline (issue #9) à partir de la
> bounding box de la géométrie : bornes de l'accesseur `POSITION` × scale monde du
> node. SketchUp exporte la géométrie en pouces, dans le repère local **Z-up** du
> groupe (la conversion Y-up de glTF est portée par le node racine de la scène),
> d'où le mapping `largeur_m` = X, `profondeur_m` = Y, `hauteur_m` = Z, en mètres.
> Les champs `material` et `notes` restent vides, réservés à l'édition in-app (V2).

**Structure `extras` de la scène racine (métadonnées globales) :**
```json
{
  "model": {
    "version": "1.0.0",
    "levels": ["rdc", "r1"],
    "zones": ["salon", "cuisine", "sdb", "chambre1", "garage"]
  },
  "layers": {
    "structure":  { "label": "Structure",      "color": "#378ADD", "visible": true },
    "ouvertures": { "label": "Ouvertures",     "color": "#1D9E75", "visible": true },
    "elec":       { "label": "Électricité",    "color": "#D85A30", "visible": false },
    "plomberie":  { "label": "Plomberie",      "color": "#7F77DD", "visible": false },
    "vmc":        { "label": "VMC/Chauffage",  "color": "#BA7517", "visible": false },
    "reseau":     { "label": "Réseau/Fibre",   "color": "#A855F7", "visible": false },
    "terrain":    { "label": "Terrain",        "color": "#4CAF50", "visible": true }
  }
}
```

---

## Convention de nommage SketchUp (CRITIQUE)

### Tags SketchUp (= calques de l'app)

Nommer les Tags exactement ainsi dans SketchUp :
```
structure | ouvertures | elec | plomberie | vmc | reseau | terrain
```

### Noms de Groupes/Composants (= node names dans le GLB)

Format (5 segments obligatoires) :
```
[système]__[type]__[zone]__[niveau]__[index 3 chiffres]
```

Valeurs autorisées par segment :

| Segment | Valeurs |
|---|---|
| système | `structure`, `ouvertures`, `elec`, `plomberie`, `vmc`, `reseau`, `terrain` |
| type | libre, minuscules, `_` comme séparateur de mots |
| zone | nom de pièce : `salon`, `cuisine`, `sdb`, `chambre1`, `garage`... |
| niveau | `ss`, `rdc`, `r1`, `r2`, `combles`, `ext` |
| index | 3 chiffres : `001`, `002`... |

Exemples :
```
structure__mur_porteur__salon__rdc__001
structure__mur_cloison__chambre1__rdc__002
ouvertures__porte_int__couloir__rdc__001
ouvertures__fenetre__chambre1__rdc__001
elec__circuit_prises__rdc__rdc__001
elec__prise__salon__rdc__003
elec__tableau__garage__rdc__001
plomberie__eau_froide__sdb__rdc__001
plomberie__evacuation__wc__rdc__001
vmc__gaine__rdc__rdc__001
reseau__rj45__bureau__rdc__001
terrain__jardin__ext__ext__001
```

Règles :
- Séparateur de **segments** : double underscore `__`
- Séparateur de **mots dans un segment** : underscore simple `_`
- **Minuscules uniquement**, pas d'accents, pas d'espaces
- Le niveau `ext` est utilisé pour tout ce qui est extérieur (terrain, jardin)

**Regex de validation (utilisée dans le script) :**
```
^(structure|ouvertures|elec|plomberie|vmc|reseau|terrain)__[a-z0-9_]+__[a-z0-9_]+__(ss|rdc|r1|r2|combles|ext)__\d{3}$
```

---

## Pipeline de production GLB

L'export SketchUp brut passe obligatoirement par un script Node.js
avant d'être chargé dans l'app. Ce script est la pièce centrale du pipeline.

```
SketchUp
  └─► Export GLB brut (maison_raw.glb)
        └─► script/process.mjs  (@gltf-transform/core)
              ├── 1. Validation des noms de nodes (regex)
              │      └─► Rapport d'erreurs lisible si violation
              ├── 2. Injection des extras par node
              │      └─► layer, type, zone, level, index extraits du nom
              ├── 3. Injection des extras scène (layers config)
              ├── 4. Compression Draco (géométrie)
              ├── 5. Compression KTX2 (textures, si présentes)
              └─► maison.glb  (production-ready, fichier unique)
                    └─► App Vite + R3F
```

### Budget taille GLB

| Taille GLB brut | Action requise |
|---|---|
| < 10 MB | Draco optionnel |
| 10 – 30 MB | Draco obligatoire |
| 30 – 100 MB | Draco + KTX2 + revoir instancing |
| > 100 MB | **Revoir la modélisation SketchUp** (sur-détail à corriger) |

---

## Ce que doit faire la V1 (scope exact)

1. Charger un fichier GLB via drag & drop ou file picker
2. Parser les `extras` de chaque node → extraire layer, type, zone, level
3. Lire les `extras` de la scène racine → config des calques (couleurs, labels)
4. Afficher le viewer 3D (orbit, zoom, pan) avec React Three Fiber
5. Panneau de calques : toggle visibilité par système (`group.visible = true/false`)
6. Colorisation optionnelle des objets par calque (couleur des extras scène)
7. Click sur un objet → affiche ses infos (depuis ses `extras`)

---

## Ce qu'on anticipe pour la V2 (ne pas coder, mais ne pas bloquer)

- Les `extras` sont conçus pour accueillir l'édition (`material`, `notes`
  déjà présents et vides ; `dims` déjà calculé en V1 mais surchargeable)
- Le store Zustand doit être conçu pour l'historique undo/redo
  → utiliser le **command pattern** + middleware `zundo`
- Les node names sont la clé de liaison GLB ↔ extras : **immuables**
- Raycasting + TransformControls pour déplacement d'objets in-app
- Plugin Ruby SketchUp pour automatiser le nommage (backlog V1/V2)

---

## Perf 3D — À prévoir pour la suite

> Cette section ne fait pas partie du scope V1.
> Elle documente les optimisations à intégrer progressivement
> selon la complexité du modèle.

### Le problème fondamental : draw calls

Three.js envoie une instruction GPU (draw call) **par mesh**.
Une maison avec 300 objets = 300 draw calls/frame = 18 000/seconde à 60fps.
Au-delà de ~200-300 draw calls, les performances se dégradent sur hardware moyen.

### Niveau 1 — Instanced Mesh (priorité absolue)

Les objets répétitifs (prises, interrupteurs, spots, robinets, poignées...)
doivent utiliser `InstancedMesh` de Three.js : 80 prises = **1 draw call**.

R3F expose `<instancedMesh>`, Drei fournit le helper `<Instances>`.

```
Sans instancing : N objets = N draw calls
Avec instancing : N objets = 1 draw call   ← gain x50 à x100
```

### Niveau 2 — Geometry Merging par calque

Les objets non-répétitifs d'un même calque (ex : tous les murs)
peuvent être fusionnés en un seul mesh via `BufferGeometryUtils.mergeGeometries()`.

Pattern à utiliser :
- **Render mesh** : géométries mergées, 1 draw call par calque, pour l'affichage
- **Picking mesh** : meshes originaux invisibles, pour le raycasting/click

### Niveau 3 — LOD (Level of Detail)

Pertinent pour le terrain, la végétation, les éléments de façade.
Quand la caméra est loin → mesh simplifié (low-poly).
Quand elle zoome → mesh détaillé.

Three.js a un objet `LOD` natif. Drei expose `<Lod>`.
Les meshes simplifiés peuvent être générés via `meshoptimizer` (`@gltf-transform`).

### Niveau 4 — Compression (pipeline)

| Algorithme | Cible | Gain typique |
|---|---|---|
| **Draco** | Géométrie (vertices, faces) | -50 à -90% sur la taille fichier |
| **KTX2** | Textures (format GPU natif) | -60 à -80% sur la mémoire GPU |

Appliqués dans le script de post-processing `@gltf-transform`.
Three.js supporte les deux via `DRACOLoader` et `KTX2Loader`.

### Niveau 5 — Frustum culling

Three.js le fait automatiquement.
Point de vigilance : vérifier que les bounding boxes sont correctement
calculées après export SketchUp (parfois mal générées sur des objets complexes).
Note : le pipeline lit déjà les bornes `POSITION` de chaque node pour calculer
les `dims` (issue #9) — un futur contrôle des bounds (E8-05) pourra s'appuyer dessus.

L'**occlusion culling** (ne pas rendre ce qu'un mur cache) n'est pas natif
Three.js — complexe à implémenter, hors scope V1 et V2.

---

## Structure du projet (Vite + R3F)

```
home3d/
├── public/
│   └── models/           ← GLB de dev (non commité en prod)
├── src/
│   ├── components/
│   │   ├── Viewer.jsx     ← Canvas R3F principal
│   │   ├── GLBLoader.jsx  ← Drag & drop + file picker
│   │   ├── LayerPanel.jsx ← Panneau calques
│   │   └── InfoPanel.jsx  ← Infos objet au click
│   ├── store/
│   │   └── useStore.js    ← Zustand (structure V2-ready)
│   └── main.jsx
├── script/
│   └── process.mjs        ← Pipeline GLB (@gltf-transform)
├── package.json
└── vite.config.js
```

---

## Store Zustand — Structure V2-ready

```javascript
// Conçu pour accueillir le command pattern undo/redo en V2
// Ajouter le middleware `zundo` à ce moment-là

{
  // Modèle chargé
  glb: null,
  metadata: null,           // extras scène parsés

  // Calques
  layers: {},               // { structure: { visible, color, label }, ... }
  toggleLayer: (id) => {},

  // Sélection
  selectedNode: null,
  selectNode: (name) => {},

  // V2 : historique (command pattern)
  // history: [],
  // future: [],
  // push: (command) => {},
  // undo: () => {},
  // redo: () => {},
}
```