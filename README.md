# Home3D Viewer (HDT)

> Application web de visualisation et d'édition 3D d'une maison, organisée par
> **calques techniques** (structure, ouvertures, électricité, plomberie, VMC,
> réseau, terrain). Le modèle est produit dans SketchUp, enrichi par un pipeline
> Node, puis affiché et édité dans le navigateur.

![status](https://img.shields.io/badge/status-WIP-orange) ![license](https://img.shields.io/badge/license-MIT-blue) ![node](https://img.shields.io/badge/node-%E2%89%A522-339933)

---

## ✨ Fonctionnalités

- **Viewer 3D web** d'un modèle de maison au format GLB (glTF 2.0 binaire).
  Navigation caméra sur PC : **Ctrl+clic gauche** = orbite, **Ctrl+clic
  droit** = pan, **molette** = zoom — Ctrl enfoncé, aucune action d'objet ne
  se déclenche (le clic nu reste réservé à la sélection et aux outils
  d'édition) ; tactile : 1 doigt orbite, 2 doigts pan/pinch.
- **Calques techniques** : allumer / éteindre / isoler / coloriser chaque
  système (structure, ouvertures, élec, plomberie, VMC, réseau, terrain).
- **Inspection au clic** : métadonnées par objet (zone, niveau, système…),
  embarquées dans le champ `extras` du GLB — pas de fichier companion.
- **Edit mode paramétrique** (en cours) : création d'objets directement dans
  l'app sur la coquille SketchUp — rectangle, cercle, Push/Pull, snapping
  (BVH + grille), saisie au clavier type VCB, undo/redo, ré-export GLB.
- **Mode visite (1re personne)** : vol libre, puis collisions/gravité.
- **Pipeline GLB** : validation des conventions de nommage, injection des
  métadonnées, compression Draco, contrôle du budget taille.

---

## 🧱 Stack technique

| Domaine | Technologies |
| ------- | ------------ |
| **Frontend** | [React 19](https://react.dev/), [Vite 8](https://vite.dev/) |
| **3D / WebGL** | [Three.js](https://threejs.org/), [React Three Fiber](https://r3f.docs.pmnd.rs/), [Drei](https://github.com/pmndrs/drei) |
| **État** | [Zustand](https://github.com/pmndrs/zustand) + [zundo](https://github.com/charkour/zundo) (undo/redo) |
| **Géométrie** | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (snapping/raycast), [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) (opérations booléennes) |
| **Pipeline GLB** | [@gltf-transform](https://gltf-transform.dev/) (core / extensions / functions), [draco3dgltf](https://github.com/google/draco) |
| **Qualité** | ESLint 10, Prettier 3, tests via `node --test` |
| **Format 3D** | GLB (glTF 2.0 binaire), métadonnées dans `extras` |

> **Pourquoi Vite et pas Next.js ?** L'app est locale/statique, sans SSR ni API
> routes ; les Server Components sont incompatibles avec WebGL. Vite garde le
> build léger. Une migration reste possible plus tard si un backend devient
> nécessaire (persistence des métadonnées, hébergement partagé).

---

## 🚀 Installation

**Prérequis** : [Node.js](https://nodejs.org/) ≥ 22 et npm.

```bash
git clone https://github.com/LaoTseu0/HDT.git
cd HDT/home3d
npm install          # installe les deps + copie les décodeurs Draco/Basis (postinstall)
npm run dev          # démarre le serveur de dev Vite (http://localhost:5173)
```

> ⚠️ Le code de l'application vit dans le sous-dossier **`home3d/`**. Toutes les
> commandes npm se lancent depuis là.

Une fois l'app ouverte, charger un GLB par **drag & drop** ou via le bouton
« Ouvrir un GLB… ». Seuls les GLB passés par le pipeline (avec `extras`) sont
acceptés.

---

## 🛠️ Pipeline GLB (SketchUp → app)

Le modèle se modélise dans SketchUp puis s'exporte en GLB brut. Le pipeline le
valide, l'enrichit et le compresse :

```bash
# Génère un GLB de test (option --invalid pour tester la validation)
npm run model:test

# Transforme un export brut en GLB production-ready
npm run process -- public/models/maison_raw.glb   # → public/models/maison.glb
```

Workflow SketchUp détaillé : [`docs/workflow-sketchup.md`](docs/workflow-sketchup.md).

---

## 📜 Scripts npm

Tous depuis `home3d/` :

| Script | Rôle |
| ------ | ---- |
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Build de production |
| `npm run preview` | Sert le build de production localement |
| `npm run lint` | Analyse ESLint |
| `npm run format` / `format:check` | Formatage Prettier (écriture / vérification) |
| `npm test` | Tests unitaires (`node --test` sur `script/**/*.test.mjs`) |
| `npm run model:test` | Génère le GLB de test |
| `npm run process` | Pipeline GLB (validation + `extras` + Draco) |

---

## 🗂️ Structure du dépôt

```
HDT/
├─ home3d/                  # l'application (Vite + React + R3F)
│  ├─ src/
│  │  ├─ components/        # UI 3D & panneaux (Viewer, EditBar, LayerPanel…)
│  │  ├─ lib/               # logique : snapping, sketch, export GLB, naming…
│  │  └─ store/             # état Zustand
│  ├─ script/              # pipeline GLB & tests Node (process.mjs, naming…)
│  └─ public/models/       # GLB de travail (décodeurs Draco/Basis copiés ici)
├─ docs/                    # architecture, design edit-mode, workflow SketchUp
├─ HTD_cahier_des_charges.md  # le « quoi » et le « pourquoi »
└─ BACKLOG.md               # user stories (IDs E*-* référencés dans le code)
```

---

## 📚 Documentation

- [`docs/architecture.md`](docs/architecture.md) — comment l'app est branchée et
  où contribuer (**point d'entrée pour un nouveau venu**).
- [`docs/edit-mode-design.md`](docs/edit-mode-design.md) — design de l'édition paramétrique.
- [`docs/workflow-sketchup.md`](docs/workflow-sketchup.md) — produire un GLB exploitable.
- [`HTD_cahier_des_charges.md`](HTD_cahier_des_charges.md) — cahier des charges.
- [`BACKLOG.md`](BACKLOG.md) — backlog et user stories.

---

## 🤝 Contribuer

Le projet n'est pas encore formellement ouvert aux contributions, mais l'objectif
est de le passer en open source. En attendant :

1. Lire [`docs/architecture.md`](docs/architecture.md) pour comprendre le découpage
   build-time (pipeline Node) / runtime (app React).
2. Respecter les conventions de nommage des nodes (validées par le pipeline).
3. Faire passer `npm run lint`, `npm run format:check` et `npm test` avant tout commit.

---

## 📄 Licence

Distribué sous licence **MIT**. Voir [`LICENSE`](LICENSE).
