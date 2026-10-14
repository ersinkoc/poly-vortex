'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { renderQuality, renderDpr } from '@/game/render-budget';
import PerformanceGovernor from './performance-governor';
import ShipFleet from './ships';
import ShipLighting from './ship-lighting';
import CombatEffects from './combat-effects';
import Terrain from './terrain';
import WorldLifeActors from './world-life';
import MissionActors from './mission-actors';
import { TargetMarker } from './target-lock';
import { navigationSignals } from '@/game/navigation';
import CinematicEffects from './cinematic-effects';
import EnemyWeaponSignals from './enemy-weapon-signals';
import { hostileBoltColor } from '@/game/enemy-weapons';
import ServiceBeacon from './service-beacon';

const dummy = new THREE.Object3D();
const color = new THREE.Color();
function Projectiles() {
  const bolts = useRef<THREE.InstancedMesh>(null), gems = useRef<THREE.InstancedMesh>(null), particles = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (bolts.current) {
      engine.bolts.forEach((b, i) => {
        dummy.position.set(b.x, b.y ?? 0.7, b.z); dummy.rotation.set(-Math.atan2(b.vy ?? 0, Math.hypot(b.vx, b.vz)), Math.atan2(b.vx, b.vz), 0, 'YXZ'); dummy.scale.set(b.hostileWeapon === 'laser' ? 0.045 : b.hostileWeapon === 'missile' ? 0.13 : b.heavy !== undefined ? 0.16 : b.enemy ? 0.17 : b.drone !== undefined ? 0.055 : 0.08, b.hostileWeapon === 'laser' ? 0.045 : b.heavy !== undefined ? 0.16 : 0.08, b.hostileWeapon === 'laser' ? 1.1 : b.hostileWeapon === 'missile' ? 0.48 : b.heavy !== undefined ? 0.36 : b.enemy ? 0.17 : 0.6); dummy.updateMatrix();
        bolts.current!.setMatrixAt(i, dummy.matrix); bolts.current!.setColorAt(i, color.set(b.enemy ? hostileBoltColor(b) : b.drone !== undefined ? '#78e8ff' : '#b5ff62').multiplyScalar(3));
      });
      bolts.current.count = engine.bolts.length; bolts.current.instanceMatrix.needsUpdate = true; if (bolts.current.instanceColor) bolts.current.instanceColor.needsUpdate = true;
    }
    if (gems.current) {
      engine.gems.forEach((g, i) => {
        dummy.position.set(g.x, 0.3 + Math.sin(clock.elapsedTime * 4 + i) * 0.12, g.z); dummy.rotation.set(0, clock.elapsedTime, Math.PI / 4, 'XYZ'); dummy.scale.setScalar(g.value >= 18 ? 0.3 : 0.16); dummy.updateMatrix(); gems.current!.setMatrixAt(i, dummy.matrix);
      }); gems.current.count = engine.gems.length; gems.current.instanceMatrix.needsUpdate = true;
    }
    if (particles.current) {
      engine.particles.forEach((p, i) => {
        dummy.position.set(p.x, Math.max(0.05, p.y), p.z); dummy.rotation.set(p.life * 3, i, p.life, 'XYZ'); dummy.scale.setScalar(p.size * p.life / p.maxLife); dummy.updateMatrix();
        particles.current!.setMatrixAt(i, dummy.matrix); particles.current!.setColorAt(i, color.set(p.color).multiplyScalar(2 * p.life / p.maxLife));
      }); particles.current.count = engine.particles.length; particles.current.instanceMatrix.needsUpdate = true; if (particles.current.instanceColor) particles.current.instanceColor.needsUpdate = true;
    }
  });
  return <>
    <instancedMesh ref={bolts} args={[undefined, undefined, LIMITS.bolts]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={gems} args={[undefined, undefined, LIMITS.gems]} frustumCulled={false}><octahedronGeometry args={[1]} /><meshBasicMaterial color={[0.4, 2.7, 2.1]} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={particles} args={[undefined, undefined, LIMITS.particles]} frustumCulled={false}><tetrahedronGeometry args={[1]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
  </>;
}

function Effects() {
  const reticle = useRef<THREE.Group>(null);
  const vortex = useRef<THREE.InstancedMesh>(null), arcs = useRef<THREE.LineSegments>(null);
  const arcPositions = useMemo(() => new Float32Array(600), []);
  useFrame(({ clock }) => {
    if (reticle.current) { reticle.current.position.set(engine.input.aimX, 0.04, engine.input.aimZ); reticle.current.visible = useGame.getState().phase === 'playing' && engine.input.aiming && Math.hypot(engine.input.aimX - engine.player.x, engine.input.aimZ - engine.player.z) > 2.3; reticle.current.rotation.y = clock.elapsedTime * 0.5; }
    if (vortex.current) {
      let n = 0;
      for (const v of engine.vortices) for (let j = 0; j < 5 && n < 30; j++) {
        dummy.position.set(v.x, 0.15 + j * 0.07, v.z); dummy.rotation.set(-Math.PI / 2, 0, clock.elapsedTime * (j % 2 ? 1 : -1)); dummy.scale.setScalar(v.radius * (0.25 + j * 0.16) * Math.min(1, v.life)); dummy.updateMatrix(); vortex.current.setMatrixAt(n++, dummy.matrix);
      } vortex.current.count = n; vortex.current.instanceMatrix.needsUpdate = true;
    }
    if (arcs.current) {
      let n = 0;
      for (const arc of engine.arcs) for (let i = 1; i < arc.points.length; i++) {
        const a = arc.points[i - 1], b = arc.points[i];
        for (let j = 0; j < 5 && n + 6 <= arcPositions.length; j++) {
          const t = j / 5, u = (j + 1) / 5;
          arcPositions[n++] = a[0] + (b[0] - a[0]) * t; arcPositions[n++] = 0.8 + Math.sin(j * 5 + clock.elapsedTime * 30) * 0.25; arcPositions[n++] = a[1] + (b[1] - a[1]) * t;
          arcPositions[n++] = a[0] + (b[0] - a[0]) * u; arcPositions[n++] = 0.8 + Math.sin((j + 1) * 5 + clock.elapsedTime * 30) * 0.25; arcPositions[n++] = a[1] + (b[1] - a[1]) * u;
        }
      }
      arcs.current.geometry.setDrawRange(0, n / 3); arcs.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  return <>
    <group ref={reticle}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.42, 0.46, 4]} /><meshBasicMaterial color="#baff62" transparent opacity={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.07, 0.11, 12]} /><meshBasicMaterial color="#baff62" /></mesh>
    </group>
    <instancedMesh ref={vortex} args={[undefined, undefined, 30]} frustumCulled={false}><torusGeometry args={[1, 0.012, 6, 64, Math.PI * 1.6]} /><meshBasicMaterial color={[1.2, 0.7, 3]} toneMapped={false} /></instancedMesh>
    <lineSegments ref={arcs} frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" args={[arcPositions, 3]} /></bufferGeometry><lineBasicMaterial color={[3, 2.5, 0.7]} toneMapped={false} /></lineSegments>
  </>;
}

function ProtocolRing() {
  const group = useRef<THREE.Group>(null), rotor = useRef<THREE.Group>(null);
  const phase = useGame(s => s.phase);
  const positions = useMemo(() => {
    const data = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const a = i * 2.3999, r = 4 + (i % 100) / 100 * 5; data[i * 3] = Math.cos(a) * r; data[i * 3 + 1] = ((i * 17) % 31) / 31 * 1.2; data[i * 3 + 2] = Math.sin(a) * r; }
    return data;
  }, []);
  useFrame(({ clock }) => { if (rotor.current) rotor.current.rotation.y = clock.elapsedTime * 0.065; });
  return <group ref={group} visible={phase === 'menu'}>
    <group ref={rotor}>
      {[4.6, 6.4, 8.6].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, i * 1.3]} position={[0, 0.03, 0]}><torusGeometry args={[r, i === 1 ? 0.023 : 0.012, 4, 160, Math.PI * (i === 1 ? 1.7 : 1.3)]} /><meshBasicMaterial color={i === 1 ? [0.7, 1.8, 0.22] : '#46633e'} toneMapped={false} /></mesh>)}
      {Array.from({ length: 64 }, (_, i) => {
        const a = i / 64 * Math.PI * 2;
        return <mesh key={i} position={[Math.sin(a) * 7.45, 0.04, Math.cos(a) * 7.45]} rotation={[0, a, 0]}><boxGeometry args={[0.025, 0.025, i % 4 === 0 ? 0.35 : 0.15]} /><meshBasicMaterial color="#91b963" transparent opacity={i % 4 === 0 ? 0.8 : 0.35} /></mesh>;
      })}
      <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial size={0.035} color="#cdff81" transparent opacity={0.45} sizeAttenuation /></points>
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[2.2, 2.21, 80]} /><meshBasicMaterial color="#bbff64" transparent opacity={0.3} side={THREE.DoubleSide} /></mesh>
    <pointLight position={[0, 3, 0]} color="#baff64" intensity={10} distance={15} />
  </group>;
}

