import useStore from '../store/useStore.js'

// Ouverture d'un fichier GLB (E3-01/02), partagée entre le drag & drop /
// l'état vide (GLBLoader) et la section More de la barre latérale (E19-05).
export async function openGlbFile(file) {
  if (!file) return
  const { requestLoad, setLoadError } = useStore.getState()
  if (!file.name.toLowerCase().endsWith('.glb')) {
    setLoadError(
      `Fichier non supporté : « ${file.name} » (seuls les .glb sont acceptés).`
    )
    return
  }
  try {
    const buffer = await file.arrayBuffer()
    requestLoad(buffer, file.name)
  } catch (err) {
    setLoadError(`Lecture du fichier impossible : ${err.message ?? err}`)
  }
}

// Modèle de démo servi depuis public/models/ (pratique en dev).
export async function loadDemoModel() {
  const { requestLoad, setLoadError } = useStore.getState()
  const url = `${import.meta.env.BASE_URL}models/maison.glb`
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    requestLoad(await response.arrayBuffer(), 'maison.glb')
  } catch (err) {
    setLoadError(`Modèle de démo introuvable (${url}) : ${err.message ?? err}`)
  }
}
