'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';

const pose = new THREE.Object3D();
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const merge = (parts: THREE.BufferGeometry[]) => {
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Unable to create first-aid geometry.'); return geometry;
};

export default function FirstAidSupplies() {
  const body = useRef<THREE.InstancedMesh>(null), crosses = useRef<THREE.InstancedMesh>(null), beacons = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => ({
    body: merge([box(1.05, 0.55, 0.8), box(0.08, 0.18, 0.09, -0.18, 0.34), box(0.08, 0.18, 0.09, 0.18, 0.34), box(0.44, 0.06, 0.09, 0, 0.43)]),
    crosses: merge([box(0.5, 0.022, 0.15, 0, 0.29, 0.08), box(0.15, 0.022, 0.5, 0, 0.29, 0.08), ...[-1, 1].flatMap(side => [box(0.42, 0.11, 0.018, 0, 0, side * 0.408), box(0.11, 0.38, 0.018, 0, 0, side * 0.408)])]),
    beacon: merge([box(0.6, 0.17, 0.035), box(0.17, 0.6, 0.035)]),
  }), []);
  useEffect(() => () => Object.values(geometry).forEach(g => g.dispose()), [geometry]);
  useFrame(({ camera, clock }) => {
    if (!body.current || !crosses.current || !beacons.current) return;
    let count = 0;
    if (useGame.getState().phase !== 'menu') for (const supply of engine.supplies) {
      if (supply.type !== 'repair' || supply.age >= 45) continue;
      const bob = Math.sin(clock.elapsedTime * 2.8 + count) * 0.08;
      pose.position.set(supply.x, 0.65 + bob, supply.z); pose.rotation.set(0, clock.elapsedTime * 0.35, 0); pose.scale.setScalar(1); pose.updateMatrix();
      body.current.setMatrixAt(count, pose.matrix); crosses.current.setMatrixAt(count, pose.matrix);
      pose.position.y = 1.7 + bob; pose.quaternion.copy(camera.quaternion); pose.scale.setScalar(0.9 + Math.sin(clock.elapsedTime * 4) * 0.08); pose.updateMatrix(); beacons.current.setMatrixAt(count, pose.matrix); count++;
    }
    for (const mesh of [body.current, crosses.current, beacons.current]) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; }
  });
  return <>
    <instancedMesh ref={body} args={[geometry.body, undefined, LIMITS.supplies]} frustumCulled={false}><meshStandardMaterial color="#ecf3f1" roughness={0.35} metalness={0.25} /></instancedMesh>
    <instancedMesh ref={crosses} args={[geometry.crosses, undefined, LIMITS.supplies]} frustumCulled={false}><meshStandardMaterial color="#ee233e" emissive="#ee233e" emissiveIntensity={0.55} roughness={0.45} /></instancedMesh>
    <instancedMesh ref={beacons} args={[geometry.beacon, undefined, LIMITS.supplies]} frustumCulled={false}><meshBasicMaterial color={[2.4, 0.12, 0.25]} toneMapped={false} /></instancedMesh>
  </>;
}