function SceneController() {
  const { camera, gl, raycaster, invalidate } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []), aim = useMemo(() => new THREE.Vector3(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const pointerInside = useRef(false);
  const navigationPoint = useMemo(() => new THREE.Vector3(), []), navigationTimer = useRef(0);
  const accumulator = useRef(0), frames = useRef({ count: 0, time: 0 });
  const runId = useGame(s => s.runId), phase = useGame(s => s.phase);
  useEffect(() => { if (runId) { engine.initializeRun(); pointerInside.current = false; invalidate(); } }, [runId, invalidate]);
  useEffect(() => {
    if (phase === 'menu') { engine.player.x = 0; engine.player.z = 0; engine.preview(); engine.bolts = []; engine.gems = []; engine.particles = []; engine.vortices = []; engine.arcs = []; }
    if (phase !== 'playing') { engine.cancelRocket('SHOT CANCELLED · gameplay suspended. No ammunition spent.'); engine.input.bomb = false; engine.publish(); engine.input.keys.clear(); engine.input.dash = false; engine.input.surge = false; engine.input.barrier = false; engine.input.rocket = false; engine.input.moveX = 0; engine.input.moveZ = 0; accumulator.current = 0; }
  }, [phase]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || e.repeat && e.code === 'Escape') return;
      const s = useGame.getState();
      if (e.code === 'Escape' && (s.phase === 'playing' || s.phase === 'paused')) { s.setPhase(s.phase === 'playing' ? 'paused' : 'playing'); return; }
      if (s.phase !== 'playing') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      engine.input.keys.add(e.code); if (e.code === 'Space') engine.input.dash = true;
      if (e.code === 'KeyQ' && !e.repeat) engine.input.surge = true;
      if (e.code === 'KeyR' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); engine.input.barrier = true; }
      if (e.code === 'KeyE' && !e.repeat) engine.input.rocket = true;
      if (e.code === 'KeyB' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); engine.input.bomb = true; }
      if (e.code === 'KeyF' && !e.repeat) { useGame.setState({ aimMode: s.aimMode === 'assisted' ? 'precision' : 'assisted' }); engine.targetId = 0; engine.publish(); }
    };
    const up = (e: KeyboardEvent) => engine.input.keys.delete(e.code);
    const blur = () => { engine.input.keys.clear(); if (useGame.getState().phase === 'playing') useGame.getState().setPhase('paused'); };
    const visibility = () => { if (document.hidden) blur(); };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || useGame.getState().phase !== 'playing') return;
      const rect = gl.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      pointerInside.current = true;
      raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(plane, aim)) { engine.input.aimX = aim.x; engine.input.aimZ = aim.z; engine.input.aiming = true; }
    };
    const leave = (e: PointerEvent) => { pointerInside.current = false; if (!(e.relatedTarget instanceof Element) || !e.relatedTarget.closest('.launcher-panel')) engine.input.aiming = false; };
    const click = (e: PointerEvent) => { if (e.button === 2 && useGame.getState().phase === 'playing') engine.input.dash = true; };
    const context = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    gl.domElement.addEventListener('pointermove', move); gl.domElement.addEventListener('pointerdown', click); gl.domElement.addEventListener('contextmenu', context);
    gl.domElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      gl.domElement.removeEventListener('pointermove', move); gl.domElement.removeEventListener('pointerdown', click); gl.domElement.removeEventListener('contextmenu', context);
      gl.domElement.removeEventListener('pointerleave', leave);
    };
  }, [camera, gl, raycaster, plane, aim, pointer]);
  useFrame((state, delta) => {
    const s = useGame.getState();
    if (s.phase === 'playing') {
      if (pointerInside.current) { raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(plane, aim)) { engine.input.aimX = aim.x; engine.input.aimZ = aim.z; engine.input.aiming = true; } }
      accumulator.current += Math.min(delta, 0.1);
      while (accumulator.current >= 1 / 60) { engine.tick(1 / 60); accumulator.current -= 1 / 60; }
    }
    frames.current.count++; frames.current.time += delta;
    if (frames.current.time >= 1) { useGame.setState({ fps: Math.round(frames.current.count / frames.current.time) }); frames.current = { count: 0, time: 0 }; }
    const menu = s.phase === 'menu';
    const px = menu ? 0 : engine.player.x, pz = menu ? 0 : engine.player.z;
    target.set(px + (menu ? 12 : 0), menu ? 13 : 25, pz + (menu ? 17 : 19));
    camera.position.lerp(target, 1 - Math.exp(-4 * Math.min(delta, 0.1)));
    const shake = menu || s.reducedEffects ? 0 : engine.trauma ** 2 * 0.4;
    camera.position.x += Math.sin(state.clock.elapsedTime * 91) * shake; camera.position.z += Math.cos(state.clock.elapsedTime * 77) * shake;
    camera.lookAt(px - (menu && state.size.width > 760 ? 5.5 : 0), menu ? 1 : 0, pz);
    navigationTimer.current += delta;
    if (s.phase === 'playing' && navigationTimer.current >= 0.1) {
      navigationTimer.current = 0; camera.updateMatrixWorld();
      const { width, height } = state.size;
      const navigation = navigationSignals(engine.player, engine.missions.mission, engine.supplies, engine.rocketAmmo, engine.service, engine.chargeAmmo).map(signal => {
        navigationPoint.set(signal.x, 1.8, signal.z).project(camera);
        const sign = navigationPoint.z > 1 ? -1 : 1;
        const x = navigationPoint.x * sign * width / 2, y = -navigationPoint.y * sign * height / 2;
        const maxX = Math.max(12, width / 2 - 82), maxY = Math.max(12, height / 2 - (width <= 600 ? 320 : 210));
        const scale = Math.max(1, Math.abs(x) / maxX, Math.abs(y) / maxY);
        return { ...signal, screenX: width / 2 + x / scale, screenY: height / 2 + y / scale, edge: scale > 1, angle: Math.atan2(x, -y) * 180 / Math.PI };
      });
      useGame.setState({ navigation });
    }
  });
  return null;
}

