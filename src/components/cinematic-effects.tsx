'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { terrainHeight } from '@/game/terrain';
import { buildVfxTextures, visualNoise, VISUAL_LIMITS } from '@/game/visuals';

const pose = new THREE.Object3D(), tint = new THREE.Color();
const nozzle = new THREE.Vector3(), actorRotation = new THREE.Euler();
const exhaustCapacity = (LIMITS.enemies * 4 + 3) * 2;
const spriteVertex = `attribute vec4 aFx; varying vec2 vUv; varying vec4 vFx;
void main(){vUv=uv;vFx=aFx;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const spriteFragment = `uniform sampler2D uMap; varying vec2 vUv; varying vec4 vFx;
void main(){float a=texture2D(uMap,vUv).a*vFx.a;if(a<.003)discard;gl_FragColor=vec4(vFx.rgb,a);
#include <colorspace_fragment>
}`;
const flameVertex = `attribute float aHeat; varying vec2 vUv; varying float vHeat;
void main(){vUv=uv;vHeat=aHeat;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
// Interpolated UVs can overshoot at triangle edges; clamp before fractional powers
// so a single NaN cannot spread across Bloom's mip chain and black out the scene.
const flameFragment = `uniform float uTime; varying vec2 vUv; varying float vHeat;
void main(){float t=clamp(vUv.y,0.,1.);float width=(.45*(1.-t)+.02)*(1.+sin(t*31.-uTime*28.)*.08);float edge=1.-smoothstep(width*.25,width,abs(vUv.x-.5));
float diamonds=.8+.2*cos(t*36.-uTime*9.);vec3 color=mix(vec3(.12,.85,2.8),vec3(3.7,4.4,5.0),pow(1.-t,3.));
float alpha=edge*pow(1.-t,.8)*(.5+vHeat*.3);if(alpha<.004)discard;gl_FragColor=vec4(color*diamonds,alpha);
#include <colorspace_fragment>
}`;

function spritePool(capacity: number) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const fx = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFx', fx); return { geometry, fx };
}
function setSprite(mesh: THREE.InstancedMesh, pool: ReturnType<typeof spritePool>, index: number, color: THREE.Color, alpha: number) {
  pose.updateMatrix(); mesh.setMatrixAt(index, pose.matrix); pool.fx.setXYZW(index, color.r, color.g, color.b, alpha);
}
function flush(mesh: THREE.InstancedMesh | null, count: number, pool?: ReturnType<typeof spritePool>) {
  if (!mesh) return; mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (pool) pool.fx.needsUpdate = true;
}

