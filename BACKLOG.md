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
| E18 | PWA : installation mobile & offline | V2 | S ⏸ |
| E19 ✅ | Refonte UX des menus (burger + barre latérale) | V2 | S |
| E20 | Taxonomie à deux niveaux (systèmes → sous-types) | V2 | S |

> Conception détaillée d'Edit mode (E10, E12→E16) et articulation du mode visite (E17) :
> [docs/edit-mode-design.md](docs/edit-mode-design.md).
> ⏸ = en pause (cf. Directives produit).

---

## Directives produit

Décisions de cadrage émises par le PO. Elles s'imposent à tout le backlog et
priment sur la priorisation des tableaux ci-dessous.

| Date | Directive |
|---|---|
| 2026-06-21 | Undo/redo (E10-03) et ré-export GLB (E10-04) explicitement validés (**go**) : E10 est le socle actif de la V2. |
| 2026-06-24 | **IHM** : tout outil d'Edit mode se présente en **barre d'icônes + tooltips au survol**, jamais en gros boutons texte. Règle transverse à tout nouvel outil. |
| 2026-06-24 | **Paradigme SketchUp contextuel** : le plan d'esquisse est déduit du survol (sol/niveau 0 par défaut, face survolée sinon) ; **aucun sélecteur de plan manuel** (le menu XZ/YZ/niveau essayé a été rejeté). |
| 2026-07-06 | **Visite Niveaux 2 & 3 mise de côté** : le développement de **E17-05, E17-06, E17-07, E17-08 et E17-09** est gelé jusqu'à nouvel ordre du PO. |
| 2026-07-07 | **E18 (PWA) mise en pause** : toutes ses stories (E18-01→05) sont gelées. Priorité donnée à **E19** (refonte UX des menus) et **E20** (taxonomie à deux niveaux). |
| 2026-07-07 | **Taxonomie à deux niveaux (E20)** : la catégorie **et** le sous-type d'un objet sont portés par la **nomenclature du nom** (`système__type__…`), **pas** par le Tag SketchUp du groupe. Le sous-type est le segment `type`, désormais issu d'un **vocabulaire contrôlé par système**. |
| 2026-07-07 | **Segment `type` OUVERT (E20)** : le vocabulaire par système est **canonique/suggéré**, pas fermé. Un `type` hors liste est **accepté** (avertissement, jamais rejet) et rangé en « Autres » — pour ne pas perdre les types déjà prévus ni brider la modélisation. |
| 2026-07-07 | **Panneau Info (rectification E19)** : il reste **détaché à droite**, hors barre latérale, et devient **commun** aux objets importés de SketchUp et aux objets créés in-app — l'inspector des objets app s'y affiche, plus sous les icônes du menu d'édition. |

---

## Historique du backlog

> L'évolution du produit et du document en un coup d'œil. Le détail incrément
> par incrément vit dans l'historique git (`git log --follow -- BACKLOG.md`)
> et les PR liées — pas ici.

