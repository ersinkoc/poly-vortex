'use client';

import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { useGame } from '@/game/store';
import { enemyWeapon, HOSTILE_WEAPONS, rangedMuzzle } from '@/game/enemy-weapons';
import { ThreatSignals, THREAT_SIGNALS } from '@/game/threat-signals';
import { terrainHeight } from '@/game/terrain';
import { audio } from '@/game/audio';

const vertex = `attribute vec2 aThreat; varying vec2 vUv; varying vec2 vThreat; varying vec3 vTint;
void main(){vUv=uv;vThreat=aThreat;vTint=vec3(1.);
#ifdef USE_INSTANCING_COLOR
vTint=instanceColor;
#endif
gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const targetFragment = `varying vec2 vUv; varying vec2 vThreat; varying vec3 vTint; uniform float uTime;
void main(){vec2 p=(vUv-.5)*2.;
float brackets=step(.68,max(abs(p.x),abs(p.y)))*(1.-step(.76,max(abs(p.x),abs(p.y))))*step(.48,min(abs(p.x),abs(p.y)));
float alpha=brackets*.45;
if(alpha<.01)discard;gl_FragColor=vec4(vTint,alpha);}`;
const directionFragment = `varying vec2 vUv; varying vec2 vThreat; varying vec3 vTint; uniform float uTime;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.x,p.y);
float sector=1.-smoothstep(.22,.26,abs(a));
float arc=(1.-smoothstep(.012,.025,abs(r-.65)))*sector;
float segments=step(.23,fract((a+.25)*16.));float filled=step((a+.25)*2.,vThreat.x);
float meter=step(.68,r)*(1.-step(.72,r))*sector*segments*(.2+.8*filled);
float arrow=1.-smoothstep(.016,.035,abs(p.y-(.88-abs(p.x)*.8)));arrow*=step(.76,p.y)*(1.-step(.88,p.y))*step(abs(p.x),.15);
float alpha=max(arc*.5,max(meter,arrow))*(.5+vThreat.x*.2);
if(alpha<.01)discard;gl_FragColor=vec4(vTint,alpha);}`;

export default function EnemyWeaponSignals() {
  const targets = useRef<THREE.InstancedMesh>(null), sectors = useRef<THREE.InstancedMesh>(null), lights = useRef<THREE.InstancedMesh>(null);
  const labelAnchor = useRef<THREE.Group>(null), label = useRef<HTMLDivElement>(null), countdown = useRef<HTMLElement>(null);
  const lastLabel = useRef('');
  const alarm = useRef({ locked: false, next: 0 });
  const targetMaterial = useRef<THREE.ShaderMaterial>(null), sectorMaterial = useRef<THREE.ShaderMaterial>(null);
  const scratch = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const threat = new THREE.InstancedBufferAttribute(new Float32Array(THREAT_SIGNALS.capacity * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aThreat', threat);
    const sectorGeometry = new THREE.PlaneGeometry(1, 1);
    const sectorThreat = new THREE.InstancedBufferAttribute(new Float32Array(THREAT_SIGNALS.directions * 2), 2).setUsage(THREE.DynamicDrawUsage);
    sectorGeometry.setAttribute('aThreat', sectorThreat);
    return { pose: new THREE.Object3D(), color: new THREE.Color(), signals: new ThreatSignals(), geometry, threat, sectorGeometry, sectorThreat, uniforms: { uTime: { value: 0 } } };
  }, []);
  useEffect(() => {
    const meshes = [targets.current, sectors.current, lights.current]; meshes.forEach(m => m?.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
    const materials = [targetMaterial.current, sectorMaterial.current];
    return () => { meshes.forEach(m => m?.dispose()); materials.forEach(m => m?.dispose()); scratch.geometry.dispose(); scratch.sectorGeometry.dispose(); };
  }, [scratch]);
  useFrame(() => {
    let targetCount = 0, sectorCount = 0, lightCount = 0;
    const state = useGame.getState(), { pose, color, signals } = scratch, active = state.phase === 'playing' || state.phase === 'paused';
    scratch.uniforms.uTime.value = state.reducedEffects ? 0 : engine.time;
    signals.tick(active ? engine.enemies : [], engine.player);
    if (state.phase === 'playing' && signals.locks && !alarm.current.locked && engine.time >= alarm.current.next) { audio.lockWarning(); alarm.current.next = engine.time + 1.5; }
    alarm.current.locked = signals.locks > 0;
    for (let i = 0; i < signals.targets.length; i++) {
      const t = signals.targets[i]; scratch.threat.setXY(i, t.progress, t.dangerous ? 1 : 0);
      color.set(t.dangerous ? '#ff6676' : '#ffbe6b');
      const size = 3.2 - t.progress * 0.6;
      pose.position.set(t.x, terrainHeight(t.x, t.z) + 0.055, t.z); pose.rotation.set(-Math.PI / 2, 0, 0); pose.scale.set(size, size, 1); pose.updateMatrix();
      targets.current?.setMatrixAt(targetCount, pose.matrix); targets.current?.setColorAt(targetCount++, color);
    }
    for (let i = 0; i < signals.directions.length; i++) {
      const t = signals.directions[i]; scratch.sectorThreat.setXY(i, t.progress, 1);
      color.set('#ff6676');
      pose.position.set(engine.player.x, terrainHeight(engine.player.x, engine.player.z) + 0.06, engine.player.z);
      pose.rotation.set(-Math.PI / 2, 0, t.bearing + Math.PI); pose.scale.set(7.2, 7.2, 1); pose.updateMatrix();
      sectors.current?.setMatrixAt(sectorCount, pose.matrix); sectors.current?.setColorAt(sectorCount++, color);
    }
    scratch.threat.needsUpdate = true; scratch.sectorThreat.needsUpdate = true;
    if (active) for (const e of engine.enemies) {
      if ((e.kind !== 0 && e.kind !== 1) || e.hp <= 0) continue;
      const rule = HOSTILE_WEAPONS[enemyWeapon(e)], charge = e.ranged;
      const flash = e.weaponFlash && e.age - e.weaponFlash.at < 0.16 ? e.weaponFlash : null;
      if (!charge && !flash || !charge && state.reducedEffects) continue;
      const side = charge ? (e.weaponShots ?? 0) % 2 === 0 ? -1 : 1 : flash!.side;
      const muzzle = rangedMuzzle(e, engine.player, side); color.set(rule.color).multiplyScalar(2.5);
      const size = charge ? 0.04 + 0.08 * Math.max(0, 1 - charge.remaining / rule.windup) : 0.18 * (1 - (e.age - flash!.at) / 0.16);
      pose.position.set(muzzle.x, muzzle.y, muzzle.z); pose.rotation.set(0, 0, 0); pose.scale.setScalar(size); pose.updateMatrix();
      lights.current?.setMatrixAt(lightCount, pose.matrix); lights.current?.setColorAt(lightCount++, color);
    }
    for (const [mesh, count] of [[targets.current, targetCount], [sectors.current, sectorCount], [lights.current, lightCount]] as const) if (mesh) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    labelAnchor.current?.position.set(engine.player.x, 0.95, engine.player.z);
    const text = signals.locks ? `${signals.soonest.toFixed(1)}s${signals.locks > 1 ? ` · ×${signals.locks}` : ''}` : '';
    if (text !== lastLabel.current && label.current && countdown.current) {
      lastLabel.current = text; countdown.current.textContent = text; label.current.style.display = text ? 'flex' : 'none';
    }
  });
  return <>
    <instancedMesh ref={targets} args={[scratch.geometry, undefined, THREAT_SIGNALS.capacity]} count={0} frustumCulled={false} dispose={null}>
      <shaderMaterial ref={targetMaterial} vertexShader={vertex} fragmentShader={targetFragment} uniforms={scratch.uniforms} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={sectors} args={[scratch.sectorGeometry, undefined, THREAT_SIGNALS.directions]} count={0} frustumCulled={false} dispose={null}>
      <shaderMaterial ref={sectorMaterial} vertexShader={vertex} fragmentShader={directionFragment} uniforms={scratch.uniforms} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={lights} args={[undefined, undefined, LIMITS.enemies]} count={0} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending}/></instancedMesh>
    <group ref={labelAnchor}><Html center zIndexRange={[7, 6]} style={{ pointerEvents: 'none' }}><div ref={label} className="hostile-lock-readout" style={{ display: 'none' }} role="status" aria-live="off" aria-label="Incoming fire countdown; dodge sideways"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4L22 21H2ZM12 10V14M12 17V18" fill="none" stroke="currentColor" strokeWidth="2"/></svg><small ref={countdown}/></div></Html></group>
  </>;
}