function Explosions({ maps }: { maps: ReturnType<typeof buildVfxTextures> }) {
  const quality = useGame(s => s.quality);
  const fire = useRef<THREE.InstancedMesh>(null), smoke = useRef<THREE.InstancedMesh>(null), debris = useRef<THREE.InstancedMesh>(null), scars = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const assets = useMemo(() => ({ fire: spritePool(VISUAL_LIMITS.puffs), smoke: spritePool(VISUAL_LIMITS.puffs), scars: spritePool(VISUAL_LIMITS.scorches), fireUniforms: { uMap: { value: maps.glow } }, smokeUniforms: { uMap: { value: maps.smoke } }, scarUniforms: { uMap: { value: maps.scorch } } }), [maps]);
  useEffect(() => () => { assets.fire.geometry.dispose(); assets.smoke.geometry.dispose(); assets.scars.geometry.dispose(); }, [assets]);
  useFrame(({ camera }) => {
    const s = useGame.getState(), active = s.phase !== 'menu', high = s.quality === 'high', calm = s.reducedEffects;
    let f = 0, m = 0, d = 0, c = 0, lightCount = 0;
    if (active && fire.current && smoke.current && debris.current) for (const b of engine.blasts) {
      if (Math.hypot(b.x - engine.player.x, b.z - engine.player.z) > 28) continue;
      const age = b.age, seed = b.id * 17;
      if (age < 0.7) for (let j = 0; j < (high ? 4 : 2); j++) {
        const a = j * 2.399 + visualNoise(seed, j) * 2, r = age * b.size * (0.3 + j * 0.12);
        pose.position.set(b.x + Math.cos(a) * r, 0.65 + age * b.size * (0.9 + j * 0.15), b.z + Math.sin(a) * r);
        pose.quaternion.copy(camera.quaternion); pose.scale.setScalar(b.size * (0.5 + age * 1.9) * (j ? 0.8 : 1.2));
        tint.set(j === 0 ? b.energy ? '#d5f5ff' : '#fff1be' : b.color).multiplyScalar(calm ? 0.8 : j === 0 ? 4 : 2.1);
        const alpha = Math.min(1, age * 30 + 0.15) * Math.max(0, 1 - age / 0.7) ** 1.6 * (calm ? 0.45 : 0.8);
        setSprite(fire.current, assets.fire, f++, tint, alpha);
      }
      if (!b.energy && high) for (let j = 0; j < 6; j++) {
        const a = j * 2.399 + visualNoise(seed, j + 10), drift = age * b.size * (0.15 + visualNoise(seed, j + 20) * 0.35);
        pose.position.set(b.x + Math.cos(a) * drift, 0.5 + age * b.size * (0.6 + j * 0.07), b.z + Math.sin(a) * drift);
        pose.quaternion.copy(camera.quaternion); pose.rotateZ(visualNoise(seed, j + 30) * 6 + age * 0.2);
        pose.scale.setScalar(b.size * (0.65 + age * 0.85) * (0.75 + visualNoise(seed, j + 40) * 0.5));
        tint.set(age < 0.25 ? '#6c6456' : '#59616b').multiplyScalar(0.8 + j * 0.04);
        setSprite(smoke.current, assets.smoke, m++, tint, Math.min(0.55, age * 2) * Math.max(0, 1 - age / 2.4));
      }
      if (!b.energy && high) for (let j = 0; j < 8; j++) {
        const a = j * 2.399 + visualNoise(seed, j + 50) * 2, speed = 1.5 + visualNoise(seed, j + 60) * 3, lift = 2 + visualNoise(seed, j + 70) * 4;
        const x = b.x + Math.cos(a) * age * speed, z = b.z + Math.sin(a) * age * speed;
        pose.position.set(x, Math.max(terrainHeight(x, z) + 0.06, 0.7 + lift * age - 4.9 * age * age), z);
        pose.rotation.set(age * (3 + j), a + age * 4, age * (j - 3)); pose.scale.setScalar(b.size * (0.6 + visualNoise(seed, j + 80)) * Math.min(1, (2.4 - age) * 2));
        pose.updateMatrix(); debris.current.setMatrixAt(d++, pose.matrix);
      }
      if (high && !calm && age < 0.45 && lightCount < VISUAL_LIMITS.lights && Math.hypot(b.x - engine.player.x, b.z - engine.player.z) < 18) {
        const light = lights.current[lightCount++]; if (light) { light.position.set(b.x, 1.5, b.z); light.color.set(b.color); light.intensity = (b.energy ? 12 : 32) * b.size * (1 - age / 0.45) ** 2; }
      }
    }
    if (scars.current && active && high) for (const scar of engine.scorches) {
      pose.position.set(scar.x, terrainHeight(scar.x, scar.z) + 0.035, scar.z); pose.rotation.set(-Math.PI / 2, 0, visualNoise(Math.floor(scar.x * 23), Math.floor(scar.z * 17)) * 6); pose.scale.setScalar(scar.size * 2.2);
      tint.set('#101516'); setSprite(scars.current, assets.scars, c++, tint, Math.min(0.8, Math.max(0, (22 - scar.age) / 6)));
    }
    flush(fire.current, f, assets.fire); flush(smoke.current, m, assets.smoke); flush(debris.current, d); flush(scars.current, c, assets.scars);
    lights.current.forEach((light, i) => { if (light && i >= lightCount) light.intensity = 0; });
  });
  return <>
    <instancedMesh ref={scars} args={[assets.scars.geometry, undefined, VISUAL_LIMITS.scorches]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.scarUniforms} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={fire} args={[assets.fire.geometry, undefined, VISUAL_LIMITS.puffs]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.fireUniforms} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={smoke} args={[assets.smoke.geometry, undefined, VISUAL_LIMITS.puffs]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.smokeUniforms} transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={debris} args={[undefined, undefined, VISUAL_LIMITS.debris]} count={0} frustumCulled={false}><boxGeometry args={[0.13, 0.035, 0.22]} /><meshStandardMaterial color="#a3a8a4" metalness={0.85} roughness={0.38} /></instancedMesh>
    {quality === 'high' && Array.from({ length: VISUAL_LIMITS.lights }, (_, i) => <pointLight key={i} ref={node => { lights.current[i] = node; }} intensity={0} distance={10} decay={2} />)}
  </>;
}

