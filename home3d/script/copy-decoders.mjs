// Copie les décodeurs Draco et le transcodeur Basis (KTX2) depuis le
// package `three` vers public/ afin de les servir localement (E3-06) —
// aucune dépendance CDN au runtime. Exécuté en postinstall ; les fichiers
// copiés sont gitignorés et régénérés à chaque `npm install`.

import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
// `three` n'exporte pas ./package.json : on remonte depuis son entrée
// principale (node_modules/three/build/three.cjs → node_modules/three).
const threeRoot = dirname(dirname(require.resolve('three')))
const publicDir = fileURLToPath(new URL('../public', import.meta.url))

// Seuls les fichiers nécessaires au décodage runtime (pas l'encodeur Draco).
const COPIES = [
  {
    from: join(threeRoot, 'examples/jsm/libs/draco/gltf'),
    to: join(publicDir, 'draco'),
    files: ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'],
  },
  {
    from: join(threeRoot, 'examples/jsm/libs/basis'),
    to: join(publicDir, 'basis'),
    files: ['basis_transcoder.js', 'basis_transcoder.wasm'],
  },
]

for (const { from, to, files } of COPIES) {
  mkdirSync(to, { recursive: true })
  for (const file of files) copyFileSync(join(from, file), join(to, file))
  console.log(`✓ ${files.length} fichier(s) → ${to}`)
}
