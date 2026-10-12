'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { terrainHeight } from '@/game/terrain';
import { useGame } from '@/game/store';

/** One reusable field station. All motion follows simulation time, including pause. */
export default function ServiceBeacon() {
  const group = useRef<THREE.Group>(null), ring = useRef<THREE.Mesh>(null), light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (!group.current) return;
    const dock = engine.service;
    group.current.visible = !!dock && useGame.getState().phase !== 'menu';
    if (!dock) return;
    group.current.position.set(dock.x, terrainHeight(dock.x, dock.z) + 0.12, dock.z);
    if (ring.current) { ring.current.rotation.z = engine.time * 0.6; ring.current.scale.setScalar(1 + Math.sin(engine.time * 2) * 0.025); }
    if (light.current) light.current.intensity = dock.serviced ? 4 : 2 + Math.sin(engine.time * 3) * 0.5;
  });
  return <group ref={group} visible={false}>
    <mesh receiveShadow><cylinderGeometry args={[2.9, 3.1, 0.18, 12]} /><meshStandardMaterial color="#1a3433" metalness={0.85} roughness={0.45} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}><ringGeometry args={[2.55, 2.68, 48]} /><meshBasicMaterial color="#6affb5" toneMapped={false} /></mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}><ringGeometry args={[1.1, 1.15, 24, 1, 0, Math.PI * 1.5]} /><meshBasicMaterial color="#adffe1" toneMapped={false} /></mesh>
    {[0, 1, 2, 3].map(i => { const a = i * Math.PI / 2; return <group key={i} position={[Math.cos(a) * 2.6, 0.15, Math.sin(a) * 2.6]} rotation={[0, -a, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.4, 0.65, 0.65]} /><meshStandardMaterial color="#354947" roughness={0.4} metalness={0.8} /></mesh>
      <mesh position={[0, 0.66, 0]}><boxGeometry args={[0.3, 0.08, 0.45]} /><meshStandardMaterial color="#7fffc5" emissive="#7fffc5" emissiveIntensity={3} toneMapped={false} /></mesh>
    </group>; })}
    <mesh position={[0, 1.5, 0]}><octahedronGeometry args={[0.3]} /><meshStandardMaterial color="#96ffcc" emissive="#55ffac" emissiveIntensity={2.5} toneMapped={false} /></mesh>
    <pointLight ref={light} position={[0, 2, 0]} color="#6fffb5" intensity={2} distance={9} />
  </group>;
}
