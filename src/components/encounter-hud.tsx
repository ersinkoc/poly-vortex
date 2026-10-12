'use client';

import { Radio, ChevronRight, Navigation } from 'lucide-react';
import { ENCOUNTERS } from '@/game/director';
import { useGame } from '@/game/store';
import { EXPEDITION } from '@/game/expedition';

export default function EncounterHUD() {
  const s = useGame(), event = s.service ? { ...ENCOUNTERS.recovery, title: 'FIELD SERVICE WINDOW', detail: 'Clear the green beacon and dock for repair or extraction.', duration: EXPEDITION.serviceDuration } : ENCOUNTERS[s.encounter];
  const remaining = s.service?.remaining ?? s.encounterRemaining;
  const hint = s.time < 8 ? 'WASD to move · SPACE to dash through danger' : s.aimMode === 'precision' && s.targeting === 'auto' ? 'PRECISION: move the mouse into the arena to acquire a hostile' : s.rocketAmmo === 0 ? 'Rocket rack empty. Follow a blue ammo signal to reload.' : s.hp / s.maxHp < 0.35 ? 'Integrity critical. Find a red repair signal or finish an operation.' : s.encounter === 'recovery' ? event.detail : null;
  return <>
    <div className={`encounter-readout encounter-${s.encounter}`} style={{ '--encounter-color': event.color } as React.CSSProperties} aria-label="Encounter phase">
      <div><Radio size={11} /><span>{event.title}</span><strong>{s.encounter === 'sentinel' ? 'EXTRACT' : `${Math.ceil(remaining)}s`}</strong></div>
      <i><b style={{ width: `${event.duration ? (1 - remaining / event.duration) * 100 : 100}%` }} /></i>
      <small>WAVE {String(s.encounterRound).padStart(2, '0')}<ChevronRight size={9} />{s.encounter === 'assault' ? 'HIGH REINFORCEMENTS' : s.encounter === 'recovery' ? 'CLEAR EXISTING THREATS' : 'HOLD THE PROTOCOL'}</small>
    </div>
    {hint && s.phase === 'playing' && <div className="flight-hint"><Navigation size={12} /><span>{hint}</span></div>}
  </>;
}
