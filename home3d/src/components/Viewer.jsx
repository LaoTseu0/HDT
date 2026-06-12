import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import Model from './Model.jsx'
import useStore from '../store/useStore.js'

// Canvas R3F principal (E4-01, E4-02).
// Orbite clic gauche, pan clic droit, zoom molette (OrbitControls).
// Éclairage ambiant + directionnelle clé + directionnelle de débouchage
// opposée : pas de faces noires sans aucune configuration.
export default function Viewer() {
  const selectNode = useStore((state) => state.selectNode)
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

      <Grid
        args={[20, 20]}
        cellColor="#444"
        sectionColor="#666"
        fadeDistance={60}
        infiniteGrid
      />
      <OrbitControls makeDefault />
    </Canvas>
  )
}
