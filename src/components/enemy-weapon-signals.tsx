'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { enemyWeapon, HOSTILE_WEAPONS, rangedMuzzle } from '@/game/enemy-weapons';

export default function EnemyWeaponSignals() {
  const beams = useRef<THREE.InstancedMesh>(null), lights = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => ({ pose: new THREE.Object3D(), color: new THREE.Color() }), []);
  useEffect(() => {
    const meshes = [beams.current, lights.current]; meshes.forEach(m => m?.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
    return () => meshes.forEach(m => m?.dispose());
  }, []);
  useFrame(() => {
    let beamCount = 0, lightCount = 0; const state = useGame.getState(), { pose, color } = scratch;
    if (state.phase === 'playing' || state.phase === 'paused') for (const e of engine.enemies) {
      if ((e.kind !== 0 && e.kind !== 1) || e.hp <= 0) continue;
      const rule = HOSTILE_WEAPONS[enemyWeapon(e)], charge = e.ranged;
      const flash = e.weaponFlash && e.age - e.weaponFlash.at < 0.16 ? e.weaponFlash : null;
      if (!charge && !flash) continue;
      const side = charge ? (e.weaponShots ?? 0) % 2 === 0 ? -1 : 1 : flash!.side;
      const muzzle = rangedMuzzle(e, engine.player, side); color.set(rule.color).multiplyScalar(2.5);
      if (charge) {
        const dx = charge.aimX - muzzle.x, dy = charge.aimY - muzzle.y, dz = charge.aimZ - muzzle.z;
        const length = Math.hypot(dx, dy, dz);
        pose.position.set((muzzle.x + charge.aimX) / 2, (muzzle.y + charge.aimY) / 2, (muzzle.z + charge.aimZ) / 2);
        pose.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
        // Steady warnings remain available with reduced effects enabled.
        pose.scale.set(0.025, 0.025, length); pose.updateMatrix();
        beams.current?.setMatrixAt(beamCount, pose.matrix); beams.current?.setColorAt(beamCount++, color);
      }
      if (charge || !state.reducedEffects) {
        const size = charge ? 0.04 + 0.08 * Math.max(0, 1 - charge.remaining / rule.windup) : 0.18 * (1 - (e.age - flash!.at) / 0.16);
        pose.position.set(muzzle.x, muzzle.y, muzzle.z); pose.rotation.set(0, 0, 0); pose.scale.setScalar(size); pose.updateMatrix();
        lights.current?.setMatrixAt(lightCount, pose.matrix); lights.current?.setColorAt(lightCount++, color);
      }
    }
    for (const [mesh, count] of [[beams.current, beamCount], [lights.current, lightCount]] as const) if (mesh) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  return <>
    <instancedMesh ref={beams} args={[undefined, undefined, LIMITS.enemies]} count={0} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial transparent opacity={0.25} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} /></instancedMesh>
    <instancedMesh ref={lights} args={[undefined, undefined, LIMITS.enemies]} count={0} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} /></instancedMesh>
  </>;
}
