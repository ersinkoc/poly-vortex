'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { CHARGE_RULES, chargeRemaining } from '@/game/ground-charges';
import { useGame } from '@/game/store';
import { terrainHeight } from '@/game/terrain';
import { SURFACES, type ShipModel, type buildShipMaterials } from '@/game/ship-models';

const SEGMENTS = 64;
function ringGeometry() {
  const g = new THREE.BufferGeometry(), indices = [];
  for (let i = 0; i < SEGMENTS; i++) { const j = (i + 1) % SEGMENTS; indices.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEGMENTS * 6), 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(indices); return g;
}
function conformRing(g: THREE.BufferGeometry, x: number, z: number, inner: number, outer: number) {
  const vertices = g.getAttribute('position');
  for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < 2; j++) {
    const a = i / SEGMENTS * Math.PI * 2, r = j ? outer : inner, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    vertices.setXYZ(i * 2 + j, px, terrainHeight(px, pz) + 0.045, pz);
  }
  vertices.needsUpdate = true; g.computeBoundingSphere();
}

export default function GroundCharges({ asset }: { asset: { model: ShipModel; materials: ReturnType<typeof buildShipMaterials> } }) {
  const charges = useGame(s => s.charges), phase = useGame(s => s.phase);
  const layers = useRef<(THREE.InstancedMesh | null)[]>([]), zones = useRef<(THREE.Mesh | null)[]>([]), progress = useRef<(THREE.Mesh | null)[]>([]);
  const sites = useRef<(string | null)[]>(Array(CHARGE_RULES.activeLimit).fill(null));
  const resources = useMemo(() => ({ pose: new THREE.Object3D(), zones: Array.from({ length: CHARGE_RULES.activeLimit }, ringGeometry), progress: Array.from({ length: CHARGE_RULES.activeLimit }, ringGeometry), zoneMaterials: Array.from({ length: CHARGE_RULES.activeLimit }, () => new THREE.MeshBasicMaterial({ color: '#ffba6a', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })), progressMaterials: Array.from({ length: CHARGE_RULES.activeLimit }, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.4), depthWrite: false, toneMapped: false })) }), []);
  useEffect(() => {
    const owned = [...layers.current]; owned.forEach(m => m?.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
    return () => { owned.forEach(m => m?.dispose()); [...resources.zones, ...resources.progress].forEach(g => g.dispose()); [...resources.zoneMaterials, ...resources.progressMaterials].forEach(m => m.dispose()); };
  }, [resources]);
  useFrame(() => {
    const state = useGame.getState(), active = state.phase === 'playing' || state.phase === 'paused' ? engine.charges : [], { pose } = resources;
    for (let i = 0; i < CHARGE_RULES.activeLimit; i++) {
      const c = active[i], zone = zones.current[i], arc = progress.current[i];
      if (zone) zone.visible = !!c; if (arc) arc.visible = !!c;
      if (!c) continue;
      pose.position.set(c.x, terrainHeight(c.x, c.z) + 0.015, c.z); pose.rotation.set(0, c.id * 0.4, 0); pose.scale.setScalar(1); pose.updateMatrix();
      layers.current.forEach(m => m?.setMatrixAt(i, pose.matrix));
      const key = `${c.id}:${c.x}:${c.z}`;
      if (sites.current[i] !== key) { sites.current[i] = key; conformRing(resources.zones[i], c.x, c.z, CHARGE_RULES.radius - 0.055, CHARGE_RULES.radius); conformRing(resources.progress[i], c.x, c.z, 0.61, 0.7); }
      if (zone) {
        const material = zone.material as THREE.MeshBasicMaterial;
        material.color.set(chargeRemaining(c) <= 1 ? '#ff6159' : '#ffba6a').multiplyScalar(1.6);
        material.opacity = state.reducedEffects ? 0.55 : 0.48 + Math.sin(engine.time * 9) * 0.1;
      }
      resources.progress[i].setDrawRange(0, Math.ceil(chargeRemaining(c) / CHARGE_RULES.fuse * SEGMENTS) * 6);
    }
    layers.current.forEach(m => { if (m) { m.count = Math.min(CHARGE_RULES.activeLimit, active.length); m.instanceMatrix.needsUpdate = true; } });
  });
  return <>
    {SURFACES.map((surface, i) => <instancedMesh key={surface} ref={m => { layers.current[i] = m; }} args={[asset.model[surface], asset.materials[surface], CHARGE_RULES.activeLimit]} count={0} frustumCulled={false} dispose={null} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}
    {resources.zones.map((g, i) => <mesh ref={m => { zones.current[i] = m; }} key={`zone${i}`} geometry={g} material={resources.zoneMaterials[i]} visible={false} frustumCulled={false} dispose={null} />)}
    {resources.progress.map((g, i) => <mesh ref={m => { progress.current[i] = m; }} key={`progress${i}`} geometry={g} material={resources.progressMaterials[i]} visible={false} frustumCulled={false} dispose={null} />)}
    {(phase === 'playing' || phase === 'paused') && charges.map(c => <Html key={c.id} center position={[c.x, terrainHeight(c.x, c.z) + 0.95, c.z]} zIndexRange={[2, 0]} style={{ pointerEvents: 'none' }}><span role="timer" aria-live="off" className={`charge-countdown ${chargeRemaining(c) <= 1 ? 'urgent' : ''}`} aria-label={`Ground charge countdown ${Math.ceil(chargeRemaining(c) * 10) / 10} seconds`}>{(Math.ceil(chargeRemaining(c) * 10) / 10).toFixed(1)}<small>s</small></span></Html>)}
  </>;
}
