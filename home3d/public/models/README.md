# Modèles 3D

Les modèles `.glb` volumineux (~30 Mo pièce) sont **hébergés hors de l'historique
git**, sur une [release GitHub](https://github.com/LaoTseu0/3d-home-tour/releases/tag/models-v1)
(tag `models-v1`), pour ne pas gonfler le dépôt (git ne sait pas compresser en
delta des binaires compressés → chaque révision ajouterait le fichier entier et
définitivement à l'historique).

| Fichier | Rôle | Récupéré par défaut |
|---|---|---|
| `maison.glb` | Modèle de démo chargé par l'app | ✅ oui |
| `maison_raw.glb` | Export SketchUp brut (bloc unique) — archive source | non (`--raw`) |

## Récupération

```bash
npm run fetch:model          # maison.glb (lancé aussi en postinstall)
npm run fetch:model -- --raw # + maison_raw.glb
npm run fetch:model -- --force  # re-télécharge même si présent
```

Le script ([`script/fetch-model.mjs`](../../script/fetch-model.mjs)) est
idempotent : il ignore un fichier déjà présent (un `.glb` régénéré localement
n'est jamais écrasé) et n'échoue pas l'install en cas de coupure réseau.

## Mettre à jour un modèle

Régénérer le `.glb`, puis remplacer l'asset de la release :

```bash
gh release upload models-v1 maison.glb --clobber
```

Le fichier local dans `public/models/` reste ignoré par git (voir
`home3d/.gitignore`).

> Le dossier `old/` contient de petites versions d'archive et reste, lui,
> versionné dans git.
