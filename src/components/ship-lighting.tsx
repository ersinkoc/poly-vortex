'use client';

import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { renderQuality } from '@/game/render-budget';

// A local studio reflection rig; no HDR image or network request is needed.
export default function ShipLighting({ followPlayer = false }: { followPlayer?: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null), target = useMemo(() => new THREE.Object3D(), []);
  const quality = useGame(renderQuality);
  useEffect(() => { const light = key.current; return () => light?.shadow.dispose(); }, []);
  useFrame(() => {
    if (!key.current || !followPlayer) return;
    const menu = useGame.getState().phase === 'menu', x = menu ? 0 : engine.player.x, z = menu ? 0 : engine.player.z;
    key.current.position.set(x + 7, 17, z + 9); target.position.set(x, 0, z); target.updateMatrixWorld();
  });
  return <>
    <ambientLight intensity={0.32} />
    <primitive object={target} />
    <directionalLight ref={key} target={target} position={[7, 17, 9]} intensity={3.6} color="#fff0db" castShadow={quality === 'high'} shadow-mapSize={[1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-near={0.5} shadow-camera-far={65} shadow-bias={-0.0004} shadow-normalBias={0.025} shadow-radius={2} />
    <directionalLight position={[-8, 7, -5]} intensity={1.15} color="#729bc9" />
    <Environment resolution={128} frames={1} environmentIntensity={0.9}>
      <Lightformer form="rect" intensity={4} color="#fff3dd" position={[0, 8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 9, 1]} />
      <Lightformer form="rect" intensity={3} color="#8dbdff" position={[-8, 3, -4]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffe1aa" position={[7, 4, 5]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 4, 1]} />
    </Environment>
  </>;
}