function Exhaust() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const assets = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const heat = new THREE.InstancedBufferAttribute(new Float32Array(exhaustCapacity), 1).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('aHeat', heat);
    return { geometry, heat, uniforms: { uTime: { value: 0 } } };
  }, []);
  useEffect(() => () => assets.geometry.dispose(), [assets]);
  useFrame(({ clock }) => {
    if (!mesh.current) return; const s = useGame.getState(), menu = s.phase === 'menu', p = engine.player; let count = 0;
    assets.uniforms.uTime.value = s.reducedEffects ? 0 : menu ? clock.elapsedTime : engine.time;
    const add = (x: number, z: number, y: number, angle: number, scale: number, offset: number, localY: number, tail: number, power: number, pitch = 0, roll = 0) => {
      nozzle.set(offset, localY, -tail).applyEuler(actorRotation.set(pitch, angle, roll, 'XYZ'));
      pose.position.set(x + nozzle.x * scale, y + nozzle.y * scale, z + nozzle.z * scale);
      pose.rotation.set(-Math.PI / 2, angle, 0, 'YXZ'); pose.scale.set(0.35 * scale, scale * power, 1); pose.updateMatrix(); mesh.current!.setMatrixAt(count, pose.matrix); assets.heat.setX(count++, power);
      // Crossed ribbons retain volume at an oblique camera angle.
      pose.rotation.set(0, angle + Math.PI / 2, -Math.PI / 2, 'YXZ'); pose.scale.set(0.25 * scale, scale * power, 1); pose.updateMatrix(); mesh.current!.setMatrixAt(count, pose.matrix); assets.heat.setX(count++, power);
    };
    const angle = menu ? clock.elapsedTime * 0.1 + 0.7 : p.angle, scale = menu ? 2.25 : 0.83;
    const power = menu ? 0.85 : p.dashTime > 0 ? 3.2 : 0.7 + Math.min(1, Math.hypot(p.vx, p.vz) / 8) * 0.8;
    for (const offset of [-0.61, 0, 0.61]) add(p.x, p.z, 0.95 + Math.sin(clock.elapsedTime * 2.5) * 0.045, angle, scale, offset, -0.09, 1.3, power, menu ? -0.04 : p.vz * 0.009, menu ? Math.sin(clock.elapsedTime * 0.7) * 0.025 : -p.vx * 0.025);
    if (s.quality === 'high') for (const e of engine.enemies) {
      if (e.kind !== 0 && e.kind !== 2) continue;
      const orbit = menu ? clock.elapsedTime * 0.035 : 0, x = e.x * Math.cos(orbit) - e.z * Math.sin(orbit), z = e.x * Math.sin(orbit) + e.z * Math.cos(orbit);
      const yaw = Math.atan2((menu ? 0 : p.x) - x, (menu ? 0 : p.z) - z), size = e.radius * (menu ? 1.45 : 1);
      const height = e.radius * 0.75 + 0.3 + Math.sin(clock.elapsedTime * 2 + e.id) * 0.045;
      const pitch = Math.sin(e.age + e.id) * 0.025, roll = Math.cos(e.age * 1.5 + e.id) * (e.kind === 0 ? 0.09 : 0.025);
      if (e.kind === 0) for (const side of [-1, 1]) add(x, z, height, yaw, size, side * 0.37, -0.05, 0.862, 0.75, pitch, roll);
      else for (const side of [-1, 1]) { add(x, z, height, yaw, size, side * 0.74, -0.03, 1.03, 0.6, pitch, roll); add(x, z, height, yaw, size, side * 0.32, -0.13, 0.949, 0.48, pitch, roll); }
    }
    mesh.current.count = count; mesh.current.instanceMatrix.needsUpdate = true; assets.heat.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[assets.geometry, undefined, exhaustCapacity]} count={0} frustumCulled={false}><shaderMaterial vertexShader={flameVertex} fragmentShader={flameFragment} uniforms={assets.uniforms} transparent blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></instancedMesh>;
}

function Tracers({ maps }: { maps: ReturnType<typeof buildVfxTextures> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const assets = useMemo(() => ({ ...spritePool(LIMITS.bolts), uniforms: { uMap: { value: maps.glow } } }), [maps]);
  useEffect(() => () => assets.geometry.dispose(), [assets]);
  useFrame(() => {
    if (!mesh.current) return; let count = 0;
    if (useGame.getState().phase !== 'menu') for (const b of engine.bolts) {
      const a = Math.atan2(b.vx, b.vz); pose.position.set(b.x - Math.sin(a) * 0.15, 0.71, b.z - Math.cos(a) * 0.15); pose.rotation.set(-Math.PI / 2, a, 0, 'YXZ'); pose.scale.set(b.enemy ? 0.6 : 0.42, b.enemy ? 0.6 : 1.6, 1);
      tint.set(b.enemy ? '#ff3973' : '#bdf796').multiplyScalar(2); setSprite(mesh.current, assets, count++, tint, 0.42);
    }
    flush(mesh.current, count, assets);
  });
  return <instancedMesh ref={mesh} args={[assets.geometry, undefined, LIMITS.bolts]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></instancedMesh>;
}

export default function CinematicEffects() {
  const maps = useMemo(() => buildVfxTextures(), []);
  useEffect(() => () => Object.values(maps).forEach(map => map.dispose()), [maps]);
  return <><Exhaust /><Tracers maps={maps} /><Explosions maps={maps} /></>;
}
