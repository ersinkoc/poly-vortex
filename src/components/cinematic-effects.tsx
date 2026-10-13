'use client';

import { hostileBoltColor } from '@/game/enemy-weapons';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { renderQuality } from '@/game/render-budget';
import { FRAME_ENGINES } from '@/game/flightframes';
import { terrainHeight } from '@/game/terrain';
import { buildVfxTextures, DESTRUCTION, visualNoise, VISUAL_LIMITS, wreckFragment } from '@/game/visuals';
import { explosionFireFragment, explosionSmokeFragment, explosionVertex } from '@/game/explosion-shaders';
import { DAMAGE_LIMITS, DamageTrail, damageHeat, hullDamage } from '@/game/ship-damage';

const pose = new THREE.Object3D(), tint = new THREE.Color();
const nozzle = new THREE.Vector3(), actorRotation = new THREE.Euler();
const exhaustCapacity = (LIMITS.enemies * 4 + 4) * 2;
const spriteVertex = `attribute vec4 aFx; varying vec2 vUv; varying vec4 vFx;
void main(){vUv=uv;vFx=aFx;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const spriteFragment = `uniform sampler2D uMap; varying vec2 vUv; varying vec4 vFx;
void main(){float a=texture2D(uMap,vUv).a*vFx.a;if(a<.003)discard;gl_FragColor=vec4(vFx.rgb,a);
#include <colorspace_fragment>
}`;
const flameVertex = `attribute float aHeat; attribute float aDamage; varying vec2 vUv; varying float vHeat; varying float vDamage;
void main(){vUv=uv;vHeat=aHeat;vDamage=aDamage;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
// Interpolated UVs can overshoot at triangle edges; clamp before fractional powers
// so a single NaN cannot spread across Bloom's mip chain and black out the scene.
const flameFragment = `uniform float uTime; varying vec2 vUv; varying float vHeat; varying float vDamage;
void main(){float t=clamp(vUv.y,0.,1.);float width=(.45*(1.-t)+.02)*(1.+sin(t*31.-uTime*28.)*.08);float edge=1.-smoothstep(width*.25,width,abs(vUv.x-.5));
float diamonds=.8+.2*cos(t*36.-uTime*9.);vec3 color=mix(vec3(.12,.85,2.8),vec3(3.7,4.4,5.0),pow(1.-t,3.));
color=mix(color,mix(vec3(3.4,.42,.04),vec3(4.5,2.6,.6),pow(1.-t,3.)),vDamage*.75);
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

function explosionPool(capacity: number) {
  const pool = spritePool(capacity);
  const evolution = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  pool.geometry.setAttribute('aEvolution', evolution); return { ...pool, evolution };
}
function setExplosion(mesh: THREE.InstancedMesh, pool: ReturnType<typeof explosionPool>, index: number, alpha: number, age: number, seed: number, mode: number) {
  pool.evolution.setXYZW(index, age, seed, mode, 0); setSprite(mesh, pool, index, tint, alpha);
}

function Explosions({ maps }: { maps: ReturnType<typeof buildVfxTextures> }) {
  const quality = useGame(renderQuality);
  const fire = useRef<THREE.InstancedMesh>(null), smoke = useRef<THREE.InstancedMesh>(null), debris = useRef<THREE.InstancedMesh>(null), scars = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const aftermath = useRef({ phase: useGame.getState().phase, time: 0 });
  const assets = useMemo(() => ({ fire: explosionPool(VISUAL_LIMITS.puffs), smoke: explosionPool(VISUAL_LIMITS.puffs), scars: spritePool(VISUAL_LIMITS.scorches), fireUniforms: { uMap: { value: maps.glow }, uNoise: { value: maps.volume }, uSamples: { value: 8 } }, smokeUniforms: { uNoise: { value: maps.volume } }, scarUniforms: { uMap: { value: maps.scorch } } }), [maps]);
  useEffect(() => () => { assets.fire.geometry.dispose(); assets.smoke.geometry.dispose(); assets.scars.geometry.dispose(); }, [assets]);
  useFrame(({ camera }, delta) => {
    const s = useGame.getState(), active = s.phase !== 'menu', high = renderQuality(s) === 'high', calm = s.reducedEffects;
    if (aftermath.current.phase !== s.phase) { aftermath.current.phase = s.phase; aftermath.current.time = 0; }
    if (s.phase === 'dead' || s.phase === 'won') aftermath.current.time += Math.min(delta, 0.1);
    const endTime = aftermath.current.time; assets.fireUniforms.uSamples.value = high ? 8 : 6;
    let f = 0, m = 0, d = 0, c = 0, lightCount = 0;
    // New impacts receive available slots before lingering smoke and embers.
    if (active && fire.current && smoke.current && debris.current) for (let i = engine.blasts.length - 1; i >= 0; i--) {
      const b = engine.blasts[i]; if (Math.hypot(b.x - engine.player.x, b.z - engine.player.z) > 28) continue;
      const age = b.age + endTime, seed = b.id * 17, floor = terrainHeight(b.x, b.z), height = b.y ?? floor + 0.7;
      if (age >= (b.energy ? 2.4 : DESTRUCTION.life)) continue;
      if (age < (b.energy ? 0.7 : 0.12) && f < VISUAL_LIMITS.puffs) {
        pose.position.set(b.x, height, b.z); pose.quaternion.copy(camera.quaternion); pose.scale.setScalar(b.size * (0.55 + age * 3));
        tint.set(b.energy ? b.color : '#fff4cd').multiplyScalar(calm ? 1 : 3.2);
        setExplosion(fire.current, assets.fire, f++, Math.max(0, 1 - age / (b.energy ? 0.7 : 0.12)) * (calm ? 0.4 : 0.9), age, seed, 2);
      }
      if (!b.energy && age < 0.95) for (let j = 0; j < (high ? 3 : 2) && f < VISUAL_LIMITS.puffs; j++) {
        const a = j * 2.399 + visualNoise(seed, j) * 2, spread = Math.sqrt(Math.max(0, age)) * b.size * (0.16 + j * 0.08);
        pose.position.set(b.x + Math.cos(a) * spread, height + age * b.size * (0.55 + j * 0.1), b.z + Math.sin(a) * spread);
        pose.quaternion.copy(camera.quaternion); pose.rotateZ(a * 0.3);
        pose.scale.setScalar(b.size * (0.55 + Math.sqrt(age) * 0.85) * (j ? 0.75 : 1));
        tint.set('#ffffff');
        setExplosion(fire.current, assets.fire, f++, Math.min(1, age * 25 + 0.2) * Math.max(0, 1 - age / 0.95) * (calm ? 0.45 : 0.85), age, seed + j * 3.1, 0);
      }
      if (!b.energy && age < DESTRUCTION.fireLife) for (let j = 0; j < (high ? 2 : 1) && f < VISUAL_LIMITS.puffs; j++) {
        const a = j * 2.399 + visualNoise(seed, j + 90) * 2, spread = b.size * 0.3;
        const decay = Math.max(0, 1 - age / DESTRUCTION.fireLife), settling = Math.max(floor + 0.12, height - age * age * 2);
        pose.position.set(b.x + Math.cos(a) * spread, settling + b.size * 0.22 * decay, b.z + Math.sin(a) * spread);
        pose.quaternion.copy(camera.quaternion); pose.rotateZ(calm ? 0 : Math.sin(age * 4 + j) * 0.12);
        pose.scale.set(b.size * 0.5 * decay, b.size * 0.9 * decay, 1); tint.set('#ffffff');
        setExplosion(fire.current, assets.fire, f++, Math.min(1, age * 6) * decay * (calm ? 0.3 : 0.75), age, seed + j * 5, 1);
      }
      if (!b.energy) for (let j = 0; j < (high ? 4 : 2) && m < VISUAL_LIMITS.puffs; j++) {
        const t = Math.max(0, age - j * 0.09), a = j * 2.399 + visualNoise(seed, j + 10);
        const drift = t * b.size * (0.08 + visualNoise(seed, j + 20) * 0.13);
        pose.position.set(b.x + Math.cos(a) * drift + t * 0.17, height + t * b.size * (0.32 + j * 0.045), b.z + Math.sin(a) * drift);
        pose.quaternion.copy(camera.quaternion); pose.rotateZ(visualNoise(seed, j + 30) * 6 + t * 0.1);
        pose.scale.setScalar(Math.min(6.5, b.size * (0.65 + t * 0.7) * (0.8 + visualNoise(seed, j + 40) * 0.4))); tint.set('#ffffff');
        setExplosion(smoke.current, assets.smoke, m++, Math.min(0.65, t * 2) * Math.max(0, 1 - age / DESTRUCTION.smokeLife) * (calm ? 0.5 : 1), t, seed + j * 4, 0);
      }
      // A short, low pressure front throws soil outwards rather than a neon ring.
      if (!b.energy && age < 1.2) for (let j = 0; j < (high ? 2 : 1) && m < VISUAL_LIMITS.puffs; j++) {
        const a = j * Math.PI + seed, spread = b.size * (0.3 + age * 1.9);
        pose.position.set(b.x + Math.cos(a) * spread, floor + 0.15 + age * 0.2, b.z + Math.sin(a) * spread);
        pose.quaternion.copy(camera.quaternion); pose.scale.set(b.size * (0.4 + age * 1.3), b.size * (0.14 + age * 0.28), 1); tint.set('#ffffff');
        setExplosion(smoke.current, assets.smoke, m++, Math.sin(Math.min(1, age / 1.2) * Math.PI) * (calm ? 0.18 : 0.45), age, seed + j * 7, 1);
      }
      if (!b.energy) for (let j = 0; j < (high ? DESTRUCTION.debrisCount : 4) && d < VISUAL_LIMITS.debris; j++) {
        const part = wreckFragment(endTime ? { ...b, age } : b, j, terrainHeight), panel = j % 3 !== 0;
        pose.position.set(part.x, part.y, part.z);
        pose.rotation.set(part.spin * (3 + j) * (1 - part.settle), part.angle + part.spin * 4, part.spin * (j - 3) * (1 - part.settle));
        pose.scale.set(part.size * (panel ? 1.8 : 0.9) * part.fade, part.size * (panel ? 0.12 : 0.7) * part.fade, part.size * part.fade); pose.updateMatrix();
        debris.current.setMatrixAt(d, pose.matrix); tint.set(j % 3 === 0 ? '#30363a' : '#939c9f'); debris.current.setColorAt(d++, tint);
        if (high && !calm && j < 3 && age < 1.3 && f < VISUAL_LIMITS.puffs) {
          pose.quaternion.copy(camera.quaternion); pose.scale.setScalar(part.size * (1 - age / 1.3) * 1.2); tint.set('#ff9e35').multiplyScalar(2.2);
          setExplosion(fire.current, assets.fire, f++, Math.max(0, 1 - age / 1.3) * 0.8, age, seed, 2);
        }
      }
      if (high && !calm && age < 0.35 && lightCount < VISUAL_LIMITS.lights && Math.hypot(b.x - engine.player.x, b.z - engine.player.z) < 18) {
        const light = lights.current[lightCount++]; if (light) { light.position.set(b.x, height + 0.5, b.z); light.color.set(b.energy ? b.color : '#ffae5a'); light.intensity = (b.energy ? 12 : 24) * b.size * Math.exp(-age * 12); }
      }
    }
    if (scars.current && active && high) for (const scar of engine.scorches) {
      pose.position.set(scar.x, terrainHeight(scar.x, scar.z) + 0.035, scar.z); pose.rotation.set(-Math.PI / 2, 0, visualNoise(Math.floor(scar.x * 23), Math.floor(scar.z * 17)) * 6); pose.scale.setScalar(scar.size * 2.2);
      tint.set('#101516'); setSprite(scars.current, assets.scars, c++, tint, Math.min(0.8, Math.max(0, (22 - scar.age - endTime) / 6)));
    }
    flush(fire.current, f, assets.fire); flush(smoke.current, m, assets.smoke); flush(debris.current, d); flush(scars.current, c, assets.scars);
    assets.fire.evolution.needsUpdate = true; assets.smoke.evolution.needsUpdate = true;
    if (debris.current?.instanceColor) debris.current.instanceColor.needsUpdate = true;
    lights.current.forEach((light, i) => { if (light && i >= lightCount) light.intensity = 0; });
  });
  return <>
    <instancedMesh ref={scars} args={[assets.scars.geometry, undefined, VISUAL_LIMITS.scorches]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.scarUniforms} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={fire} args={[assets.fire.geometry, undefined, VISUAL_LIMITS.puffs]} count={0} frustumCulled={false}><shaderMaterial vertexShader={explosionVertex} fragmentShader={explosionFireFragment} uniforms={assets.fireUniforms} transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={smoke} args={[assets.smoke.geometry, undefined, VISUAL_LIMITS.puffs]} count={0} frustumCulled={false}><shaderMaterial vertexShader={explosionVertex} fragmentShader={explosionSmokeFragment} uniforms={assets.smokeUniforms} transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={debris} args={[undefined, undefined, VISUAL_LIMITS.debris]} count={0} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#ffffff" metalness={0.78} roughness={0.55} /></instancedMesh>
    {quality === 'high' && Array.from({ length: VISUAL_LIMITS.lights }, (_, i) => <pointLight key={i} ref={node => { lights.current[i] = node; }} intensity={0} distance={10} decay={2} />)}
  </>;
}

function Exhaust() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const assets = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const heat = new THREE.InstancedBufferAttribute(new Float32Array(exhaustCapacity), 1).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('aHeat', heat);
    const damage = new THREE.InstancedBufferAttribute(new Float32Array(exhaustCapacity), 1).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('aDamage', damage);
    return { geometry, heat, damage, uniforms: { uTime: { value: 0 } } };
  }, []);
  useEffect(() => () => assets.geometry.dispose(), [assets]);
  useFrame(({ clock }) => {
    if (!mesh.current) return; const s = useGame.getState(), menu = s.phase === 'menu', p = engine.player; let count = 0;
    assets.uniforms.uTime.value = s.reducedEffects ? 0 : menu ? clock.elapsedTime : engine.time;
    const add = (x: number, z: number, y: number, angle: number, scale: number, offset: number, localY: number, tail: number, power: number, pitch = 0, roll = 0, damage = 0) => {
      nozzle.set(offset, localY, -tail).applyEuler(actorRotation.set(pitch, angle, roll, 'XYZ'));
      pose.position.set(x + nozzle.x * scale, y + nozzle.y * scale, z + nozzle.z * scale);
      pose.rotation.set(-Math.PI / 2, angle, 0, 'YXZ'); pose.scale.set(0.35 * scale, scale * power, 1); pose.updateMatrix(); mesh.current!.setMatrixAt(count, pose.matrix); assets.damage.setX(count, damage); assets.heat.setX(count++, power);
      // Crossed ribbons retain volume at an oblique camera angle.
      pose.rotation.set(0, angle + Math.PI / 2, -Math.PI / 2, 'YXZ'); pose.scale.set(0.25 * scale, scale * power, 1); pose.updateMatrix(); mesh.current!.setMatrixAt(count, pose.matrix); assets.damage.setX(count, damage); assets.heat.setX(count++, power);
    };
    const angle = menu ? clock.elapsedTime * 0.1 + 0.7 : p.angle, scale = menu ? 2.25 : 0.83;
    const power = menu ? 0.85 : p.dashTime > 0 ? 3.2 : 0.7 + Math.min(1, Math.hypot(p.vx, p.vz) / 8) * 0.8;
    const heat = menu ? 0 : damageHeat(hullDamage(p.hp, p.maxHp));
    const flicker = s.reducedEffects ? 1 : 1 - heat * 0.22 * (0.5 + 0.5 * Math.sin(engine.time * 27));
    const frame = menu ? s.ship : s.activeShip;
    if (menu || p.hp > 0) for (const [x,y,z] of FRAME_ENGINES[frame]) add(p.x, p.z, 0.95 + Math.sin(clock.elapsedTime * 2.5) * 0.045, angle, scale, x, y, -z, power * flicker, menu ? -0.04 : p.vz * 0.009, menu ? Math.sin(clock.elapsedTime * 0.7) * 0.025 : -p.vx * 0.025, heat);
    if (renderQuality(s) === 'high') for (const e of engine.enemies) {
      if (e.kind !== 0 && e.kind !== 2) continue;
      const orbit = menu ? clock.elapsedTime * 0.035 : 0, x = e.x * Math.cos(orbit) - e.z * Math.sin(orbit), z = e.x * Math.sin(orbit) + e.z * Math.cos(orbit);
      const yaw = Math.atan2((menu ? 0 : p.x) - x, (menu ? 0 : p.z) - z), size = e.radius * (menu ? 1.45 : 1);
      const height = e.radius * 0.75 + 0.3 + Math.sin(clock.elapsedTime * 2 + e.id) * 0.045;
      const pitch = Math.sin(e.age + e.id) * 0.025, roll = Math.cos(e.age * 1.5 + e.id) * (e.kind === 0 ? 0.09 : 0.025);
      if (e.kind === 0) for (const side of [-1, 1]) add(x, z, height, yaw, size, side * 0.37, -0.05, 0.862, 0.75, pitch, roll);
      else for (const side of [-1, 1]) { add(x, z, height, yaw, size, side * 0.74, -0.03, 1.03, 0.6, pitch, roll); add(x, z, height, yaw, size, side * 0.32, -0.13, 0.949, 0.48, pitch, roll); }
    }
    mesh.current.count = count; mesh.current.instanceMatrix.needsUpdate = true; assets.heat.needsUpdate = true; assets.damage.needsUpdate = true;
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
      const a = Math.atan2(b.vx, b.vz); pose.position.set(b.x - Math.sin(a) * 0.15, (b.y ?? 0.7) + 0.01, b.z - Math.cos(a) * 0.15); pose.rotation.set(-Math.PI / 2, a, 0, 'YXZ'); pose.scale.set(b.enemy ? 0.6 : b.drone !== undefined ? 0.3 : 0.42, b.enemy ? 0.6 : b.drone !== undefined ? 1.2 : 1.6, 1);
      tint.set(b.enemy ? hostileBoltColor(b) : b.drone !== undefined ? '#78e8ff' : '#bdf796').multiplyScalar(2); setSprite(mesh.current, assets, count++, tint, 0.42);
    }
    flush(mesh.current, count, assets);
  });
  return <instancedMesh ref={mesh} args={[assets.geometry, undefined, LIMITS.bolts]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></instancedMesh>;
}

function HullDamageFX({ maps }: { maps: ReturnType<typeof buildVfxTextures> }) {
  const smoke = useRef<THREE.InstancedMesh>(null), sparks = useRef<THREE.InstancedMesh>(null);
  const memory = useRef({ run: -1, time: 0, phase: 'menu' });
  const assets = useMemo(() => ({ smoke: spritePool(DAMAGE_LIMITS.smoke), sparks: spritePool(DAMAGE_LIMITS.sparks), trail: new DamageTrail(), origins: [new THREE.Vector3(), new THREE.Vector3()], smokeUniforms: { uMap: { value: maps.smoke } }, sparkUniforms: { uMap: { value: maps.glow } } }), [maps]);
  useEffect(() => () => { assets.smoke.geometry.dispose(); assets.sparks.geometry.dispose(); }, [assets]);
  useFrame(({ camera, clock }) => {
    const s = useGame.getState(), p = engine.player, menu = s.phase === 'menu', last = memory.current;
    if (last.run !== s.runId || engine.time < last.time || menu && last.phase !== 'menu') assets.trail.reset();
    const dt = s.phase === 'playing' && last.run === s.runId ? Math.max(0, engine.time - last.time) : 0;
    last.run = s.runId; last.time = engine.time; last.phase = s.phase;
    const damage = menu ? 0 : hullDamage(p.hp, p.maxHp);
    for (let i = 0; i < 2; i++) assets.origins[i].set(i ? -0.6 : 0.75, 0.2, i ? -0.3 : -0.45).applyEuler(actorRotation.set(p.vz * 0.009, p.angle, -p.vx * 0.025)).multiplyScalar(0.83).add(nozzle.set(p.x, 0.95 + Math.sin(clock.elapsedTime * 2.5) * 0.045, p.z));
    assets.trail.advance(dt, damage, assets.origins, renderQuality(s) === 'high', s.reducedEffects);
    let m = 0, f = 0;
    if (!menu && p.hp > 0 && smoke.current && sparks.current) {
      for (const particle of assets.trail.smoke) {
        if (particle.age >= particle.life || m >= (renderQuality(s) === 'high' ? DAMAGE_LIMITS.smoke : 8)) continue;
        pose.position.set(particle.x, particle.y, particle.z); pose.quaternion.copy(camera.quaternion); pose.rotateZ(particle.spin + particle.age * 0.1); pose.scale.setScalar(particle.size + particle.age * 0.75);
        tint.set('#59616a'); setSprite(smoke.current, assets.smoke, m++, tint, Math.min(0.55, particle.age * 3) * Math.max(0, 1 - particle.age / particle.life));
      }
      for (const particle of assets.trail.sparks) {
        if (particle.age >= particle.life) continue;
        pose.position.set(particle.x, particle.y, particle.z); pose.quaternion.copy(camera.quaternion); pose.scale.setScalar(particle.size * (1 - particle.age / particle.life));
        tint.set('#ffad58').multiplyScalar(s.reducedEffects ? 1 : 3); setSprite(sparks.current, assets.sparks, f++, tint, 0.9 * (1 - particle.age / particle.life));
      }
    }
    flush(smoke.current, m, assets.smoke); flush(sparks.current, f, assets.sparks);
  });
  return <>
    <instancedMesh ref={smoke} args={[assets.smoke.geometry, undefined, DAMAGE_LIMITS.smoke]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.smokeUniforms} transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={sparks} args={[assets.sparks.geometry, undefined, DAMAGE_LIMITS.sparks]} count={0} frustumCulled={false}><shaderMaterial vertexShader={spriteVertex} fragmentShader={spriteFragment} uniforms={assets.sparkUniforms} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></instancedMesh>
  </>;
}

export default function CinematicEffects() {
  const maps = useMemo(() => buildVfxTextures(), []);
  useEffect(() => () => Object.values(maps).forEach(map => map.dispose()), [maps]);
  return <><Exhaust /><Tracers maps={maps} /><Explosions maps={maps} /><HullDamageFX maps={maps} /></>;
}
