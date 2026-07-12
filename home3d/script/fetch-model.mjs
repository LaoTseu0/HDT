// Récupère le modèle 3D de démo (maison.glb) depuis les assets d'une release
// GitHub vers public/models/ — les GLB volumineux sont hébergés HORS de
// l'historique git (cf. release `models-v1`) pour ne pas gonfler le dépôt.
//
// Exécuté en postinstall (et via `npm run fetch:model`). Le fichier récupéré est
// gitignoré. Idempotent : si le fichier existe déjà on ne re-télécharge pas
// (forcer avec `--force` ou `FETCH_MODEL_FORCE=1`). En cas d'échec réseau on
// AVERTIT sans faire échouer l'install (le dev peut relancer `npm run
// fetch:model`), sauf `--strict` (utile en CI).

import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE = 'models-v1'
const BASE = `https://github.com/LaoTseu0/3d-home-tour/releases/download/${RELEASE}`

// Modèles à récupérer. `maison.glb` (démo) suffit à lancer l'app ; l'export brut
// `maison_raw.glb` est une archive source, tiré seulement à la demande (--raw).
const MODELS = [
  { file: 'maison.glb', always: true },
  { file: 'maison_raw.glb', always: false },
]

const args = process.argv.slice(2)
const force = args.includes('--force') || process.env.FETCH_MODEL_FORCE === '1'
const strict = args.includes('--strict')
const withRaw = args.includes('--raw')

const modelsDir = fileURLToPath(new URL('../public/models', import.meta.url))
mkdirSync(modelsDir, { recursive: true })

async function fetchModel({ file }) {
  const dest = join(modelsDir, file)
  // Présent et non vide → on garde (le .glb local du dev prime, y compris une
  // version qu'il vient de régénérer et pas encore uploadée).
  if (!force && existsSync(dest) && statSync(dest).size > 0) {
    console.log(`✓ ${file} déjà présent (ignoré)`)
    return
  }
  const url = `${BASE}/${file}`
  const res = await fetch(url) // suit les redirections (CDN GitHub) par défaut
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // Écriture atomique : fichier temporaire puis renommage (pas de .glb tronqué
  // si le téléchargement casse en cours de route).
  const tmp = `${dest}.download`
  writeFileSync(tmp, buf)
  renameSync(tmp, dest)
  console.log(`✓ ${file} (${(buf.length / 1e6).toFixed(1)} Mo) → public/models/`)
}

const wanted = MODELS.filter((m) => m.always || withRaw)
try {
  for (const m of wanted) await fetchModel(m)
} catch (err) {
  const msg = `⚠ Récupération du modèle échouée : ${err.message}\n  Relancez « npm run fetch:model » quand le réseau est disponible.`
  if (strict) {
    console.error(msg)
    process.exit(1)
  }
  console.warn(msg)
  // Sortie 0 : ne pas casser `npm install` (les dépendances sont déjà installées).
}
