'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import ShipFleet from './ships';
import ShipLighting from './ship-lighting';
import CombatEffects from './combat-effects';
import { SECTORS } from '@/game/progression';

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const floorVertex = `varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`;
const floorFragment = `
  varying vec3 vWorld; uniform float uTime; uniform vec3 uPulse; uniform vec2 uCenter; uniform vec3 uTint;
  void main(){
    vec2 p = vWorld.xz; vec2 a = abs(fract(p/2.-.5)-.5)/fwidth(p/2.);
    float line = 1.-min(min(a.x,a.y),1.);
    vec2 b = abs(fract(p/10.-.5)-.5)/fwidth(p/10.); float major = 1.-min(min(b.x,b.y),1.);
    float d = length(p-uCenter); float fade = exp(-d*.037);
    float elapsed = max(0.,uTime-uPulse.z);
    float wave = exp(-pow(length(p-uPulse.xy)-elapsed*12.,2.)*.7) * exp(-elapsed*1.4);
    vec3 base = vec3(.009,.017,.018); vec3 grid = uTint*line*.1 + uTint*major*.075;
    gl_FragColor = vec4(base + grid*fade + vec3(.35,.85,.16)*wave*.25*line,1.);
  }`;

function GridFloor() {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPulse: { value: new THREE.Vector3(0, 0, -100) }, uCenter: { value: new THREE.Vector2() }, uTint: { value: new THREE.Color(SECTORS[0].color) } }), []);
  useFrame(({ clock }) => {
    if (!ref.current) return; const playing = useGame.getState().phase !== 'menu';
    uniforms.uTime.value = playing ? engine.time : clock.elapsedTime;
    uniforms.uCenter.value.set(engine.player.x, engine.player.z);
    uniforms.uTint.value.set(SECTORS[playing ? engine.sector : 0].color);
    if (mesh.current) { mesh.current.position.x = Math.floor(engine.player.x / 100) * 100; mesh.current.position.z = Math.floor(engine.player.z / 100) * 100; }
    if (playing) uniforms.uPulse.value.set(engine.pulse.x, engine.pulse.z, engine.pulse.time);
    else uniforms.uPulse.value.set(0, 0, Math.floor(clock.elapsedTime / 5) * 5);
  });
  return <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[4000, 4000]} /><shaderMaterial ref={ref} uniforms={uniforms} vertexShader={floorVertex} fragmentShader={floorFragment} /></mesh>;
}

