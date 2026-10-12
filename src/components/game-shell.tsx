'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUpRight, Bomb, Check, ChevronRight, CircleDot, Cpu, Crosshair, Disc3, Expand, Hexagon, Keyboard, Layers3, MousePointer2, Orbit, Pause, Play, Radio, Rocket, RotateCcw, Shield, SlidersHorizontal, Snowflake, Sparkles, Trophy, Volume2, VolumeX, Wind, X, Zap } from 'lucide-react';
import ChargeControl from './charge-control';
import RoverReadout from './rover-readout';
import DroneStatus from './drone-status';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { audio } from '@/game/audio';
import { engine } from '@/game/engine';
import ExpeditionHUD from './expedition-hud';
import { useGame } from '@/game/store';
import { ACHIEVEMENTS } from '@/game/progression';
import RewardSlot from './reward-slot';
import TacticalHUD from './tactical-hud';
import RocketGuide from './rocket-guide';
import { WEAPONS, type Profile, type WeaponId } from '@/game/types';

const Arena = dynamic(() => import('./arena'), { ssr: false, loading: () => <div className="arena-loading"><Hexagon size={32} /><span>INITIALIZING THE VORTEX</span><i /></div> });
type Panel = 'protocol' | 'controls' | 'armory' | 'settings' | 'core' | 'records' | 'ordnance' | null;
const weaponIcons = { pulse: Crosshair, glaive: Disc3, cryo: Snowflake, tesla: Zap };
const panelTitles = { protocol: 'The protocol', controls: 'Know your controls', armory: 'Choose your arsenal', settings: 'System settings', core: 'Core modifications', records: 'Flight record', ordnance: 'Rocket flight manual' };
const number = (n: number) => Math.floor(n).toLocaleString('en-US');
const time = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${Math.floor(n % 60).toString().padStart(2, '0')}`;

class ArenaBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return <div className="arena-error"><Hexagon size={40} /><h2>Graphics connection lost</h2><p>This arena needs WebGL 2. Enable hardware acceleration in your browser, then reconnect.</p><button className="primary-button" onClick={() => window.location.reload()}>RECONNECT <RotateCcw size={16} /></button></div>;
    return this.props.children;
  }
}

function Logo({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><span className="brand-symbol"><Hexagon size={35} strokeWidth={1.4} /><Zap size={17} strokeWidth={2.2} /></span><div>POLY<span className="brand-divider">/</span>VORTEX<small>NEON PROTOCOL</small></div></div>;
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button className={`toggle ${active ? 'active' : ''}`} role="switch" aria-checked={active} aria-label={label} onClick={onClick}><span /></button>;
}

function Menu({ open, start }: { open: (panel: Panel) => void; start: () => void }) {
  const runMode = useGame(s => s.runMode);
  const sound = useGame(s => s.sound), profile = useGame(s => s.profile), difficulty = useGame(s => s.difficulty), loadout = useGame(s => s.loadout);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const update = () => setFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
  const expand = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* The game remains playable when embedding disables fullscreen. */ } };
  return <motion.div className="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <header className="header">
      <Logo />
      <nav aria-label="Main navigation"><button onClick={() => open('protocol')}>THE PROTOCOL</button><button onClick={() => open('controls')}>HOW TO PLAY</button><button onClick={() => open('armory')}>ARMORY <ArrowUpRight size={13} /></button><button onClick={() => open('records')}>FLIGHT LOG</button></nav>
      <div className="header-actions"><span className="online-status"><i /> SYSTEM ONLINE</span><button className="icon-button" title={sound ? 'Mute audio' : 'Enable audio'} aria-label={sound ? 'Mute audio' : 'Enable audio'} onClick={() => { useGame.setState({ sound: !sound }); void audio.unlock().catch(() => undefined); }}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="icon-button" aria-label="Settings" title="Settings" onClick={() => open('settings')}><SlidersHorizontal size={18} /></button></div>
    </header>
    <main className="menu-main">
      <div className="hero-copy">
        <motion.div className="eyebrow" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}><span className="tiny-cross">+</span> A GEOMETRIC ROGUELITE <span className="version">V.21</span></motion.div>
        <motion.h1 initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18, duration: 0.6 }}>SHAPE<br />THE <span className="title-star">✳</span><br /><span>CHAOS.</span></motion.h1>
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28 }}>
          <p className="hero-description">One core. Infinite chaos.<br />Outlast the swarm. Evolve your arsenal.<br /><span>Break the protocol.</span></p>
          <div className="run-route" aria-label="Run duration"><button aria-pressed={runMode === 'expedition'} onClick={() => useGame.setState({ runMode: 'expedition' })}>EXPEDITION <small>KEEP GOING</small></button><button aria-pressed={runMode === 'classic'} onClick={() => useGame.setState({ runMode: 'classic' })}>CLASSIC <small>ONE SENTINEL</small></button></div>
          <button className="primary-button enter-button" onClick={start}><span><Play size={15} fill="currentColor" /> ENTER THE VORTEX</span><ArrowUpRight size={24} /></button>
          <div className="start-meta"><span><i /> NO DOWNLOAD. JUST SURVIVE.</span><button onClick={() => open('controls')}>CONTROLS <Keyboard size={14} /></button></div>
        </motion.div>
      </div>
      <div className="preview-chrome">
        <div className="preview-top"><span><Radio size={13} /> LIVE SIMULATION</span><span>SECTOR_07 <span className="muted">//</span> THE VORTEX</span></div>
        <div className="preview-coordinate coord-one">X: 00.000<br />Y: 00.000<br /><span>CORE SIGNAL: STABLE</span></div>
        <div className="core-label"><span className="label-line" /><div><span className="micro">YOUR ONLY CONSTANT</span><strong>THE POLY-CORE</strong><small>MK.01 <span>·</span> PHASE-SHIFT ENABLED</small></div></div>
        <div className="arena-spec"><div><span className="signal-bars"><i /><i /><i /><i /><i /></span> REACTOR OUTPUT <strong>98.4%</strong></div><button className="icon-button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={expand}><Expand size={18} /></button></div>
      </div>
      <div className="mission-strip">
        <div className="mission-strip-title"><span className="micro">THE LOOP</span><strong>SURVIVE. EVOLVE. REPEAT.</strong><ArrowDown size={15} /></div>
        <div className="feature"><span className="feature-icon"><Layers3 size={22} /></span><div><h3>INFINITE PRESSURE</h3><p>Relentless swarms. No two runs alike.</p></div></div>
        <div className="feature"><span className="feature-icon"><Zap size={22} /></span><div><h3>UNLIMITED POTENTIAL</h3><p>Four weapon systems. Your evolution.</p></div></div>
        <div className="feature"><span className="feature-icon"><Orbit size={24} /></span><div><h3>PURE NEON ENERGY</h3><p>Procedural worlds. Unfiltered chaos.</p></div></div>
      </div>
      <div className="deployment-bar"><span><CircleDot size={14} /> READY FOR DEPLOYMENT</span><button onClick={() => open('settings')}>MODE <strong>{difficulty === 'standard' ? 'STANDARD' : 'OVERDRIVE'}</strong><ChevronRight size={13} /></button><button onClick={() => open('armory')}>LOADOUT <strong>{WEAPONS[loadout].name.toUpperCase()}</strong><ChevronRight size={13} /></button><button onClick={() => open('core')}>CORE CREDITS <strong>{number(profile.credits)}</strong><ArrowUpRight size={13} /></button></div>
    </main>
    <footer className="footer"><span>DESIGNED TO BE OUTNUMBERED.</span><span className="footer-center"><i /> ALL SYSTEMS PROCEDURAL</span><button onClick={() => open('records')}>PERSONAL BEST <strong>{number(profile.best).padStart(6, '0')}</strong><Trophy size={13} /></button><span className="build-number">BUILD 021 / 2026</span></footer>
  </motion.div>;
}

function PanelContent({ panel }: { panel: Exclude<Panel, null> }) {
  const runMode = useGame(s => s.runMode);
  const aimMode = useGame(s => s.aimMode), reducedEffects = useGame(s => s.reducedEffects);
  const profile = useGame(s => s.profile), sound = useGame(s => s.sound), quality = useGame(s => s.quality), difficulty = useGame(s => s.difficulty), loadout = useGame(s => s.loadout);
  if (panel === 'ordnance') return <RocketGuide />;
  if (panel === 'records') return <>
    <p className="panel-intro">Every deployment leaves a signal. Your flight record is saved with your core.</p>
    <div className="profile-stats flight-stats"><div><span>LIFETIME HOSTILES</span><strong>{number(profile.totalKills)}</strong></div><div><span>DEPLOYMENTS</span><strong>{profile.runs}</strong></div><div><span>EXTRACTIONS</span><strong>{profile.wins}</strong></div></div>
    <div className="achievement-list">{ACHIEVEMENTS.map(a => { const unlocked = profile.achievements.includes(a.id); return <div className={unlocked ? 'unlocked' : ''} key={a.id}><span>{unlocked ? <Trophy size={20} /> : <Hexagon size={20} />}</span><div><h3>{a.name}</h3><p>{a.description}</p></div>{unlocked ? <Check size={16} /> : <span className="achievement-lock">LOCKED</span>}</div>; })}</div>
  </>;
  if (panel === 'controls') return <>
    <p className="panel-intro">Weapons fire at a clear, locked hostile. Move the mouse to aim: targets outside your aiming cone are ignored. Keep moving and collect prisms.</p>
    <div className="control-row"><span><Keyboard /> MOVEMENT</span><div className="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><em>or arrow keys</em></div></div>
    <div className="control-row"><span><MousePointer2 /> AIM DIRECTION</span><div className="keys"><kbd>MOUSE</kbd></div></div>
    <div className="control-row"><span><Crosshair /> TARGETING MODE</span><div className="keys"><kbd>F</kbd><em>assisted / precision</em></div></div>
    <div className="control-row"><span><Wind /> PHASE SHIFT</span><div className="keys"><kbd>SPACE</kbd><em>or right-click</em></div></div>
    <div className="control-row"><span><Zap /> VORTEX SURGE</span><div className="keys"><kbd>Q</kbd><em>EMP / clear bullets</em></div></div>
    <div className="control-row"><span><Rocket /> HELLION ROCKET</span><div className="keys"><kbd>E</kbd><em>6 rounds / ammo crates refill 3</em></div></div>
    <div className="control-row"><span><Bomb /> GROUND CHARGE</span><div className="keys"><kbd>B</kbd><em>3 charges / 3s fuse / 5.5m blast</em></div></div>
    <div className="control-row"><span><Pause /> PAUSE</span><div className="keys"><kbd>ESC</kbd></div></div>
    <div className="control-row"><span><Layers3 /> MODULE REEL</span><div className="keys"><em>Automatic / keep moving</em></div></div>
    <div className="control-row"><span><Shield /> FIELD SERVICE</span><div className="keys"><em>Green beacon / stop for 3s</em></div></div>
    <div className="tip"><Shield size={18} /><p><strong>Heavy siege vehicles</strong>Goliaths hold at 9–12m and retreat if you close in. Amber barrels warn before a single slow shell; change direction during their one-second aim lock. They leave at least 7.5 seconds between shots, including elites. Rocks block their firing lane.</p></div>
    <div className="tip"><Bomb size={18} /><p><strong>Leave a trap behind</strong>Press B or tap the charge icon to plant a bomb at your current position. Follow its countdown and lure pursuers into the amber circle. It explodes after three seconds. Rocks block the blast; your core and pilots are protected. Move clear before placing another. Blue crates refill one charge, up to three; there is no passive refill.</p></div>
    <div className="tip"><Cpu size={18} /><p><strong>Automatic ground support</strong>The rover bay releases three or six four-wheel mines in random directions, starting at ten seconds and repeating every 24–36 seconds of combat. They drive 9–14m, stop before rocks, and arm at their destination. A nearby hostile triggers a brief red warning, then a blast. Idle mines self-detonate after twelve seconds. Your core and pilots are protected. The rover bay has its own automatic cycle and does not spend B charges or rockets; new launches wait during field service.</p></div>
    <div className="tip"><Radio size={18} /><p><strong>Long-range expedition</strong>Each Sentinel opens a 30-second service window. Clear the beacon perimeter and stop there for three seconds without taking damage. Service restores 35% hull, shields, three rockets, one charge and 50 EMP once. Extract at the beacon to bank credits, or keep playing into the next front automatically. Escape pauses all timers.</p></div>
    <div className="tip"><Sparkles size={18} /><p><strong>A little advice</strong>Dash through danger: phase shift makes you briefly invulnerable. Collect cyan prisms to level up. Gold elites drop rare salvage. Mouse aim focuses the pulse salvo on one hostile. Rocks stop bullets, and pilots in the firing line hold friendly fire. Q discharges your EMP, and blue shields regenerate after four seconds without a hit. Amber signals mark stranded pilots: stay in their perimeter for 1.5 seconds to extract. Follow the field-operation arrow for timed missions. E fires a limited rocket at your locked target. Blue crates refill up to three rockets and 20 EMP charge. Red first-aid cases are rare. Touch controls appear on mobile.</p></div>
  </>;
  if (panel === 'protocol') return <>
    <p className="panel-intro">You are the last stable core in a collapsing geometric system. The protocol wants you erased. Rewrite it.</p>
    {[['01', 'Survive the swarm', 'Move through an infinite arena as chasers, orbiters, and heavy goliaths close in. Your core tracks one visible hostile. Mouse aim chooses your firing lane.'], ['02', 'Evolve in real time', 'Collect XP prisms. The side reel automatically installs one randomized upgrade. Keep moving while rewards queue. Stack rare and overclocked modules into devastating builds.'], ['03', 'Bring them home', 'Rescue stranded pilots, restore communication relays, and break enemy blockades. Complete timed operations for bonus credits, repairs, and EMP charge.'], ['04', 'Break the protocol', 'Every front has a Sentinel after three minutes. Expedition keeps your build: clear the green beacon, stop there for three seconds, then extract during its 30-second window or continue automatically. Classic ends at the first Sentinel. Bank credits for permanent upgrades.']].map(([n, title, copy]) => <div className="brief-step" key={n}><span>{n}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}
    <div className="protocol-bottom"><Hexagon size={20} /><span>ONE CORE. ONE CHANCE. <strong>MAKE IT COUNT.</strong></span></div>
  </>;
  if (panel === 'armory') return <>
    <p className="panel-intro">Select your starting module. The pulse cannon is always equipped. Find and evolve every system during your run.</p>
    <div className="armory-list">{(Object.keys(WEAPONS) as WeaponId[]).map(id => { const w = WEAPONS[id], Icon = weaponIcons[id]; return <button className={`weapon-option ${loadout === id ? 'selected' : ''}`} style={{ '--weapon-color': w.color } as React.CSSProperties} key={id} onClick={() => useGame.setState({ loadout: id })}><span className="weapon-option-icon"><Icon size={27} /></span><div><span className="micro">{w.code}</span><h3>{w.name}</h3><p>{w.description}</p></div><span className="select-indicator">{loadout === id && <Check size={13} />}</span></button>; })}</div>
    <div className="panel-footnote"><CircleDot size={13} /> CHANGES APPLY TO YOUR NEXT DEPLOYMENT</div>
    <a className="fleet-link" href="/hangar" target="_blank" rel="noreferrer">INSPECT THE FLEET <ArrowUpRight size={15} /></a>
  </>;
  if (panel === 'settings') return <>
    <p className="panel-intro">Tune your connection to the vortex.</p>
    <div className="setting-row"><div><h3>Deployment length</h3><p>Expedition keeps your build through successive fronts. After each Sentinel, dock for service and choose extraction or continuation. Classic ends at the first Sentinel. Applies next run.</p></div><div className="segmented"><button className={runMode === 'expedition' ? 'active' : ''} onClick={() => useGame.setState({ runMode: 'expedition' })}>EXPEDITION</button><button className={runMode === 'classic' ? 'active' : ''} onClick={() => useGame.setState({ runMode: 'classic' })}>CLASSIC</button></div></div>
    <div className="setting-row"><div><h3>Targeting control</h3><p>{aimMode === 'precision' ? 'Only fire in your mouse aim cone. No automatic fallback.' : 'Mouse aim takes priority. Track automatically when the cursor leaves.'} Press F during flight.</p></div><div className="segmented"><button className={aimMode === 'assisted' ? 'active' : ''} onClick={() => useGame.setState({ aimMode: 'assisted' })}>ASSISTED</button><button className={aimMode === 'precision' ? 'active' : ''} onClick={() => useGame.setState({ aimMode: 'precision' })}>PRECISION</button></div></div>
    <div className="setting-row"><div><h3>Reduced effects</h3><p>Disable camera shake, hit distortion and interface motion. Combat warnings remain visible.</p></div><Toggle label="Reduced effects" active={reducedEffects} onClick={() => useGame.setState({ reducedEffects: !reducedEffects })} /></div>
    <div className="setting-row"><div><h3>Procedural audio</h3><p>Synth bassline, laser pulses, and reactive effects.</p></div><Toggle label="Procedural audio" active={sound} onClick={() => { useGame.setState({ sound: !sound }); void audio.unlock().catch(() => undefined); }} /></div>
    <div className="setting-row"><div><h3>Render quality</h3><p>{quality === 'high' ? 'Soft shadows, layered smoke, metal debris and enhanced resolution.' : 'Reduced resolution. Shadows, dense smoke and debris disabled.'}</p></div><div className="segmented"><button className={quality === 'high' ? 'active' : ''} onClick={() => useGame.setState({ quality: 'high' })}>HIGH</button><button className={quality === 'performance' ? 'active' : ''} onClick={() => useGame.setState({ quality: 'performance' })}>PERFORMANCE</button></div></div>
    <div className="setting-label">DEPLOYMENT DIFFICULTY</div>
    <div className="difficulty-options"><button className={difficulty === 'standard' ? 'selected' : ''} onClick={() => useGame.setState({ difficulty: 'standard' })}><Shield size={23} /><strong>STANDARD</strong><p>The original protocol.<br />A fair fight against impossible odds.</p>{difficulty === 'standard' && <Check size={16} />}</button><button className={difficulty === 'overdrive' ? 'selected' : ''} onClick={() => useGame.setState({ difficulty: 'overdrive' })}><Zap size={23} /><strong>OVERDRIVE</strong><p>Faster swarms. Stronger enemies.<br />For cores that crave chaos.</p>{difficulty === 'overdrive' && <Check size={16} />}</button></div>
    <div className="panel-footnote"><CircleDot size={13} /> DIFFICULTY APPLIES TO YOUR NEXT RUN</div>
  </>;
  const mods: { id: keyof Profile['upgrades']; title: string; copy: string; icon: typeof Shield }[] = [
    { id: 'armor', title: 'Reinforced core', copy: '+15 starting integrity per level', icon: Shield },
    { id: 'reactor', title: 'Charged reactor', copy: '+8% starting weapon damage per level', icon: Cpu },
    { id: 'thrusters', title: 'Vector thrusters', copy: '+6% starting movement speed per level', icon: Wind },
  ];
  return <>
    <div className="credit-card"><span><Cpu size={17} /> AVAILABLE CORE CREDITS</span><strong>{number(profile.credits)} <small>CR</small></strong></div>
    <p className="panel-intro">Death is data. Invest your run credits in permanent improvements. Modifications persist between sessions.</p>
    {mods.map(({ id, title, copy, icon: Icon }) => { const level = profile.upgrades[id], cost = 50 + level * 50; return <div className="mod-row" key={id}><Icon size={24} /><div><h3>{title}</h3><p>{copy}</p><div className="mod-pips">{Array.from({ length: 5 }, (_, i) => <i className={i < level ? 'filled' : ''} key={i} />)}<span>LV. {level}/5</span></div></div><button disabled={level === 5 || profile.credits < cost} onClick={() => useGame.getState().purchase(id)}>{level === 5 ? 'MAXED' : `${cost} CR`}{level < 5 && <ArrowUpRight size={13} />}</button></div>; })}
    <div className="profile-stats"><div><span>DEPLOYMENTS</span><strong>{profile.runs}</strong></div><div><span>EXTRACTIONS</span><strong>{profile.wins}</strong></div><div><span>PERSONAL BEST</span><strong>{number(profile.best)}</strong></div></div>
  </>;
}

function Modal({ panel, close }: { panel: Exclude<Panel, null>; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
      if (e.key === 'Tab') {
        const buttons = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'); if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key, true); return () => { window.removeEventListener('keydown', key, true); previous?.focus(); };
  }, [close]);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}><motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="panel-title" className="panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onClick={e => e.stopPropagation()}><div className="panel-header"><div><span className="micro">POLY-VORTEX / SYSTEM INTERFACE</span><h2 id="panel-title">{panelTitles[panel]}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div><PanelContent panel={panel} /></motion.div></motion.div>;
}

function HUD({ open }: { open: (panel: Panel) => void }) {
  const s = useGame();
  const [notice, setNotice] = useState(true);
  useEffect(() => { setNotice(true); const t = setTimeout(() => setNotice(false), 6500); return () => clearTimeout(t); }, [s.runId]);
  const bossEnemy = engine.enemies.find(e => e.kind === 3 && e.hp > 0);
  const boss = !!bossEnemy;
  return <div className="hud">
    <div className="hud-top"><div className="hud-core"><Logo small /><div className="integrity-label"><span>CORE INTEGRITY</span><strong>{Math.ceil(s.hp)}<small> / {s.maxHp}</small></strong></div><div className={`integrity-bar ${s.hp / s.maxHp < 0.3 ? 'critical' : ''}`}><i style={{ width: `${s.hp / s.maxHp * 100}%` }} /></div></div><div className="hud-timer"><span>{s.service ? 'SERVICE WINDOW' : boss ? 'SENTINEL AWAKENED' : 'SURVIVE THE PROTOCOL'}</span><strong>{time(s.time)}</strong><small>{s.service ? `NEXT FRONT IN ${Math.ceil(s.service.remaining)}s` : boss ? 'DESTROY TO OPEN EXTRACTION' : `SENTINEL IN ${time(s.sentinelIn)}`}</small></div><div className="hud-right"><button className="icon-button" aria-label={s.sound ? 'Mute audio' : 'Enable audio'} onClick={() => useGame.setState({ sound: !s.sound })}>{s.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="icon-button" aria-label="Pause game" onClick={() => { if (s.phase === 'playing') s.setPhase('paused'); }}><Pause size={18} /></button><div className="score"><span>SCORE</span><strong>{number(s.score).padStart(6, '0')}</strong><small>{number(s.kills)} ELIMINATED</small></div></div></div>
    {boss && bossEnemy && <div className="boss-bar"><span>VORTEX SENTINEL // PHASE {s.bossPhase || 1}</span><div><i style={{ width: `${bossEnemy.hp / bossEnemy.maxHp * 100}%` }} /></div></div>}
    <AnimatePresence>{notice && s.phase === 'playing' && <motion.div className="deploy-notice" initial={{ opacity: 0, y: 10, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, x: '-50%' }}><span>PROTOCOL INITIATED</span><h2>KEEP. MOVING.</h2><p>Mouse aims. E fires rockets. B plants a timed charge. Q clears the swarm.</p></motion.div>}</AnimatePresence>
    {s.combo >= 2 && <div className="combo"><strong>×{Math.floor(s.combo)}</strong><span>CHAIN MULTIPLIER</span></div>}
    <div className="hud-bottom"><div className="weapon-slots">{(Object.keys(WEAPONS) as WeaponId[]).map(id => { const Icon = weaponIcons[id], lv = s.weapons[id]; return <div key={id} className={`weapon-slot ${lv ? 'equipped' : ''} ${id === 'glaive' && lv ? 'escort-slot' : ''}`} style={{ '--weapon-color': WEAPONS[id].color } as React.CSSProperties} title={`${WEAPONS[id].name} · ${lv ? `Level ${lv}` : 'Not equipped'}`}><Icon size={23} /><span>{lv ? `LV ${lv}` : '—'}</span>{id === 'glaive' && lv > 0 && <DroneStatus hull={s.droneHull} />}</div>; })}<div className={`dash-slot ${s.dash <= 0 ? 'ready' : ''}`}><Wind size={22} /><div><span>PHASE SHIFT</span><strong>{s.dash <= 0 ? 'READY' : `${s.dash.toFixed(1)}s`}</strong></div><kbd>SPACE</kbd></div><ChargeControl /></div><div className="hud-performance"><span><i /> SECTOR_{String(s.sector + 1).padStart(2, '0')}</span><small>{s.enemies} HOSTILES <span>/</span> {s.fps} FPS</small></div></div>
    <div className="xp-container"><span>LV. {s.level}</span><div className="xp-bar"><i style={{ width: `${Math.min(100, s.xp / s.nextXp * 100)}%` }} /></div><small>{Math.floor(s.xp)} / {s.nextXp} XP</small></div>
    <RewardSlot /><ExpeditionHUD /><RoverReadout /><TacticalHUD onOrdnanceHelp={() => { if (useGame.getState().phase === 'playing') useGame.getState().setPhase('paused'); open('ordnance'); }} /><TouchControls />
  </div>;
}

function TouchControls() {
  const base = useRef<HTMLDivElement>(null), [stick, setStick] = useState({ x: 0, y: 0 });
  const move = (e: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect(); if (!rect) return;
    const dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2, d = Math.max(35, Math.hypot(dx, dy));
    setStick({ x: dx / d * 35, y: dy / d * 35 }); engine.input.moveX = dx / d; engine.input.moveZ = dy / d; engine.input.aiming = false;
  };
  const stop = () => { setStick({ x: 0, y: 0 }); engine.input.moveX = 0; engine.input.moveZ = 0; };
  const phase = useGame(s => s.phase);
  useEffect(() => { if (phase !== 'playing') stop(); }, [phase]);
  return <div className="touch-controls"><div className="joystick" ref={base} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e); }} onPointerUp={stop} onPointerCancel={stop} role="button" aria-label="Touch movement joystick" tabIndex={0}><span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }}><Crosshair size={20} /></span></div><button className="touch-dash" onPointerDown={() => { engine.input.dash = true; }} aria-label="Phase shift"><Wind size={26} /><span>DASH</span></button></div>;
}

function PauseOverlay({ open }: { open: (p: Panel) => void }) {
  const canExtract = useGame(s => s.canExtract);
  return <motion.div className="game-overlay pause-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="pause-card"><span className="eyebrow"><Pause size={14} /> SIGNAL SUSPENDED</span><h2>TAKE A<br /><em>BREATHER.</em></h2><p>Your core is safe. The chaos can wait.</p><button className="primary-button" onClick={() => useGame.getState().setPhase('playing')}>RESUME PROTOCOL <Play size={17} fill="currentColor" /></button><button className="secondary-button" onClick={() => open('settings')}>SYSTEM SETTINGS <SlidersHorizontal size={15} /></button>{canExtract && <button className="secondary-button" onClick={() => engine.extract()}>EXTRACT & BANK CREDITS <ArrowUpRight size={14} /></button>}<button className="text-button" onClick={() => { engine.publish(); useGame.getState().saveRun(engine.score, engine.kills, false, engine.salvage); }}>END RUN <ArrowUpRight size={13} /></button><small>PRESS ESC TO RESUME</small></div></motion.div>;
}

function ResultOverlay({ start, open }: { start: () => void; open: (p: Panel) => void }) {
  const s = useGame(), won = s.phase === 'won';
  return <motion.div className="game-overlay result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="result-card"><span className="result-symbol">{won ? <Trophy size={40} /> : <Hexagon size={40} />}</span><span className="eyebrow">{won ? 'EXTRACTION SUCCESSFUL' : 'CORE CONNECTION TERMINATED'}</span><h2>{won ? <>PROTOCOL<br /><em>BROKEN.</em></> : <>DEATH IS<br /><em>JUST DATA.</em></>}</h2><p>{won ? 'You rewrote the rules. The vortex remembers.' : 'Every run makes you stronger. Deploy again.'}</p><div className="result-stats"><div><span>FINAL SCORE</span><strong>{number(s.score)}</strong></div><div><span>SURVIVED</span><strong>{time(s.time)}</strong></div><div><span>ELIMINATED</span><strong>{number(s.kills)}</strong></div></div><div className="result-extra"><span>PEAK CHAIN <strong>×{Math.floor(s.peakCombo)}</strong></span><span>ELITES <strong>{s.elites}</strong></span><span>SALVAGE <strong>{s.salvage} CR</strong></span><span>RESCUED <strong>{s.rescued}</strong></span><span>MISSIONS <strong>{s.missionsCompleted}</strong></span><span>SENTINELS <strong>{s.sentinels}</strong></span><span>FRONTS <strong>{s.chapter}</strong></span></div><div className="credits-earned"><Cpu size={18} /><span>CORE CREDITS EARNED</span><strong>+{s.earned} CR</strong></div><button className="primary-button" onClick={start}>DEPLOY AGAIN <RotateCcw size={18} /></button><div className="result-actions"><button className="secondary-button" onClick={() => open('core')}>UPGRADE CORE <ArrowUpRight size={14} /></button><button className="secondary-button" onClick={() => s.setPhase('menu')}>COMMAND CENTER <ArrowRight size={14} /></button></div></div></motion.div>;
}

export default function GameShell() {
  const phase = useGame(s => s.phase), sound = useGame(s => s.sound);
  const reducedEffects = useGame(s => s.reducedEffects);
  const [panel, setPanel] = useState<Panel>(null);
  const closePanel = useRef(() => setPanel(null));
  useEffect(() => { useGame.getState().hydrate(); return () => audio.stopMusic(); }, []);
  useEffect(() => { audio.setEnabled(sound); }, [sound]);
  useEffect(() => { if (phase === 'playing') audio.startMusic(); else audio.stopMusic(); }, [phase]);
  const start = () => { setPanel(null); void audio.unlock().catch(() => { useGame.setState({ sound: false }); }); useGame.getState().start(); };
  return <MotionConfig reducedMotion={reducedEffects ? 'always' : 'user'}><div className={`app-shell ${phase === 'menu' ? 'is-menu' : 'is-game'} ${reducedEffects ? 'reduced-effects' : ''}`}>
    <div className="arena-canvas"><ArenaBoundary><Arena /></ArenaBoundary></div>
    <AnimatePresence mode="wait">{phase === 'menu' ? <Menu key="menu" open={setPanel} start={start} /> : <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="game-interface"><HUD open={setPanel} /><AnimatePresence>{phase === 'paused' && <PauseOverlay key="pause" open={setPanel} />}{(phase === 'dead' || phase === 'won') && <ResultOverlay key="result" start={start} open={setPanel} />}</AnimatePresence></motion.div>}</AnimatePresence>
    <AnimatePresence>{panel && <Modal key={panel} panel={panel} close={closePanel.current} />}</AnimatePresence>
  </div></MotionConfig>;
}
