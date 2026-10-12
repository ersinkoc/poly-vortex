'use client';

import { Radio, ChevronRight, Navigation } from 'lucide-react';
import { ENCOUNTERS } from '@/game/director';
import { useGame } from '@/game/store';

export default function EncounterHUD() {
  const s = useGame(), event = ENCOUNTERS[s.encounter];
  const hint = s.time < 8 ? 'WASD to move · SPACE to dash through danger' : s.aimMode === 'precision' && s.targeting === 'auto' ? 'PRECISION: move the mouse into the arena to acquire a hostile' : s.rocketAmmo === 0 ? 'Rocket rack empty. Follow a blue ammo signal to reload.' : s.hp / s.maxHp < 0.35 ? 'Integrity critical. Find a red repair signal or finish an operation.' : s.encounter === 'recovery' ? event.detail : null;
  return <>
    <div className={`encounter-readout encounter-${s.encounter}`} style={{ '--encounter-color': event.color } as React.CSSProperties} aria-label="Encounter phase">
      <div><Radio size={11} /><span>{event.title}</span><strong>{s.encounter === 'sentinel' ? 'EXTRACT' : `${Math.ceil(s.encounterRemaining)}s`}</strong></div>
      <i><b style={{ width: `${event.duration ? (1 - s.encounterRemaining / event.duration) * 100 : 100}%` }} /></i>
      <small>WAVE {String(s.encounterRound).padStart(2, '0')}<ChevronRight size={9} />{s.encounter === 'assault' ? 'HIGH REINFORCEMENTS' : s.encounter === 'recovery' ? 'CLEAR EXISTING THREATS' : 'HOLD THE PROTOCOL'}</small>
    </div>
    {hint && s.phase === 'playing' && <div className="flight-hint"><Navigation size={12} /><span>{hint}</span></div>}
  </>;
}
