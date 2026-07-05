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
| E10 | Édition in-app : socle transverse (undo/redo, ré-export) | V2 | M |
| E11 | Modélisation complète in-app | V3 | W |
| E12 | Edit mode — moteur d'édition (plans de travail, snapping, paramétrique) | V2 | M |
| E13 | Edit mode — formes / primitives d'esquisse | V2 | M |
| E14 | Edit mode — ouvertures & menuiseries (vrai vide + cadre) | V2 | M |
| E15 | Edit mode — électricité (création) | V2 | M |
| E16 | Edit mode — plomberie (création) | V2 | S |
| E17 | Mode visite (vue 1re personne, type « Visite » SketchUp) | V2 | M |

> Conception détaillée d'Edit mode (E10, E12→E16) et articulation du mode visite (E17) :
> [docs/edit-mode-design.md](docs/edit-mode-design.md).

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
| E9-01 ✅ | En tant que modeleur, je veux un plugin Ruby SketchUp avec des dropdowns (système, type, zone, niveau) afin de générer les noms de nodes sans faute de frappe. | Plugin `.rb` installable ; le nom généré passe la regex de validation ; index auto-incrémenté. | C | 8 |
| E9-02 ✅ | En tant que modeleur, je veux une checklist/doc du workflow SketchUp (Tags exacts, pièges : Tags cachés non exportés, un seul Tag par objet) afin d'exporter un GLB exploitable du premier coup. | Doc `docs/workflow-sketchup.md` couvrant Tags, nommage, export GLB, exécution du pipeline. | S | 2 |

> **E9-01 livré le 2026-06-27** — extension SketchUp Ruby dans `sketchup-plugin/`
> (loader `home_designer_namer.rb` + `home_designer_namer/main.rb`). Dropdowns
> système/type/zone/niveau, normalisation + regex **alignées sur `naming.mjs`**
> (noms garantis valides), index auto en `max+1` par bucket, assignation du Tag =
> système, action **« Vérifier les noms du modèle »** qui sélectionne le « bloc
> unique » / noms fautifs. Menu *Extensions > Home Designer* + clic droit.
> Install : cf. `sketchup-plugin/README.md`.

---

## Epic E10 — Édition in-app : socle transverse (V2 — **actif**)

**Objectif** : les briques transverses de l'édition in-app, partagées par tout
Edit mode (E12→E16). Undo/redo et ré-export sont **validés (go)** par le PO le 2026-06-21.

| ID | User story | Prio | Pts |
|---|---|---|---|
| E10-01 | En tant qu'utilisateur, je veux déplacer/tourner un objet sélectionné via TransformControls afin de corriger le modèle sans repasser par SketchUp. _(→ intégré à **E12-07**.)_ | M (V2) | 8 |
| E10-02 | En tant qu'utilisateur, je veux éditer les champs `dims`, `material`, `notes` d'un objet afin d'enrichir les métadonnées in-app. _(`dims` pré-rempli en V1, cf. E2-10 ; mutualisé avec l'inspector **E12-01**.)_ | S (V2) | 5 |
| E10-03 ✅ ⭐ | En tant qu'utilisateur, je veux annuler/rétablir mes modifications (undo/redo via command pattern + `zundo`) afin d'éditer sans risque. **Go.** | M (V2) | 8 |
| E10-04 ✅ ⭐ | En tant qu'utilisateur, je veux ré-exporter le GLB modifié (via `GLTFExporter`, en conservant les `edit.params`) afin de persister mes créations sans perdre la ré-éditabilité. **Go.** | M (V2) | 8 |
| E10-05 | En tant que dev, je veux évaluer la migration Next.js (si besoin d'hébergement partagé / API routes pour la persistence) afin de décider de l'infra V2. | C (V2) | 3 |

> ⭐ = explicitement validé par le PO le 2026-06-21. E10 n'est plus « W (V1) » mais le
> **socle actif de la V2**. Détail : [docs/edit-mode-design.md](docs/edit-mode-design.md) § 5.5–5.6.

---

## Epic E11 — Modélisation complète in-app (V3 — hors scope)

Non détaillé volontairement. À cadrer après livraison V2.

---

## Epic E12 — Edit mode : moteur d'édition (V2)

**Objectif** : le socle réutilisable du mode édition — plan d'esquisse contextuel,
snapping, modèle paramétrique. Voir [docs/edit-mode-design.md](docs/edit-mode-design.md) § 5.1–5.2.

> **Directive IHM (2026-06-24).** Les outils d'Edit mode (E12-01, E12-02, E12-07,
> E12-08, E13…) se présentent en **barre d'outils à icônes + tooltips au survol**,
> jamais en gros boutons texte. Règle transverse à tout nouvel outil.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E12-01 ✅ | En tant qu'utilisateur, je veux basculer View ↔ Edit avec une palette d'outils et un inspector afin de créer/éditer des objets. | Bascule de mode ; **palette d'outils à icônes + tooltips** (directive IHM) ; panneau propriétés (lecture **et** édition des params de l'objet sélectionné). | M | 5 |
| E12-02 ✅ | En tant qu'utilisateur, je veux que le plan d'esquisse soit **déduit du contexte** (façon SketchUp) afin de créer sans choisir de plan manuellement. | Dessin sur le **sol / niveau 0** par défaut ; sur la **face survolée** quand le curseur est sur un mesh (le plan = cette face) ; **aucun sélecteur de plan manuel** ; feedback visuel discret du plan actif. **Révisé 2026-06-24** : abandon du menu XZ/YZ/niveau au profit du paradigme SketchUp contextuel ; les « points de référence » (arêtes/intersections) relèvent de E12-03. | M | 5 |
| E12-03 | En tant qu'utilisateur, je veux du snapping/inférence afin de placer précisément et confortablement. | Snap sur grille, extrémités/milieux, sommets/arêtes des meshes (accéléré par `three-mesh-bvh`), axes X/Y/Z, parallèle/perpendiculaire ; marqueurs + lignes d'inférence ; pas de chute de framerate. | M | 13 |
| E12-04 ✅ | En tant qu'utilisateur, je veux saisir une cote au clavier pendant un tracé afin d'être exact. | Taper une longueur/rayon fixe la cote ; unités en mètres (façon VCB SketchUp). | S | 3 |
| E12-05 ✅ | En tant que dev, je veux un modèle paramétrique afin que les objets créés soient ré-éditables après rechargement. | `extras.edit { kind, plane, params, variant }` ; registre `kind→générateur` ; géométrie **régénérée au chargement** depuis les params ; `dims` recalculés (cohérent E2-10). | M | 8 |
| E12-06 ✅ | En tant que dev, je veux des node names auto-générés conformes afin de garder le contrat de nommage sans plugin SketchUp. | Nom `système__type__zone__niveau__index` ; index auto-incrémenté par (système, zone, niveau) ; zone choisie dans l'inspector (zone courante par défaut) ; passe la regex de validation. | M | 5 |
| E12-07 | En tant qu'utilisateur, je veux déplacer/tourner/redimensionner un objet par manipulation directe. | `TransformControls` (déplacer/tourner) + poignées de redimensionnement paramétrique ; respecte le snapping et l'undo/redo. Absorbe **E10-01**. | M | 5 |
| E12-08 | En tant qu'utilisateur, je veux donner du volume à une forme 2D avec **Push/Pull** afin de créer un solide sans repasser par SketchUp. | Cliquer une face plane → tirer le long de sa **normale** → extrusion en volume (prisme) ; profondeur calable par **inférence** (E12-03) ou **saisie clavier** (E12-04) ; résultat **paramétrique** (hauteur d'extrusion dans `params`, régénérée au chargement, E12-05) ; undo/redo. _(Ajouté 2026-06-24, directive « façon SketchUp ».)_ | M | 5 |

---

## Epic E13 — Edit mode : formes / primitives d'esquisse (V2 — Slice 0)

**Objectif** : dessiner les primitives les plus communes sur un plan de travail.
Premier livrable d'Edit mode, **sans booléen**.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E13-01 ✅ | En tant qu'utilisateur, je veux dessiner un rectangle paramétrique afin de poser une forme de base. | Tracé 2 coins (ou centre + coin) sur le plan actif ; paramétrique ; snapping actif. | M | 3 |
| E13-02 ✅ | En tant qu'utilisateur, je veux dessiner un cercle paramétrique. | Centre + rayon ; saisie numérique du rayon possible (E12-04). | M | 2 |
| E13-03 ✅ | En tant qu'utilisateur, je veux dessiner un arc de cercle paramétrique. | 3 points (ou centre + début + fin) ; paramétrique. | M | 3 |
| E13-04 | En tant qu'utilisateur, je veux éditer les paramètres d'une primitive afin de l'ajuster après coup. | Sélection → inspector affiche/édite les cotes ; poignées de redimensionnement ; undo/redo ; **survit au rechargement** (E12-05). | M | 3 |

---

## Epic E14 — Edit mode : ouvertures & menuiseries (V2)

**Objectif** : creuser de **vrais vides** dans les murs, puis y poser des menuiseries.
Livré en **deux temps**. Voir [docs/edit-mode-design.md](docs/edit-mode-design.md) § 5.4.

