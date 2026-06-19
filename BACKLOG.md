# Backlog — Home3D Viewer

> Backlog produit élaboré à partir de `HTD_cahier_des_charges.md` (V2).
> Priorisation MoSCoW : **M** (Must have), **S** (Should have), **C** (Could have), **W** (Won't have / hors scope cette version).
> Estimation en points (suite de Fibonacci : 1, 2, 3, 5, 8, 13).

---

## Vue d'ensemble des epics

| Epic | Titre | Version cible | Priorité |
|---|---|---|---|
| E1 | Initialisation & socle technique | V1 | M |
| E2 | Pipeline GLB (post-processing SketchUp) | V1 | M |
| E3 | Chargement du modèle dans l'app | V1 | M |
| E4 | Viewer 3D | V1 | M |
| E5 | Système de calques | V1 | M |
| E6 | Sélection & inspection d'objets | V1 | M |
| E7 | Store & architecture V2-ready | V1 | S |
| E8 | Optimisations performance 3D | V1.x / V2 | C |
| E9 | Outillage workflow SketchUp | V2 | C |
| E10 | Édition in-app | V2 | W (V1) |
| E11 | Modélisation complète in-app | V3 | W |

---

## Epic E1 — Initialisation & socle technique (V1)

**Objectif** : disposer d'un projet Vite + React + R3F fonctionnel, structuré selon l'arborescence cible.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E1-01 ✅ | En tant que dev, je veux initialiser le projet Vite + React afin d'avoir une base de travail. | Projet `home3d/` créé ; `npm run dev` lance l'app ; React fonctionnel. | M | 1 |
| E1-02 ✅ | En tant que dev, je veux installer et configurer R3F, Drei et Zustand afin de disposer du socle 3D et état. | `@react-three/fiber`, `@react-three/drei`, `zustand` installés ; un `<Canvas>` de test affiche un cube. | M | 2 |
| E1-03 ✅ | En tant que dev, je veux mettre en place l'arborescence cible (`components/`, `store/`, `script/`, `public/models/`) afin de respecter la structure du cahier des charges. | Arborescence conforme à la section « Structure du projet » ; `public/models/` ignoré en prod (`.gitignore`). | M | 1 |
| E1-04 ✅ | En tant que dev, je veux un lint/format de base (ESLint + Prettier) afin de garder un code homogène. | `npm run lint` passe ; config commitée. | S | 2 |

> **E1 terminé le 2026-06-12** — projet dans `home3d/`, cube de test vérifié visuellement, `npm run lint` et `npm run build` passent.

---

## Epic E2 — Pipeline GLB (V1)

**Objectif** : transformer l'export SketchUp brut en GLB production-ready, enrichi des métadonnées `extras`. **Pièce centrale du pipeline.**

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E2-01 ✅ | En tant que dev, je veux un script `script/process.mjs` basé sur `@gltf-transform/core` qui lit un GLB et en réécrit un afin de poser le squelette du pipeline. | `node script/process.mjs maison_raw.glb` produit `maison.glb` valide (rechargeable dans un viewer). | M | 3 |
| E2-02 ✅ | En tant que dev, je veux valider les noms de nodes contre la regex de convention afin de détecter toute faute de nommage SketchUp. | Regex `^(structure\|ouvertures\|elec\|plomberie\|vmc\|reseau\|terrain)__[a-z0-9_]+__[a-z0-9_]+__(ss\|rdc\|r1\|r2\|combles\|ext)__\d{3}$` appliquée à chaque node nommé ; nodes invalides listés. | M | 3 |
| E2-03 ✅ | En tant qu'utilisateur du pipeline, je veux un rapport d'erreurs lisible en cas de violation de nommage afin de corriger rapidement dans SketchUp. | Le rapport indique : nom fautif, raison (segment invalide, casse, accent…), suggestion si possible ; exit code ≠ 0 si erreurs. | M | 3 |
| E2-04 ✅ | En tant que dev, je veux injecter les `extras` par node (layer, type, zone, level, index extraits du nom) afin que l'app puisse exploiter la sémantique. | Chaque node validé porte un `extras` conforme au schéma du CdC ; `dims` calculé depuis la bounding box (cf. E2-10), `material`/`notes` vides réservés à l'édition V2 (E10-02). | M | 5 |
| E2-05 ✅ | En tant que dev, je veux injecter les `extras` de la scène racine (config des calques : labels, couleurs, visibilité par défaut, levels, zones) afin que l'app n'ait aucune config en dur. | `extras` scène conforme au schéma du CdC ; les 7 calques (`structure`, `ouvertures`, `elec`, `plomberie`, `vmc`, `reseau`, `terrain`) présents avec leurs couleurs. | M | 3 |
| E2-06 ✅ | En tant que dev, je veux appliquer la compression Draco sur la géométrie afin de respecter le budget taille. | GLB > 10 MB compressé Draco ; le fichier reste chargeable par l'app (DRACOLoader). | M | 3 |
| E2-07 ✅ | En tant que dev, je veux appliquer la compression KTX2 sur les textures (si présentes) afin de réduire la mémoire GPU. | Textures converties en KTX2 ; chargement OK via KTX2Loader. | S | 3 |
| E2-08 ✅ | En tant qu'utilisateur du pipeline, je veux un avertissement basé sur le budget taille (10/30/100 MB) afin de savoir quand revoir la modélisation. | Le script affiche la taille brute/finale et l'action requise selon le barème du CdC. | S | 2 |
| E2-09 ✅ | En tant que dev, je veux des tests unitaires sur la validation/extraction des noms de nodes afin de fiabiliser la pièce centrale du pipeline. | Cas valides/invalides couverts (accents, espaces, segments manquants, index ≠ 3 chiffres, niveau inconnu). | S | 3 |
| E2-10 ✅ | En tant qu'utilisateur, je veux que les dimensions d'un objet soient calculées automatiquement afin de les consulter dans « Objet sélectionné » sans saisie manuelle (issue #9). | `dims` = bounding box (bornes POSITION × scale monde) injecté par node : `largeur_m` (X), `profondeur_m` (Y), `hauteur_m` (Z), repère SketchUp Z-up ; calcul avant Draco ; affiché par `InfoPanel` sans modif UI ; tests unitaires `computeDims`. | M | 3 |

> **S2 terminé le 2026-06-12** (incluant le reliquat S1 E2-01→03) — pipeline complet dans
> `home3d/script/process.mjs` (+ `naming.mjs` séparé pour les tests E2-09), modèle de test
> généré par `npm run model:test`, doc workflow dans `docs/workflow-sketchup.md`.
>
> **S5 (E2-07/E2-09) terminé le 2026-06-13** — E2-07 : compression KTX2 dans
> `process.mjs` (extension `KHRTextureBasisu`, encodage etc1s via `toktx`, sRGB/linéaire
> selon le slot de texture ; sauté proprement si `toktx` absent ou GLB sans texture,
> `--no-ktx2` pour désactiver). E2-09 : `script/naming.test.mjs` (29 tests, runner natif
> `node --test`, `npm test`).

---

## Epic E3 — Chargement du modèle (V1)

**Objectif** : charger un GLB dans l'app et en extraire les métadonnées.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E3-01 ✅ | En tant qu'utilisateur, je veux charger un GLB par drag & drop afin d'ouvrir mon modèle sans manipulation. | Déposer un `.glb` sur la fenêtre charge le modèle ; feedback visuel pendant le drop et le chargement. | M | 3 |
| E3-02 ✅ | En tant qu'utilisateur, je veux charger un GLB via un file picker afin d'avoir une alternative au drag & drop. | Bouton « Ouvrir » → sélection fichier → modèle chargé. | M | 2 |
| E3-03 ✅ | En tant que dev, je veux parser les `extras` de chaque node (layer, type, zone, level) afin d'alimenter le store. | Après chargement, chaque mesh est rattaché à son calque ; nodes sans `extras` regroupés dans un calque « non classé ». | M | 3 |
| E3-04 ✅ | En tant que dev, je veux lire les `extras` de la scène racine afin de construire la config des calques (couleurs, labels, visibilité initiale). | Le panneau de calques reflète exactement la config embarquée dans le GLB. | M | 2 |
| E3-05 ✅ | En tant qu'utilisateur, je veux un message d'erreur clair si le fichier est invalide (pas un GLB, extras absents, GLB corrompu) afin de comprendre le problème. | Erreur affichée dans l'UI (pas seulement console) ; l'app reste utilisable ; cas « GLB sans extras » signalé comme « fichier non passé par le pipeline ». | M | 2 |
| E3-06 ✅ | En tant que dev, je veux supporter les GLB compressés Draco/KTX2 afin de charger la sortie du pipeline. | DRACOLoader et KTX2Loader configurés (decoders servis localement) ; `maison.glb` compressé se charge. | M | 2 |

> **S3 terminé le 2026-06-12** — chargement drag & drop / picker (`GLBLoader.jsx`), parse des
> extras + erreurs UI (`Model.jsx`, `lib/loadModel.js`), décodeurs Draco/Basis servis localement
> (copiés depuis `three` par `script/copy-decoders.mjs` en postinstall, gitignorés).
> Visibilité initiale des calques appliquée depuis les extras scène (le panneau UI arrive en S4/E5).

---

## Epic E4 — Viewer 3D (V1)

**Objectif** : navigation 3D fluide dans le modèle.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E4-01 ✅ | En tant qu'utilisateur, je veux orbiter, zoomer et panner autour de la maison afin de l'inspecter sous tous les angles. | `OrbitControls` (Drei) : orbite clic gauche, pan clic droit/molette pressée, zoom molette ; cible centrée sur le modèle au chargement. | M | 2 |
| E4-02 ✅ | En tant qu'utilisateur, je veux un éclairage et un environnement par défaut corrects afin de distinguer les volumes sans configuration. | Lumière ambiante + directionnelle (ou environnement Drei) ; pas de faces noires ; sol/grille de référence optionnelle. | M | 2 |
| E4-03 ✅ | En tant qu'utilisateur, je veux que la caméra se recadre automatiquement sur le modèle chargé afin de ne jamais « perdre » la maison. | Au chargement : caméra positionnée pour cadrer la bounding box ; bouton/raccourci « recentrer ». | S | 2 |
| E4-04 ✅ | En tant qu'utilisateur, je veux une UI sobre (canvas plein écran, panneaux latéraux) afin de me concentrer sur le modèle. | Canvas plein écran responsive ; panneaux calques/infos superposés ou ancrés ; pas de scroll parasite. | S | 3 |

> **S5 (E4-03/E4-04) terminé le 2026-06-13** — E4-03 : recadrage déjà fait au
> chargement (E4-01), exposé en bouton « Recentrer » (toolbar) + raccourci `R` via un
> compteur `fitRequest` dans le store (la caméra vit dans le Canvas). E4-04 : `index.css`
> déjà plein écran sans scroll parasite ; ajout d'un breakpoint ≤ 640 px (panneaux plus
> étroits, action « Isoler » toujours visible faute de hover tactile).

---

## Epic E5 — Système de calques (V1)

**Objectif** : piloter la visibilité et la colorisation par système technique.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E5-01 ✅ | En tant qu'utilisateur, je veux un panneau listant les calques (label + couleur issus des extras scène) afin de voir les systèmes disponibles. | Les 7 calques affichés avec label FR et pastille couleur ; état initial = champ `visible` des extras. | M | 3 |
| E5-02 ✅ | En tant qu'utilisateur, je veux toggler la visibilité d'un calque afin d'isoler un système (ex : voir seulement l'électricité). | Click sur un calque → `group.visible` bascule ; rendu immédiat ; état persisté dans le store. | M | 3 |
| E5-03 ✅ | En tant qu'utilisateur, je veux des actions « tout afficher / tout masquer / isoler ce calque » afin de manipuler les calques rapidement. | Boutons fonctionnels ; « isoler » masque tous les autres calques. | S | 2 |
| E5-04 ✅ | En tant qu'utilisateur, je veux activer une colorisation des objets par calque afin d'identifier visuellement chaque système. | Toggle global « couleurs par calque » : ON = matériau teinté par la couleur du calque, OFF = matériaux d'origine ; réversible sans rechargement. | M | 3 |

