'use client';

import { Bomb } from 'lucide-react';
import { engine } from '@/game/engine';
import { CHARGE_RULES } from '@/game/ground-charges';
import { useGame } from '@/game/store';

export default function ChargeControl() {
  const s = useGame(), crowded = s.charges.some(c => Math.hypot(c.x - engine.player.x, c.z - engine.player.z) < CHARGE_RULES.minSpacing);
  const ready = s.phase === 'playing' && s.chargeAmmo > 0 && s.chargeCooldown <= 0 && s.charges.length < CHARGE_RULES.activeLimit && !crowded;
  return <div className="charge-control">
    <button className={`charge-button ${ready ? 'ready' : ''}`} aria-label="Drop ground charge" aria-describedby="charge-control-hint" title={`${crowded ? 'Move clear of the armed charge. ' : ''}B: drop a ground charge. ${CHARGE_RULES.fuse}s fuse · ${CHARGE_RULES.radius}m blast · ${s.chargeAmmo}/${CHARGE_RULES.capacity} charges. Blue crates reload +1.`} disabled={!ready} onClick={() => engine.placeCharge()}><Bomb size={21} /><span>CHARGE</span><strong>{s.chargeCooldown > 0 ? `${s.chargeCooldown.toFixed(1)}s` : `${s.chargeAmmo}/${CHARGE_RULES.capacity}`}</strong><kbd>B</kbd></button>
    <span className="sr-only" id="charge-control-hint">Three-second countdown. Move away to lure enemies into the blast. Your core and rescued pilots are protected. Blue crates refill one charge.</span>
    {s.chargeNoticeTime > 0 && <div className="charge-feedback" role="status">{s.chargeNotice}</div>}
  </div>;
}
