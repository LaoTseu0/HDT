import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import Model from './Model.jsx'
import VisitControls from './VisitControls.jsx'
import EditObjects from './EditObjects.jsx'
import WallCutter from './WallCutter.jsx'
import RunFittings from './RunFittings.jsx'
import useStore from '../store/useStore.js'

// E8-01 : overlay perf (draw calls, fps, mémoire GPU), dev uniquement,
// toggle touche P. Chargé à la demande : `import.meta.env.DEV` étant
// constant au build, r3f-perf est exclu du bundle de production.
// Seuil d'alerte : au-delà de ~200-300 draw calls sur hardware moyen,
// activer les optimisations E8-02+ (instancing, merge par calque).
const Perf = import.meta.env.DEV
  ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
  : null

// E21-01 : navigation caméra sous Ctrl (PC). Sans Ctrl, clic gauche/droit
// sont inertes (action -1 → STATE.NONE) ; Ctrl enfoncé, gauche = orbite et
// droit = pan. On bascule `mouseButtons` (prop d'OrbitControls) — PAS
// `enabled`, qui tuerait aussi le zoom molette et le tactile (`touches`
// reste au défaut : 1 doigt orbite, 2 doigts pan/pinch).
// E21-03 : curseur grab (Ctrl enfoncé) / grabbing (bouton pressé en plus).
// Renvoie l'état Ctrl + bouton souris, suivi par écouteurs globaux ; reset
// sur blur, sans quoi Ctrl+Tab / Alt+Tab laisserait un Ctrl « collé » (le
// keyup part vers l'autre fenêtre).
function useCtrlNav() {
  const [ctrlDown, setCtrlDown] = useState(false)
  const [buttonDown, setButtonDown] = useState(false)
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Control') setCtrlDown(event.type === 'keydown')
    }
    const onBlur = () => setCtrlDown(false)
    const onPointer = (event) => setButtonDown(event.type === 'pointerdown')
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('pointerup', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('pointerup', onPointer)
    }
  }, [])
  return { ctrlDown, buttonDown }
}

// ATTENTION : OrbitControls (three-stdlib) échange ROTATE↔PAN quand
// Ctrl/Meta/Shift est pressé au mousedown — on assigne donc LEFT=PAN /
// RIGHT=ROTATE pour obtenir gauche=orbite / droit=pan à l'écran sous Ctrl.
const CTRL_MOUSE_BUTTONS = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
}
const IDLE_MOUSE_BUTTONS = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: -1 }

// Canvas R3F principal (E4-01, E4-02).
// Orbite Ctrl+clic gauche, pan Ctrl+clic droit, zoom molette (E21-01).
// Éclairage ambiant + directionnelle clé + directionnelle de débouchage
// opposée : pas de faces noires sans aucune configuration.
export default function Viewer() {
  const selectNode = useStore((state) => state.selectNode)
  const showPerf = useStore((state) => state.showPerf)
  // E17 : en mode visite, OrbitControls laisse la place au vol libre
  // (PointerLockControls + WASD).
  const viewMode = useStore((state) => state.viewMode)
  // E6-01 : clic dans le vide → désélection. onPointerMissed se déclenche
  // aussi en fin d'orbite ; on ne désélectionne que si le pointeur n'a
  // quasiment pas bougé entre down et up (vrai clic).
  const downPosition = useRef([0, 0])
  const { ctrlDown, buttonDown } = useCtrlNav()

  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 50 }}
      style={
        ctrlDown && viewMode !== 'visit'
          ? { cursor: buttonDown ? 'grabbing' : 'grab' }
          : undefined
      }
      onPointerDown={(event) => {
        downPosition.current = [event.clientX, event.clientY]
      }}
      onPointerMissed={(event) => {
        if (event.ctrlKey) return // E21-02 : Ctrl+clic = navigation pure
        const [x, y] = downPosition.current
        if (Math.hypot(event.clientX - x, event.clientY - y) < 6) selectNode(null)
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 4]} intensity={1.2} />
      <directionalLight position={[-6, 4, -5]} intensity={0.4} />

      <Model />
      <WallCutter />
      <RunFittings />
      <EditObjects />

      <Grid
        args={[20, 20]}
        cellColor="#444"
        sectionColor="#666"
        fadeDistance={60}
        infiniteGrid
      />
      {viewMode === 'visit' ? (
        <VisitControls />
      ) : (
        <OrbitControls
          makeDefault
          mouseButtons={ctrlDown ? CTRL_MOUSE_BUTTONS : IDLE_MOUSE_BUTTONS}
        />
      )}

      {Perf && showPerf && (
        <Suspense fallback={null}>
          <Perf position="bottom-right" />
        </Suspense>
      )}
    </Canvas>
  )
}
