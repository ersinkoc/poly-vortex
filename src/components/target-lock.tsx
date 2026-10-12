'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Crosshair } from 'lucide-react';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { AIM_HALF_ANGLE } from '@/game/targeting';

export function TargetMarker() {
  const marker = useRef<THREE.Group>(null), cone = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const active = useGame.getState().phase === 'playing', p = engine.player, target = engine.enemies.find(e => e.id === engine.targetId && e.hp > 0);
    if (marker.current) { marker.current.visible = active && !!target; if (target) { marker.current.position.set(target.x, 0.1, target.z); marker.current.scale.setScalar(target.radius + 0.45); marker.current.rotation.y = engine.time * 0.6; } }
    if (cone.current) { cone.current.visible = active && engine.input.aiming; cone.current.position.set(p.x, 0.02, p.z); cone.current.rotation.set(-Math.PI / 2, 0, Math.atan2(engine.input.aimX - p.x, engine.input.aimZ - p.z)); }
  });
  return <>
    <group ref={marker}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.95, 1, 32]} /><meshBasicMaterial color={[0.8, 2, 0.3]} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>{[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 1.15, 0, Math.sin(i * Math.PI / 2) * 1.15]} rotation={[0, -i * Math.PI / 2, 0]}><boxGeometry args={[0.18, 0.03, 0.045]} /><meshBasicMaterial color="#d6ffac" /></mesh>)}</group>
    <mesh ref={cone}><ringGeometry args={[0.9, 6.5, 40, 1, Math.PI * 1.5 - AIM_HALF_ANGLE, AIM_HALF_ANGLE * 2]} /><meshBasicMaterial color="#b9f9d0" transparent opacity={0.055} side={THREE.DoubleSide} depthWrite={false} /></mesh>
  </>;
}

const names = ['CHASER', 'ORBITER', 'GOLIATH', 'SENTINEL'];
export default function TargetReadout() {
  const s = useGame();
  return <div className={`target-readout ${s.target ? 'locked' : ''}`} aria-label="Weapon targeting status"><Crosshair size={14} /><div><span>{s.aimMode === 'precision' ? 'PRECISION' : s.targeting === 'aim' ? 'AIM ASSIST' : 'AUTO TRACKING'}</span><strong>{s.target ? `${names[s.target.kind]} · ${Math.ceil(s.target.distance)}m` : s.aimMode === 'precision' && s.targeting === 'auto' ? 'MOVE CURSOR INTO ARENA TO AIM' : s.targeting === 'aim' ? 'NO CLEAR HOSTILE IN AIM' : 'SEARCHING FOR A CLEAR TARGET'}</strong>{s.target && <i><b style={{ width: `${s.target.hp / s.target.maxHp * 100}%` }} /></i>}</div><button aria-label="Toggle targeting mode" title="F: switch assisted / precision" onClick={() => { useGame.setState({ aimMode: s.aimMode === 'assisted' ? 'precision' : 'assisted' }); engine.targetId = 0; engine.publish(); }}><kbd>F</kbd></button></div>;
}
