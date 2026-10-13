'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { buildLifeModels } from '@/game/life-models';
import { LIFE_RULES, lifePose } from '@/game/world-life';

type Layer = keyof ReturnType<typeof buildLifeModels>;
const layerNames = ['fox', 'lizard', 'animalLeg', 'eyes', 'crew', 'vest', 'visor', 'arm', 'leg'] as const;

export default function WorldLifeActors() {
  const meshes = useRef<Partial<Record<Layer, THREE.InstancedMesh>>>({});
  const models = useMemo(() => buildLifeModels(), []);
  const scratch = useMemo(() => ({ body: new THREE.Object3D(), joint: new THREE.Object3D(), world: new THREE.Matrix4(), tint: new THREE.Color() }), []);
  useEffect(() => {
    const owned = Object.values(meshes.current); owned.forEach(m => m.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
    return () => { owned.forEach(m => { m.dispose(); for (const material of Array.isArray(m.material) ? m.material : [m.material]) material.dispose(); }); Object.values(models).forEach(g => g.dispose()); };
  }, [models]);
  useFrame(() => {
    const counts: Record<Layer, number> = { fox: 0, lizard: 0, animalLeg: 0, eyes: 0, crew: 0, vest: 0, visor: 0, arm: 0, leg: 0 };
    const { body, joint, world, tint } = scratch;
    const add = (layer: Layer, matrix: THREE.Matrix4, color?: string) => {
      const mesh = meshes.current[layer]; if (!mesh) return;
      const i = counts[layer]++; mesh.setMatrixAt(i, matrix); if (color) mesh.setColorAt(i, tint.set(color));
    };
    if (useGame.getState().phase !== 'menu') for (const a of engine.worldLife.actors) {
      const p = lifePose(a), crew = a.kind === 'crew';
      body.position.set(a.x, p.y, a.z); body.rotation.set(p.crawl * Math.PI / 2, a.yaw + (crew ? 0 : Math.sin(a.age * 1.4 + a.id) * 0.12 * (1 - p.moving)), Math.sin(a.stride) * p.moving * (crew ? 0.04 : 0.015), 'YXZ'); body.scale.setScalar(p.scale); body.updateMatrix();
      if (crew) {
        add('crew', body.matrix); add('vest', body.matrix); add('visor', body.matrix);
        for (const side of [-1, 1]) {
          const gait = Math.sin(a.stride + (side > 0 ? Math.PI : 0)) * p.moving;
          joint.position.set(side * 0.27, 1.2, 0); joint.rotation.set(p.crawl ? -0.25 + gait * 0.18 : gait * 0.65, 0, side * 0.12); joint.scale.setScalar(1); joint.updateMatrix(); world.multiplyMatrices(body.matrix, joint.matrix); add('arm', world);
          joint.position.set(side * 0.105, 0.66, 0); joint.rotation.set(p.crawl ? -0.08 - gait * 0.12 : -gait * 0.7, 0, side * 0.025); joint.updateMatrix(); world.multiplyMatrices(body.matrix, joint.matrix); add('leg', world);
        }
      } else {
        add(a.kind, body.matrix); if (a.kind === 'fox') add('eyes', body.matrix);
        for (const side of [-1, 1]) for (const end of [-1, 1]) {
          const gait = Math.sin(a.stride + (side * end > 0 ? Math.PI : 0)) * p.moving;
          joint.position.set(side * (a.kind === 'fox' ? 0.115 : 0.16), a.kind === 'fox' ? 0.17 : 0.08, end * 0.19);
          joint.rotation.set(gait * 0.65, 0, a.kind === 'fox' ? side * 0.12 : side * 0.8); joint.scale.setScalar(a.kind === 'fox' ? 1 : 0.75); joint.updateMatrix(); world.multiplyMatrices(body.matrix, joint.matrix); add('animalLeg', world, a.kind === 'fox' ? '#8e7451' : '#5f7663');
        }
      }
    }
    for (const key of layerNames) {
      const mesh = meshes.current[key]; if (!mesh) continue;
      mesh.count = counts[key]; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  const colors: Record<Layer, string> = { fox: '#b69a6c', lizard: '#748975', animalLeg: '#ffffff', eyes: '#151817', crew: '#687c7b', vest: '#aa9068', visor: '#162e3b', arm: '#687c7b', leg: '#526262' };
  return <>{layerNames.map(key => <instancedMesh key={key} ref={mesh => { if (mesh) meshes.current[key] = mesh; }} args={[models[key], undefined, LIFE_RULES.capacity * (key === 'animalLeg' ? 4 : key === 'arm' || key === 'leg' ? 2 : 1)]} count={0} frustumCulled={false} dispose={null} castShadow receiveShadow>
    <meshStandardMaterial color={colors[key]} roughness={key === 'visor' ? 0.12 : 0.82} metalness={key === 'visor' ? 0.65 : key === 'crew' ? 0.2 : 0.04} />
  </instancedMesh>)}</>;
}
