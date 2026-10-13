'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ArrowLeft, ArrowUpRight, Crosshair, Hexagon, MousePointer2, Orbit, Shield, Skull, Wind } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildEnemyShip, buildPlayerShip, buildShadowTexture, buildShipMaterials, buildSurfaceTextures, SURFACES } from '@/game/ship-models';
import ShipLighting from './ship-lighting';
import { FLIGHTFRAMES, SHIP_IDS } from '@/game/flightframes';
import { useGame } from '@/game/store';
import { renderDpr } from '@/game/render-budget';
import PerformanceGovernor from './performance-governor';
import { useShipSync } from './use-ship-sync';

const catalog = [
  ...SHIP_IDS.map((id, i) => ({ name: FLIGHTFRAMES[id].name, code: FLIGHTFRAMES[id].code + ' / FLIGHTFRAME', role: FLIGHTFRAMES[id].role, color: FLIGHTFRAMES[id].color, icon: [Crosshair, Wind, Shield][i], copy: FLIGHTFRAMES[id].description })),
  { name: 'Chaser', code: 'CX.01 / PURSUIT DRONE', role: 'FAST ATTACK', color: '#ff5774', icon: Wind, copy: 'A compact autonomous interceptor. A reinforced nose, optical tracking array, and twin engines make this hunter relentless.' },
  { name: 'Orbiter', code: 'OR.02 / RECON PLATFORM', role: 'RANGED CONTROL', color: '#a685ff', icon: Orbit, copy: 'A standoff weapons platform: pink plasma bursts, violet charged lasers, or amber unguided rockets. Its aim line warns before firing; evade sideways or use stone cover.' },
  { name: 'Goliath', code: 'GT.03 / SIEGE CARRIER', role: 'HEAVY ARMOR', color: '#ffae50', icon: Shield, copy: 'A heavy hover carrier with overlapping ceramic armor, reinforced engine nacelles, cooling grilles, and a twin-barrel siege turret.' },
  { name: 'Vortex Sentinel', code: 'VS.00 / DREADNOUGHT', role: 'PROTOCOL GUARDIAN', color: '#ff3a5d', icon: Skull, copy: 'A guardian calibrated to your arsenal. Blue sealed armor resists hits; the amber exposed reactor rewards timed bursts. Three barrage phases add increasingly dangerous telegraphed ground strikes.' },
];

function DisplayShip({ selected }: { selected: number }) {
  const group = useRef<THREE.Group>(null);
  const resources = useMemo(() => {
    const textures = buildSurfaceTextures(), shadow = buildShadowTexture();
    return { textures, shadow };
  }, []);
  const actor = useMemo(() => ({ model: selected < 3 ? buildPlayerShip(SHIP_IDS[selected]) : buildEnemyShip((selected - 3) as 0 | 1 | 2 | 3), materials: buildShipMaterials(catalog[selected].color, selected < 3, resources.textures) }), [selected, resources.textures]);
  useEffect(() => () => { Object.values(actor.model).forEach(g => g.dispose()); Object.values(actor.materials).forEach(m => m.dispose()); }, [actor]);
  useEffect(() => () => {
    Object.values(resources.textures).forEach(t => t.dispose()); resources.shadow.dispose();
  }, [resources]);
  useFrame(({ clock }) => { if (group.current) { group.current.rotation.y = -0.5 + Math.sin(clock.elapsedTime * 0.16) * 0.15; group.current.position.y = 0.9 + Math.sin(clock.elapsedTime * 1.5) * 0.03; } });
  return <>
    <group ref={group} scale={selected < 3 ? 1.15 : 1.65} dispose={null}>{SURFACES.map(surface => <mesh key={`${selected}-${surface}`} geometry={actor.model[surface]} material={actor.materials[surface]} />)}</group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} scale={[5, 5, 1]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={resources.shadow} transparent opacity={0.9} depthWrite={false} /></mesh>
    <mesh position={[0, 0, 0]}><cylinderGeometry args={[2.65, 2.7, 0.2, 80]} /><meshStandardMaterial color="#171e22" roughness={0.4} metalness={0.65} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}><ringGeometry args={[2.47, 2.48, 96]} /><meshBasicMaterial color={catalog[selected].color} toneMapped={false} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#090e13" roughness={0.8} metalness={0.15} /></mesh>
  </>;
}

export default function ShipHangar() {
  useShipSync();
  const [selected, setSelected] = useState(0); const item = catalog[selected];
  const chosen = useGame(s => s.ship), quality = useGame(s => s.quality), adaptiveQuality = useGame(s => s.adaptiveQuality), renderBudget = useGame(s => s.renderBudget);
  useEffect(() => { useGame.getState().hydrate(); setSelected(SHIP_IDS.indexOf(useGame.getState().ship)); }, []);
  return <main className="hangar-shell">
    <div className="hangar-canvas"><Canvas camera={{ position: [4.2, 3.7, 5.7], fov: 43 }} dpr={renderDpr({quality,adaptiveQuality,renderBudget})} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <PerformanceGovernor />
      <color attach="background" args={['#080e13']} /><fog attach="fog" args={['#080e13', 15, 40]} />
      <ShipLighting /><DisplayShip selected={selected} />
      <OrbitControls makeDefault target={[0, 0.55, 0]} enablePan={false} minDistance={3.2} maxDistance={10} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.15} />
      <EffectComposer multisampling={adaptiveQuality || quality === 'performance' ? 0 : 4}><Bloom intensity={0.55} luminanceThreshold={1.2} mipmapBlur /><Vignette darkness={0.55} offset={0.3} /></EffectComposer>
    </Canvas></div>
    <header className="hangar-header"><Link href="/" className="hangar-back"><ArrowLeft size={17} /> COMMAND CENTER</Link><span><Hexagon size={18} /> POLY-VORTEX / DRYDOCK</span><small>FLEET IDENTIFICATION SYSTEM</small></header>
    <aside className="hangar-catalog"><span className="micro">ENGINEERED FOR THE VORTEX</span><h1>THE<br /><span>FLEET.</span></h1><div>{catalog.map((ship, i) => { const Icon = ship.icon; return <button key={ship.name} className={selected === i ? 'selected' : ''} style={{ '--ship-accent': ship.color } as React.CSSProperties} onClick={() => setSelected(i)} aria-pressed={selected === i}><Icon size={22} /><div><strong>{ship.name}</strong><span>{ship.role}</span></div><ArrowUpRight size={16} /></button>; })}</div></aside>
    <div className="hangar-info"><span style={{ color: item.color }}>{item.code}</span><h2>{item.name}</h2><p>{item.copy}</p>{selected < 3 && <button className="hangar-deploy" onClick={() => useGame.getState().selectShip(SHIP_IDS[selected])}>{chosen === SHIP_IDS[selected] ? 'ACTIVE FLIGHTFRAME' : `SELECT ${item.name.toUpperCase()}`}</button>}<small><MousePointer2 size={14} /> DRAG TO ROTATE <i /> SCROLL TO INSPECT</small></div>
  </main>;
}
