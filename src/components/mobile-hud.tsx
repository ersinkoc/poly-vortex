'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Crosshair, Layers3, Pause, Rocket, Shield, Wind, X, Zap } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { WEAPONS, type WeaponId } from '@/game/types';
import { LAUNCHER_COPY } from '@/game/launcher';
import ChargeControl from './charge-control';
import DroneStatus from './drone-status';
import ExpeditionHUD from './expedition-hud';
import MissionHUD from './mission-hud';
import EncounterHUD from './encounter-hud';
import TargetReadout from './target-lock';
import RoverReadout from './rover-readout';
import { RadarPanel } from './tactical-hud';
import NavigationSignals from './navigation-signals';

const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

function TacticalSheet({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const s = useGame(), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => { el?.close(); }; }, []);
  return <dialog ref={dialog} className="mobile-tactical-sheet" id="mobile-tactical-sheet" aria-labelledby="mobile-tactical-title"
    onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { e.stopPropagation(); }}
    onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <header><div><span>FLIGHT PAUSED · LIVE TELEMETRY</span><h2 id="mobile-tactical-title">Tactical overview</h2></div><button onClick={onClose} aria-label="Close tactical overview"><X size={21} /></button></header>
    <div className="mobile-intel-scroll">
      <div className="mobile-run-stats"><div><span>SCORE</span><strong>{Math.floor(s.score).toLocaleString('en-US')}</strong></div><div><span>ELIMINATED</span><strong>{s.kills}</strong></div><div><span>CHAIN</span><strong>×{s.combo}</strong></div><div><span>HOSTILES</span><strong>{s.enemies}</strong></div></div>
      <ExpeditionHUD allowPaused /><MissionHUD /><EncounterHUD /><TargetReadout /><RadarPanel />
      <section className="mobile-build-summary" aria-label="Installed weapon modules"><h3>ARSENAL</h3>{(Object.keys(WEAPONS) as WeaponId[]).map(id => <div key={id}><span>{WEAPONS[id].name}</span><strong>{s.weapons[id] ? `LV ${s.weapons[id]}` : 'OFFLINE'}</strong></div>)}{s.weapons.glaive > 0 && <DroneStatus hull={s.droneHull} units={s.droneStatus} detailed />}</section>
      <RoverReadout />
      <section className="mobile-ordnance-summary" aria-label="Rocket launcher details"><h3>HELLION ROCKETS · {s.rocketAmmo}/{s.rocketCapacity}</h3><p>Tap the rocket button to fire at a clear target within 23m. A queued shot waits for alignment. Blue crates restore up to three rounds.</p><p>{s.rocketNoticeTime > 0 ? s.rocketNotice : 'No passive ammunition refill.'}</p><button onClick={onHelp}>ROCKET FLIGHT MANUAL <Rocket size={16} /></button></section>
      <div className="mobile-intel-footnote">{s.rescued} RESCUED · {s.missionsCompleted} OPERATIONS · {s.salvage} SALVAGE<br />{s.repair > 0 ? `REPAIR ${s.repair.toFixed(1)}s · ` : ''}{s.overdrive > 0 ? `OVERDRIVE ${s.overdrive.toFixed(1)}s · ` : ''}SECTOR {s.sector + 1} · {s.fps} FPS</div>
    </div>
    <footer><button onClick={onClose}>CLOSE & RESUME <Wind size={17} /></button></footer>
  </dialog>;
}