> **S4 (E5) terminé le 2026-06-12** — `LayerPanel.jsx` (toggle, Tout/Aucun, Isoler, couleurs
> par calque) ; application sur la scène dans `lib/appearance.js` (matériaux teintés partagés
> par calque, matériaux d'origine conservés → réversible sans rechargement).

---

## Epic E6 — Sélection & inspection (V1)

**Objectif** : cliquer sur un objet et consulter ses métadonnées.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E6-01 ✅ | En tant qu'utilisateur, je veux cliquer sur un objet 3D afin de le sélectionner. | Raycasting via events R3F ; l'objet sélectionné est mis en évidence (outline ou émissive) ; click dans le vide désélectionne. | M | 3 |
| E6-02 ✅ | En tant qu'utilisateur, je veux voir les infos de l'objet sélectionné (layer, type, zone, niveau, index, dims, material, notes) afin de consulter ses caractéristiques. | `InfoPanel` affiche les `extras` formatés (labels FR) ; champs vides masqués ou grisés ; nom de node complet visible. | M | 2 |
| E6-03 ✅ | En tant qu'utilisateur, je veux que la sélection respecte la visibilité des calques afin de ne pas sélectionner un objet masqué. | Le raycasting ignore les objets des calques masqués. | M | 1 |
| E6-04 ✅ | En tant qu'utilisateur, je veux un survol (hover) avec mise en évidence légère afin de savoir ce que je vais sélectionner. | Highlight au hover + curseur pointer ; pas de chute de framerate notable. | C | 2 |

> **S5 (E6-04) terminé le 2026-06-13** — survol via `onPointerMove`/`onPointerOut` sur le
> `<primitive>` ([Model.jsx](home3d/src/components/Model.jsx)), résolution du node
> mutualisée avec le clic (`resolveNodeName`) et filtrée sur la visibilité des calques.
> Émissif léger (intensité 0.18 vs 0.55 pour la sélection) dans
> [appearance.js](home3d/src/lib/appearance.js) + curseur `pointer`. L'action `hoverNode`
> a une garde d'égalité : pas de re-render ni de re-passe `applyAppearance` tant que le
> node survolé ne change pas (pas de chute de framerate).

---

## Epic E7 — Store & architecture V2-ready (V1)

**Objectif** : structurer l'état pour accueillir l'édition et l'undo/redo en V2 sans refonte.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E7-01 ✅ | En tant que dev, je veux un store Zustand unique conforme au schéma du CdC (`glb`, `metadata`, `layers`, `toggleLayer`, `selectedNode`, `selectNode`) afin de centraliser l'état. | Store implémenté ; composants connectés via sélecteurs (pas de re-render global). | M | 3 |
| E7-02 ✅ | En tant que dev, je veux que les mutations d'état passent par des actions nommées (pré-command-pattern) afin de faciliter l'ajout de `zundo` en V2. | Aucune mutation directe hors actions ; emplacements `history`/`future`/`push`/`undo`/`redo` documentés en commentaire. | S | 2 |
| E7-03 ✅ | En tant que dev, je veux traiter les node names comme identifiants immuables (clé de liaison GLB ↔ extras) afin de garantir la cohérence V2. | Le code référence les objets par node name ; aucune fonctionnalité ne renomme un node. | M | 1 |

> **S4 (E6/E7) terminé le 2026-06-12** — sélection au clic avec surbrillance émissive
> (`Model.jsx` + `lib/appearance.js`), désélection au clic dans le vide (`Viewer.jsx`,
> avec garde anti-drag d'orbite), raycast filtré sur la visibilité (le raycaster three.js
> ne teste pas `visible` nativement). `InfoPanel.jsx` : extras formatés labels FR.
> Store : actions nommées `setAllLayersVisible`/`isolateLayer`/`toggleColorByLayer` ;
> sélection référencée par node name (immuable). E5-03 fait en S4 (retiré du S5).

---

## Epic E8 — Optimisations performance 3D (V1.x / V2 — progressif)

**Objectif** : maintenir 60 fps sur hardware moyen quand le modèle se complexifie. À activer **selon la complexité réelle du modèle**, pas préventivement.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E8-01 ✅ | En tant que dev, je veux mesurer les draw calls et le framerate (ex : `r3f-perf`) afin de décider quand optimiser. | Overlay perf activable en dev ; seuil d'alerte ~200-300 draw calls documenté. | S | 2 |
| E8-02 | En tant que dev, je veux instancier les objets répétitifs (prises, interrupteurs, spots…) via `InstancedMesh`/`<Instances>` afin de réduire drastiquement les draw calls. | Objets de même type+géométrie rendus en 1 draw call ; sélection/click toujours fonctionnels par instance. | C | 8 |
| E8-03 | En tant que dev, je veux merger les géométries non répétitives par calque (render mesh + picking mesh invisible) afin de tomber à ~1 draw call par calque. | `mergeGeometries` appliqué ; raycasting sur picking meshes ; toggle calque toujours instantané. | C | 8 |
| E8-04 | En tant que dev, je veux du LOD sur terrain/végétation/façade afin d'alléger le rendu en vue éloignée. | `<Lod>` (Drei) ou `THREE.LOD` ; meshes simplifiés générés via `meshoptimizer` dans le pipeline. | C | 5 |
| E8-05 | En tant que dev, je veux vérifier les bounding boxes après export SketchUp afin que le frustum culling natif fonctionne. | Contrôle (ou recalcul) des bounds dans le pipeline ; pas d'objet qui disparaît à tort à l'écran. _Partiellement couvert par E2-10 : les bounds POSITION sont déjà lus pour calculer les `dims`._ | C | 2 |

> **S5 (E8-01) terminé le 2026-06-13** — overlay `r3f-perf` (draw calls, fps, mémoire GPU),
> dev uniquement (chargé en `import()` paresseux derrière `import.meta.env.DEV` → exclu du
> bundle de prod), toggle touche `P`. Seuil d'alerte ~200-300 draw calls documenté dans
> [Viewer.jsx](home3d/src/components/Viewer.jsx) ; au-delà, activer E8-02+ (instancing,
> merge par calque).

> **W (hors scope V1/V2)** : occlusion culling — complexe, non natif Three.js.

---

## Epic E9 — Outillage workflow SketchUp (V2)

**Objectif** : fiabiliser le nommage à la source.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E9-01 | En tant que modeleur, je veux un plugin Ruby SketchUp avec des dropdowns (système, type, zone, niveau) afin de générer les noms de nodes sans faute de frappe. | Plugin `.rb` installable ; le nom généré passe la regex de validation ; index auto-incrémenté. | C | 8 |
| E9-02 ✅ | En tant que modeleur, je veux une checklist/doc du workflow SketchUp (Tags exacts, pièges : Tags cachés non exportés, un seul Tag par objet) afin d'exporter un GLB exploitable du premier coup. | Doc `docs/workflow-sketchup.md` couvrant Tags, nommage, export GLB, exécution du pipeline. | S | 2 |

---

## Epic E10 — Édition in-app (V2 — ne pas coder en V1, ne pas bloquer)

**Objectif** : corriger le modèle directement dans l'app.

| ID | User story | Prio | Pts |
|---|---|---|---|
| E10-01 | En tant qu'utilisateur, je veux déplacer/tourner un objet sélectionné via TransformControls afin de corriger le modèle sans repasser par SketchUp. | W (V1) | 8 |
| E10-02 | En tant qu'utilisateur, je veux éditer les champs `dims`, `material`, `notes` d'un objet afin d'enrichir les métadonnées in-app. _(`dims` est désormais pré-rempli automatiquement en V1, cf. E2-10 ; cette story couvre l'édition manuelle, y compris pour surcharger les cotes calculées.)_ | W (V1) | 5 |
| E10-03 | En tant qu'utilisateur, je veux annuler/rétablir mes modifications (undo/redo via command pattern + `zundo`) afin d'éditer sans risque. | W (V1) | 8 |
| E10-04 | En tant qu'utilisateur, je veux ré-exporter le GLB modifié afin de persister mes corrections. | W (V1) | 8 |
| E10-05 | En tant que dev, je veux évaluer la migration Next.js (si besoin d'hébergement partagé / API routes pour la persistence) afin de décider de l'infra V2. | W (V1) | 3 |

---

## Epic E11 — Modélisation complète in-app (V3 — hors scope)

Non détaillé volontairement. À cadrer après livraison V2.

---

## Proposition d'ordre de réalisation V1 (sprints indicatifs)

| Sprint | Contenu | Stories |
|---|---|---|
| S1 — Socle | Projet + pipeline minimal | E1-01 → E1-03, E2-01, E2-02, E2-03 |
| S2 — Pipeline complet | Extras + compression + modèle de test | E2-04, E2-05, E2-06, E2-08, E9-02 |
| S3 — Viewer | Chargement + navigation | E3-01 → E3-06, E4-01, E4-02, E7-01 |
| S4 — Calques & sélection | Cœur fonctionnel V1 | E5-01 → E5-04, E6-01 → E6-03, E7-02, E7-03 |
| S5 — Finitions | UX, qualité, mesure perf | E4-03, E4-04, E6-04, E1-04, E2-07, E2-09, E8-01 |

**Definition of Done V1** : les 7 points du « scope exact » du cahier des charges sont démontrables avec un GLB réel exporté de SketchUp et passé par le pipeline.

---

*Document généré le 2026-06-12 à partir de `HTD_cahier_des_charges.md`.*