function Projectiles() {
  const bolts = useRef<THREE.InstancedMesh>(null), gems = useRef<THREE.InstancedMesh>(null), particles = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (bolts.current) {
      engine.bolts.forEach((b, i) => {
        dummy.position.set(b.x, 0.7, b.z); dummy.rotation.set(0, Math.atan2(b.vx, b.vz), 0); dummy.scale.set(b.enemy ? 0.17 : 0.08, 0.08, b.enemy ? 0.17 : 0.6); dummy.updateMatrix();
        bolts.current!.setMatrixAt(i, dummy.matrix); bolts.current!.setColorAt(i, color.set(b.enemy ? '#ff4088' : '#b5ff62').multiplyScalar(3));
      });
      bolts.current.count = engine.bolts.length; bolts.current.instanceMatrix.needsUpdate = true; if (bolts.current.instanceColor) bolts.current.instanceColor.needsUpdate = true;
    }
    if (gems.current) {
      engine.gems.forEach((g, i) => {
        dummy.position.set(g.x, 0.3 + Math.sin(clock.elapsedTime * 4 + i) * 0.12, g.z); dummy.rotation.set(0, clock.elapsedTime, Math.PI / 4); dummy.scale.setScalar(g.value >= 18 ? 0.3 : 0.16); dummy.updateMatrix(); gems.current!.setMatrixAt(i, dummy.matrix);
      }); gems.current.count = engine.gems.length; gems.current.instanceMatrix.needsUpdate = true;
    }
    if (particles.current) {
      engine.particles.forEach((p, i) => {
        dummy.position.set(p.x, Math.max(0.05, p.y), p.z); dummy.rotation.set(p.life * 3, i, p.life); dummy.scale.setScalar(p.size * p.life / p.maxLife); dummy.updateMatrix();
        particles.current!.setMatrixAt(i, dummy.matrix); particles.current!.setColorAt(i, color.set(p.color).multiplyScalar(2 * p.life / p.maxLife));
      }); particles.current.count = engine.particles.length; particles.current.instanceMatrix.needsUpdate = true; if (particles.current.instanceColor) particles.current.instanceColor.needsUpdate = true;
    }
  });
  return <>
    <instancedMesh ref={bolts} args={[undefined, undefined, LIMITS.bolts]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={gems} args={[undefined, undefined, LIMITS.gems]} frustumCulled={false}><octahedronGeometry args={[1]} /><meshBasicMaterial color={[0.4, 2.7, 2.1]} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={particles} args={[undefined, undefined, LIMITS.particles]} frustumCulled={false}><tetrahedronGeometry args={[1]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
  </>;
}

function Effects() {
  const glaives = useRef<THREE.Group>(null), reticle = useRef<THREE.Group>(null);
  const vortex = useRef<THREE.InstancedMesh>(null), arcs = useRef<THREE.LineSegments>(null);
  const arcPositions = useMemo(() => new Float32Array(600), []);
  useFrame(({ clock }) => {
    const p = engine.player;
    if (glaives.current) {
      glaives.current.position.set(p.x, 0.65, p.z); glaives.current.rotation.y = -engine.time * 2.3;
      glaives.current.children.forEach((blade, i) => { blade.visible = engine.weapons.glaive > 0 && i < engine.weapons.glaive + 1; const a = i / (engine.weapons.glaive + 1) * Math.PI * 2; blade.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3); blade.rotation.y = clock.elapsedTime * 5; });
    }
    if (reticle.current) { reticle.current.position.set(engine.input.aimX, 0.04, engine.input.aimZ); reticle.current.visible = useGame.getState().phase === 'playing' && engine.input.aiming; reticle.current.rotation.y = clock.elapsedTime * 0.5; }
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
    <group ref={glaives}>{Array.from({ length: 7 }, (_, i) => <mesh key={i} scale={[0.3, 0.18, 0.85]}><octahedronGeometry args={[1]} /><meshBasicMaterial color={[0.5, 2.7, 3]} toneMapped={false} /></mesh>)}</group>
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
  const { camera, gl, raycaster } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []), aim = useMemo(() => new THREE.Vector3(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const accumulator = useRef(0), frames = useRef({ count: 0, time: 0 });
  const runId = useGame(s => s.runId), phase = useGame(s => s.phase);
  useEffect(() => { if (runId) engine.reset(); }, [runId]);
  useEffect(() => {
    if (phase === 'menu') { engine.player.x = 0; engine.player.z = 0; engine.preview(); engine.bolts = []; engine.gems = []; engine.particles = []; engine.vortices = []; engine.arcs = []; }
    if (phase !== 'playing') { engine.input.keys.clear(); engine.input.dash = false; engine.input.surge = false; engine.input.moveX = 0; engine.input.moveZ = 0; accumulator.current = 0; }
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
    };
    const up = (e: KeyboardEvent) => engine.input.keys.delete(e.code);
    const blur = () => { engine.input.keys.clear(); if (useGame.getState().phase === 'playing') useGame.getState().setPhase('paused'); };
    const visibility = () => { if (document.hidden) blur(); };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const rect = gl.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(plane, aim)) { engine.input.aimX = aim.x; engine.input.aimZ = aim.z; engine.input.aiming = true; }
    };
    const click = (e: PointerEvent) => { if (e.button === 2 && useGame.getState().phase === 'playing') engine.input.dash = true; };
    const context = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    gl.domElement.addEventListener('pointermove', move); gl.domElement.addEventListener('pointerdown', click); gl.domElement.addEventListener('contextmenu', context);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      gl.domElement.removeEventListener('pointermove', move); gl.domElement.removeEventListener('pointerdown', click); gl.domElement.removeEventListener('contextmenu', context);
    };
  }, [camera, gl, raycaster, plane, aim, pointer]);
  useFrame((state, delta) => {
    const s = useGame.getState();
    if (s.phase === 'playing') {
      accumulator.current += Math.min(delta, 0.1);
      while (accumulator.current >= 1 / 60) { engine.tick(1 / 60); accumulator.current -= 1 / 60; }
    }
    frames.current.count++; frames.current.time += delta;
    if (frames.current.time >= 1) { useGame.setState({ fps: Math.round(frames.current.count / frames.current.time) }); frames.current = { count: 0, time: 0 }; }
    const menu = s.phase === 'menu';
    const px = menu ? 0 : engine.player.x, pz = menu ? 0 : engine.player.z;
    target.set(px + (menu ? 12 : 0), menu ? 18 : 28, pz + (menu ? 17 : 18));
    camera.position.lerp(target, 1 - Math.exp(-4 * Math.min(delta, 0.1)));
    const shake = engine.trauma ** 2 * 0.4;
    camera.position.x += Math.sin(state.clock.elapsedTime * 91) * shake; camera.position.z += Math.cos(state.clock.elapsedTime * 77) * shake;
    camera.lookAt(px, 0, pz);
  });
  return null;
}

function PostFX() {
  const quality = useGame(s => s.quality);
  const offset = useMemo(() => new THREE.Vector2(0.0003, 0.0003), []);
  useFrame(() => { const v = 0.0003 + engine.hitFlash * 0.009; offset.set(v, v); });
  return <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
    <Bloom intensity={0.9} luminanceThreshold={0.75} luminanceSmoothing={0.5} mipmapBlur />
    <ChromaticAberration offset={offset} radialModulation modulationOffset={0.2} />
    <Vignette offset={0.15} darkness={0.72} eskil={false} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>;
}

export default function Arena() {
  const quality = useGame(s => s.quality);
  return <Canvas camera={{ position: [16, 23, 20], fov: 46, near: 0.1, far: 160 }} dpr={quality === 'high' ? [1, 1.5] : 1} gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}>
    <color attach="background" args={['#080d0d']} />
    <fog attach="fog" args={['#080d0d', 36, 78]} />
    <ShipLighting />
    <SceneController /><GridFloor /><ProtocolRing /><ShipFleet />
    <Projectiles /><Effects /><CombatEffects /><Stars radius={65} depth={35} count={600} factor={1.3} saturation={0} fade speed={0.1} />
    <PostFX />
  </Canvas>;
}
