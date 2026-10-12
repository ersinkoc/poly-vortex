'use client';

import { Environment, Lightformer } from '@react-three/drei';

// A local studio reflection rig; no HDR image or network request is needed.
export default function ShipLighting() {
  return <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[5, 14, 8]} intensity={3.5} color="#e5efff" />
    <directionalLight position={[-8, 7, -5]} intensity={1.8} color="#8baaff" />
    <Environment resolution={128} frames={1} environmentIntensity={0.7}>
      <Lightformer form="rect" intensity={4} color="#e7f1ff" position={[0, 8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 9, 1]} />
      <Lightformer form="rect" intensity={3} color="#8dbdff" position={[-8, 3, -4]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffe1aa" position={[7, 4, 5]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 4, 1]} />
    </Environment>
  </>;
}
