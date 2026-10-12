'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';

const pose = new THREE.Object3D(), glow = new THREE.Color();
const box = (w: number, h: number, d: number, x: number, y: number, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const sphere = (r: number, x: number, y: number, z = 0, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 12, 8).scale(sx, sy, sz).translate(x, y, z);
const limb = (x: number, y: number, angle = 0) => new THREE.CapsuleGeometry(0.1, 0.35, 4, 8).rotateZ(angle).translate(x, y, 0);
const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); if (!g) throw new Error('Unable to create mission geometry.'); return g; };

export default function MissionActors() {
  const layers = useRef<(THREE.InstancedMesh | null)[]>([]);
  const rings = useRef<THREE.InstancedMesh>(null), beams = useRef<THREE.InstancedMesh>(null), pads = useRef<THREE.InstancedMesh>(null), relays = useRef<THREE.InstancedMesh>(null);
  const models = useMemo(() => ({
    suit: merge([sphere(0.23, 0, 1.63), box(0.46, 0.5, 0.28, 0, 1.18), limb(-0.31, 1.12, -0.12), limb(0.37, 1.48, -0.65), limb(-0.15, 0.66), limb(0.15, 0.66), box(0.2, 0.14, 0.32, -0.15, 0.38, 0.04), box(0.2, 0.14, 0.32, 0.15, 0.38, 0.04)]).translate(0, -0.25, 0),
    trim: merge([box(0.48, 0.1, 0.3, 0, 0.98), box(0.25, 0.35, 0.14, 0, 1.24, -0.2), box(0.16, 0.13, 0.29, -0.26, 1.39), box(0.16, 0.13, 0.29, 0.26, 1.39)]).translate(0, -0.25, 0),
    visor: merge([sphere(0.19, 0, 1.65, 0.13, 1, 0.65, 0.5), box(0.16, 0.13, 0.014, 0, 1.22, 0.15)]).translate(0, -0.25, 0),
    pod: merge([sphere(0.6, 0.85, 0.55, -0.8, 0.65, 0.9, 1), box(0.1, 0.45, 0.65, 1.2, 0.55, -0.8), box(0.1, 0.45, 0.65, 0.5, 0.55, -0.8)]),
    relay: merge([new THREE.CylinderGeometry(0.65, 0.85, 0.45, 8).translate(0, 0.45, 0), box(0.55, 1.2, 0.55, 0, 1.12), new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8).translate(0, 2.15, 0), new THREE.TorusGeometry(0.5, 0.035, 4, 16).rotateX(Math.PI / 2).translate(0, 1.9, 0)]),
  }), []);
  useEffect(() => () => Object.values(models).forEach(g => g.dispose()), [models]);
  useFrame(({ clock }) => {
    const mission = engine.missions.mission; const active = useGame.getState().phase !== 'menu' && mission?.status === 'active'; let people = 0, relay = 0, count = 0;
    if (active) for (const t of mission.targets) {
      if (t.done) continue;
      const angle = Math.atan2(engine.player.x - t.x, engine.player.z - t.z);
      pose.position.set(t.x, 0.07 + Math.sin(clock.elapsedTime * 2 + t.id) * 0.012, t.z); pose.rotation.set(0, angle, 0); pose.scale.setScalar(1); pose.updateMatrix();
      if (mission.kind === 'rescue') { for (const layer of layers.current) layer?.setMatrixAt(people, pose.matrix); people++; }
      else if (mission.kind === 'uplink') relays.current?.setMatrixAt(relay++, pose.matrix);
      const radius = mission.kind === 'rescue' ? 2.4 : 3.5, progress = t.progress / (mission.kind === 'rescue' ? 1.5 : 8);
      pose.position.set(t.x, 0.07, t.z); pose.rotation.set(-Math.PI / 2, 0, clock.elapsedTime * 0.15); pose.scale.setScalar(radius); pose.updateMatrix(); rings.current?.setMatrixAt(count, pose.matrix); rings.current?.setColorAt(count, glow.set(progress > 0 ? '#86ffe0' : mission.kind === 'rescue' ? '#ffd59a' : '#85d6ff').multiplyScalar(1.2 + progress));
      pose.rotation.set(0, 0, 0); pose.scale.set(1.5, 0.12, 1.5); pose.updateMatrix(); pads.current?.setMatrixAt(count, pose.matrix);
      pose.position.y = 3.2; pose.scale.set(progress > 0 ? 0.38 : 0.12, 6, progress > 0 ? 0.38 : 0.12); pose.updateMatrix(); beams.current?.setMatrixAt(count++, pose.matrix);
    }
    for (const mesh of layers.current) if (mesh) { mesh.count = people; mesh.instanceMatrix.needsUpdate = true; }
    if (relays.current) { relays.current.count = relay; relays.current.instanceMatrix.needsUpdate = true; }
    for (const mesh of [rings.current, beams.current, pads.current]) if (mesh) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  });
  return <>
    <instancedMesh ref={m => { layers.current[0] = m; }} args={[models.suit, undefined, 3]} frustumCulled={false}><meshStandardMaterial color="#d5e2df" roughness={0.62} metalness={0.15} /></instancedMesh>
    <instancedMesh ref={m => { layers.current[1] = m; }} args={[models.trim, undefined, 3]} frustumCulled={false}><meshStandardMaterial color="#df7e36" roughness={0.55} /></instancedMesh>
    <instancedMesh ref={m => { layers.current[2] = m; }} args={[models.visor, undefined, 3]} frustumCulled={false}><meshPhysicalMaterial color="#07242c" roughness={0.09} metalness={0.6} clearcoat={1} /></instancedMesh>
    <instancedMesh ref={m => { layers.current[3] = m; }} args={[models.pod, undefined, 3]} frustumCulled={false}><meshStandardMaterial color="#4e6269" roughness={0.58} metalness={0.75} /></instancedMesh>
    <instancedMesh ref={relays} args={[models.relay, undefined, 1]} frustumCulled={false}><meshStandardMaterial color="#57828b" metalness={0.7} roughness={0.3} emissive="#4ab4dc" emissiveIntensity={0.3} /></instancedMesh>
    <instancedMesh ref={rings} args={[undefined, undefined, 3]} frustumCulled={false}><torusGeometry args={[1, 0.018, 4, 48]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={pads} args={[undefined, undefined, 3]} frustumCulled={false}><cylinderGeometry args={[1, 1.1, 1, 12]} /><meshStandardMaterial color="#263d43" metalness={0.6} roughness={0.55} /></instancedMesh>
    <instancedMesh ref={beams} args={[undefined, undefined, 3]} frustumCulled={false}><cylinderGeometry args={[1, 1, 1, 12, 1, true]} /><meshBasicMaterial color="#c5f4ea" transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></instancedMesh>
  </>;
}
