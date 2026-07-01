import { lazy, Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import Model from './Model.jsx'
import VisitControls from './VisitControls.jsx'
import EditObjects from './EditObjects.jsx'
import WallCutter from './WallCutter.jsx'
import useStore from '../store/useStore.js'

// E8-01 : overlay perf (draw calls, fps, mémoire GPU), dev uniquement,
// toggle touche P. Chargé à la demande : `import.meta.env.DEV` étant
// constant au build, r3f-perf est exclu du bundle de production.
// Seuil d'alerte : au-delà de ~200-300 draw calls sur hardware moyen,
// activer les optimisations E8-02+ (instancing, merge par calque).
const Perf = import.meta.env.DEV
  ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
  : null

// Canvas R3F principal (E4-01, E4-02).
// Orbite clic gauche, pan clic droit, zoom molette (OrbitControls).
// Éclairage ambiant + directionnelle clé + directionnelle de débouchage
// opposée : pas de faces noires sans aucune configuration.
export default function Viewer() {
  const selectNode = useStore((state) => state.selectNode)
  const showPerf = useStore((state) => state.showPerf)
  // E17 : en mode visite, OrbitControls laisse la place au vol libre
  // (PointerLockControls + WASD).
  const viewMode = useStore((state) => state.viewMode)
  // Slice 0 : pendant le tracé d'une forme, on coupe OrbitControls (le drag
  // sert à dessiner, pas à orbiter ; les contrôles écoutent le DOM directement,
  // un stopPropagation R3F ne les arrête pas).
  const editMode = useStore((state) => state.editMode)
  const activeTool = useStore((state) => state.activeTool)
  // Outils à glisser (tracé du rectangle, extrusion Push/Pull) : on coupe
  // OrbitControls, sinon le drag orbite au lieu d'agir.
  const drawingTool = editMode && (activeTool === 'rect' || activeTool === 'pushpull')
  // E6-01 : clic dans le vide → désélection. onPointerMissed se déclenche
  // aussi en fin d'orbite ; on ne désélectionne que si le pointeur n'a
  // quasiment pas bougé entre down et up (vrai clic).
  const downPosition = useRef([0, 0])

  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 50 }}
      onPointerDown={(event) => {
        downPosition.current = [event.clientX, event.clientY]
      }}
      onPointerMissed={(event) => {
        const [x, y] = downPosition.current
        if (Math.hypot(event.clientX - x, event.clientY - y) < 6) selectNode(null)
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 4]} intensity={1.2} />
      <directionalLight position={[-6, 4, -5]} intensity={0.4} />

      <Model />
      <WallCutter />
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
        <OrbitControls makeDefault enabled={!drawingTool} />
      )}

      {Perf && showPerf && (
        <Suspense fallback={null}>
          <Perf position="bottom-right" />
        </Suspense>
      )}
    </Canvas>
  )
}
