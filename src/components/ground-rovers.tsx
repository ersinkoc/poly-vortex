'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { ROVER_MODEL, ROVER_RULES, roverPose, roverWheelSite } from '@/game/ground-rovers';
import { SURFACES, type ShipModel, type buildShipMaterials, type buildRoverRadar, type buildRoverWheels } from '@/game/ship-models';
import { terrainHeight } from '@/game/terrain';
import { useGame } from '@/game/store';
import { RoverRadar, ROVER_RADAR, roverSweep } from '@/game/rover-radar';
import { buildRoverField, buildRoverFieldMaterial, placeRoverField } from '@/game/rover-field';

const MARKERS = 24;
export default function GroundRovers({ asset, wheels, radar, shadow }: { asset: { model: ShipModel; materials: ReturnType<typeof buildShipMaterials> }; wheels: ReturnType<typeof buildRoverWheels>; radar: ReturnType<typeof buildRoverRadar>; shadow: THREE.Texture }) {
  const layers = useRef<(THREE.InstancedMesh | null)[]>([]), tires = useRef<THREE.InstancedMesh>(null), hubs = useRef<THREE.InstancedMesh>(null), footprints = useRef<THREE.InstancedMesh>(null), sensors = useRef<THREE.InstancedMesh>(null);
  const dishes = useRef<THREE.InstancedMesh>(null), radarLights = useRef<THREE.InstancedMesh>(null), blips = useRef<THREE.InstancedMesh>(null);
  const resources = useMemo(() => ({ body: new THREE.Object3D(), wheel: new THREE.Object3D(), marker: new THREE.Object3D(), head: new THREE.Object3D(), headWorld: new THREE.Matrix4(), scanners: Array.from({ length: ROVER_RULES.capacity }, () => new RoverRadar()), sites: Array<string | null>(ROVER_RULES.capacity).fill(null), field: buildRoverField(), fieldMaterial: buildRoverFieldMaterial(), signalMaterial: new THREE.MeshBasicMaterial({ color: 'white', toneMapped: false }), tint: new THREE.Color(), tire: new THREE.MeshStandardMaterial({ color: '#101613', roughness: 0.97, metalness: 0.06 }), armed: new THREE.Color(0.18, 1.35, 1.08), alert: new THREE.Color(2.4, 1.05, 0.3), primed: new THREE.Color(3.5, 0.16, 0.09) }), []);
  useEffect(() => {
    const owned = [...layers.current, tires.current, hubs.current, footprints.current, sensors.current, dishes.current, radarLights.current, blips.current];
    owned.forEach(m => m?.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
    return () => { owned.forEach(m => m?.dispose()); resources.tire.dispose(); resources.field.dispose(); resources.fieldMaterial.dispose(); resources.signalMaterial.dispose(); };
  }, [resources]);
  useFrame(() => {
    const state = useGame.getState(), units = state.phase === 'playing' || state.phase === 'paused' ? engine.roverBay.units : [], count = Math.min(units.length, ROVER_RULES.capacity), { body, wheel, marker } = resources;
    let sensorCount = 0, blipCount = 0;
    const data = resources.fieldMaterial.uniforms.uData.value as THREE.Vector4[];
    resources.fieldMaterial.uniforms.uReduced.value = state.reducedEffects ? 1 : 0;
    for (let i = count; i < ROVER_RULES.capacity; i++) { data[i].set(0, 0, 0, 0); resources.scanners[i].reset(); resources.sites[i] = null; }
    for (let i = 0; i < count; i++) {
      const rover = units[i], pose = roverPose(rover);
      body.position.set(rover.x, pose.y, rover.z); body.rotation.set(pose.pitch, rover.yaw, pose.bank, 'YXZ'); body.scale.setScalar(ROVER_MODEL.scale); body.updateMatrix();
      layers.current.forEach(m => m?.setMatrixAt(i, body.matrix));
      const echoes = resources.scanners[i].scan(rover, engine.enemies), sweep = roverSweep(rover), primed = rover.state === 'primed';
      const tint = primed ? resources.primed : echoes.length ? resources.alert : resources.armed;
      resources.head.position.set(0, 0.54, -0.16); resources.head.rotation.set(0, state.reducedEffects ? 0 : sweep - rover.yaw, 0); resources.head.scale.setScalar(1); resources.head.updateMatrix();
      resources.headWorld.multiplyMatrices(body.matrix, resources.head.matrix); dishes.current?.setMatrixAt(i, resources.headWorld); radarLights.current?.setMatrixAt(i, resources.headWorld); radarLights.current?.setColorAt(i, tint);
      data[i].set(sweep, rover.state === 'rolling' ? 0 : primed ? 2 : 1, primed ? rover.fuse / ROVER_RULES.fuse : Math.max(0, 1 - rover.parked / ROVER_RULES.lifetime), echoes.length ? 1 : 0);
      if (rover.state !== 'rolling') {
        const key = `${rover.id}:${rover.x}:${rover.z}`;
        if (resources.sites[i] !== key) { placeRoverField(resources.field, i, rover.x, rover.z); resources.sites[i] = key; }
      }
      for (const echo of echoes) {
        const strength = echo.life / ROVER_RADAR.hold;
        marker.position.set(echo.x, terrainHeight(echo.x, echo.z) + 0.09, echo.z); marker.rotation.set(-Math.PI / 2, 0, Math.PI / 4); marker.scale.setScalar(0.13 + strength * 0.1); marker.updateMatrix();
        blips.current?.setMatrixAt(blipCount, marker.matrix); blips.current?.setColorAt(blipCount++, resources.tint.copy(tint).multiplyScalar(0.35 + strength * 0.65));
      }
      let index = i * 4;
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const p = roverWheelSite(rover, side, end);
        wheel.position.set(p.x, terrainHeight(p.x, p.z) + ROVER_RULES.wheelRadius, p.z); wheel.quaternion.copy(body.quaternion); wheel.rotateX(rover.traveled / ROVER_RULES.wheelRadius); wheel.scale.setScalar(ROVER_MODEL.scale); wheel.updateMatrix();
        tires.current?.setMatrixAt(index, wheel.matrix); hubs.current?.setMatrixAt(index++, wheel.matrix);
      }
      marker.position.set(rover.x, terrainHeight(rover.x, rover.z) + 0.025, rover.z); marker.rotation.set(-Math.PI / 2, 0, -rover.yaw); marker.scale.set(1.35 * ROVER_MODEL.scale, 1.8 * ROVER_MODEL.scale, 1); marker.updateMatrix(); footprints.current?.setMatrixAt(i, marker.matrix);
      if (rover.state !== 'rolling') {
        const pulse = state.reducedEffects ? 1 : 0.8 + 0.2 * Math.sin(rover.age * (primed ? 12 : 5));
        for (let j = 0; j < MARKERS; j++) {
          const a = j / MARKERS * Math.PI * 2, x = rover.x + Math.sin(a) * ROVER_RULES.triggerRadius, z = rover.z + Math.cos(a) * ROVER_RULES.triggerRadius;
          marker.position.set(x, terrainHeight(x, z) + 0.06, z); marker.rotation.set(0, a, 0); marker.scale.set(pulse, pulse, pulse); marker.updateMatrix();
          sensors.current?.setMatrixAt(sensorCount, marker.matrix); sensors.current?.setColorAt(sensorCount++, tint);
        }
      }
    }
    for (const m of [...layers.current, footprints.current]) if (m) { m.count = count; m.instanceMatrix.needsUpdate = true; }
    for (const m of [tires.current, hubs.current]) if (m) { m.count = count * 4; m.instanceMatrix.needsUpdate = true; }
    if (sensors.current) { sensors.current.count = sensorCount; sensors.current.instanceMatrix.needsUpdate = true; if (sensors.current.instanceColor) sensors.current.instanceColor.needsUpdate = true; }
    for (const m of [dishes.current, radarLights.current, blips.current]) if (m) { m.count = m === blips.current ? blipCount : count; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  });
  return <>
    {SURFACES.map((surface, i) => <instancedMesh key={surface} ref={m => { layers.current[i] = m; }} args={[asset.model[surface], asset.materials[surface], ROVER_RULES.capacity]} count={0} frustumCulled={false} dispose={null} castShadow={surface === 'hull' || surface === 'armor'} receiveShadow />)}
    <instancedMesh ref={tires} args={[wheels.tire, resources.tire, ROVER_RULES.capacity * 4]} count={0} frustumCulled={false} dispose={null} castShadow receiveShadow />
    <instancedMesh ref={hubs} args={[wheels.hub, asset.materials.metal, ROVER_RULES.capacity * 4]} count={0} frustumCulled={false} dispose={null} />
    <instancedMesh ref={dishes} args={[radar.dish, asset.materials.metal, ROVER_RULES.capacity]} count={0} frustumCulled={false} dispose={null} castShadow />
    <instancedMesh ref={radarLights} args={[radar.signal, resources.signalMaterial, ROVER_RULES.capacity]} count={0} frustumCulled={false} dispose={null} />
    <mesh geometry={resources.field} material={resources.fieldMaterial} frustumCulled={false} dispose={null} />
    <instancedMesh ref={blips} args={[undefined, undefined, ROVER_RULES.capacity * ROVER_RADAR.contacts]} count={0} frustumCulled={false}><ringGeometry args={[0.65, 1, 4]} /><meshBasicMaterial color="white" toneMapped={false} depthWrite={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={footprints} args={[undefined, undefined, ROVER_RULES.capacity]} count={0} frustumCulled={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={shadow} transparent opacity={0.4} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={sensors} args={[undefined, undefined, ROVER_RULES.capacity * MARKERS]} count={0} frustumCulled={false}><boxGeometry args={[0.1, 0.02, 0.055]} /><meshBasicMaterial color="white" toneMapped={false} depthWrite={false} /></instancedMesh>
  </>;
}