export default function MobileHUD({ intelOpen, onIntelOpen, onIntelClose, onHelp, movement }: { intelOpen: boolean; onIntelOpen: () => void; onIntelClose: () => void; onHelp: () => void; movement: ReactNode }) {
  const s = useGame(), playable = s.phase === 'playing', boss = engine.enemies.find(e => e.kind === 3 && e.hp > 0);
  const toggle = useRef<HTMLButtonElement>(null), wasOpen = useRef(false);
  useEffect(() => { if (wasOpen.current && !intelOpen) toggle.current?.focus(); wasOpen.current = intelOpen; }, [intelOpen]);
  const copy = LAUNCHER_COPY[s.launcherStatus];
  const roll = s.reward, winner = roll?.choices[roll.winner];
  const alert = s.rocketNoticeTime > 0 ? s.rocketNotice : s.chargeNoticeTime > 0 ? s.chargeNotice : s.announcementTime > 0 ? s.announcement : '';
  return <div className="hud mobile-hud">
    <header className="mobile-flight-strip"><div className={`mobile-integrity ${s.hp / s.maxHp < 0.3 ? 'critical' : ''}`}><span><Shield size={11} /> CORE <strong>{Math.ceil(s.hp)}/{s.maxHp}</strong></span><i><b style={{ width: `${s.hp / s.maxHp * 100}%` }} /></i><small>SHIELD {Math.ceil(s.shield)}/{s.maxShield}</small><i className="mobile-shield-bar"><b style={{ width: `${s.shield / s.maxShield * 100}%` }} /></i></div><div className="mobile-clock"><strong>{clock(s.time)}</strong><small>{s.service ? 'SERVICE' : boss ? 'SENTINEL' : `BOSS ${clock(s.sentinelIn)}`}</small></div><button ref={toggle} className="mobile-intel-toggle" aria-label="Open tactical overview" aria-haspopup="dialog" aria-expanded={intelOpen} aria-controls={intelOpen ? 'mobile-tactical-sheet' : undefined} onClick={onIntelOpen}><Layers3 size={19} /><span>TACTICAL</span>{s.mission?.status === 'active' && <i />}</button><button className="mobile-pause" aria-label="Pause game" onClick={() => s.setPhase('paused')}><Pause size={19} /></button></header>
    {boss && <div className="mobile-boss-meter"><span>SENTINEL · PHASE {s.bossPhase || 1}</span><i><b style={{ width: `${boss.hp / boss.maxHp * 100}%` }} /></i></div>}
    <NavigationSignals />
    {s.service && <button className="mobile-objective-chip" onClick={onIntelOpen}>SERVICE · {Math.ceil(s.service.remaining)}s · {Math.ceil(s.dockDistance)}m <span>OPEN</span></button>}
    {!s.service && s.mission?.status === 'active' && <button className="mobile-objective-chip" onClick={onIntelOpen}><Crosshair size={12} /> {s.mission.progress.toFixed(s.mission.kind === 'uplink' ? 1 : 0)}/{s.mission.goal} · {Math.ceil(s.mission.remaining)}s <span>MISSION</span></button>}
    {playable && alert && <div className="mobile-flight-alert" role="status" aria-live="polite">{alert}</div>}
    {roll && <div className="mobile-upgrade-chip" role="status" aria-live="polite">{roll.installed ? <><Zap size={12} /> {winner?.title} +{winner?.power}</> : <><Layers3 size={12} /> UPGRADE DECODING</>}{s.rewardQueued > 0 && <b>+{s.rewardQueued}</b>}</div>}
    {movement}
    <div className="mobile-rocket-state" aria-label="Rocket lock status">{s.rocketPending > 0 ? 'LOCKING' : s.rocketCooldown > 0 ? 'RELOADING' : s.rocketAmmo <= 0 ? 'ROCKETS EMPTY' : s.rocketReady ? 'ROCKET LOCKED' : s.launcherStatus === 'aligning' ? 'ALIGNING' : 'NO ROCKET LOCK'}</div>
    <div className="mobile-combat-actions" aria-label="Touch combat controls">
      <button className={`mobile-action dash ${s.dash <= 0 ? 'ready' : ''}`} aria-label="Phase shift" disabled={!playable} onClick={() => { if (playable) engine.input.dash = true; }}><Wind size={22} /><span>{s.dash <= 0 ? 'DASH' : `${s.dash.toFixed(1)}s`}</span></button>
      <button className={`mobile-action rocket ${s.rocketReady ? 'ready' : ''} ${s.rocketPending > 0 ? 'queued' : ''}`} aria-label="Launch rocket" disabled={!playable} title={copy.hint} onClick={() => engine.requestRocket()}><Rocket size={22} /><span>{s.rocketPending > 0 ? 'LOCKING' : s.rocketCooldown > 0 ? `${s.rocketCooldown.toFixed(1)}s` : `${s.rocketAmmo}/${s.rocketCapacity}`}</span></button>
      <ChargeControl />
      <button className={`mobile-action surge ${s.surge >= 100 ? 'ready' : ''}`} aria-label="Activate Vortex Surge" disabled={!playable || s.surge < 100} onClick={() => { engine.input.surge = true; }}><Zap size={22} /><span>{s.surge >= 100 ? 'EMP' : `${Math.floor(s.surge)}%`}</span></button>
    </div>
    <div className="mobile-xp"><span>LV {s.level}</span><i><b style={{ width: `${Math.min(100, s.xp / s.nextXp * 100)}%` }} /></i></div>
    {intelOpen && <TacticalSheet onClose={onIntelClose} onHelp={onHelp} />}
  </div>;
}
