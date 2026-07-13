import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import useStore from '../store/useStore.js'
import { touchInput, gamepadInput, clampStick } from '@/features/visit/visitInput'

// E17 — Mode visite, Niveau 1 (« vol libre »).
// On regarde à la souris (PointerLockControls) à hauteur d'œil et on se
// déplace au clavier (WASD / flèches), SANS gravité ni collision : on
// traverse les murs, c'est le banc d'essai de navigation avant l'édition.
// Les collisions (Niveau 2, E17-05→07) viendront après les slices d'édition.
// E17-10 : mêmes déplacements en analogique — joysticks virtuels (tactile,
// cf. VisitSticks) et manette (Gamepad API) ; le stick droit pilote le regard.

const EYE_HEIGHT = 1.6 // m — hauteur d'œil (E17-02/04)
const MOVE_SPEED = 3.2 // m/s — allure de marche réaliste (E17-03)
const LOOK_SPEED = 2.4 // rad/s à pleine course du stick droit (E17-10)
const MAX_PITCH = Math.PI / 2 - 0.05 // même butée verticale que le verrou souris

// Pas de verrou souris sur un appareil sans l'API Pointer Lock (mobiles/
// tablettes) : le regard y passe par le stick droit tactile.
const HAS_POINTER_LOCK =
  typeof document !== 'undefined' && 'requestPointerLock' in document.documentElement

export default function VisitControls() {
  const camera = useThree((state) => state.camera)
  const glb = useStore((state) => state.glb)
  const setPointerLocked = useStore((state) => state.setPointerLocked)
  // FOV de visite réglable (section Vue, E19-04) — champ plus large qu'en
  // orbite en vue subjective (E17-02), 70° par défaut.
  const visitFov = useStore((state) => state.visitFov)

  // État clavier (refs : pas de re-render, lu dans la boucle de rendu).
  const keys = useRef({ forward: false, back: false, left: false, right: false })
  // Vecteurs réutilisés d'une frame à l'autre (pas d'alloc par frame).
  const forwardV = useRef(new THREE.Vector3())
  const rightV = useRef(new THREE.Vector3())
  const moveV = useRef(new THREE.Vector3())
  // Euler YXZ (yaw puis pitch, roll nul) : même décomposition que le verrou
  // souris → le regard stick et le regard souris se cumulent sans gîte.
  const eulerV = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  // FOV d'orbite restauré en quittant le mode visite (capturé au montage,
  // AVANT que l'effet suivant applique le FOV de visite).
  useEffect(() => {
    const prevFov = camera.fov
    return () => {
      camera.fov = prevFov
      camera.updateProjectionMatrix()
    }
  }, [camera])

  // FOV de visite, ré-appliqué en direct quand le réglage change (E19-04).
  useEffect(() => {
    // On mute la caméra vivante du Canvas (pattern three.js/R3F standard) ;
    // l'affectation de propriété déclenche la règle d'immutabilité, ici voulue.
    // eslint-disable-next-line react-hooks/immutability
    camera.fov = visitFov
    camera.updateProjectionMatrix()
  }, [camera, visitFov])

  // E17-04 : entrée à hauteur d'œil au centre du modèle, regard à
  // l'horizontale.
  useEffect(() => {
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
  // Clavier (tout-ou-rien) + sticks tactiles/manette (analogiques) cumulés,
  // bornés au cercle unité → la diagonale clavier ne va pas plus vite, les
  // demi-courses de stick marchent plus lentement.
  useFrame((_, delta) => {
    // delta borné : pas de bond géant après un freeze d'onglet.
    const dt = Math.min(delta, 0.1)
    // Manette : à sonder CHAQUE frame (Chrome fige les axes entre deux appels).
    const pad = navigator.getGamepads ? gamepadInput(navigator.getGamepads()) : null

    // E17-10 : regard au stick droit (yaw autour de Y monde, pitch borné).
    const lookX = touchInput.look.x + (pad ? pad.look.x : 0)
    const lookY = touchInput.look.y + (pad ? pad.look.y : 0)
    if (lookX || lookY) {
      const e = eulerV.current.setFromQuaternion(camera.quaternion)
      e.y -= lookX * LOOK_SPEED * dt // stick à droite = tourner à droite
      e.x = THREE.MathUtils.clamp(e.x + lookY * LOOK_SPEED * dt, -MAX_PITCH, MAX_PITCH)
      camera.quaternion.setFromEuler(e)
    }

    const k = keys.current
    const input = clampStick(
      (k.right ? 1 : 0) - (k.left ? 1 : 0) + touchInput.move.x + (pad ? pad.move.x : 0),
      (k.forward ? 1 : 0) - (k.back ? 1 : 0) + touchInput.move.y + (pad ? pad.move.y : 0)
    )
    if (!input.x && !input.y) return

    camera.getWorldDirection(forwardV.current).normalize()
    rightV.current.crossVectors(forwardV.current, camera.up).normalize()
    const move = moveV.current
      .set(0, 0, 0)
      .addScaledVector(forwardV.current, input.y)
      .addScaledVector(rightV.current, input.x)
    camera.position.add(move.multiplyScalar(MOVE_SPEED * dt))
  })

  if (!HAS_POINTER_LOCK) return null
  return (
    <PointerLockControls
      onLock={() => setPointerLocked(true)}
      onUnlock={() => setPointerLocked(false)}
    />
  )
}
