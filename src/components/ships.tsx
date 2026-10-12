'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { buildEnemyShip, buildPlayerShip, buildShadowTexture, buildShipMaterials, buildSurfaceTextures, SURFACES, type ShipModel } from '@/game/ship-models';
import { terrainHeight } from '@/game/terrain';

type ActorAsset = { model: ShipModel; materials: ReturnType<typeof buildShipMaterials> };
const accents = ['#ff5774', '#a685ff', '#ffae50', '#ff3a5d'];
const matrixObject = new THREE.Object3D();

function PlayerShip({ asset, shadow }: { asset: ActorAsset; shadow: THREE.Texture }) {
  const group = useRef<THREE.Group>(null), footprint = useRef<THREE.Mesh>(null), light = useRef<THREE.PointLight>(null);
  const idleFlame = useMemo(() => new THREE.Color('#8adfff'), []);
  useFrame(({ clock }) => {
    const p = engine.player, menu = useGame.getState().phase === 'menu';
    if (group.current) {
      group.current.position.set(p.x, 0.95 + Math.sin(clock.elapsedTime * 2.5) * 0.045, p.z);
      group.current.rotation.set(menu ? -0.04 : p.vz * 0.009, menu ? clock.elapsedTime * 0.1 + 0.7 : p.angle, menu ? Math.sin(clock.elapsedTime * 0.7) * 0.025 : -p.vx * 0.025);
      group.current.scale.setScalar(menu ? 2.25 : 0.83);
      group.current.visible = true;
    }
    const flame = asset.materials.engine as THREE.MeshBasicMaterial;
    flame.color.copy(idleFlame).multiplyScalar((p.dashTime > 0 ? 6 : 2.4) + Math.sin(clock.elapsedTime * 35) * 0.28 + Math.hypot(p.vx, p.vz) * 0.08);
    const armor = asset.materials.armor as THREE.MeshPhysicalMaterial;
    armor.emissive.set(p.invulnerable > 0 && !menu ? '#83c6e1' : '#000000'); armor.emissiveIntensity = 0.16;
    if (footprint.current) { footprint.current.position.set(p.x, terrainHeight(p.x, p.z) + 0.035, p.z); footprint.current.rotation.set(-Math.PI / 2, 0, -(menu ? clock.elapsedTime * 0.1 + 0.7 : p.angle)); footprint.current.scale.set(menu ? 5.5 : 2.4, menu ? 7 : 3, 1); }
    if (light.current) light.current.position.set(p.x, 1.8, p.z);
  });
  return <>
    <group ref={group} dispose={null}>{SURFACES.map(surface => <mesh key={surface} geometry={asset.model[surface]} material={asset.materials[surface]} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}</group>
    <mesh ref={footprint}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={shadow} transparent opacity={0.4} depthWrite={false} /></mesh>
    <pointLight ref={light} color="#9cdbff" intensity={9} distance={6} decay={2} />
  </>;
}

function EnemyShips({ kind, asset, shadow }: { kind: 0 | 1 | 2 | 3; asset: ActorAsset; shadow: THREE.Texture }) {
  const layers = useRef<(THREE.InstancedMesh | null)[]>([]), footprints = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    for (const layer of layers.current) layer?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const owned = [...layers.current, footprints.current];
    return () => { owned.forEach(mesh => mesh?.dispose()); };
  }, []);
  useFrame(({ clock }) => {
    const menu = useGame.getState().phase === 'menu'; let count = 0;
    for (const e of engine.enemies) {
      if (e.kind !== kind) continue;
      const orbit = menu ? clock.elapsedTime * 0.035 : 0;
      const x = e.x * Math.cos(orbit) - e.z * Math.sin(orbit), z = e.x * Math.sin(orbit) + e.z * Math.cos(orbit);
      const yaw = kind === 1 ? clock.elapsedTime * 0.25 + e.id : Math.atan2((menu ? 0 : engine.player.x) - x, (menu ? 0 : engine.player.z) - z);
      const scale = e.radius * (menu ? 1.45 : 1);
      matrixObject.position.set(x, e.radius * 0.75 + 0.3 + Math.sin(clock.elapsedTime * 2 + e.id) * 0.045, z);
      matrixObject.rotation.set(Math.sin(e.age + e.id) * 0.025, yaw, Math.cos(e.age * 1.5 + e.id) * (kind === 0 ? 0.09 : 0.025));
      matrixObject.scale.setScalar(scale); matrixObject.updateMatrix();
      for (const mesh of layers.current) mesh?.setMatrixAt(count, matrixObject.matrix);
      if (footprints.current) {
        matrixObject.position.set(x, terrainHeight(x, z) + 0.025 + kind * 0.001, z); matrixObject.rotation.set(-Math.PI / 2, 0, -yaw); matrixObject.scale.set(scale * 2.5, scale * 2.9, 1); matrixObject.updateMatrix(); footprints.current.setMatrixAt(count, matrixObject.matrix);
      }
      count++;
    }
    for (const mesh of [...layers.current, footprints.current]) if (mesh) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; }
  });
  return <>
    {SURFACES.map((surface, i) => <instancedMesh key={surface} ref={mesh => { layers.current[i] = mesh; }} args={[asset.model[surface], asset.materials[surface], LIMITS.enemies]} frustumCulled={false} dispose={null} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}
    <instancedMesh ref={footprints} args={[undefined, undefined, LIMITS.enemies]} frustumCulled={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={shadow} transparent opacity={0.3} depthWrite={false} /></instancedMesh>
  </>;
}

export default function ShipFleet() {
  const assets = useMemo(() => {
    const textures = buildSurfaceTextures(), shadow = buildShadowTexture();
    const player = { model: buildPlayerShip(), materials: buildShipMaterials('#bdff6f', true, textures) };
    const enemies = ([0, 1, 2, 3] as const).map(kind => ({ model: buildEnemyShip(kind), materials: buildShipMaterials(accents[kind], false, textures) }));
    return { textures, shadow, player, enemies };
  }, []);
  useEffect(() => () => {
    for (const actor of [assets.player, ...assets.enemies]) {
      Object.values(actor.model).forEach(geometry => geometry.dispose()); Object.values(actor.materials).forEach(material => material.dispose());
    }
    Object.values(assets.textures).forEach(texture => texture.dispose()); assets.shadow.dispose();
  }, [assets]);
  return <><PlayerShip asset={assets.player} shadow={assets.shadow} />{([0, 1, 2, 3] as const).map(kind => <EnemyShips key={kind} kind={kind} asset={assets.enemies[kind]} shadow={assets.shadow} />)}</>;
}
