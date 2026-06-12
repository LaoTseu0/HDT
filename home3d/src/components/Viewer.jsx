import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import Model from './Model.jsx'

// Canvas R3F principal (E4-01, E4-02).
// Orbite clic gauche, pan clic droit, zoom molette (OrbitControls).
// Éclairage ambiant + directionnelle clé + directionnelle de débouchage
// opposée : pas de faces noires sans aucune configuration.
export default function Viewer() {
  return (
    <Canvas camera={{ position: [8, 6, 8], fov: 50 }}>
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