**Phase 1 — l'ouverture (le vide)** — Slice 1, le morceau risqué (CSG).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E14-01 ✅ | En tant qu'utilisateur, je veux déposer une ouverture paramétrique sur une face de mur afin de définir l'emplacement et la taille du vide. | Params **largeur / hauteur / allège** ; posée sur une face de mur ; référence le mur par node name (dégradation propre si mur absent). | M | 5 |
| E14-02 ✅ | En tant que dev, je veux un booléen CSG sur le mur importé afin d'y faire un **vrai trou**. | `three-bvh-csg` : mur percé = mur importé − volume de l'ouverture ; **non-destructif** (mur d'origine conservé) ; découpe **recalculée au chargement** depuis les `edit` des ouvertures référençant le mur. | M | 13 |
| E14-03 ✅ | En tant qu'utilisateur, je veux que l'app gère proprement un mur « sale » (non-manifold). | Détection d'un résultat CSG dégénéré (volume nul / explosion de triangles) → **fallback** « pose en surface sans trou » + message ; validé sur un **vrai export SketchUp**. | M | 5 |
| E14-04 ✅ | En tant qu'utilisateur, je veux des gabarits d'ouverture (classique / large / étroite) afin d'aller vite. | Presets de dims sélectionnables ; modifiables ensuite par instance. | S | 2 |

**Phase 2 — la menuiserie (cadre + vitrage)** — **après** Slice 2 (réutilise la pose de composants ①, **pas de booléen**).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E14-05 ✅ | En tant qu'utilisateur, je veux poser un cadre de fenêtre (+ vitrage) dans une ouverture. | **Composant posé** (catégorie ①) hébergé dans l'ouverture, ajusté à ses dims ; **pas de booléen** ; réutilise la machinerie de pose d'E15. | M | 5 |
| E14-06 ✅ | En tant qu'utilisateur, je veux choisir une variante de menuiserie. | Variantes catalogue (classique / large / étroite, battant/coulissant…) par instance. | S | 3 |
| E14-07 ✅ | En tant qu'utilisateur, je veux poser une porte (ouverture + vantail) via le même mécanisme. | Réemploi E14-01→05 : ouverture + composant vantail. | C | 5 |

---

## Epic E15 — Edit mode : électricité, création (V2 — Slice 2)

**Objectif** : créer le réseau électrique (objets ponctuels ① + câble routé ②).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E15-01 ✅ | En tant qu'utilisateur, je veux poser prises, interrupteurs et boîtes de dérivation sur les murs. | Pose sur une **face de mur** ; catalogue + variantes (ex. interrupteur va-et-vient) ; hauteur/sol + orientation paramétrables. | M | 8 |
| E15-02 ✅ | En tant qu'utilisateur, je veux poser un compteur électrique. | Objet ponctuel posé depuis le catalogue. | M | 2 |
| E15-03 ✅ | En tant qu'utilisateur, je veux router un câble électrique afin de relier les éléments. | Tracer un chemin → **section rectangulaire balayée** (low-poly, § 5.3) ; sections prédéfinies ; **coudes auto** aux sommets ; snapping aux objets/murs. | M | 13 |
| E15-04 | En tant qu'utilisateur, je veux connecter logiquement un câble à une boîte/tableau (optionnel). | Notion de circuit : association câble ↔ boîte/tableau. | C | 8 |

---

## Epic E16 — Edit mode : plomberie, création (V2 — Slice 3)

**Objectif** : créer les réseaux de plomberie, en **réutilisant le routage** d'E15.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E16-01 ✅ | En tant qu'utilisateur, je veux router des tuyaux avec des diamètres prédéfinis. | Réemploi du routage rectangulaire ; presets **cuivre** Ø12/14/16/18/22, **PVC**, **évacuation** Ø32/40/100 (rendus en section rectangulaire d'emprise équivalente, identité nominale conservée). | M | 5 |
| E16-02 ✅ | En tant qu'utilisateur, je veux régler une pente sur un réseau d'évacuation. | Pente paramétrable sur un run d'évacuation. | S | 3 |
| E16-03 ✅ | En tant qu'utilisateur, je veux des coudes/raccords/tés automatiques aux jonctions. | Générés automatiquement (onglet entre sections rectangulaires) aux sommets et jonctions. | M | 5 |
| E16-04 | En tant qu'utilisateur, je veux insérer une valve sur un tuyau. | Objet inline inséré sur un segment, coupe le run en deux. | S | 3 |

---

## Epic E17 — Mode visite (vue 1re personne) (V2 — Viewer)

**Objectif** : se déplacer dans la maison en vue subjective, comme le mode « Visite »
de SketchUp. Feature **Viewer**, orthogonale à l'édition. Articulation du séquençage :
[docs/edit-mode-design.md](docs/edit-mode-design.md) § 6.1.

**Niveau 1 — vol libre** — traité **avant** l'édit (banc d'essai de navigation).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E17-01 ✅ | En tant qu'utilisateur, je veux basculer entre Orbite et Visite afin de choisir mon mode de navigation. | Flag store `viewMode` ; bascule toolbar + raccourci ; overlay « Cliquez pour explorer / ÉCHAP pour quitter ». | M | 3 |
| E17-02 ✅ | En tant qu'utilisateur, je veux regarder autour de moi à la souris, à hauteur d'œil. | Drei `PointerLockControls` ; caméra à ~1,60 m ; FOV ~70°. | M | 2 |
| E17-03 ✅ | En tant qu'utilisateur, je veux me déplacer au clavier (WASD / flèches) en vol libre. | Avancer / reculer / pas latéraux ; vitesse réaliste ; **sans** gravité ni collision (niveau 1). | M | 3 |
| E17-04 ✅ | En tant qu'utilisateur, je veux démarrer la visite au bon endroit. | Entrée à hauteur d'œil au centre du modèle ; FOV réglable. | S | 2 |

> **Visite Niveau 1 (E17-01→04) terminé le 2026-06-21** — `viewMode` (`orbit`/`visit`)
> + `pointerLocked` dans le store ([useStore.js](home3d/src/store/useStore.js)).
> [VisitControls.jsx](home3d/src/components/VisitControls.jsx) : `PointerLockControls`
> (Drei), caméra à 1,60 m, FOV 70°, entrée au centre de la bounding box, déplacement
> WASD/flèches **vol libre** (direction complète du regard, sans gravité ni collision,
> `delta` borné). Bascule via toolbar « Visiter/Quitter » + raccourci `V` ([App.jsx](home3d/src/App.jsx)),
> `Viewer.jsx` rend `VisitControls` **ou** `OrbitControls` selon `viewMode` (retour Orbite
> → recadrage auto via l'effet existant de `Model.jsx`). Overlay « Cliquez pour explorer »
> ([VisitOverlay.jsx](home3d/src/components/VisitOverlay.jsx), `pointer-events:none` → le
> clic verrouille la souris) ; `Échap` déverrouille (1er appui) puis quitte (2e appui).
> Raycast clic/survol de `Model` débranché en visite. FOV « réglable » (E17-04) reste à
> exposer en réglages (E17-09). **Niveaux 2/3 (collisions, gravité) après les slices d'édition.**

**Niveau 2 — vraie visite (collisions)** — traité **après** l'édit.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E17-05 | En tant qu'utilisateur, je veux ne pas traverser les murs. | Capsule vs *collider* via `three-mesh-bvh` ; collider construit depuis le calque `structure` ; sous-pas anti-tunneling pour murs fins. | M | 8 |
| E17-06 | En tant qu'utilisateur, je veux marcher au sol et monter les escaliers. | Gravité + snap au sol + franchissement de marches. | M | 5 |
| E17-07 | En tant que dev, je veux (re)construire le collider au chargement du modèle. | Collider rebâti à chaque modèle chargé (drag & drop). | M | 2 |

**Niveau 3 — finitions** — traité **après** l'édit.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E17-08 | En tant qu'utilisateur, je veux placer le point de départ de la visite. | « Placer la caméra » : cliquer un point → départ de la visite. | C | 3 |
| E17-09 | En tant qu'utilisateur, je veux régler le confort (vitesse, accroupi, FOV). | Réglages exposés ; pas de *head-bob* par défaut. | C | 2 |
| E17-10 | En tant qu'utilisateur (mobile), je veux des contrôles tactiles / manette. | Joysticks virtuels / gamepad. | C | 5 |

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

## Proposition d'ordre de réalisation V2

Edit mode est livré en **tranches verticales** (créer → éditer → undo/redo → sauver →
recharger → ré-éditer), encadrées par le **mode visite** (E17) et un **spike** de
dérisquage. Détail : [docs/edit-mode-design.md](docs/edit-mode-design.md) § 6.

| Étape | Contenu | Epics |
|---|---|---|
| **Visite — Niveau 1** | Vue 1re personne en **vol libre** (avant l'édit) → tester la navigation tôt. | E17 ph.1 |
| **Spike — murs « solides » ?** ✅ | Valider qu'un **vrai export SketchUp** donne des murs exploitables. Dérisque **à la fois** le booléen (Slice 1) et la collision de visite (E17 N2). **Fait le 2026-06-22 : 🟢 collision OK + CSG fenêtre fiable (8/8) même sur un bloc non-manifold** → workflow « un seul bloc » tenable ; garder weld + fallback E14-03. Détail : [docs/edit-mode-design.md](docs/edit-mode-design.md) § 6.2. | — |
| **Slice 0 — Socle + formes** | Mode édition, plans de travail, snapping, rectangle/cercle/arc, inspector, undo/redo, ré-export. **Aucun booléen.** | E12, E13, E10-03/04 |
| **Slice 1 — Ouvertures** | Ouverture paramétrique → **vrai vide dans le mur (CSG)**. | E14 ph.1 |
| **Slice 2 — Électricité** | Prise / interrupteur / boîte / compteur + câble routé (section rectangulaire). | E15 |
| **Slice 3 — Plomberie** | Tuyaux cuivre/PVC/évac (réemploi du routage), pente, coudes/raccords auto, valves. | E16 |
| **Visite — Niveaux 2 & 3** | **Collisions + gravité** (marche, escaliers) puis finitions — **après l'édit**. | E17 ph.2/3 |

> **Menuiserie des fenêtres (E14 phase 2)** : posée **après la Slice 2**, car le cadre est
> un composant posé (catégorie ①) qui réutilise la pose de composants de l'électricité.
> La Slice 1 ne livre que le **vide** dans le mur.

> **Slice 0 — avancement (2026-06-23, incrément 1).** Socle Edit mode posé et
> démontrable : bascule View ↔ Edit (toolbar + touche `E`), store enveloppé par
> `zundo` (undo/redo sur les objets app uniquement), registre paramétrique
> `kind→generate` ([editRegistry.js](home3d/src/lib/editRegistry.js), 1re entrée
> `sketch.rect`), outil **Rectangle** (tracé cliquer-glisser sur le plan de sol),
> inspector éditable (largeur/profondeur → régénère la géométrie), undo/redo
> (boutons + `Ctrl+Z`/`Ctrl+Maj+Z`). Vérifié dans le navigateur (créer → éditer →
> annuler/rétablir).

> **Slice 0 — avancement (2026-06-23, incrément 2 : E10-04 ré-export GLB).** Boucle
> de persistance bouclée : bouton **« Exporter GLB »** ([EditBar.jsx](home3d/src/components/EditBar.jsx))
> → [exportGLB.js](home3d/src/lib/exportGLB.js) réécrit la scène via `GLTFExporter`
> (coquille importée + objets app porteurs de `extras.edit { kind, plane, params }` +
> `source:'app'` ; géométrie bakée, ré-éditabilité via les params). Au chargement,
> [loadModel.js](home3d/src/lib/loadModel.js) `extractModelData` reconstruit les
> `objects` depuis `extras.edit` et **détache** les nodes app (l'app régénère la
> géométrie depuis les params) ; `setModel` repeuple `objects`, historique zundo
> remis à zéro. Round-trip vérifié de bout en bout (headless + navigateur) :
> créer → exporter → recharger → la forme revient, ses params intacts, et la maison
> importée s'affiche. **Bug corrigé au passage** : `appearance.js` stockait le
> matériau d'origine dans `object.userData.__origMaterial`, que `GLTFExporter`
> sérialisait en `extras` (un `THREE.Color` → un nombre) → matériau corrompu au
> ré-import (maison invisible). Correctif racine : matériaux d'origine déplacés dans
> une **WeakMap** (jamais dans `userData`) + purge défensive au chargement pour les
> GLB déjà exportés. NB : le GLB ressort décompressé (GLTFExporter ne fait pas de
> Draco) → repasser par `script/process.mjs` pour recompresser/valider ;
> node names conformes + zone restent à faire (E12-06).

> **Slice 0 — avancement (2026-06-24, incrément 3 : E12-02 « façon SketchUp » +
> E12-08 Push/Pull + IHM).** Après essai d'un sélecteur de plan explicite (XZ/YZ/
> niveau, **rejeté par le PO**), bascule sur le paradigme **SketchUp contextuel** :
> le plan d'esquisse est déduit du **survol** — **sol (niveau 0)** par défaut, ou la
> **face survolée** d'un mesh ([workPlanes.js](home3d/src/lib/workPlanes.js) :
> `groundFrame`/`faceFrame`, repère `u/v/normal`, projection monde↔plan ; pur, testé
> [script/workPlanes.test.mjs](home3d/script/workPlanes.test.mjs)). L'outil
> **Rectangle** trace sur ce plan (verrouillé au 1er point) ; aperçu discret du plan
> au survol. Nouvel outil **Push/Pull** (E12-08) : cliquer une forme et tirer →
> extrusion en **boîte paramétrique** (`hauteur_m` ajoutée aux params, géométrie
> régénérée, undo en 1 entrée) — [editRegistry.js](home3d/src/lib/editRegistry.js)
> `generateRect` produit un plan ou une boîte selon `hauteur_m`. **Multi-face** : la
> face cliquée détermine la cote modifiée (largeur/profondeur/hauteur via l'axe u/v/
> normal le plus aligné avec sa normale), la **face opposée restant fixe** (décalage
> de `plane.origin` committé dans la même entrée d'historique). Bug corrigé : les
> arêtes décoratives `__edges` interceptaient le clic (pas de `face`) → détection de
> face faussée ; rendues non-raycastables + repli sur `event.intersections`. **Barre d'outils à
> icônes + tooltips** (directive IHM) en remplacement des boutons texte. Correctif
> UX au passage : la surbrillance de survol/sélection du modèle est **coupée pendant
> un outil de dessin** ([Model.jsx](home3d/src/components/Model.jsx)) — sinon survoler
> un mur lavait toute la maison en bleu. Vérifié au navigateur : tracé sol + face,
> extrusion (boîte 3 m), undo, aucune erreur console.

> **Slice 0 — avancement (2026-06-24, incrément 4 : E12-03 snapping, inc. 1).**
> Premier jet du moteur d'inférence : pendant le tracé Rectangle, le curseur
> **s'accroche** aux références de la **face survolée** — **sommets** (vert),
> **milieux d'arête** (cyan), **point le plus proche sur une arête** (rouge) — dès
> qu'on passe à moins d'un **seuil en pixels** (14 px, constant à l'écran façon
> SketchUp). Module pur [snapping.js](home3d/src/lib/snapping.js) (`closestPointOnSegment`,
> `pickBestSnap` priorité sommet>milieu>arête + distance écran ; testé
> [script/snapping.test.mjs](home3d/script/snapping.test.mjs)) ; côté Canvas
> ([EditObjects.jsx](home3d/src/components/EditObjects.jsx)) `probeSketch` renvoie le
> `hit` modèle, `computeSnap` projette les candidats à l'écran, **marqueur losange**
> coloré par type. Vérifié au navigateur (marqueur affiché, aperçu du plan recentré
> sur l'accroche). **Reste E12-03 (inc. suivants)** : accroche aux **objets app**
> dessinés, références **hors triangle survolé** (requêtes de proximité accélérées
> `three-mesh-bvh`), **intersections**, **axes X/Y/Z** + lignes d'inférence, snap
> grille. **Reste Slice 0** : saisie numérique VCB (E12-04), cercle/arc (E13-02/03),
> node names conformes + zone (E12-06). Coalescence d'historique pendant la frappe :
> à raffiner.

> **Slice 0 — avancement (2026-06-26, incrément 5 : E12-03 snapping, inc. 2).**
> Extension de l'inférence aux trois cibles attendues. **(1) Accroche à tes formes** :
> chaque objet app expose ses points de référence (`referencePoints` dans
> [editRegistry.js](home3d/src/lib/editRegistry.js), **analytique** depuis params +
> repère, cohérent avec `generateRect`) — 4 coins + 4 milieux + centre par face, et
> faces base/haute + milieux verticaux pour une boîte extrudée ; ajoutés aux candidats
> du snapping. **(2) Axes** : pendant le tracé, accroche sur une droite passant par une
> référence le long de **u/v du plan actif**, avec **ligne d'inférence colorée façon
> SketchUp** (X rouge, Y vertical bleu, Z vert ; biais → magenta — `axisColorForDir`).
> **(3) Intersections** : croisement de deux axes (`closestPointBetweenLines`), marqueur
> magenta + les deux lignes. Tout est **ramené sur le plan d'esquisse actif**
> (`projectToPlane`) pour que marqueur et coin du rectangle coïncident (une référence
> hors plan donne un alignement « en colonne » sur le plan, pas une accroche hors-sol).
> Priorité d'accroche : **sommet > intersection > milieu > arête > axe**. Coût borné :
> seules les ~12 références les plus proches du curseur (écran) alimentent axes et
> intersections. Module pur [snapping.js](home3d/src/lib/snapping.js)
> (`closestPointOnLine`, `closestPointBetweenLines`, `axisColorForDir`, `WORLD_AXES`/
> `AXIS_COLORS`) ; composant [EditObjects.jsx](home3d/src/components/EditObjects.jsx)
> (`computeSnap` enrichi, `InferenceLines`). Tests étendus
> ([snapping.test.mjs](home3d/script/snapping.test.mjs) + nouveau
> [editRegistry.test.mjs](home3d/script/editRegistry.test.mjs) : 74 verts). Vérifié au
> navigateur sur le modèle démo : 2 rectangles tracés (le 2ᵉ près du 1ᵉʳ → accroche
> objets app + axes + intersections actifs), aucune erreur console. **Reste E12-03** :
> références du **mur importé hors triangle survolé** (requêtes de proximité accélérées
> `three-mesh-bvh`), **parallèle/perpendiculaire**, **snap grille**. **Reste Slice 0** :
> saisie numérique VCB (E12-04), cercle/arc (E13-02/03), node names conformes + zone
> (E12-06).

> **Slice 0 — avancement (2026-06-26, incrément 6 : E12-03 snapping, inc. 3).**
> Deux des trois cibles restantes de l'inférence. **(1) Références du mur importé hors
> triangle survolé** via `three-mesh-bvh` (la pièce phare). Nouveau module pur three
> [bvh.js](home3d/src/lib/bvh.js) : `patchBVH` (prototypes `computeBoundsTree`/
> `acceleratedRaycast`, idempotent — un mesh sans boundsTree retombe sur le raycast
> natif), `ensureBoundsTree` (indexe les meshes à l'**entrée d'Edit mode**, coût
> one-time, pas pour un simple viewer), et `meshReferencesNear(mesh, centre, rayon)` :
> **requête de proximité** (`boundsTree.shapecast`, test sphère en espace **local** du
> mesh) qui renvoie sommets + arêtes **dédupliqués** des triangles à portée — donc on
> accroche désormais aux coins/arêtes d'un mur **même quand le curseur est sur un autre
> triangle**. Le rayon de requête est dérivé du seuil d'accroche en **pixels**
> (`worldRadiusForPixels`, constant à l'écran façon SketchUp), coût borné par `maxTris`.
> [EditObjects.jsx](home3d/src/components/EditObjects.jsx) : `computeSnap` remplace la
> collecte mono-triangle (E12-03 inc.1) par cette requête BVH (repli triangle survolé
> conservé), et le raycast du tracé est lui aussi accéléré. **(2) Snap grille** : flag
> store `gridSnap` + `toggleGridSnap` (préférence non historisée), candidat de **plus
> basse priorité** (`grid` < `axis` dans `SNAP_PRIORITY` — la géométrie l'emporte
> toujours, la grille ne « tire » qu'à défaut), pas de 0,1 m sur le plan, marqueur gris.
> Toggle **barre d'outils à icône `#` + tooltip** (directive IHM) dans
> [EditBar.jsx](home3d/src/components/EditBar.jsx) + raccourci **G**
> ([App.jsx](home3d/src/App.jsx)). Tests : nouveau [bvh.test.mjs](home3d/script/bvh.test.mjs)
> (proximité/dédup sur cube, transformée monde, budget `maxTris`) + grille dans
> [snapping.test.mjs](home3d/script/snapping.test.mjs) — **83 verts**, `lint`/`build`
> OK. Vérifié au navigateur sur le modèle démo réel : entrée en édition (BVH construit
> sans erreur), toggle grille fonctionnel (`aria-pressed`), aucune erreur console.
> **Reste E12-03** : **parallèle/perpendiculaire** — délibérément reporté : c'est une
> inférence de *direction de tracé*, sans objet pour le Rectangle (côtés fixés sur u/v
> du plan) ; sa vraie valeur viendra avec les outils **ligne/arc** (E13-02/03). **Reste
> Slice 0** : saisie numérique VCB (E12-04), cercle/arc (E13-02/03), node names conformes
> + zone (E12-06).

> **Slice 0 — avancement (2026-06-26, incrément 7 : E12-04 saisie VCB).** Saisie de
> cote au clavier pendant le tracé Rectangle, façon **VCB SketchUp**. Pendant un
> glissé, taper « **Largeur ; Profondeur** » (séparateur de cote `;`, décimale `,`
> ou `.`, en mètres) fixe les cotes ; **Entrée** committe immédiatement, ou bien la
> cote tapée s'applique au **relâché** ; une cote omise garde la valeur du glissé
> (`2;` = largeur seule, `;0,8` = profondeur seule). La **direction** du glissé est
> conservée (seul le coin de départ est fixe). Modules **purs** testés : parsing +
> application au tracé [vcb.js](home3d/src/lib/vcb.js)
> ([vcb.test.mjs](home3d/script/vcb.test.mjs), 11 verts → **94** au total), et
> construction du rectangle extraite [sketchRect.js](home3d/src/lib/sketchRect.js)
> (partagée entre glissé et clavier). Le commit du tracé est centralisé dans une
> action store **`commitDraft`** (gère la cote VCB **et** la garde clic-accidentel
> `MIN_SIZE`, levée dès qu'une cote est tapée), appelée au relâché
> ([EditObjects.jsx](home3d/src/components/EditObjects.jsx)) comme à l'Entrée. La
> frappe est captée **avant** les raccourcis ([App.jsx](home3d/src/App.jsx),
> `handleVcbKey`) pour ne pas déclencher R/G/V/E en tapant des chiffres ; **Échap**
> efface la saisie (tracé maintenu) puis annule le tracé. Boîte de mesure HTML en
> bas à droite [VCBOverlay.jsx](home3d/src/components/VCBOverlay.jsx) (cotes vives ou
> texte tapé souligné). Vérifié au navigateur : `2;3` écrase un glissé 2,59 × 0,24
> (Entrée), `1;0,5` appliqué au relâché sans Entrée, décimale virgule OK, aucune
> erreur console ; `lint`/`build` OK. **Reste Slice 0** : cercle/arc (E13-02/03) —
> qui réutiliseront la VCB pour le rayon —, node names conformes + zone (E12-06).
> VCB du Push/Pull (E12-08, profondeur d'extrusion au clavier) : à brancher de même.

> **Slice 0 — avancement (2026-06-26, incrément 8 : E12-06 node names + zone).**
> Les objets créés in-app portent un **node name conforme** à la convention
> (`système__type__zone__niveau__index`) qui **passe la regex de validation** du
> pipeline, sans plugin SketchUp. Module **pur** [naming.js](home3d/src/lib/naming.js)
> ([naming-app.test.mjs](home3d/script/naming-app.test.mjs), 10 verts → **114** au
> total) : `nodeName`, `nextIndex` (**index auto-incrémenté par bucket (système,
> zone, niveau) en max+1** → pas de réutilisation après suppression), `normalizeZone` ;
> il **réutilise la convention unique** de [naming.mjs](home3d/script/naming.mjs)
> (regex/systèmes/niveaux, `normalizeSegment` désormais exporté) → noms validés à
> l'identique côté app et côté pipeline. **Découplage id ↔ node name** : l'`id`
> interne du store reste **stable** (`app-N`) et distinct du node name (dérivé des
> champs de nommage) → changer zone/niveau ne re-keye pas le store (cohérent avec
> l'immutabilité des ids, E7-03). [editRegistry.js](home3d/src/lib/editRegistry.js)
> `kindNaming(kind)` mappe le `kind` → système/type (`sketch.rect` →
> `structure`/`forme`) ; les vrais objets MEP/ouvertures déclareront le leur. Store
> ([useStore.js](home3d/src/store/useStore.js)) : zone/niveau **« courants »** (défaut
> des nouvelles formes, **seedés** depuis `metadata.model.zones[0]`/`levels[0]`),
> `buildAppObject`, action **`setObjectNaming`** (recalcule l'index dans le nouveau
> bucket, met à jour la zone courante ; historisée zundo). **Inspector**
> ([EditBar.jsx](home3d/src/components/EditBar.jsx)) : affiche le node name conforme
> + **sélecteurs Zone** (zones du modèle) et **Niveau** (libellés FR) câblés sur
> `setObjectNaming` (directive IHM respectée). **Round-trip GLB** (E10-04) : le node
> exporté porte le nom conforme + extras `layer/type/zone/level/index` (comme un node
> pipeline), [loadModel.js](home3d/src/lib/loadModel.js) les relit (repli
> registre+défauts pour un GLB pré-E12-06). Vérifié au navigateur sur le modèle démo :
> 6 formes nommées, changement zone/niveau → nom + index recalculés, **round-trip
> export→reload** (noms conformes, champs préservés), aucune erreur console ;
> `lint`/`build` OK. **Reste Slice 0** : cercle/arc (E13-02/03), VCB du Push/Pull
> (E12-08, profondeur d'extrusion au clavier). Avec E12-06, **Slice 0 a livré tout le
> socle d'édition + nommage** ; ne restent que les primitives cercle/arc.

> **Slice 0 — avancement (2026-06-27, incrément 9 : E13-02 cercle paramétrique).**
> Outil **Cercle** (centre + rayon) qui réemploie toute la machinerie du Rectangle :
> plan d'esquisse contextuel (E12-02), snapping/inférence (E12-03), VCB clavier
> (E12-04), Push/Pull (E12-08, le cercle s'extrude en **cylindre**), inspector +
> undo/redo, et le **nommage conforme** (E12-06, type `disque`). Nouveau `kind`
> `sketch.circle` dans [editRegistry.js](home3d/src/lib/editRegistry.js)
> (`generateCircle` : `CircleGeometry` plat / `CylinderGeometry` d'axe Z extrudé,
> contours via `EdgesGeometry` à seuil 30° pour ne garder que les cercles base/haut ;
> `referencePoints` = centre + 4 quadrants par face ; `deriveDims` = diamètre×diamètre×
> hauteur ; `kindNaming` → `structure`/`disque`). Module pur
> [sketchCircle.js](home3d/src/lib/sketchCircle.js) (`circlePayloadFromDraft`, rayon =
> distance centre→bord) et **VCB rayon** dans [vcb.js](home3d/src/lib/vcb.js)
> (`parseVcbRadius`/`applyVcbRadiusToDraft` : une valeur = le rayon, direction du
> glissé conservée). Le tracé porte désormais un `draft.tool` (rect|circle) :
> [useStore.js](home3d/src/store/useStore.js) `commitDraft` branche dessus (parsing
> VCB, garde clic-accidentel, constructeur de payload), [EditObjects.jsx](home3d/src/components/EditObjects.jsx)
> `SketchSurface` reçoit l'outil et `DraftPreview` rend un disque ou un rectangle. UI :
> **icône cercle + tooltip** ([EditBar.jsx](home3d/src/components/EditBar.jsx), directive
> IHM), champ **Rayon** dans l'inspector (selon `kind`), overlay VCB « Rayon » + invite
> « Tapez R puis Entrée » ([VCBOverlay.jsx](home3d/src/components/VCBOverlay.jsx)). Tests :
> [sketchCircle.test.mjs](home3d/script/sketchCircle.test.mjs) (payload, VCB rayon,
> références, dims) → **112 verts** ; `lint`/`build` OK. Vérifié au navigateur sur le
> modèle démo : disque plat + cylindre extrudé rendus (contours nets), VCB rayon
> (`3` écrase le glissé), inspector Rayon, round-trip export→reload (cercles + noms
> conformes préservés), aucune erreur console. **Reste Slice 0** : **arc** (E13-03),
> VCB du Push/Pull (E12-08).

> **Slice 0 — avancement (2026-06-29, incrément 10 : E13-03 arc paramétrique).**
> Outil **Arc** « centre + début + fin » (3 clics, façon SketchUp), dernière
> primitive de Slice 0. Réemploie toute la machinerie : plan d'esquisse contextuel
> (E12-02, l'arc se pose sur le sol ou la face survolée), snapping/inférence
> (E12-03), VCB clavier (E12-04), inspector + undo/redo, nommage conforme (E12-06,
> type `arc`), Push/Pull (E12-08). Interaction **multi-clics** (et non glissé) :
> clic 1 = centre, clic 2 = début (fixe **rayon** + angle de départ), clic 3 = fin
> (fixe le **balayage**). Le balayage est **accumulé** au déplacement (`nextSweep`)
> pour franchir **±180°** (arcs majeurs) sans saut — vérifié à 200°. Nouveau `kind`
> `sketch.arc` dans [editRegistry.js](home3d/src/lib/editRegistry.js)
> (`generateArc` : **plat** = fin tube le long de l'arc (corps cliquable) + trait
> net ; **extrudé** (`hauteur_m`) = **mur courbe** (ruban cousu base/haut) ;
> `referencePoints` = centre + début + fin + milieu par face ; `deriveDims` =
> bounding box de l'arc dans le plan ; `kindNaming` → `structure`/`arc`). Module pur
> [sketchArc.js](home3d/src/lib/sketchArc.js) (`radiusOf`, `angleOf`, `nextSweep`
> balayage accumulé, `arcPayloadFromDraft`) et **VCB angle** dans
> [vcb.js](home3d/src/lib/vcb.js) (`parseVcbAngle`, signé). Le tracé porte
> `draft.stage` (radius|sweep) : [useStore.js](home3d/src/store/useStore.js)
> `commitDraft` → `commitArc` (étape `radius` verrouille et **avance**, étape
> `sweep` **crée** l'objet) ; [EditObjects.jsx](home3d/src/components/EditObjects.jsx)
> `SketchSurface` gère le flux clic (pas de drag) + `ArcDraftPreview` (cercle support
> + rayons-guides en étape radius, arc + 2 rayons en étape sweep). Push/Pull restreint
> à la normale pour l'arc (seul `hauteur_m` a un sens — courbe ouverte). UI : **icône
> arc + tooltip** ([EditBar.jsx](home3d/src/components/EditBar.jsx), directive IHM),
> champs **Rayon** + **Balayage (°)** (signé) dans l'inspector, overlay VCB adapté à
> l'étape ([VCBOverlay.jsx](home3d/src/components/VCBOverlay.jsx)), saisie du signe
> `-` admise ([App.jsx](home3d/src/App.jsx)). Tests :
> [sketchArc.test.mjs](home3d/script/sketchArc.test.mjs) (rayon/angle, balayage
> accumulé >180°, payload, VCB angle, références, dims) → **131 verts** ; `lint`/
> `build` OK. Vérifié au navigateur sur le modèle démo : arc tracé sur une face du
> toit, édition balayage 200° (arc majeur) + hauteur 1,5 m (mur courbe), VCB rayon
> `2`/angle `90`, node name conforme, undo/redo, aucune erreur console. **Slice 0
> est CLOSE** (rect/cercle/arc + socle d'édition complet) ; reste optionnel : VCB du
> Push/Pull (E12-08). Prochaine étape : **Slice 1 — Ouvertures (CSG, E14 ph.1)**.

> **Slice 1 — avancement (2026-07-01, incrément 1 : E14-01 ouverture posée).**
> Début de la Slice 1 (ouvertures). **Phase 1a — l'objet ouverture**, AVANT le CSG
> (découplage du risque, cf. § 5.4 « en deux temps »). Nouvel outil **Ouverture** :
> clic sur une **face de mur** → pose une fenêtre paramétrique qui **référence le
> mur par node name** (`plane.faceOf`, immuable). Réemploie le plan contextuel
> (E12-02, la face survolée) et le snapping (E12-03) déjà en place. Nouveau `kind`
> `opening.window` dans [editRegistry.js](home3d/src/lib/editRegistry.js)
> (`generateOpening` = cadre translucide teinté « ouvertures » posé sur le mur —
> **marqueur, pas encore le vide** ; `referencePoints` = 4 coins + 4 milieux +
> centre, seuil à v=0 ; `kindNaming` → `ouvertures`/`fenetre`). Repère : `u`
> horizontal (largeur), `v` vertical (hauteur depuis le **seuil** = `plane.origin`),
> `normal` = extérieur ; l'**allège** = hauteur du seuil au-dessus du sol
> (`origin.y`). Module pur [opening.js](home3d/src/lib/opening.js) (`openingPayload`
> centre l'ouverture sur le clic : seuil = clic − ½ hauteur le long de `v`). Store
> ([useStore.js](home3d/src/store/useStore.js)) : action **`setOpeningAllege`**
> (déplace `plane.origin` verticalement, historisée) ; la pose passe par
> `createObject` existant. Pose au clic dans
> [EditObjects.jsx](home3d/src/components/EditObjects.jsx) `SketchSurface`
> (`tool==='opening'`, uniquement si `frame.type==='face'`) ; Push/Pull exclu pour
> une ouverture. UI : **icône fenêtre + tooltip** (directive IHM), inspector dédié
> Largeur / Hauteur / **Allège** + node name du **mur référencé**
> ([EditBar.jsx](home3d/src/components/EditBar.jsx)). Round-trip GLB **générique**
> (le registre gère `opening.window` ; `plane.faceOf` persisté dans `extras.edit`).
> Tests : [opening.test.mjs](home3d/script/opening.test.mjs) (payload, seuil, allège
> plancher, références, nommage conforme) → **135 verts** ; `lint`/`build` OK.
> Vérifié au navigateur sur le modèle démo : fenêtre posée sur un mur pignon
> (référence `structure__mur_porteur__sejour__rdc__005`), largeur/allège éditées
> (l'ouverture se repositionne), undo/redo, aucune erreur console. **Reste Slice 1
> (incrément 2)** : **E14-02 le vrai trou CSG** (`three-bvh-csg`, `mur − volume`,
> recalculé au chargement, non-destructif) + **E14-03 fallback** mur non-manifold ;
> puis **E14-04** gabarits. Le [spike CSG](home3d/script/spike-csg.mjs) a validé
> l'approche (🟢 fiable même sur le bloc non-manifold, garder weld + fallback).

> **Slice 1 — avancement (2026-07-01, incrément 2 : E14-02/03 vrai trou CSG).**
> **Le morceau risqué de la V2.** Les ouvertures (E14-01) percent désormais un
> **vrai vide** dans le mur importé par booléen CSG. Module three
> [csg.js](home3d/src/lib/csg.js) (reprend l'approche validée du
> [spike](home3d/script/spike-csg.mjs) 🟢) : `openingCutBox` (boîte largeur×hauteur
> profonde sur la face), `cutWallGeometry` (weld `mergeVertices` + `Brush`/
> `Evaluator SUBTRACTION` de `three-bvh-csg` ; conserve `uv` pour les murs texturés ;
> travaille en monde, rend en local), `isCutDegenerate` (vide / NaN / explosion de
> triangles → E14-03). **Non-destructif & ré-éditable** : la géométrie d'origine est
> gardée dans une **WeakMap** (`pristineGeom`) et la découpe **recalculée DEPUIS
> elle** à chaque changement (agrandir / rétrécir / **déplacer** repartent du mur
> plein → pas de trou fantôme). Composant [WallCutter.jsx](home3d/src/components/WallCutter.jsx)
> (monté dans [Viewer.jsx](home3d/src/components/Viewer.jsx), actif en **vue comme en
> édition**) : groupe les ouvertures par mur (`plane.faceOf`), restaure tout puis
> recoupe ; pose la géométrie percée **en place** sur le mesh (même calque / matériau /
> raycast) ; mur absent → dégradation propre. **Recalcul au chargement** : gratuit
> (WallCutter réagit aux `objects` reconstruits). **E14-03 fallback** : résultat
> dégénéré → mur d'origine conservé + id dans `csgFallbackIds` (store) → **message**
> dans l'inspector ([EditBar.jsx](home3d/src/components/EditBar.jsx)). **Export**
> ([exportGLB.js](home3d/src/lib/exportGLB.js)) : `withPristineGeometry` écrit le mur
> **plein** + les ouvertures paramétriques (fichier ré-éditable, découpe recalculée au
> rechargement, pas figée). Tests [csg.test.mjs](home3d/script/csg.test.mjs) (boîte de
> découpe, **vrai trou vérifié par raycast** headless comme le spike, dégénérescence)
> → **138 verts** ; `lint`/`build` OK. Vérifié au navigateur sur le modèle démo :
> ouverture posée sur un mur → géométrie du mur **modifiée** (perçage, 0 fallback),
> **suppression restaure exactement** l'origine (non-destructif), **export sans
> erreur** (mur plein pendant le clone puis découpe rétablie), aucune erreur console.
> **Slice 1 quasi close** ; reste **E14-04** (gabarits classique/large/étroite).

> **Slice 1 — avancement (2026-07-01, incrément 3 : E14-04 gabarits d'ouverture).**
> **Slice 1 CLOSE.** Trois gabarits sélectionnables avant la pose de l'outil
> **Ouverture** : `OPENING_PRESETS` dans [opening.js](home3d/src/lib/opening.js)
> (`classique` 1,0×1,2 m — dims historiques d'E14-01 —, `large` 1,6×1,4 m,
> `etroite` 0,6×1,0 m) ; `openingPayload(point, frame, dims)` prend désormais le
> gabarit en 3ᵉ argument (repli `classique`). Store
> ([useStore.js](home3d/src/store/useStore.js)) : `openingPreset` + `setOpeningPreset`
> — préférence d'outil **non historisée** (comme `gridSnap`, le `partialize` zundo
> n'historise que `objects`). UI ([EditBar.jsx](home3d/src/components/EditBar.jsx)) :
> **sous-barre à icônes + tooltips** (directive IHM) sous la palette d'outils,
> visible seulement outil **Ouverture** actif ; icône = cadre + croisillon dont
> l'aspect (carré/large/étroit) illustre le gabarit, tooltip donnant les cotes.
> L'instance posée reste **modifiable ensuite** dans l'inspector existant (champs
> Largeur/Hauteur/Allège inchangés). Tests :
> [opening.test.mjs](home3d/script/opening.test.mjs) (3 gabarits distincts,
> `openingPayload` applique le gabarit passé) → **140 verts** ; `lint`/`build` OK.
> Vérifié au navigateur sur le modèle démo : gabarit **Large** sélectionné → fenêtre
> posée sur un mur (`structure__mur_porteur__sejour__rdc__0…`) avec largeur 1,6 m /
> hauteur 1,4 m dans l'inspecteur, aucune erreur console. **E14 phase 1 (le vide)
> est complet** ; reste **E14 phase 2** (menuiserie cadre+vitrage, après Slice 2)
> et **Slice 2 — Électricité (E15)**.

> **Slice 2 — avancement (2026-07-01, incrément 1 : E15-01/02 composants élec
> ponctuels).** Début de la Slice 2 (électricité). **Catégorie ① « ponctuel »**
> (cf. § 4) : poser un petit composant catalogue sur une **face de mur**, façon
> ouverture (E14-01) — réemploie le plan d'esquisse contextuel (E12-02, la face
> survolée) et le snapping (E12-03), **aucun booléen**. Nouvel outil **Électricité**
> avec une **sous-barre à icônes + tooltips** (directive IHM) pour choisir le
> composant : **prise** (`elec.outlet`), **interrupteur** (`elec.switch`), **boîte
> de dérivation** (`elec.junction`), **compteur** (`elec.meter`). Clic sur une face
> de mur → pose le composant sélectionné, qui **référence le mur par node name**
> (`plane.faceOf`) ; un clic sur le sol est ignoré. Module **pur**
> [elec.js](home3d/src/lib/elec.js) : catalogue `ELEC_COMPONENTS` (dims réalistes,
> `type` de nommage conforme) + `elecPayload(point, frame, kind)` (origin = point
> cliqué = **centre** du composant, repli prise si kind inconnu). Registre
> [editRegistry.js](home3d/src/lib/editRegistry.js) : `generateElec` (boîte centrée
> ressortie le long de +normal, teintée couleur du calque `elec` `#D85A30`),
> partagé par les 4 kinds ; `referencePoints` (centre + 4 coins sur le mur),
> `deriveDims` (u→largeur/v→hauteur/normal→profondeur), `kindNaming` (→ `elec`/type)
> **dérivés du catalogue** pour éviter la redite. Store
> ([useStore.js](home3d/src/store/useStore.js)) : `elecComponent` + `setElecComponent`
> (préférence d'outil **non historisée**, comme `openingPreset`/`gridSnap`) et action
> **générique** `setObjectFloorHeight` (déplace `plane.origin` en Y, réutilisable au
> lieu du `setOpeningAllege` spécifique). Pose au clic dans
> [EditObjects.jsx](home3d/src/components/EditObjects.jsx) `SketchSurface`
> (`tool==='elec'`, comme l'ouverture) ; Push/Pull restreint aux `sketch.*` (une
> ouverture / un composant posé ne s'extrude pas). UI
> ([EditBar.jsx](home3d/src/components/EditBar.jsx)) : icône **éclair** + sous-barre
> des 4 composants + inspector dédié (Largeur / Hauteur / Profondeur / **Hauteur /
> sol** + node name du mur référencé). Round-trip GLB **générique** (le registre
> gère `elec.*`, `plane.faceOf` persisté dans `extras.edit` ; WallCutter ignore les
> non-`opening.window` → pas de CSG sur l'élec). Tests :
> [elec.test.mjs](home3d/script/elec.test.mjs) (catalogue, payload + repli, dims,
> références, nommage conforme des 4 types) → **147 verts** ; `lint`/`build` OK.
> Vérifié au navigateur sur le modèle démo : outil Électricité + sous-barre, **prise
> posée** sur un mur pignon (`elec__prise__combles__combles__001`, mur référencé
> `structure__mur_porteur__sejour__rdc__005`), **compteur** posé
> (`elec__compteur__combles__combles__002`), clic sol ignoré, inspector complet,
> undo (retour à 1 objet), aucune erreur console. **Reste Slice 2** : **E15-03
> câble routé** (catégorie ② linéaire, section rectangulaire balayée, § 5.3) — le
> gros morceau — puis **E15-04** (circuits, optionnel). La menuiserie des fenêtres
> (E14 ph.2) réutilisera cette pose de composants.

> **Slice 2 — avancement (2026-07-01, incrément 2 : E15-03 câble routé).** Le gros
> morceau de la Slice 2. **Catégorie ② « linéaire/routé »** (§ 5.3) : router un câble
> élec par une **polyligne multi-clics** balayée avec une **section RECTANGULAIRE**
> (4 faces/tronçon, pas de cylindre → basse résolution) et des **coudes d'onglet**
> (mitre) aux sommets. Module **pur réutilisable par la plomberie** (E16)
> [routing.js](home3d/src/lib/routing.js) : `dedupePath`, `pathLength`, `runRings`
> (repère de section porté par le **plan bissecteur** à chaque sommet → jonctions
> sans trou). Module pur [cable.js](home3d/src/lib/cable.js) : catalogue de sections
> **gaine Ø16/20/25/32** (emprise rectangulaire = côté nominal, `diametre_mm`
> conservé pour l'étiquetage), `cablePayloadFromPath` (déduplique, ≥ 2 sommets).
> Registre [editRegistry.js](home3d/src/lib/editRegistry.js) : `generateRun`
> (géométrie construite en coordonnées **MONDE** depuis `params.points`, **sans
> placeOnPlane** — le run n'a pas de plan unique ; matériau opaque teinté `elec`),
> `referencePoints` (chaque sommet = point d'accroche), `deriveDims` (bbox monde),
> `kindNaming` `elec.cable` → `elec`/`cable`. Store
> ([useStore.js](home3d/src/store/useStore.js)) : `cableSection` (préférence non
> historisée) + `commitCable` ; le tracé porte `draft.tool='cable'` avec les sommets
> en **monde** (chaque clic résolu sur le **plan contextuel frais**, pas un plan
> verrouillé → le câble passe d'une face à l'autre). Interaction
> ([EditObjects.jsx](home3d/src/components/EditObjects.jsx)) `SketchSurface`
> (`tool==='cable'`) : clics successifs ajoutent un sommet, **double-clic** ou
> **Entrée** termine, **Échap** annule ; `CableDraftPreview` (polyligne de l'aperçu).
> UI ([EditBar.jsx](home3d/src/components/EditBar.jsx)) : **icône Câble** + **sous-barre
> des sections** (carré-jauge) + inspector (section, `N sommets · longueur`). Push/Pull
> exclu (déjà restreint aux `sketch.*`), WallCutter ignore les non-`opening.window`
> (pas de CSG sur le câble). Round-trip GLB **générique** (`edit.params` porte `points`
> + `section`). Tests : [routing.test.mjs](home3d/script/routing.test.mjs) +
> [cable.test.mjs](home3d/script/cable.test.mjs) → **164 verts** ; `lint`/`build` OK.
> Vérifié au navigateur sur le modèle démo : câble routé **sur les faces du toit**
> (`elec__cable__combles__combles__001`, 3 sommets · 3,55 m), section **Ø20→Ø32**
> régénère la géométrie (câble plus épais), undo/redo, aucune erreur console. **Reste
> Slice 2** : **E15-04** (circuits, optionnel). La menuiserie des fenêtres (E14 ph.2)
> réutilisera la pose de composants d'E15-01.

> **E14 phase 2 — avancement (2026-07-01, incrément 1 : E14-05 menuiserie cadre +
> vitrage).** Comme prévu au séquençage (§ 6), la menuiserie arrive **après** la
> Slice 2 : c'est un **composant posé** (catégorie ①) qui réutilise la machinerie
> de pose d'E15-01, **aucun booléen**. Nouvel outil **Menuiserie** : cliquer une
> **ouverture déjà posée** (son marqueur devient cliquable, pas de surface
> d'esquisse) → un cadre + vitrage s'y loge, **ajusté à ses dims** (largeur/hauteur
> copiées à la pose). Module **pur** [joinery.js](home3d/src/lib/joinery.js) :
> `joineryPayloadFromOpening` (dims + plan de l'hôte copiés PAR VALEUR, profil par
> défaut épaisseur 0,06 m / profondeur 0,08 m) et `findJoinery` (garde **« un cadre
> par ouverture »** : re-cliquer une ouverture équipée sélectionne son cadre).
> **Liaison** : `plane.hostOf` = node name de l'ouverture — stable au round-trip
> GLB (au rechargement l'id d'un objet app = son node name exporté). Registre
> ([editRegistry.js](home3d/src/lib/editRegistry.js)) : `generateJoinery` — 2
> traverses + 2 montants **fusionnés en une géométrie** (`mergeGeometries`, un seul
> `__fill` → sélection/émissif uniformes) + vitrage translucide `__glass`,
> **encastré dans le vide** (face avant affleurant le mur), teinté couleur du calque
> `ouvertures` `#1D9E75` ; section des montants bornée (jamais au point de fermer le
> jour) ; `referencePoints` partagés avec l'ouverture (même repère seuil),
> `deriveDims`, `kindNaming` → `ouvertures`/`menuiserie`. Pose dans
> [EditObjects.jsx](home3d/src/components/EditObjects.jsx) : prop `hostable` sur les
> ouvertures quand l'outil Menuiserie est actif (clic → `onHostJoinery`), WallCutter
> et Push/Pull inchangés (ignorent les non-`opening.window` / non-`sketch.*`). UI
> ([EditBar.jsx](home3d/src/components/EditBar.jsx)) : **icône cadre + tooltip**
> (directive IHM) + inspector (Largeur / Hauteur / Épaisseur cadre / Profondeur +
> node name de l'ouverture hôte). Round-trip GLB **générique** (`extras.edit` porte
> params + plane avec `hostOf`). Tests :
> [joinery.test.mjs](home3d/script/joinery.test.mjs) + générateur/références dans
> [editRegistry.test.mjs](home3d/script/editRegistry.test.mjs) → **176 verts** ;
> `lint`/`build` OK. Vérifié au navigateur sur le modèle démo : ouverture posée
> (`ouvertures__fenetre__combles__combles__001`) → outil Menuiserie → cadre posé
> (`ouvertures__menuiserie__combles__combles__002`, 1 × 1,2 m copiés du gabarit
> classique), re-clic sans doublon, inspector complet, undo/redo, aucune erreur
> console. **Reste E14 phase 2** : E14-06 (variantes de menuiserie) et E14-07
> (portes) — puis **Slice 3 (plomberie, E16)** ou **E15-04** (circuits, optionnel).

> **E14 phase 2 — avancement (2026-07-04, incrément 2 : E14-06 variantes de
> menuiserie).** La variante est un **param d'instance** (`params.variante`),
> façon catalogue élec : le kind, le nommage (`ouvertures__menuiserie__…`) et
> l'emprise (dims copiées de l'hôte) ne changent pas, seule la géométrie générée
> diffère. Catalogue dans [joinery.js](home3d/src/lib/joinery.js) :
> `JOINERY_VARIANTS` = **fixe** (rendu E14-05 : vitrage plein), **battant**
> (meneau central + un vitrage par vantail) et **coulissant** (2 vantaux sur
> **rails décalés** le long de la normale : vitrages d'une demi-baie +
> recouvrement central, montants de recouvrement croisés sur des plans
> différents) ; `joineryVariantOf` = repli sur `fixe` → **rétro-compat** des GLB
> antérieurs (menuiseries sans `variante`). Générateur
> ([editRegistry.js](home3d/src/lib/editRegistry.js)) : `bar(bw,bh,cx,cy,bd?,cz?)`
> généralisé (profondeur/position propres aux pièces de variante), vitrages
> **fusionnés en une géométrie** (`mergeGeometries`, un seul `__glass`), cadre
> toujours un seul `__fill`. Sélection **avant la pose** : préférence d'outil
> `joineryVariant` dans le store (non historisée), copiée dans les params par
> `joineryPayloadFromOpening(opening, host, variante)` ; **sous-barre à icônes +
> tooltips** (directive IHM) sous la palette quand l'outil Menuiserie est actif
> ([EditBar.jsx](home3d/src/components/EditBar.jsx)) + **SelectField « Variante »
> dans l'inspector** (modifiable par instance, régénère la géométrie). Round-trip
> GLB **générique** (`edit.params` porte `variante`, aucun changement d'export).
> Tests : [joinery.test.mjs](home3d/script/joinery.test.mjs) (catalogue, payload,
> repli) + [editRegistry.test.mjs](home3d/script/editRegistry.test.mjs)
> (géométries par variante : meneau, 2 vitrages, rails à Z distincts,
> rétro-compat) → **183 verts** ; `lint`/`build` OK. Vérifié au navigateur sur le
> modèle démo : ouverture posée → menuiserie **battant**
> (`ouvertures__menuiserie__combles__combles__002`, meneau visible), bascule
> **battant → coulissant** dans l'inspector régénère la géométrie, undo/redo sur
> le changement de variante, aucune erreur console. **Reste E14 phase 2** :
> E14-07 (portes) — puis **Slice 3 (plomberie, E16)** ou **E15-04** (circuits,
> optionnel).

> **E14 phase 2 — avancement (2026-07-04, incrément 3 : E14-07 portes). E14 est
> COMPLET.** La porte réemploie les deux mécanismes existants, comme prévu au
> backlog : une **ouverture** + un **composant hébergé**. **(1) L'ouverture
> porte** (`opening.door`, [opening.js](home3d/src/lib/opening.js)) : nouvel
> outil **Porte** (icône + sous-barre de gabarits **simple 0,90×2,15 /
> double 1,40×2,15 / étroite 0,73×2,04 m**, directive IHM) ; même pose au clic
> sur une face de mur que la fenêtre (`doorPayload`), mais le **seuil descend
> au sol** le long de v (y=0, convention allège/hauteur-sol du projet ; repli
> « centré sur le clic » si la face n'est pas verticale) et il n'y a **pas de
> param allège**. `isOpeningKind` (fenêtre OU porte) : le **CSG WallCutter
> perce les deux** (openingCutBox inchangée — base au seuil), l'inspector
> partage la branche fenêtre (champ Allège réservé à la fenêtre), le marqueur
> réutilise `generateOpening`. **(2) Le vantail** (`door.leaf`,
> [joinery.js](home3d/src/lib/joinery.js)) : l'outil **Menuiserie** clique une
> ouverture et le module choisit le composant selon l'hôte — fenêtre → cadre +
> vitrage (E14-05), **porte → vantail** ; `joineryPayloadFromOpening` rend un
> `door.leaf` **sans variante** (les variantes E14-06 restent propres aux
> fenêtres), `findJoinery`/`isHostedKind` étendent la garde « un composant par
> ouverture ». `generateDoorLeaf` ([editRegistry.js](home3d/src/lib/editRegistry.js)) :
> dormant **3 côtés** (2 montants + traverse haute, seuil libre) + **panneau
> plein** + **poignée**, fusionnés en un seul `__fill` (pas de `__glass`),
> couleur calque `ouvertures`. Nommage `ouvertures__porte__…` /
> `ouvertures__vantail__…` conforme ; round-trip GLB générique (kinds au
> registre). Tests : [opening.test.mjs](home3d/script/opening.test.mjs) +
> [joinery.test.mjs](home3d/script/joinery.test.mjs) +
> [editRegistry.test.mjs](home3d/script/editRegistry.test.mjs) → **199 verts** ;
> `lint`/`build` OK. Vérifié au navigateur sur le modèle démo : porte posée sur
> un mur rdc (`ouvertures__porte__combles__combles__001`, mur
> `structure__mur_porteur__sejour__rdc__005`, **vrai trou CSG, 0 fallback**,
> seuil au sol), vantail posé via l'outil Menuiserie
> (`ouvertures__vantail__combles__combles__002`, dims copiées 0,9×2,15,
> inspector sans champ Variante), re-clic sans doublon, undo×2/redo×2, aucune
> erreur console. **Reste** : **Slice 3 (plomberie, E16)** — dernière slice
> d'édition — ou **E15-04** (circuits, optionnel).

> **Slice 3 — avancement (2026-07-04, incrément 1 : E16-01 tuyaux routés).**
> Calque exact du câble E15-03 : le tuyau est un **run routé** (catégorie ②) —
> polyligne multi-clics balayée avec une **section rectangulaire** d'emprise
> équivalente au Ø nominal, coudes d'onglet aux sommets, **`routing.js`
> réutilisé tel quel** (zéro changement). Nouveau module pur
> [plumbing.js](home3d/src/lib/plumbing.js) : catalogue `PIPE_SECTIONS`
> (**cuivre Ø12/14/16/18/22** alimentation + **évac PVC Ø32/40/100**, défaut
> cuivre Ø16), chaque section porte `famille` ('cuivre'|'evac') **conservée
> dans les params** (support direct d'E16-02 : la pente ne concernera que les
> runs `evac`) ; `pipePayloadFromPath` (déduplication, ≥ 2 sommets).
> [editRegistry.js](home3d/src/lib/editRegistry.js) : le générateur de run est
> devenu une **fabrique `makeGenerateRun(fill, edge)`** partagée câble/tuyau
> (seule la couleur de calque diffère — plomberie `#7F77DD`) ; kind
> **`plomberie.pipe`**, `referencePoints`/`deriveDims` généralisés (`isRunKind`),
> `kindNaming` → **`plomberie`/`tuyau`**. Store : préférence `pipeSection`
> (non historisée) + `commitCable` généralisé en **`commitRun`** (câble/tuyau
> selon `draft.tool`). Tracé : mêmes gestes que le câble (plan contextuel frais
> à chaque clic, snapping, double-clic/Entrée pour finir, Échap annule) —
> branches `cable` de [EditObjects.jsx](home3d/src/components/EditObjects.jsx)
> généralisées aux deux outils (`RunDraftPreview`). UI
> ([EditBar.jsx](home3d/src/components/EditBar.jsx)) : outil **Tuyau** (icône
> conduite coudée + goutte, tooltip) + **sous-barre des 8 sections** (cercles-
> jauges, vs carrés du câble — directive IHM) + **inspector commun aux runs**
> (`runCatalog` : SelectField Section par catalogue du kind + « N sommets ·
> longueur »). Round-trip GLB générique (kind au registre). Tests :
> [plumbing.test.mjs](home3d/script/plumbing.test.mjs) (catalogue, payload,
> famille, registre, **générateur** : balayage monde, couleur calque, groupe à
> l'identité) → **211 verts** ; `lint`/`build` OK. Vérifié au navigateur sur le
> modèle démo : tuyau **évac Ø40** routé en 3 clics sur le toit
> (`plomberie__tuyau__combles__combles__001`, 3 sommets · 3,93 m), Entrée
> committe, bascule de section **evac40 → cuivre16** dans l'inspector régénère
> (famille suit), undo×2/redo×2, aucune erreur console. **Reste Slice 3** :
> E16-03 (tés aux jonctions — les coudes d'onglet sont déjà dans `runRings`),
> E16-02 (pente évac), E16-04 (valve inline).

> **Slice 3 — avancement (2026-07-05, incrément 2 : E16-03 raccords automatiques
> aux jonctions).** Les coudes d'onglet AU SEIN d'un run existaient déjà (le
> balayage `runRings`, E15-03/E16-01) ; l'incrément traite les jonctions ENTRE
> tuyaux : une EXTRÉMITÉ de run qui arrive sur un autre run reçoit un raccord
> généré automatiquement — **té** (arrivée sur le corps : milieu de segment ou
> sommet intérieur), **coude** (extrémité contre extrémité en angle), **manchon**
> (extrémités colinéaires). Nouveau module pur
> [fittings.js](home3d\src\lib\fittings.js) : `detectFittings(runs)` (tolérance =
> demi-sections cumulées, dédup extrémité-contre-extrémité par paire + point
> médian) et `fittingMesh` (bras = mini-runs de 2 points, section ×1,4 effet
> « collier », longueur 1,6 × le plus gros côté, plancher 3 cm). La triangulation
> du balayage sort d'`editRegistry` vers [routing.js](home3d\src\lib\routing.js)
> (`runMesh`, RÉUTILISÉE par les runs et les raccords). Rendu **DÉRIVÉ** (même
> philosophie que le perçage CSG de WallCutter) :
> [RunFittings.jsx](home3d\src\components\RunFittings.jsx) monté dans le Viewer
> (vue ET édition), UN maillage fusionné pour tout le réseau (1 draw call), non
> raycastable, rien dans le store ni les params → re-router, re-sectionner,
> supprimer ou undo/redo un tuyau régénère les raccords, et le rechargement d'un
> GLB les recalcule gratuitement depuis les runs. Tests : `fittings.test.mjs`
> (détection, tolérance, bras) + `runMesh` dans `routing.test.mjs` → **225
> verts** ; `lint`/`build` OK. Vérifié au navigateur sur le modèle démo (réseau
> évac Ø100 + 2 branches Ø40) : té 3 bras + coude détectés et rendus (un mesh de
> 40 sommets/60 tris), undo×2 fait retomber le mesh à 24 puis 0 sommets, redo le
> restaure, aucune erreur console. **Reste Slice 3** : E16-02 (pente évac,
> s'appuyer sur `params.famille`), E16-04 (valve inline).

> **Slice 3 — avancement (2026-07-05, incrément 3 : E16-02 pente d'évacuation).**
> La pente est un **param d'instance** (`params.pente_pct`, % — présent et nul à
> la pose pour les sections `famille === 'evac'`, absent côté cuivre), **NON
> destructif** : les clics (`params.points`) ne bougent jamais, la géométrie
> RENDUE fait descendre chaque sommet de `pente % × longueur horizontale
> cumulée` depuis l'AMONT (1er point tracé — on route de l'amont vers l'aval ;
> les tronçons verticaux n'ajoutent rien).
> [plumbing.js](home3d\src\lib\plumbing.js) : `slopedPoints(params)` + `pentePct`
> (bornée [0, `MAX_PENTE_PCT` = 10]), `pipeLength` devient pente comprise.
> [editRegistry.js](home3d\src\lib\editRegistry.js) : `makeGenerateRun` prend un
> `resolvePoints` (le tuyau passe `slopedPoints`, le câble reste tel quel) ;
> `referencePoints`/`deriveDims` suivent la géométrie pentue (on s'accroche à ce
> qu'on voit). Les raccords E16-03
> ([RunFittings.jsx](home3d\src\components\RunFittings.jsx)) détectent sur les
> points PENTUS → le té suit la descente. Inspector : champ **Pente (%)** (pas
> 0,5) visible seulement sur un run d'évacuation. Tests : `plumbing.test.mjs`
> (+10 → **235 verts**), `lint`/`build` OK. Vérifié au navigateur (modèle démo) :
> évac Ø100 6 m + branche Ø40 en té, pente 2 % → chute 12 cm (bbox 1,55→1,33),
> té recalé sur l'axe pentu (y=1,44), clics intacts (y=1,5), champ Pente visible
> en évac / masqué en cuivre / restauré à l'undo, aucune erreur console.
> **Comportement assumé** : une forte pente (8 % testé) éloigne le corps du
> tuyau d'une branche restée en place au-delà de la tolérance → son té disparaît
> (les raccords suivent la géométrie réelle) ; re-router la branche sur le
> sommet pentu le rétablit. **Reste Slice 3** : E16-04 (valve inline).

**Definition of Done V2** : les 4 slices d'édition démontrables sur un **vrai modèle
SketchUp** (objets **persistés** au ré-export GLB et **ré-éditables** après rechargement),
et le **mode visite** opérationnel (vol libre, puis collisions).

---

*Document généré le 2026-06-12 à partir de `HTD_cahier_des_charges.md`.
Mis à jour le 2026-06-21 : Edit mode V2 (E10 réactivé, epics E12→E16).*