| Date | Évolution |
|---|---|
| 2026-06-12 | **Création** du backlog depuis `HTD_cahier_des_charges.md`. Sprints S1→S4 livrés dans la foulée : socle (E1), pipeline GLB (E2), chargement + viewer (E3, E4), calques + sélection (E5, E6), store (E7). |
| 2026-06-13 | **V1 terminée** (S5 — finitions UX, KTX2, tests pipeline, overlay perf E8-01). |
| 2026-06-20 | Dimensions auto par node dans le pipeline (E2-10, issue #9). |
| 2026-06-21 | **Cadrage V2** : conception Edit mode (E10 réactivé, E12→E16), ajout du mode visite (E17) et du spike murs ; **go PO** sur undo/redo (E10-03) et ré-export (E10-04). |
| 2026-06-22 | Visite Niveau 1 livrée (vol libre) ; spike « murs solides » 🟢 — CSG et collision validés sur un vrai export non-manifold. |
| 2026-06-23 → 29 | **Slice 0 livrée** en 10 incréments : socle Edit mode, ré-export, plan d'esquisse contextuel, Push/Pull, snapping, VCB, noms auto, cercle, arc (E12, E13, E10-03/04). |
| 2026-06-27 | Plugin SketchUp de nommage livré (E9-01) — E9 complet. |
| 2026-07-01 | **Slice 1 livrée** (ouvertures : vrai trou CSG, fallback mur « sale », gabarits — E14 ph.1) ; **Slice 2 livrée** (élec : composants ponctuels + câble routé, reste E15-04 optionnel). |
| 2026-07-04 | **E14 phase 2 complète** : menuiseries, variantes, portes. |
| 2026-07-04 → 06 | **Slice 3 livrée** (plomberie E16 complet : tuyaux, raccords auto, pente, vannes). |
| 2026-07-06 | Retrait du journal de réalisation détaillé ; ajout des **Directives produit** ; **gel E17-05→09** (directive PO) ; **E17-10 livré** (joysticks tactiles + manette) ; ajout de l'**Epic E18 — PWA**. |
| 2026-07-06 | Le plein écran navigateur ([#23](https://github.com/LaoTseu0/HDT/issues/23)) sort d'E18 → nouvelle story **E17-11** (mode visite). |
| 2026-07-07 | **E18 (PWA) mise en pause** ; ajout de l'**Epic E19** (refonte UX des menus : burger + barre latérale) et de l'**Epic E20** (taxonomie à deux niveaux systèmes → sous-types, portée par la nomenclature du nom). |
| 2026-07-07 | **E20 livré** (E20-01→06) : vocabulaire `SUBTYPES` (source unique `naming.mjs`, miroir Ruby testé anti-dérive), validation ouverte + extras `subtype`/`subtypeLabel` dans le pipeline, sous-type visible/éditable in-app, calques à deux niveaux (visibilité + isolation par sous-type, bucket « Autres »), docs alignées. Le filtrage prendra sa place dans la barre latérale E19-02 lors d'E19. |
| 2026-07-07 | **E19 livré** (E19-01→07) : barre latérale unique (burger, overlay) à sections accordéon Calques/Édition/Vue/Plus ; panneau **Info détaché à droite rendu commun** (inspector des objets app déplacé de l'`EditBar`, rectification PO) ; slider FOV de visite ; plein écran E17-11 ; overlay des raccourcis clavier (touche « ? »). |
| 2026-07-08 | **E17-11 livré** ([#23](https://github.com/LaoTseu0/HDT/issues/23)) : plein écran in-navigateur — hook partagé `useFullscreen`, bouton ⛶ flottant en mode visite + bouton de la section Vue, masqués si l'API est absente (Safari iPhone). |

---

## Epic E1 — Initialisation & socle technique (V1)

**Objectif** : disposer d'un projet Vite + React + R3F fonctionnel, structuré selon l'arborescence cible.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E1-01 ✅ | En tant que dev, je veux initialiser le projet Vite + React afin d'avoir une base de travail. | Projet `home3d/` créé ; `npm run dev` lance l'app ; React fonctionnel. | M | 1 |
| E1-02 ✅ | En tant que dev, je veux installer et configurer R3F, Drei et Zustand afin de disposer du socle 3D et état. | `@react-three/fiber`, `@react-three/drei`, `zustand` installés ; un `<Canvas>` de test affiche un cube. | M | 2 |
| E1-03 ✅ | En tant que dev, je veux mettre en place l'arborescence cible (`components/`, `store/`, `script/`, `public/models/`) afin de respecter la structure du cahier des charges. | Arborescence conforme à la section « Structure du projet » ; `public/models/` ignoré en prod (`.gitignore`). | M | 1 |
| E1-04 ✅ | En tant que dev, je veux un lint/format de base (ESLint + Prettier) afin de garder un code homogène. | `npm run lint` passe ; config commitée. | S | 2 |

> **E1 terminé le 2026-06-12** — projet dans `home3d/`.

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

> **E2 terminé** (S2 le 2026-06-12, KTX2/tests le 2026-06-13) — pipeline complet dans
> `home3d/script/process.mjs` (+ `naming.mjs` testé). Doc : [docs/workflow-sketchup.md](docs/workflow-sketchup.md).

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

> **E3 terminé le 2026-06-12** — `GLBLoader.jsx`, `Model.jsx`, `lib/loadModel.js` ;
> décodeurs Draco/Basis copiés en postinstall (`script/copy-decoders.mjs`, gitignorés).

---

## Epic E4 — Viewer 3D (V1)

**Objectif** : navigation 3D fluide dans le modèle.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E4-01 ✅ | En tant qu'utilisateur, je veux orbiter, zoomer et panner autour de la maison afin de l'inspecter sous tous les angles. | `OrbitControls` (Drei) : orbite clic gauche, pan clic droit/molette pressée, zoom molette ; cible centrée sur le modèle au chargement. | M | 2 |
| E4-02 ✅ | En tant qu'utilisateur, je veux un éclairage et un environnement par défaut corrects afin de distinguer les volumes sans configuration. | Lumière ambiante + directionnelle (ou environnement Drei) ; pas de faces noires ; sol/grille de référence optionnelle. | M | 2 |
| E4-03 ✅ | En tant qu'utilisateur, je veux que la caméra se recadre automatiquement sur le modèle chargé afin de ne jamais « perdre » la maison. | Au chargement : caméra positionnée pour cadrer la bounding box ; bouton/raccourci « recentrer ». | S | 2 |
| E4-04 ✅ | En tant qu'utilisateur, je veux une UI sobre (canvas plein écran, panneaux latéraux) afin de me concentrer sur le modèle. | Canvas plein écran responsive ; panneaux calques/infos superposés ou ancrés ; pas de scroll parasite. | S | 3 |

> **E4 terminé le 2026-06-13** — bouton « Recentrer » + raccourci `R`, responsive ≤ 640 px.

---

## Epic E5 — Système de calques (V1)

**Objectif** : piloter la visibilité et la colorisation par système technique.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E5-01 ✅ | En tant qu'utilisateur, je veux un panneau listant les calques (label + couleur issus des extras scène) afin de voir les systèmes disponibles. | Les 7 calques affichés avec label FR et pastille couleur ; état initial = champ `visible` des extras. | M | 3 |
| E5-02 ✅ | En tant qu'utilisateur, je veux toggler la visibilité d'un calque afin d'isoler un système (ex : voir seulement l'électricité). | Click sur un calque → `group.visible` bascule ; rendu immédiat ; état persisté dans le store. | M | 3 |
| E5-03 ✅ | En tant qu'utilisateur, je veux des actions « tout afficher / tout masquer / isoler ce calque » afin de manipuler les calques rapidement. | Boutons fonctionnels ; « isoler » masque tous les autres calques. | S | 2 |
| E5-04 ✅ | En tant qu'utilisateur, je veux activer une colorisation des objets par calque afin d'identifier visuellement chaque système. | Toggle global « couleurs par calque » : ON = matériau teinté par la couleur du calque, OFF = matériaux d'origine ; réversible sans rechargement. | M | 3 |

> **E5 terminé le 2026-06-12** — `LayerPanel.jsx` + `lib/appearance.js` (réversible sans rechargement).

---

## Epic E6 — Sélection & inspection (V1)

**Objectif** : cliquer sur un objet et consulter ses métadonnées.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E6-01 ✅ | En tant qu'utilisateur, je veux cliquer sur un objet 3D afin de le sélectionner. | Raycasting via events R3F ; l'objet sélectionné est mis en évidence (outline ou émissive) ; click dans le vide désélectionne. | M | 3 |
| E6-02 ✅ | En tant qu'utilisateur, je veux voir les infos de l'objet sélectionné (layer, type, zone, niveau, index, dims, material, notes) afin de consulter ses caractéristiques. | `InfoPanel` affiche les `extras` formatés (labels FR) ; champs vides masqués ou grisés ; nom de node complet visible. | M | 2 |
| E6-03 ✅ | En tant qu'utilisateur, je veux que la sélection respecte la visibilité des calques afin de ne pas sélectionner un objet masqué. | Le raycasting ignore les objets des calques masqués. | M | 1 |
| E6-04 ✅ | En tant qu'utilisateur, je veux un survol (hover) avec mise en évidence légère afin de savoir ce que je vais sélectionner. | Highlight au hover + curseur pointer ; pas de chute de framerate notable. | C | 2 |

> **E6 terminé le 2026-06-13** — sélection + hover dans [Model.jsx](home3d/src/components/Model.jsx) /
> [appearance.js](home3d/src/lib/appearance.js), `InfoPanel.jsx` (labels FR).

---

## Epic E7 — Store & architecture V2-ready (V1)

**Objectif** : structurer l'état pour accueillir l'édition et l'undo/redo en V2 sans refonte.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E7-01 ✅ | En tant que dev, je veux un store Zustand unique conforme au schéma du CdC (`glb`, `metadata`, `layers`, `toggleLayer`, `selectedNode`, `selectNode`) afin de centraliser l'état. | Store implémenté ; composants connectés via sélecteurs (pas de re-render global). | M | 3 |
| E7-02 ✅ | En tant que dev, je veux que les mutations d'état passent par des actions nommées (pré-command-pattern) afin de faciliter l'ajout de `zundo` en V2. | Aucune mutation directe hors actions ; emplacements `history`/`future`/`push`/`undo`/`redo` documentés en commentaire. | S | 2 |
| E7-03 ✅ | En tant que dev, je veux traiter les node names comme identifiants immuables (clé de liaison GLB ↔ extras) afin de garantir la cohérence V2. | Le code référence les objets par node name ; aucune fonctionnalité ne renomme un node. | M | 1 |

> **E7 terminé le 2026-06-12** — actions nommées, sélection référencée par node name (immuable).

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

> **E8-01 livré le 2026-06-13** — overlay `r3f-perf` dev-only, toggle touche `P` ;
> seuil ~200-300 draw calls documenté dans [Viewer.jsx](home3d/src/components/Viewer.jsx).

> **W (hors scope V1/V2)** : occlusion culling — complexe, non natif Three.js.

---

## Epic E9 — Outillage workflow SketchUp (V2)

**Objectif** : fiabiliser le nommage à la source.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E9-01 ✅ | En tant que modeleur, je veux un plugin Ruby SketchUp avec des dropdowns (système, type, zone, niveau) afin de générer les noms de nodes sans faute de frappe. | Plugin `.rb` installable ; le nom généré passe la regex de validation ; index auto-incrémenté. | C | 8 |
| E9-02 ✅ | En tant que modeleur, je veux une checklist/doc du workflow SketchUp (Tags exacts, pièges : Tags cachés non exportés, un seul Tag par objet) afin d'exporter un GLB exploitable du premier coup. | Doc `docs/workflow-sketchup.md` couvrant Tags, nommage, export GLB, exécution du pipeline. | S | 2 |

> **E9 terminé le 2026-06-27** — extension Ruby dans `sketchup-plugin/`, regex alignées
> sur `naming.mjs`, action « Vérifier les noms du modèle ». Install : `sketchup-plugin/README.md`.

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

> ⭐ = explicitement validé par le PO le 2026-06-21 (cf. Directives produit). E10 n'est
> plus « W (V1) » mais le **socle actif de la V2**. Détail : [docs/edit-mode-design.md](docs/edit-mode-design.md) § 5.5–5.6.
> NB : le GLB ré-exporté ressort décompressé (GLTFExporter ne fait pas de Draco) →
> repasser par `script/process.mjs` pour recompresser/valider.

---

## Epic E11 — Modélisation complète in-app (V3 — hors scope)

Non détaillé volontairement. À cadrer après livraison V2.

---

## Epic E12 — Edit mode : moteur d'édition (V2)

**Objectif** : le socle réutilisable du mode édition — plan d'esquisse contextuel,
snapping, modèle paramétrique. Voir [docs/edit-mode-design.md](docs/edit-mode-design.md) § 5.1–5.2.
Directives IHM et « paradigme SketchUp contextuel » : voir **Directives produit**.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E12-01 ✅ | En tant qu'utilisateur, je veux basculer View ↔ Edit avec une palette d'outils et un inspector afin de créer/éditer des objets. | Bascule de mode ; **palette d'outils à icônes + tooltips** (directive IHM) ; panneau propriétés (lecture **et** édition des params de l'objet sélectionné). | M | 5 |
| E12-02 ✅ | En tant qu'utilisateur, je veux que le plan d'esquisse soit **déduit du contexte** (façon SketchUp) afin de créer sans choisir de plan manuellement. | Dessin sur le **sol / niveau 0** par défaut ; sur la **face survolée** quand le curseur est sur un mesh (le plan = cette face) ; **aucun sélecteur de plan manuel** ; feedback visuel discret du plan actif. **Révisé 2026-06-24** : abandon du menu XZ/YZ/niveau au profit du paradigme SketchUp contextuel ; les « points de référence » (arêtes/intersections) relèvent de E12-03. | M | 5 |
| E12-03 | En tant qu'utilisateur, je veux du snapping/inférence afin de placer précisément et confortablement. | Snap sur grille, extrémités/milieux, sommets/arêtes des meshes (accéléré par `three-mesh-bvh`), axes X/Y/Z, parallèle/perpendiculaire ; marqueurs + lignes d'inférence ; pas de chute de framerate. _Livré sauf **parallèle/perpendiculaire**, délibérément reporté : inférence de direction de tracé, sans objet pour le Rectangle ; sa valeur viendra avec un futur outil ligne._ | M | 13 |
| E12-04 ✅ | En tant qu'utilisateur, je veux saisir une cote au clavier pendant un tracé afin d'être exact. | Taper une longueur/rayon fixe la cote ; unités en mètres (façon VCB SketchUp). | S | 3 |
| E12-05 ✅ | En tant que dev, je veux un modèle paramétrique afin que les objets créés soient ré-éditables après rechargement. | `extras.edit { kind, plane, params, variant }` ; registre `kind→générateur` ; géométrie **régénérée au chargement** depuis les params ; `dims` recalculés (cohérent E2-10). | M | 8 |
| E12-06 ✅ | En tant que dev, je veux des node names auto-générés conformes afin de garder le contrat de nommage sans plugin SketchUp. | Nom `système__type__zone__niveau__index` ; index auto-incrémenté par (système, zone, niveau) ; zone choisie dans l'inspector (zone courante par défaut) ; passe la regex de validation. | M | 5 |
| E12-07 | En tant qu'utilisateur, je veux déplacer/tourner/redimensionner un objet par manipulation directe. | `TransformControls` (déplacer/tourner) + poignées de redimensionnement paramétrique ; respecte le snapping et l'undo/redo. Absorbe **E10-01**. | M | 5 |
| E12-08 | En tant qu'utilisateur, je veux donner du volume à une forme 2D avec **Push/Pull** afin de créer un solide sans repasser par SketchUp. | Cliquer une face plane → tirer le long de sa **normale** → extrusion en volume (prisme) ; profondeur calable par **inférence** (E12-03) ou **saisie clavier** (E12-04) ; résultat **paramétrique** (hauteur d'extrusion dans `params`, régénérée au chargement, E12-05) ; undo/redo. _(Ajouté 2026-06-24, directive « façon SketchUp ». Livré sauf la saisie VCB de la profondeur d'extrusion.)_ | M | 5 |

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
| E16-04 ✅ | En tant qu'utilisateur, je veux insérer une valve sur un tuyau. | Objet inline inséré sur un segment, coupe le run en deux. | S | 3 |

> **Comportement assumé (pente E16-02, décision du 2026-07-05)** : une forte pente
> éloigne le corps du tuyau d'une branche restée en place au-delà de la tolérance →
> son té disparaît (les raccords suivent la géométrie réelle) ; re-router la branche
> sur le sommet pentu le rétablit.

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

> **Visite Niveau 1 terminé le 2026-06-21** — [VisitControls.jsx](home3d/src/components/VisitControls.jsx)
> (PointerLockControls, vol libre WASD), bascule toolbar + raccourci `V`,
> [VisitOverlay.jsx](home3d/src/components/VisitOverlay.jsx). Le réglage du FOV
> (E17-04) reste à exposer en réglages (E17-09).

**Niveau 2 — vraie visite (collisions)** — ⏸ **mis de côté** (directive PO du 2026-07-06, cf. Directives produit).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E17-05 ⏸ | En tant qu'utilisateur, je veux ne pas traverser les murs. | Capsule vs *collider* via `three-mesh-bvh` ; collider construit depuis le calque `structure` ; sous-pas anti-tunneling pour murs fins. | M | 8 |
| E17-06 ⏸ | En tant qu'utilisateur, je veux marcher au sol et monter les escaliers. | Gravité + snap au sol + franchissement de marches. | M | 5 |
| E17-07 ⏸ | En tant que dev, je veux (re)construire le collider au chargement du modèle. | Collider rebâti à chaque modèle chargé (drag & drop). | M | 2 |

**Niveau 3 — finitions** — ⏸ E17-08 et E17-09 **mis de côté** (même directive) ; E17-10 et E17-11 livrés (hors gel).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E17-08 ⏸ | En tant qu'utilisateur, je veux placer le point de départ de la visite. | « Placer la caméra » : cliquer un point → départ de la visite. | C | 3 |
| E17-09 ⏸ | En tant qu'utilisateur, je veux régler le confort (vitesse, accroupi, FOV). | Réglages exposés ; pas de *head-bob* par défaut. | C | 2 |
| E17-10 ✅ | En tant qu'utilisateur (mobile), je veux des contrôles tactiles / manette. | Joysticks virtuels / gamepad. | C | 5 |
| E17-11 ✅ | En tant qu'utilisateur (mobile), je veux passer en plein écran pendant la visite afin de masquer la barre du navigateur ([#23](https://github.com/LaoTseu0/HDT/issues/23)). | Bouton ⛶ dans l'UI de visite (l'API exige un geste utilisateur, pas de plein écran forcé au chargement) : `requestFullscreen()` / `exitFullscreen()` ; état du bouton synchronisé via `fullscreenchange` (sortie possible par geste système) ; bouton masqué si l'API est absente (Safari iPhone). | C | 2 |

> **E17-10 livré le 2026-07-06** — joysticks virtuels sur appareil tactile
> ([VisitSticks.jsx](home3d/src/components/VisitSticks.jsx) : stick gauche = se déplacer,
> stick droit = regarder, multi-touch) et manette Gamepad API (sticks gauche/droit,
> sondée chaque frame). Maths des axes (zone morte, clamp) dans
> [visitInput.js](home3d/src/lib/visitInput.js) (testé). Vol libre N1 inchangé ; sans API
> Pointer Lock (mobile), le verrou souris et son invite sont simplement absents.

> **E17-11 livré le 2026-07-08** — plein écran in-navigateur. Hook partagé
> [useFullscreen.js](home3d/src/lib/useFullscreen.js) (`requestFullscreen`/`exitFullscreen`,
> état suivi via `fullscreenchange`, `supported` = API d'élément HTML présente).
> Bouton ⛶ flottant en mode visite ([VisitFullscreen.jsx](home3d/src/components/VisitFullscreen.jsx),
> coin haut-droit) **et** bouton de la section Vue ([ViewSection.jsx](home3d/src/components/ViewSection.jsx)),
> tous deux masqués si l'API est absente (Safari iPhone). Complète, sans le
> remplacer, le `display: standalone` de la PWA (E18) pour l'usage **sans**
> installation.

---

## Epic E18 — PWA : installation mobile & offline (V2 — Viewer) — ⏸ EN PAUSE

> ⏸ **En pause depuis le 2026-07-07** (directive PO) : toutes les stories
> E18-01→05 sont gelées le temps de traiter E19 (UX menus) et E20 (taxonomie).
> Rien n'est abandonné — l'épic reste prêt à reprendre tel quel.

**Objectif** : transformer l'app en PWA installable — ouverture depuis l'écran
d'accueil **sans barre d'URL**, chargement instantané après la première visite
grâce au cache du GLB (~29 Mo), app shell disponible hors ligne. Outillage
standard : `vite-plugin-pwa` (Workbox) + `@vite-pwa/assets-generator`.
Le plein écran **in-navigateur** (usage sans installation) est traité à part :
**E17-11** (mode visite).

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E18-01 | En tant qu'utilisateur mobile, je veux installer l'app sur mon écran d'accueil afin de l'ouvrir en plein écran, sans barre d'URL. | `vite-plugin-pwa` configuré ; manifest généré (pas de `manifest.json` à la main) : `name`, `short_name` (≤ 12 car.), `description`, `lang: fr`, `id`, `start_url`, `scope`, `theme_color`/`background_color` assortis au fond de l'app ; `display: standalone` + `display_override: ['fullscreen']` ; **pas** d'`orientation` figée (visite en paysage, édition en portrait possibles). | S | 3 |
| E18-02 | En tant qu'utilisateur, je veux une icône d'app propre sur Android et iOS. | Icônes générées depuis `favicon.svg` via `@vite-pwa/assets-generator` : PNG 192 et 512 px + variante 512 px `purpose: maskable` (logo dans la zone de sécurité de 80 %, vérifié sur maskable.app) ; `apple-touch-icon` 180 px dans `index.html` (iOS ignore les icônes du manifest) ; metas ajoutées : `theme-color`, `description`, `mobile-web-app-capable`, status bar iOS. | S | 2 |
| E18-03 | En tant qu'utilisateur, je veux que l'app s'ouvre instantanément (même hors ligne) après la première visite. | Service worker Workbox (`generateSW`, pas de SW à la main) ; précache limité à l'**app shell** (JS/CSS/HTML/favicon) ; ⚠️ **jamais** les `models/*.glb` (29 Mo > limite Workbox de 2 Mo, et re-téléchargement à chaque mise à jour sinon) : `runtimeCaching` **CacheFirst** sur les GLB (`maxEntries: 2`) et sur les décodeurs `draco/`/`basis/` ; `navigateFallback: index.html` (SPA) ; `registerType: 'autoUpdate'` (le toast « nouvelle version ? » type `prompt` est reporté). | S | 5 |
| E18-04 | En tant que dev, je veux que les mises à jour de l'app arrivent de façon fiable en prod. | `sw.js` servi avec `Cache-Control: no-cache` (à vérifier sur Vercel ; sinon règle `headers` dans `vercel.json`) ; test grandeur nature : déployer une modif et vérifier qu'elle arrive (piège du SW qui sert l'ancienne version pour toujours) ; `dev-dist/` gitignoré. | S | 2 |
| E18-05 | En tant qu'utilisateur, je veux une PWA conforme, vérifiée sur appareil réel. | Audit Lighthouse (installabilité) vert sur le build (`npm run build && npm run preview`) ; sur Chrome Android réel : invite « Ajouter à l'écran d'accueil », app installée ouverte **sans barre d'URL** ; DevTools → Offline : app shell chargée + modèle disponible s'il a déjà été visité. | S | 2 |

> **Estimation : 14 pts ≈ 2,5 à 3 jours-homme** (dev solo) — E18-01 ~0,5 j ;
> E18-02 ~0,25 j ; E18-03 ~1 j (le gros morceau : stratégie de cache du GLB) ;
> E18-04 ~0,5 j ; E18-05 ~0,5 j (vérifications sur appareil réel comprises).
> NB : ne remplace pas le bouton plein écran in-navigateur **E17-11**
> ([#23](https://github.com/LaoTseu0/HDT/issues/23)), utile pour l'usage **sans**
> installation ; dépend du correctif verrou souris mobile
> [#22](https://github.com/LaoTseu0/HDT/issues/22) pour une visite mobile utilisable.

---

## Epic E19 — Refonte UX des menus (burger + barre latérale) (V2 — UI)

**Objectif** : remplacer les panneaux flottants dispersés (calques, barre
d'édition, VCB…) par **une seule barre latérale** ouverte depuis un **bouton
burger**, organisée en sections **Calques · Edit · Vue · More**. Objectifs :
lisibilité, place à l'écran (surtout mobile, cf. E17-10), et un point d'entrée
unique pour toutes les commandes. Reprend la directive IHM du 2026-06-24
(icônes + tooltips) pour la palette d'outils.

> **Rectification PO (2026-07-07)** : le panneau **Info** ne migre PAS dans la
> barre latérale — il reste **détaché à droite**, tel quel. Il devient en
> revanche **commun** : les objets créés in-app y affichent leur inspector
> (aujourd'hui logé sous les icônes de l'`EditBar`), au même endroit que les
> infos des objets importés de SketchUp.

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E19-01 ✅ | En tant qu'utilisateur, je veux un bouton burger qui ouvre/ferme une barre latérale afin d'accéder à tous les menus depuis un point unique. | Bouton burger ancré (coin) ; barre latérale coulissante (ouverture/fermeture animée) ; état d'ouverture dans le store ; ne masque pas le canvas sur desktop (push ou overlay tranché) ; ÉCHAP / clic hors panneau ferme. | S | 3 |
| E19-02 ✅ | En tant qu'utilisateur, je veux la section **Calques** dans la barre afin de piloter la visibilité comme aujourd'hui. | `LayerPanel` migré en section ; parité fonctionnelle (toggle, tout/rien, isoler, couleurs par calque) ; prêt à accueillir le filtrage à deux niveaux d'E20. | S | 3 |
| E19-03 ✅ | En tant qu'utilisateur, je veux la section **Edit** dans la barre afin de créer/éditer sans barre d'outils séparée. | Palette d'outils (icônes + tooltips, directive IHM), undo/redo et export regroupés dans la section ; l'**inspector de l'objet sélectionné part dans le panneau Info détaché** (rectification PO : panneau commun objets SketchUp + objets app) ; VCB conservé ; parité avec l'`EditBar` actuelle. | S | 5 |
| E19-04 ✅ | En tant qu'utilisateur, je veux la section **Vue** afin de régler la navigation et l'affichage. | Regroupe : bascule Orbite/Visite, recentrer, FOV de visite (expose E17-04/09 gelé — au moins le FOV), overlay perf (dev), et le plein écran **E17-11**. | S | 3 |
| E19-05 ✅ | En tant qu'utilisateur, je veux une section **More** afin de retrouver les actions secondaires. | Ouvrir/charger un modèle, infos du modèle (métadonnées scène), à-propos/version ; extensible. | S | 2 |
| E19-06 ✅ | En tant qu'utilisateur mobile, je veux que la barre latérale cohabite avec la visite tactile. | En visite sur tactile, la barre n'entre pas en conflit avec les joysticks (E17-10) ; en portrait, drawer pleine largeur ; pas de scroll parasite. | S | 3 |
| E19-07 ✅ | En tant qu'utilisateur, je veux un overlay listant tous les raccourcis clavier de l'app afin de les découvrir sans documentation. | Overlay modal ouvert par la touche « ? » et depuis la barre latérale ; liste complète et à jour (globaux, édition/VCB, visite) ; ÉCHAP / clic hors panneau / ✕ ferme. | S | 2 |

> **Estimation : 21 pts ≈ 3 à 4 jours-homme** (dev solo). Chantier surtout de
> **réagencement** (les panneaux existants sont déjà fonctionnels) : le risque est
> la parité (ne rien perdre en migrant) plus que la nouveauté. E19-02 est le point
> de contact avec **E20** (le filtrage à deux niveaux des calques y prendra place).

---

## Epic E20 — Taxonomie à deux niveaux (systèmes → sous-types) (V2 — transverse)

**Objectif** : passer d'une taxonomie **à un niveau** (7 systèmes) à **deux
niveaux** (système → sous-type), pour classer, filtrer et colorer plus finement.
**Décision d'architecture (2026-07-07)** : catégorie **et** sous-type sont portés
par la **nomenclature du nom** (`système__type__…`), **pas** par le Tag SketchUp.
Le sous-type **est le segment `type`**, qui existe déjà mais en free-form : E20 le
fait passer à un **vocabulaire contrôlé par système**. Chantier **transverse**
(pipeline, app, tests, plugin Ruby, docs).

**Pourquoi le nom et pas le Tag** : l'app dérive déjà le calque du **nom**
([loadModel.js](home3d/src/lib/loadModel.js) lit `extras.layer`, injecté par le
pipeline depuis `parseNodeName`) ; les Tags SketchUp ne survivent pas de façon
fiable à l'export glTF (a fortiori des Tags imbriqués). Le segment `type` est donc
le bon support — zéro changement de schéma, on **contraint un segment existant**.

Vocabulaire cible (labels FR ; le **segment** stocké est normalisé sans accent —
même distinction label/segment que pour les systèmes, ex. `elec` → « Électricité ») :

| Système (niveau 1) | Sous-types (niveau 2) |
|---|---|
| Structure | Murs · Cloisons · Planchers · Toitures · Escaliers · Poutres |
| Ouvertures | Fenêtres · Portes · Volets · Baies vitrées |
| Électricité | Câblage · Prises · Interrupteurs · Éclairage |
| Plomberie | Canalisations · Robinetterie · Éviers · Toilettes |
| VMC/Chauffage | VMC · Radiateurs · Chaudière · Thermostat |
| Réseaux | Internet · Téléphone · TV · Sécurité |
| Terrain | Potager · Arche · Serre · Allée · Clôture · Garage |

| ID | User story | Critères d'acceptation | Prio | Pts |
|---|---|---|---|---|
| E20-01 ✅ | En tant que dev, je veux LA source unique de la taxonomie à deux niveaux afin qu'app, pipeline, Ruby et docs en héritent. | `SUBTYPES` dans [naming.mjs](home3d/script/naming.mjs) : par système, liste `{ value, label }` (value normalisée) ; typos corrigées (Structures, Réseaux) ; segment `type` **ouvert** (décision 2026-07-07, cf. note) → ces listes sont le vocabulaire **canonique/suggéré**, complétées des types déjà prévus non listés (`dalle`, `fondation`, `poteau`, `tableau`, `gaine`, `velux`, `porte_garage`…). | S | 3 |
| E20-02 ✅ | En tant qu'utilisateur du pipeline, je veux que le sous-type soit validé et enrichi afin d'avoir un classement fiable. | `process.mjs`/`naming.mjs` : `type` validé contre `SUBTYPES` du système (selon E20-01) ; `extras` porte `subtype` + son label ; rapport d'erreur ciblé ; tests `naming.test.mjs` / `naming-app.test.mjs` mis à jour. | S | 5 |
| E20-03 ✅ | En tant qu'utilisateur, je veux voir et éditer le sous-type in-app. | `InfoPanel` affiche le label du sous-type ; `editRegistry` (`kindNaming`) et la génération de nom ([naming.js](home3d/src/lib/naming.js)) alignés sur le vocabulaire ; sélection du sous-type dans l'inspector d'édition. | S | 3 |
| E20-04 ✅ | En tant qu'utilisateur, je veux filtrer/afficher les calques à deux niveaux. | Section **Calques** (E19-02) : arborescence système → sous-type ; visibilité et (option) couleur par sous-type ; « isoler » applicable à un sous-type. | S | 5 |
| E20-05 ✅ | En tant que modeleur, je veux que le plugin SketchUp propose le vocabulaire par système. | [main.rb](sketchup-plugin/home_designer_namer/main.rb) : `TYPES_BY_SYSTEM` aligné sur `SUBTYPES` (miroir de naming.mjs) ; dropdown filtré par système ; comportement ouvert/fermé cohérent avec E20-01. | S | 2 |
| E20-06 ✅ | En tant que dev, je veux la doc alignée sur la taxonomie à deux niveaux. | `HTD_cahier_des_charges.md` (nomenclature), [docs/workflow-sketchup.md](docs/workflow-sketchup.md), [docs/edit-mode-design.md](docs/edit-mode-design.md) mis à jour ; table de correspondance système → sous-types. | S | 2 |

> **Estimation : 20 pts ≈ 4 à 5 jours-homme** (dev solo) — le « gros travail »
> attendu, mais **contenu** par la décision « nom, pas Tag » : on enrichit un
> segment existant, pas de refonte de schéma ni de migration des données.
>
> **Décision (2026-07-07) — vocabulaire `type` OUVERT.** Le segment reste libre
> (`[a-z0-9_]+`) ; les listes ci-dessus sont le vocabulaire **canonique/suggéré**
> (dropdowns + « autre… »), pas une contrainte fermée. Motif : un enum fermé
> ferait **perdre** des types déjà prévus (`dalle`, `fondation`, `poteau`,
> `tableau`, `gaine`, `velux`, `porte_garage`…) et interdirait d'en ajouter en
> modélisant. Conséquences pour E20-02/04/05 : la validation **avertit** (ne
> rejette pas) un `type` hors vocabulaire ; l'UI le range dans un bucket
> « Autres » du système ; le vocabulaire canonique intègre les types manquants.
>
> **Chevauchements à arbitrer en E20-01** : « Garage » est à la fois un sous-type
> Terrain **et** une zone (`BASE_ZONES`) ; « Sécurité » (Réseaux) recoupe l'alarme ;
> conserver les types fins existants (`mur_porteur`/`mur_cloison` sous « Murs ») —
> le vocabulaire ouvert le permet sans arbitrage bloquant.

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

| Étape | Contenu | Epics | Statut |
|---|---|---|---|
| **Visite — Niveau 1** | Vue 1re personne en **vol libre** (avant l'édit) → tester la navigation tôt. | E17 ph.1 | ✅ 2026-06-21 |
| **Spike — murs « solides » ?** | Valider qu'un **vrai export SketchUp** donne des murs exploitables. Dérisque **à la fois** le booléen (Slice 1) et la collision de visite (E17 N2). **Résultat 🟢 : collision OK + CSG fenêtre fiable (8/8) même sur un bloc non-manifold** → workflow « un seul bloc » tenable ; garder weld + fallback E14-03. Détail : [docs/edit-mode-design.md](docs/edit-mode-design.md) § 6.2. | — | ✅ 2026-06-22 |
| **Slice 0 — Socle + formes** | Mode édition, plans de travail, snapping, rectangle/cercle/arc, inspector, undo/redo, ré-export. **Aucun booléen.** | E12, E13, E10-03/04 | ✅ 2026-06-29 |
| **Slice 1 — Ouvertures** | Ouverture paramétrique → **vrai vide dans le mur (CSG)**. | E14 ph.1 | ✅ 2026-07-01 |
| **Slice 2 — Électricité** | Prise / interrupteur / boîte / compteur + câble routé (section rectangulaire). | E15 | ✅ 2026-07-01 (reste E15-04, optionnel) |
| **E14 ph.2 — Menuiseries** | Cadre + vitrage, variantes, portes (composants posés, **pas de booléen**). | E14 ph.2 | ✅ 2026-07-04 |
| **Slice 3 — Plomberie** | Tuyaux cuivre/PVC/évac (réemploi du routage), pente, coudes/raccords auto, valves. | E16 | ✅ 2026-07-06 |
| **Visite — Niveaux 2 & 3** | **Collisions + gravité** (marche, escaliers) puis finitions. | E17 ph.2/3 | ⏸ mis de côté (directive PO 2026-07-06) |

> **Menuiserie des fenêtres (E14 phase 2)** : posée **après la Slice 2**, car le cadre est
> un composant posé (catégorie ①) qui réutilise la pose de composants de l'électricité.
> La Slice 1 ne livre que le **vide** dans le mur.

> Le journal de bord détaillé de la réalisation V2 (avancement incrément par incrément
> des Slices 0→3) a été retiré du backlog le 2026-07-06. Il reste consultable dans
> l'historique git : `git log --follow -- BACKLOG.md` (commits `docs(backlog)`) et les
> PR [#17](https://github.com/LaoTseu0/HDT/pull/17) → [#20](https://github.com/LaoTseu0/HDT/pull/20).

**Definition of Done V2** : les 4 slices d'édition démontrables sur un **vrai modèle
SketchUp** (objets **persistés** au ré-export GLB et **ré-éditables** après rechargement),
et le **mode visite** opérationnel (vol libre, puis collisions).

---

*Les mises à jour de ce document sont tracées dans la section
[Historique du backlog](#historique-du-backlog), en tête de fichier.*
