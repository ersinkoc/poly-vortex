'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { engine, LIMITS } from '@/game/engine';
import { supplyLifetime } from '@/game/supplies';
import { useGame } from '@/game/store';

const pose = new THREE.Object3D();
const merge = (parts: THREE.BufferGeometry[]) => { const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose()); if (!geometry) throw new Error('Unable to create ordnance geometry.'); return geometry; };

export default function Ordnance() {
  const missiles = useRef<THREE.InstancedMesh>(null), flames = useRef<THREE.InstancedMesh>(null), boxes = useRef<THREE.InstancedMesh>(null), racks = useRef<THREE.InstancedMesh>(null), beacons = useRef<THREE.InstancedMesh>(null);
  const assets = useMemo(() => {
    const missile = merge([new THREE.CylinderGeometry(0.07, 0.09, 0.6, 10).rotateX(Math.PI / 2), new THREE.ConeGeometry(0.07, 0.2, 10).rotateX(Math.PI / 2).translate(0, 0, 0.4), new THREE.BoxGeometry(0.35, 0.025, 0.16).translate(0, 0, -0.2), new THREE.BoxGeometry(0.025, 0.35, 0.16).translate(0, 0, -0.2)]);
    const flame = new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1, 3).translate(0, 0, -0.4);
    const rack = merge([-0.27, 0, 0.27].map(x => missile.clone().scale(0.8, 0.8, 0.8).translate(x, 0.35, 0)));
    const box = merge([new THREE.BoxGeometry(1.04, 0.55, 0.9), new THREE.BoxGeometry(1.1, 0.08, 0.96).translate(0, -0.22, 0), new THREE.BoxGeometry(0.08, 0.64, 0.98).translate(-0.42, 0, 0), new THREE.BoxGeometry(0.08, 0.64, 0.98).translate(0.42, 0, 0)]);
    const beacon = missile.clone().rotateX(-Math.PI / 2).scale(1.25, 1.25, 1.25);
    return { missile, flame, rack, box, beacon };
  }, []);
  useEffect(() => () => Object.values(assets).forEach(g => g.dispose()), [assets]);
  useFrame(({ clock, camera }) => {
    const active = useGame.getState().phase !== 'menu'; let flying = 0, ammo = 0;
    if (active) for (const rocket of engine.rockets) {
      if (rocket.age >= 4) continue;
      pose.position.set(rocket.x, 0.8, rocket.z); pose.rotation.set(0, Math.atan2(rocket.vx, rocket.vz), 0); pose.scale.setScalar(1); pose.updateMatrix(); missiles.current?.setMatrixAt(flying, pose.matrix); flames.current?.setMatrixAt(flying++, pose.matrix);
    }
    if (active) for (const supply of engine.supplies) {
      if (supply.type !== 'ammo' || supply.age >= supplyLifetime(supply)) continue;
      pose.position.set(supply.x, 0.5 + Math.sin(clock.elapsedTime * 2 + ammo) * 0.05, supply.z); pose.rotation.set(0, clock.elapsedTime * 0.25, 0); pose.scale.setScalar(1); pose.updateMatrix(); boxes.current?.setMatrixAt(ammo, pose.matrix); racks.current?.setMatrixAt(ammo, pose.matrix);
      pose.position.y = 1.65; pose.quaternion.copy(camera.quaternion); pose.scale.setScalar(0.85); pose.updateMatrix(); beacons.current?.setMatrixAt(ammo++, pose.matrix);
    }
    for (const mesh of [missiles.current, flames.current]) if (mesh) { mesh.count = flying; mesh.instanceMatrix.needsUpdate = true; }
    for (const mesh of [boxes.current, racks.current, beacons.current]) if (mesh) { mesh.count = ammo; mesh.instanceMatrix.needsUpdate = true; }
  });
  return <>
    <instancedMesh ref={missiles} args={[assets.missile, undefined, LIMITS.rockets]} frustumCulled={false}><meshStandardMaterial color="#edf0e5" metalness={0.55} roughness={0.28} /></instancedMesh>
    <instancedMesh ref={flames} args={[assets.flame, undefined, LIMITS.rockets]} frustumCulled={false}><meshBasicMaterial color={[4, 1.3, 0.18]} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={boxes} args={[assets.box, undefined, LIMITS.supplies]} frustumCulled={false}><meshStandardMaterial color="#244966" emissive="#2c83bd" emissiveIntensity={0.3} metalness={0.75} roughness={0.38} /></instancedMesh>
    <instancedMesh ref={racks} args={[assets.rack, undefined, LIMITS.supplies]} frustumCulled={false}><meshStandardMaterial color="#bccacb" metalness={0.55} roughness={0.3} /></instancedMesh>
    <instancedMesh ref={beacons} args={[assets.beacon, undefined, LIMITS.supplies]} frustumCulled={false}><meshBasicMaterial color={[0.45, 1.3, 2.5]} toneMapped={false} /></instancedMesh>
  </>;
}
