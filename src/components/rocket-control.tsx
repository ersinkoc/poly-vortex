'use client';

import { CircleHelp, Rocket, Crosshair } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { LAUNCHER_COPY, ROCKET_RULES } from '@/game/launcher';

const targets = ['CHASER', 'ORBITER', 'GOLIATH', 'SENTINEL'];
export default function RocketControl({ onHelp }: { onHelp: () => void }) {
  const s = useGame(), ready = s.rocketReady && s.phase === 'playing', pending = s.rocketPending > 0;
  const copy = LAUNCHER_COPY[s.launcherStatus];
  const progress = pending ? 1 - s.rocketPending / ROCKET_RULES.intentWindow : s.rocketCooldown > 0 ? 1 - s.rocketCooldown / ROCKET_RULES.cooldown : s.rocketLock?.alignment ?? 0;
  return <aside className={`rocket-control launcher-panel ${pending ? 'queued' : ''}`} aria-label="Hellion rocket launcher" onPointerLeave={() => { engine.input.aiming = false; }}>
    <div className="launcher-help-row"><span>MANUAL ORDNANCE</span><button aria-label="How rockets work" title="Rocket controls and reload guide" onClick={onHelp}><CircleHelp size={12} /><span>HELP</span></button></div>
    <button className={`launcher-fire ${ready ? 'ready' : ''}`} disabled={s.phase !== 'playing'} aria-label="Launch rocket" aria-describedby="launcher-hint" onClick={() => engine.requestRocket()}>
      <Rocket size={23} /><div><span>HELLION ROCKETS <strong>{s.rocketAmmo}/{s.rocketCapacity}</strong></span><small>{s.phase !== 'playing' ? copy.title : pending ? 'SHOT QUEUED · ALIGNING' : s.rocketCooldown > 0 ? `CYCLING · ${s.rocketCooldown.toFixed(1)}s` : copy.title}</small><i>{Array.from({ length: s.rocketCapacity }, (_, n) => <b className={n < s.rocketAmmo ? 'filled' : ''} key={n} />)}</i></div><kbd className="launch-key">E</kbd>
    </button>
    <div className="launcher-details"><span><Crosshair size={10} />{s.rocketLock ? `${targets[s.rocketLock.kind]} · ${Math.ceil(s.rocketLock.distance)}m` : s.rocketAmmo === 0 ? 'BLUE CRATES RELOAD +3' : '23m LOCK RANGE'}</span><strong>{pending ? 'HOLD TARGET' : ready ? 'E / TAP TO FIRE' : s.launcherStatus === 'aligning' ? 'E / TAP TO QUEUE' : 'E / TAP FOR STATUS'}</strong></div>
    <div className="launcher-progress"><i style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} /></div>
    <p id="launcher-hint">{copy.hint}</p>
    <div className={`launcher-notice ${s.rocketNoticeKind}`} role="status" aria-live="polite">{s.rocketNoticeTime > 0 ? s.rocketNotice : '6-round rack · no passive ammunition refill.'}</div>
  </aside>;
}
