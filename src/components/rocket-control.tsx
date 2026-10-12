'use client';

import { Rocket } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';

export default function RocketControl() {
  const s = useGame(), ready = s.rocketAmmo > 0 && s.rocketCooldown <= 0 && s.rocketReady && s.phase === 'playing';
  return <div className="rocket-control"><button className={ready ? 'ready' : ''} disabled={!ready} aria-label="Launch rocket" onClick={() => { engine.input.rocket = true; }}><Rocket size={23} /><div><span>HELLION ROCKETS <strong>{s.rocketAmmo}/{s.rocketCapacity}</strong></span><small>{s.rocketAmmo === 0 ? 'FIND AN AMMO CRATE' : s.rocketCooldown > 0 ? `${s.rocketCooldown.toFixed(1)}s CYCLING` : s.rocketReady ? 'LOCKED · LAUNCH' : s.target ? 'ALIGNING LAUNCHER' : 'CLEAR TARGET REQUIRED'}</small><i>{Array.from({ length: s.rocketCapacity }, (_, n) => <b className={n < s.rocketAmmo ? 'filled' : ''} key={n} />)}</i></div><kbd>E</kbd></button></div>;
}
