'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import FirstAidSupplies from './first-aid-supplies';
import Ordnance from './ordnance';
import ImpactShield from './impact-shield';
import BarrierShell from './barrier-shell';

const transform = new THREE.Object3D(), tint = new THREE.Color(), right = new THREE.Vector3();
const damageVertex = `attribute float aGlyph; attribute vec3 aTint; varying vec2 vUv; varying vec3 vTint; varying float vGlyph;
void main(){vUv=uv;vTint=aTint;vGlyph=aGlyph;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const damageFragment = `uniform sampler2D uAtlas; varying vec2 vUv; varying vec3 vTint; varying float vGlyph;
void main(){vec4 ink=texture2D(uAtlas,vec2((vUv.x+vGlyph)/16.,vUv.y));gl_FragColor=vec4(vTint,ink.a); if(gl_FragColor.a<.02)discard;
#include <colorspace_fragment>
}`;

function DamageNumbers() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const resources = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 64;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('A 2D context is required for damage glyphs.');
    ctx.font = 'bold 46px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'white';
    [...'0123456789!+×CRT'].forEach((char, i) => ctx.fillText(char, i * 64 + 32, 33));
    const atlas = new THREE.CanvasTexture(canvas);
    const glyphs = new THREE.InstancedBufferAttribute(new Float32Array(LIMITS.damageTexts * 6), 1).setUsage(THREE.DynamicDrawUsage);
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(LIMITS.damageTexts * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    return { atlas, glyphs, colors, uniforms: { uAtlas: { value: atlas } } };
  }, []);
  useEffect(() => () => resources.atlas.dispose(), [resources]);
  useFrame(({ camera }) => {
    if (!mesh.current) return; let count = 0;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    if (useGame.getState().phase !== 'menu') for (const d of engine.damageTexts) {
      const digits = `${Math.min(99999, d.value)}${d.critical ? '!' : ''}`;
      const progress = 1 - d.life / 0.75; const size = d.critical ? 0.7 : 0.5;
      tint.set(d.critical ? '#ffe69d' : '#d4e8eb').multiplyScalar(Math.min(1, d.life * 4));
      for (let i = 0; i < digits.length; i++) {
        const offset = (i - (digits.length - 1) / 2) * size * 0.65;
        transform.position.set(d.x + right.x * offset, 1.6 + progress * 1.8 + right.y * offset, d.z + right.z * offset);
        transform.quaternion.copy(camera.quaternion); transform.scale.set(size, size, size); transform.updateMatrix(); mesh.current.setMatrixAt(count, transform.matrix);
        resources.glyphs.setX(count, digits[i] === '!' ? 10 : Number(digits[i])); resources.colors.setXYZ(count, tint.r, tint.g, tint.b); count++;
      }
    }
    mesh.current.count = count; mesh.current.instanceMatrix.needsUpdate = true; resources.glyphs.needsUpdate = true; resources.colors.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, LIMITS.damageTexts * 6]} frustumCulled={false}>
    <planeGeometry args={[1, 1]}><primitive attach="attributes-aGlyph" object={resources.glyphs} /><primitive attach="attributes-aTint" object={resources.colors} /></planeGeometry>
    <shaderMaterial vertexShader={damageVertex} fragmentShader={damageFragment} uniforms={resources.uniforms} transparent depthWrite={false} toneMapped={false} />
  </instancedMesh>;
}

function Battlefield() {
  const waves = useRef<THREE.InstancedMesh>(null), flashes = useRef<THREE.InstancedMesh>(null), danger = useRef<THREE.InstancedMesh>(null), elite = useRef<THREE.InstancedMesh>(null);
  const crateEdges = useRef<THREE.InstancedMesh>(null);
  const crates = useRef<THREE.InstancedMesh>(null), supplies = useRef<THREE.InstancedMesh>(null), icons = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const active = useGame.getState().phase !== 'menu';
    if (waves.current) {
      engine.shockwaves.forEach((w, i) => {
        const p = 1 - w.life / w.maxLife; transform.position.set(w.x, 0.12, w.z); transform.rotation.set(-Math.PI / 2, 0, 0); transform.scale.setScalar(Math.max(0.05, w.radius * p)); transform.updateMatrix();
        waves.current!.setMatrixAt(i, transform.matrix); waves.current!.setColorAt(i, tint.set(w.color).multiplyScalar(w.life / w.maxLife * 2));
        if (flashes.current) { transform.position.set(w.x, 0.65, w.z); transform.rotation.set(0, 0, 0); transform.scale.setScalar(Math.max(0.01, w.radius * 0.3 * (w.life / w.maxLife) ** 2)); transform.updateMatrix(); flashes.current.setMatrixAt(i, transform.matrix); flashes.current.setColorAt(i, tint); }
      }); waves.current.count = active ? engine.shockwaves.length : 0; waves.current.instanceMatrix.needsUpdate = true; if (waves.current.instanceColor) waves.current.instanceColor.needsUpdate = true;
      if (flashes.current) { flashes.current.count = waves.current.count; flashes.current.instanceMatrix.needsUpdate = true; if (flashes.current.instanceColor) flashes.current.instanceColor.needsUpdate = true; }
    }
    if (danger.current) {
      engine.hazards.forEach((h, i) => {
        transform.position.set(h.x, 0.07, h.z); transform.rotation.set(-Math.PI / 2, 0, clock.elapsedTime * 0.6); transform.scale.setScalar(h.radius); transform.updateMatrix(); danger.current!.setMatrixAt(i, transform.matrix);
        danger.current!.setColorAt(i, tint.set('#ff497b').multiplyScalar(h.detonated ? 4 : 0.65 + Math.sin(clock.elapsedTime * (h.age / h.delay * 9 + 3)) * 0.3 + h.age / h.delay));
      }); danger.current.count = active ? engine.hazards.length : 0; danger.current.instanceMatrix.needsUpdate = true; if (danger.current.instanceColor) danger.current.instanceColor.needsUpdate = true;
    }
    if (elite.current) {
      let n = 0; if (active) for (const e of engine.enemies) if (e.elite) { transform.position.set(e.x, 0.1, e.z); transform.rotation.set(-Math.PI / 2, 0, clock.elapsedTime); transform.scale.setScalar(e.radius * 1.7); transform.updateMatrix(); elite.current.setMatrixAt(n++, transform.matrix); }
      elite.current.count = n; elite.current.instanceMatrix.needsUpdate = true;
    }
    if (crates.current) {
      engine.caches.forEach((c, i) => { transform.position.set(c.x, 0.5 + Math.sin(clock.elapsedTime * 2 + i) * 0.08, c.z); transform.rotation.set(0, clock.elapsedTime * 0.4, 0); transform.scale.setScalar(0.55); transform.updateMatrix(); crates.current!.setMatrixAt(i, transform.matrix); crateEdges.current?.setMatrixAt(i, transform.matrix); });
      crates.current.count = active ? engine.caches.length : 0; crates.current.instanceMatrix.needsUpdate = true;
      if (crateEdges.current) { crateEdges.current.count = crates.current.count; crateEdges.current.instanceMatrix.needsUpdate = true; }
    }
    if (supplies.current && icons.current) {
      let count = 0;
      engine.supplies.forEach((s, i) => {
        tint.set(s.type === 'repair' ? '#ff4259' : s.type === 'ammo' ? '#74bcff' : s.type === 'magnet' ? '#71eedd' : '#ffbd70').multiplyScalar(2);
        if (s.type !== 'repair' && s.type !== 'ammo') {
          transform.position.set(s.x, 0.65 + Math.sin(clock.elapsedTime * 3 + i) * 0.12, s.z); transform.rotation.set(0, clock.elapsedTime * 0.7, 0); transform.scale.setScalar(0.38); transform.updateMatrix(); supplies.current!.setMatrixAt(count, transform.matrix); supplies.current!.setColorAt(count++, tint);
        }
        transform.position.set(s.x, 0.06, s.z); transform.scale.setScalar(s.type === 'repair' ? 0.9 : 0.65); transform.rotation.set(-Math.PI / 2, 0, 0); transform.updateMatrix(); icons.current!.setMatrixAt(i, transform.matrix); icons.current!.setColorAt(i, tint);
      });
      supplies.current.count = active ? count : 0; icons.current.count = active ? engine.supplies.length : 0;
      for (const mesh of [supplies.current, icons.current]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    }
  });
  return <>
    <instancedMesh ref={waves} args={[undefined, undefined, LIMITS.shockwaves]} frustumCulled={false}><torusGeometry args={[1, 0.023, 4, 64]} /><meshBasicMaterial transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={flashes} args={[undefined, undefined, LIMITS.shockwaves]} frustumCulled={false}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={danger} args={[undefined, undefined, LIMITS.hazards]} frustumCulled={false}><ringGeometry args={[0.87, 1, 40]} /><meshBasicMaterial transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={elite} args={[undefined, undefined, LIMITS.enemies]} frustumCulled={false}><torusGeometry args={[1, 0.028, 4, 6]} /><meshBasicMaterial color={[2, 1.3, 0.35]} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={crates} args={[undefined, undefined, LIMITS.caches]} frustumCulled={false}><boxGeometry args={[1, 0.8, 1]} /><meshStandardMaterial color="#9c7752" metalness={0.8} roughness={0.3} emissive="#ffc36c" emissiveIntensity={0.75} /></instancedMesh>
    <instancedMesh ref={crateEdges} args={[undefined, undefined, LIMITS.caches]} frustumCulled={false}><boxGeometry args={[1.03, 0.83, 1.03]} /><meshBasicMaterial color={[2.4, 1.6, 0.4]} wireframe toneMapped={false} /></instancedMesh>
    <instancedMesh ref={supplies} args={[undefined, undefined, LIMITS.supplies]} frustumCulled={false}><octahedronGeometry args={[1]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={icons} args={[undefined, undefined, LIMITS.supplies]} frustumCulled={false}><ringGeometry args={[0.7, 1, 24]} /><meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
  </>;
}

export default function CombatEffects() { return <><Battlefield /><ImpactShield /><BarrierShell /><FirstAidSupplies /><Ordnance /><DamageNumbers /></>; }
