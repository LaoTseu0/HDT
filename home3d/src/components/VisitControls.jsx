import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import useStore from '../store/useStore.js'

// E17 — Mode visite, Niveau 1 (« vol libre »).
// On regarde à la souris (PointerLockControls) à hauteur d'œil et on se
// déplace au clavier (WASD / flèches), SANS gravité ni collision : on
// traverse les murs, c'est le banc d'essai de navigation avant l'édition.
// Les collisions (Niveau 2, E17-05→07) viendront après les slices d'édition.

const EYE_HEIGHT = 1.6 // m — hauteur d'œil (E17-02/04)
const VISIT_FOV = 70 // ° — champ de vision plus large en vue subjective (E17-02)
const MOVE_SPEED = 3.2 // m/s — allure de marche réaliste (E17-03)

export default function VisitControls() {
  const camera = useThree((state) => state.camera)
  const glb = useStore((state) => state.glb)
  const setPointerLocked = useStore((state) => state.setPointerLocked)

  // État clavier (refs : pas de re-render, lu dans la boucle de rendu).
  const keys = useRef({ forward: false, back: false, left: false, right: false })
  // Vecteurs réutilisés d'une frame à l'autre (pas d'alloc par frame).
  const forwardV = useRef(new THREE.Vector3())
  const rightV = useRef(new THREE.Vector3())
  const moveV = useRef(new THREE.Vector3())

  // E17-04 : entrée à hauteur d'œil au centre du modèle, regard à
  // l'horizontale. + FOV de visite, restauré en quittant le mode.
  useEffect(() => {
    const prevFov = camera.fov
    // On mute la caméra vivante du Canvas (pattern three.js/R3F standard) ;
    // l'affectation de propriété déclenche la règle d'immutabilité, ici voulue.
    // eslint-disable-next-line react-hooks/immutability
    camera.fov = VISIT_FOV

    const start = new THREE.Vector3(0, EYE_HEIGHT, 0)
    if (glb) {
      const box = new THREE.Box3().setFromObject(glb.scene)
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3())
        start.set(center.x, box.min.y + EYE_HEIGHT, center.z)
      }
    }
    camera.position.copy(start)
    camera.lookAt(start.x, start.y, start.z - 1) // regard horizontal vers -Z
    camera.updateProjectionMatrix()

    return () => {
      camera.fov = prevFov
      camera.updateProjectionMatrix()
    }
  }, [camera, glb])

  // E17-03 : déplacement clavier. WASD + flèches, pris en compte tant que
  // le mode visite est monté (le verrou souris filtre l'usage réel).
  useEffect(() => {
    const setKey = (event, value) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = value
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.back = value
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = value
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = value
          break
        default:
          return
      }
      event.preventDefault()
    }
    const onKeyDown = (event) => setKey(event, true)
    const onKeyUp = (event) => setKey(event, false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keys.current = { forward: false, back: false, left: false, right: false }
    }
  }, [])

  // Boucle de déplacement. Vol libre : on suit la direction complète du
  // regard (regarder vers le haut + avancer = monter), sans gravité.
  useFrame((_, delta) => {
    const k = keys.current
    if (!(k.forward || k.back || k.left || k.right)) return

    camera.getWorldDirection(forwardV.current).normalize()
    rightV.current.crossVectors(forwardV.current, camera.up).normalize()

    const move = moveV.current.set(0, 0, 0)
    if (k.forward) move.add(forwardV.current)
    if (k.back) move.addScaledVector(forwardV.current, -1)
    if (k.right) move.add(rightV.current)
    if (k.left) move.addScaledVector(rightV.current, -1)
    if (move.lengthSq() === 0) return

    // delta borné : pas de bond géant après un freeze d'onglet.
    move.normalize().multiplyScalar(MOVE_SPEED * Math.min(delta, 0.1))
    camera.position.add(move)
  })

  return (
    <PointerLockControls
      onLock={() => setPointerLocked(true)}
      onUnlock={() => setPointerLocked(false)}
    />
  )
}
