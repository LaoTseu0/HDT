# Home3D Viewer

Viewer 3D web d'une maison avec calques techniques (structure, électricité,
plomberie, VMC, réseau…). Cf. `../HTD_cahier_des_charges.md` et `../BACKLOG.md`.

Stack : Vite + React + React Three Fiber + Drei + Zustand.
Format : GLB enrichi de métadonnées `extras` par le pipeline.

## Démarrer

```bash
npm install        # copie aussi les décodeurs Draco/Basis dans public/ (postinstall)
npm run dev
```

Puis charger un GLB par drag & drop ou via « Ouvrir un GLB… ».
Seuls les GLB passés par le pipeline (extras présents) sont acceptés.

## Pipeline GLB

```bash
npm run model:test                                 # génère public/models/maison_raw.glb
npm run process -- public/models/maison_raw.glb    # → public/models/maison.glb
```

Le pipeline (`script/process.mjs`) valide la convention de nommage des nodes,
injecte les `extras` (node + scène), applique Draco et affiche le budget taille.
Workflow SketchUp complet : `docs/workflow-sketchup.md`.

## Scripts

| Script                              | Rôle                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `npm run dev` / `build` / `preview` | Vite                                                      |
| `npm run lint` / `format`           | ESLint / Prettier                                         |
| `npm run model:test`                | Génère le GLB de test (option `--invalid`)                |
| `npm run process`                   | Pipeline GLB (validation + extras + Draco)                |
| `postinstall`                       | Copie les décodeurs Draco/Basis de `three` vers `public/` |