function PostFX() {
  const quality = useGame(renderQuality);
  const adaptive = useGame(s => s.adaptiveQuality);
  const offset = useMemo(() => new THREE.Vector2(0.0003, 0.0003), []);
  useFrame(() => { const v = useGame.getState().reducedEffects ? 0 : 0.0003 + engine.hitFlash * 0.009; offset.set(v, v); });
  return <EffectComposer multisampling={!adaptive && quality === 'high' ? 4 : 0}>
    <Bloom intensity={0.82} luminanceThreshold={1} luminanceSmoothing={0.65} mipmapBlur />
    <ChromaticAberration offset={offset} radialModulation modulationOffset={0.2} />
    <Vignette offset={0.15} darkness={0.72} eskil={false} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>;
}

export default function Arena() {
  const quality = useGame(renderQuality);
  const phase = useGame(s => s.phase);
  const preference = useGame(s => s.quality), adaptiveQuality = useGame(s => s.adaptiveQuality), renderBudget = useGame(s => s.renderBudget);
  return <Canvas frameloop={phase === 'paused' ? 'demand' : 'always'} shadows={quality === 'high' ? 'percentage' : false} camera={{ position: [16, 23, 20], fov: 46, near: 0.1, far: 160 }} dpr={renderDpr({quality: preference, adaptiveQuality, renderBudget})} gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}>
    <PerformanceGovernor />
    <color attach="background" args={['#080e15']} />
    <fog attach="fog" args={['#080e15', 28, 72]} />
    <ShipLighting followPlayer />
    <SceneController /><Terrain /><ShipFleet />
    {phase !== 'menu' && <><MissionActors /><WorldLifeActors /><ServiceBeacon /><TargetMarker /><ProtocolRing /><Projectiles /><EnemyWeaponSignals /><Effects /><CombatEffects /><CinematicEffects /><Stars radius={65} depth={35} count={600} factor={1.3} saturation={0} fade speed={0.1} /></>}
    <PostFX />
  </Canvas>;
}
