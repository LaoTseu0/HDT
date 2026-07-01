import { useEffect, useMemo } from 'react'
import useStore from '../store/useStore.js'
import {
  openingCutBox,
  cutWallGeometry,
  isCutDegenerate,
  markPristine,
  applyCut,
  restoreAll,
} from '../lib/csg.js'

// Perçage CSG des murs par les ouvertures (E14-02, cf. docs/edit-mode-design § 5.4).
// Vit dans le Canvas, actif en vue COMME en édition (le trou fait partie du
// modèle). Réagit aux ouvertures (`objects` filtré `opening.window`) + au modèle :
// à chaque changement de leurs cotes / position, on RESTAURE tous les murs à leur
// géométrie d'origine puis on RECALCULE la découpe depuis cette origine (agrandir /
// rétrécir / déplacer repartent du mur plein, cf. lib/csg). Aucun rendu propre —
// le composant ne fait que muter la géométrie des meshes du modèle en place.

export default function WallCutter() {
  const glb = useStore((state) => state.glb)
  const objects = useStore((state) => state.objects)
  const setCsgFallbackIds = useStore((state) => state.setCsgFallbackIds)

  // Ouvertures groupées par mur référencé (plane.faceOf).
  const openingsByWall = useMemo(() => {
    const map = new Map()
    for (const obj of Object.values(objects)) {
      if (obj.kind !== 'opening.window') continue
      const wall = obj.plane?.faceOf
      if (!wall) continue // mur non référencé → pas de découpe (E14-01)
      if (!map.has(wall)) map.set(wall, [])
      map.get(wall).push(obj)
    }
    return map
  }, [objects])

  // Signature de recalcul : ne recouper que si une cote / position d'ouverture
  // change (pas à chaque mutation d'état éphémère).
  const signature = useMemo(
    () =>
      JSON.stringify(
        [...openingsByWall].map(([wall, ops]) => [
          wall,
          ops.map((o) => [o.id, o.params.largeur_m, o.params.hauteur_m, o.plane.origin]),
        ])
      ),
    [openingsByWall]
  )

  useEffect(() => {
    const scene = glb?.scene
    if (!scene) return
    restoreAll() // repartir du mur plein pour tous les murs déjà percés

    const fallback = []
    for (const [wallName, ops] of openingsByWall) {
      const node = scene.getObjectByName(wallName)
      if (!node) continue // mur absent au rechargement → dégradation propre
      const boxes = ops.map(openingCutBox)
      node.traverse((mesh) => {
        if (!mesh.isMesh) return
        const orig = markPristine(mesh)
        mesh.updateWorldMatrix(true, false)
        try {
          const result = cutWallGeometry(orig, mesh.matrixWorld, boxes)
          if (isCutDegenerate(orig, result)) {
            result.dispose()
            for (const o of ops) fallback.push(o.id) // E14-03 : pose en surface
          } else {
            applyCut(mesh, result)
          }
        } catch {
          for (const o of ops) fallback.push(o.id)
        }
      })
      for (const b of boxes) b.dispose()
    }
    setCsgFallbackIds([...new Set(fallback)])

    return () => restoreAll()
  }, [glb, signature, setCsgFallbackIds, openingsByWall])

  return null
}
