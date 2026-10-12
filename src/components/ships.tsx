'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { buildDroneRotor, buildEnemyShip, buildEscortDrone, buildGroundCharge, buildGroundRover, buildRoverWheels, buildPlayerShip, buildShadowTexture, buildShipMaterials, buildSurfaceTextures, SURFACES, type ShipModel } from '@/game/ship-models';
import GroundCharges from './ground-charges';
import GroundRovers from './ground-rovers';
import { DRONE_HULL, DRONE_FIRE, DRONE_FORMATION, DRONE_ORBIT, droneMuzzle, dronePose } from '@/game/orbital-drones';
import { terrainHeight } from '@/game/terrain';
import { attachDamageMaterial, buildDamageUniforms, damageHeat, hullDamage } from '@/game/ship-damage';
import { GOLIATH, goliathMuzzle, goliathPose } from '@/game/goliath-ai';

type ActorAsset = { model: ShipModel; materials: ReturnType<typeof buildShipMaterials> };
const accents = ['#ff5774', '#a685ff', '#ffae50', '#ff3a5d'];
const matrixObject = new THREE.Object3D();

function PlayerShip({ asset, shadow }: { asset: ActorAsset & { damage: ReturnType<typeof buildDamageUniforms> }; shadow: THREE.Texture }) {
  const group = useRef<THREE.Group>(null), footprint = useRef<THREE.Mesh>(null), light = useRef<THREE.PointLight>(null);
  const idleFlame = useMemo(() => new THREE.Color('#8adfff'), []);
  const failingFlame = useMemo(() => new THREE.Color('#ff8a38'), []);
  useFrame(({ clock }) => {
    const p = engine.player, state = useGame.getState(), menu = state.phase === 'menu';
    const damage = menu ? 0 : hullDamage(p.hp, p.maxHp), heat = damageHeat(damage);
    asset.damage.uHullDamage.value = damage;
    asset.damage.uHullImpact.value = menu || state.reducedEffects ? 0 : p.hullHit / 0.65;
    if (group.current) {
      group.current.position.set(p.x, 0.95 + Math.sin(clock.elapsedTime * 2.5) * 0.045, p.z);
      group.current.rotation.set(menu ? -0.04 : p.vz * 0.009, menu ? clock.elapsedTime * 0.1 + 0.7 : p.angle, menu ? Math.sin(clock.elapsedTime * 0.7) * 0.025 : -p.vx * 0.025);
      group.current.scale.setScalar(menu ? 2.25 : 0.83);
      group.current.visible = true;
    }
    const flame = asset.materials.engine as THREE.MeshBasicMaterial;
    const flicker = state.reducedEffects ? 1 : 1 - heat * 0.22 * (0.5 + 0.5 * Math.sin(engine.time * 27));
    const shimmer = state.reducedEffects ? 0 : Math.sin((menu ? clock.elapsedTime : engine.time) * 35) * 0.28;
    flame.color.copy(idleFlame).lerp(failingFlame, heat * 0.65).multiplyScalar(((p.dashTime > 0 ? 6 : 2.4) + shimmer + Math.hypot(p.vx, p.vz) * 0.08) * flicker);
    (asset.materials.signal as THREE.MeshStandardMaterial).emissiveIntensity = 3.1 * (1 - damage * 0.6) * flicker;
    const armor = asset.materials.armor as THREE.MeshPhysicalMaterial;
    armor.emissive.set(p.dashTime > 0 && !menu ? '#83c6e1' : '#000000'); armor.emissiveIntensity = 0.16;
    if (footprint.current) { footprint.current.position.set(p.x, terrainHeight(p.x, p.z) + 0.035, p.z); footprint.current.rotation.set(-Math.PI / 2, 0, -(menu ? clock.elapsedTime * 0.1 + 0.7 : p.angle)); footprint.current.scale.set(menu ? 5.5 : 2.4, menu ? 7 : 3, 1); }
    if (light.current) { light.current.position.set(p.x, 1.8, p.z); light.current.color.copy(idleFlame).lerp(failingFlame, heat); light.current.intensity = 9 + (state.reducedEffects ? 0 : p.hullHit * 10); }
  });
  return <>
    <group ref={group} dispose={null}>{SURFACES.map(surface => <mesh key={surface} geometry={asset.model[surface]} material={asset.materials[surface]} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}</group>
    <mesh ref={footprint}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={shadow} transparent opacity={0.4} depthWrite={false} /></mesh>
    <pointLight ref={light} color="#9cdbff" intensity={9} distance={6} decay={2} />
  </>;
}

function EnemyShips({ kind, asset, shadow }: { kind: 0 | 1 | 2 | 3; asset: ActorAsset; shadow: THREE.Texture }) {
  const layers = useRef<(THREE.InstancedMesh | null)[]>([]), footprints = useRef<THREE.InstancedMesh>(null), cannonLights = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const owned = [...layers.current, footprints.current, cannonLights.current];
    for (const mesh of owned) mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => { owned.forEach(mesh => mesh?.dispose()); };
  }, []);
  useFrame(({ clock }) => {
    const state = useGame.getState(), menu = state.phase === 'menu'; let count = 0, lightCount = 0;
    for (const e of engine.enemies) {
      if (e.kind !== kind) continue;
      const orbit = menu ? clock.elapsedTime * 0.035 : 0;
      const x = e.x * Math.cos(orbit) - e.z * Math.sin(orbit), z = e.x * Math.sin(orbit) + e.z * Math.cos(orbit);
      const heavy = kind === 2 && !menu ? goliathPose(e, engine.player) : null;
      const yaw = heavy?.yaw ?? (kind === 1 ? clock.elapsedTime * 0.25 + e.id : Math.atan2((menu ? 0 : engine.player.x) - x, (menu ? 0 : engine.player.z) - z));
      const scale = e.radius * (menu ? 1.45 : 1);
      matrixObject.position.set(x, e.radius * 0.75 + 0.3 + Math.sin(clock.elapsedTime * 2 + e.id) * 0.045, z);
      matrixObject.rotation.set(Math.sin(e.age + e.id) * 0.025, yaw, Math.cos(e.age * 1.5 + e.id) * (kind === 0 ? 0.09 : 0.025));
      if (heavy) { matrixObject.position.set(heavy.x, heavy.y, heavy.z); matrixObject.rotation.set(heavy.pitch, heavy.yaw, heavy.bank, 'XYZ'); }
      matrixObject.scale.setScalar(scale); matrixObject.updateMatrix();
      for (const mesh of layers.current) mesh?.setMatrixAt(count, matrixObject.matrix);
      if (footprints.current) {
        matrixObject.position.set(x, terrainHeight(x, z) + 0.025 + kind * 0.001, z); matrixObject.rotation.set(-Math.PI / 2, 0, -yaw); matrixObject.scale.set(scale * 2.5, scale * 2.9, 1); matrixObject.updateMatrix(); footprints.current.setMatrixAt(count, matrixObject.matrix);
      }
      if (kind === 2 && !menu && e.hp > 0 && cannonLights.current) {
        const flash = e.cannonFlash && e.age - e.cannonFlash.at < GOLIATH.flash ? e.cannonFlash : null;
        for (const side of [-1, 1] as const) {
          if (!e.cannon && (!flash || flash.side !== side || state.reducedEffects)) continue;
          const muzzle = goliathMuzzle(e, engine.player, side), size = e.cannon ? 0.035 + 0.075 * Math.max(0, 1 - e.cannon.remaining / GOLIATH.windup) : 0.2 * (1 - (e.age - flash!.at) / GOLIATH.flash);
          matrixObject.position.set(muzzle.x, muzzle.y, muzzle.z); matrixObject.rotation.set(0, 0, 0); matrixObject.scale.setScalar(size); matrixObject.updateMatrix(); cannonLights.current.setMatrixAt(lightCount++, matrixObject.matrix);
        }
      }
      count++;
    }
    for (const mesh of [...layers.current, footprints.current]) if (mesh) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; }
    if (cannonLights.current) { cannonLights.current.count = lightCount; cannonLights.current.instanceMatrix.needsUpdate = true; }
  });
  return <>
    {SURFACES.map((surface, i) => <instancedMesh key={surface} ref={mesh => { layers.current[i] = mesh; }} args={[asset.model[surface], asset.materials[surface], LIMITS.enemies]} frustumCulled={false} dispose={null} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}
    <instancedMesh ref={footprints} args={[undefined, undefined, LIMITS.enemies]} frustumCulled={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={shadow} transparent opacity={0.3} depthWrite={false} /></instancedMesh>
    {kind === 2 && <instancedMesh ref={cannonLights} args={[undefined, undefined, LIMITS.enemies * 2]} count={0} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color={[3.5, 1.4, 0.4]} toneMapped={false} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>}
  </>;
}

function EscortDrones({ asset, rotor, shadow }: { asset: ActorAsset; rotor: THREE.BufferGeometry; shadow: THREE.Texture }) {
  const layers = useRef<(THREE.InstancedMesh | null)[]>([]), fans = useRef<THREE.InstancedMesh>(null), footprints = useRef<THREE.InstancedMesh>(null), flashes = useRef<THREE.InstancedMesh>(null);
  const objects = useMemo(() => ({ body: new THREE.Object3D(), fan: new THREE.Object3D(), fanWorld: new THREE.Matrix4(), footprint: new THREE.Object3D(), wear: new THREE.Color() }), []);
  useEffect(() => {
    const owned = [...layers.current, fans.current, footprints.current, flashes.current];
    for (const mesh of owned) mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => { owned.forEach(mesh => mesh?.dispose()); };
  }, []);
  useFrame(() => {
    const state = useGame.getState(), count = state.phase === 'menu' ? 0 : engine.droneFormation.count; let flashCount = 0;
    for (let draw = 0; draw < count; draw++) {
      const i = engine.droneFormation.slots[draw];
      const pose = dronePose(engine.time, i, count, engine.player, engine.droneFormation), { body, fan, fanWorld, footprint } = objects;
      const gun = engine.droneGuns[i], yaw = gun.active ? gun.yaw : pose.yaw, pitch = gun.active ? gun.pitch : pose.pitch;
      body.position.set(pose.x, pose.y, pose.z); body.rotation.set(pitch, yaw, pose.bank, 'YXZ'); body.scale.setScalar(DRONE_ORBIT.scale); body.updateMatrix();
      const hull = engine.droneRack.units[i], integrity = hull.hp / DRONE_HULL.hp;
      objects.wear.setRGB(0.35 + integrity * 0.65, 0.19 + integrity * 0.81, 0.13 + integrity * 0.87);
      if (hull.hit > 0 && !state.reducedEffects) objects.wear.setRGB(1.8, 0.8, 0.35);
      for (let surface = 0; surface < layers.current.length; surface++) {
        const layer = layers.current[surface]; layer?.setMatrixAt(draw, body.matrix);
        if (SURFACES[surface] === 'hull' || SURFACES[surface] === 'armor') layer?.setColorAt(draw, objects.wear);
      }
      let j = 0;
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        fan.position.set(side * 0.55, 0.065, end * 0.37); fan.rotation.set(0, engine.time * 54 * side * end + i * 0.8, 0); fan.updateMatrix();
        fanWorld.multiplyMatrices(body.matrix, fan.matrix); fans.current?.setMatrixAt(draw * 4 + j++, fanWorld);
      }
      const spread = Math.max(0, pose.y - DRONE_FORMATION.altitude) * 0.2;
      footprint.position.set(pose.x, terrainHeight(pose.x, pose.z) + 0.03, pose.z); footprint.rotation.set(-Math.PI / 2, 0, -yaw); footprint.scale.set(1.7 + spread, 1.9 + spread, 1); footprint.updateMatrix();
      footprints.current?.setMatrixAt(draw, footprint.matrix);
      if (gun.flash > 0 && !state.reducedEffects) {
        const muzzle = droneMuzzle(pose, yaw, gun.barrel, pitch), size = Math.sqrt(gun.flash / DRONE_FIRE.flashDuration);
        footprint.position.set(muzzle.x, muzzle.y, muzzle.z); footprint.rotation.set(pitch, yaw, pose.bank, 'YXZ'); footprint.scale.set(0.11 * size, 0.11 * size, 0.22 * size); footprint.updateMatrix();
        flashes.current?.setMatrixAt(flashCount++, footprint.matrix);
      }
    }
    for (const mesh of [...layers.current, footprints.current]) if (mesh) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    if (fans.current) { fans.current.count = count * 4; fans.current.instanceMatrix.needsUpdate = true; }
    if (flashes.current) { flashes.current.count = flashCount; flashes.current.instanceMatrix.needsUpdate = true; }
  });
  return <>
    {SURFACES.map((surface, i) => <instancedMesh key={surface} ref={mesh => { layers.current[i] = mesh; }} args={[asset.model[surface], asset.materials[surface], DRONE_ORBIT.capacity]} count={0} frustumCulled={false} dispose={null} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}
    <instancedMesh ref={fans} args={[rotor, asset.materials.metal, DRONE_ORBIT.capacity * 4]} count={0} frustumCulled={false} dispose={null} />
    <instancedMesh ref={footprints} args={[undefined, undefined, DRONE_ORBIT.capacity]} count={0} frustumCulled={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={shadow} transparent opacity={0.32} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={flashes} args={[undefined, undefined, DRONE_ORBIT.capacity]} count={0} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color={[1.3, 3.5, 4.5]} toneMapped={false} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
  </>;
}

export default function ShipFleet() {
  const assets = useMemo(() => {
    const textures = buildSurfaceTextures(), shadow = buildShadowTexture();
    const player = { model: buildPlayerShip(), materials: buildShipMaterials('#bdff6f', true, textures), damage: buildDamageUniforms() };
    for (const surface of ['hull', 'armor', 'metal', 'glass'] as const) attachDamageMaterial(player.materials[surface], player.damage);
    const enemies = ([0, 1, 2, 3] as const).map(kind => ({ model: buildEnemyShip(kind), materials: buildShipMaterials(accents[kind], false, textures) }));
    const drone = { model: buildEscortDrone(), materials: buildShipMaterials('#6ee7ff', false, textures) };
    const rotor = buildDroneRotor();
    const charge = { model: buildGroundCharge(), materials: buildShipMaterials('#ffba6a', false, textures) };
    const rover = { model: buildGroundRover(), materials: buildShipMaterials('#9ef1dc', false, textures) }, wheels = buildRoverWheels();
    return { textures, shadow, player, enemies, drone, rotor, charge, rover, wheels };
  }, []);
  useEffect(() => () => {
    for (const actor of [assets.player, ...assets.enemies, assets.drone, assets.charge, assets.rover]) {
      Object.values(actor.model).forEach(geometry => geometry.dispose()); Object.values(actor.materials).forEach(material => material.dispose());
    }
    Object.values(assets.textures).forEach(texture => texture.dispose()); assets.shadow.dispose(); assets.rotor.dispose();
    Object.values(assets.wheels).forEach(geometry => geometry.dispose());
  }, [assets]);
  return <><PlayerShip asset={assets.player} shadow={assets.shadow} /><EscortDrones asset={assets.drone} rotor={assets.rotor} shadow={assets.shadow} /><GroundCharges asset={assets.charge} /><GroundRovers asset={assets.rover} wheels={assets.wheels} shadow={assets.shadow} />{([0, 1, 2, 3] as const).map(kind => <EnemyShips key={kind} kind={kind} asset={assets.enemies[kind]} shadow={assets.shadow} />)}</>;
}
