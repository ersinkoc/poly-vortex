'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, CircleDot, Cpu, Crosshair, Disc3, Hexagon, Pause, Play, Rocket, RotateCcw, Shield, SlidersHorizontal, Snowflake, Trophy, Wind, X, Zap } from 'lucide-react';
import MobileHUD from './mobile-hud';
import { useCompactHUD } from './use-compact-hud';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { audio } from '@/game/audio';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { ACHIEVEMENTS } from '@/game/progression';
import RocketGuide from './rocket-guide';
import ShipSelector from './ship-selector';
import LaunchMenu from './launch-menu';
import FlightHUD from './flight-hud';
import FlightManual from './flight-manual';

import { useShipSync } from './use-ship-sync';
import { WEAPONS, type Profile, type WeaponId } from '@/game/types';

const Arena = dynamic(() => import('./arena'), { ssr: false, loading: () => <div className="arena-loading"><Hexagon size={32} /><span>INITIALIZING THE VORTEX</span><i /></div> });
type Panel = 'protocol' | 'controls' | 'armory' | 'ships' | 'settings' | 'core' | 'records' | 'ordnance' | null;
const weaponIcons = { pulse: Crosshair, glaive: Disc3, cryo: Snowflake, tesla: Zap };
const panelTitles = { protocol: 'The protocol', controls: 'Visual flight manual', armory: 'Choose your arsenal', ships: 'Choose your warship', settings: 'System settings', core: 'Core modifications', records: 'Flight record', ordnance: 'Rocket flight manual' };
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

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button className={`toggle ${active ? 'active' : ''}`} role="switch" aria-checked={active} aria-label={label} onClick={onClick}><span /></button>;
}

function PanelContent({ panel }: { panel: Exclude<Panel, null> }) {
  const runMode = useGame(s => s.runMode);
  const aimMode = useGame(s => s.aimMode), reducedEffects = useGame(s => s.reducedEffects);
  const profile = useGame(s => s.profile), sound = useGame(s => s.sound), quality = useGame(s => s.quality), difficulty = useGame(s => s.difficulty), loadout = useGame(s => s.loadout);
  const adaptive = useGame(s => s.adaptiveQuality), budget = useGame(s => s.renderBudget);
  if (panel === 'ships') return <ShipSelector />;
  if (panel === 'ordnance') return <RocketGuide />;
  if (panel === 'records') return <>
    <p className="panel-intro">Every deployment leaves a signal. Your flight record is saved with your core.</p>
    <div className="profile-stats flight-stats"><div><span>LIFETIME HOSTILES</span><strong>{number(profile.totalKills)}</strong></div><div><span>DEPLOYMENTS</span><strong>{profile.runs}</strong></div><div><span>EXTRACTIONS</span><strong>{profile.wins}</strong></div></div>
    <div className="achievement-list">{ACHIEVEMENTS.map(a => { const unlocked = profile.achievements.includes(a.id); return <div className={unlocked ? 'unlocked' : ''} key={a.id}><span>{unlocked ? <Trophy size={20} /> : <Hexagon size={20} />}</span><div><h3>{a.name}</h3><p>{a.description}</p></div>{unlocked ? <Check size={16} /> : <span className="achievement-lock">LOCKED</span>}</div>; })}</div>
  </>;
  if (panel === 'controls') return <FlightManual />;
  if (panel === 'protocol') return <FlightManual />;
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
    <div className="setting-row"><div><h3>Render quality</h3><p>{adaptive ? `AUTO · ${['HIGH', 'BALANCED', 'LIGHT'][budget]} · Adapts resolution and detail for smooth combat.` : quality === 'high' ? 'Full shadows, layered smoke, debris and enhanced resolution.' : 'Light rendering with core lighting, bloom and combat signals retained.'}</p></div><div className="segmented"><button className={adaptive ? 'active' : ''} onClick={() => useGame.setState({ adaptiveQuality: true, quality: 'high', renderBudget: 0 })}>AUTO</button><button className={!adaptive && quality === 'high' ? 'active' : ''} onClick={() => useGame.setState({ adaptiveQuality: false, quality: 'high' })}>HIGH</button><button className={!adaptive && quality === 'performance' ? 'active' : ''} onClick={() => useGame.setState({ adaptiveQuality: false, quality: 'performance' })}>PERFORMANCE</button></div></div>
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
        const buttons = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]'); if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key, true); return () => { window.removeEventListener('keydown', key, true); previous?.focus(); };
  }, [close]);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}><motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="panel-title" className="panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onClick={e => e.stopPropagation()}><div className="panel-header"><div><span className="micro">POLY-VORTEX / SYSTEM INTERFACE</span><h2 id="panel-title">{panelTitles[panel]}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div><PanelContent panel={panel} /></motion.div></motion.div>;
}

function TouchControls({ showDash = true }: { showDash?: boolean }) {
  const base = useRef<HTMLDivElement>(null), [stick, setStick] = useState({ x: 0, y: 0 });
  const move = (e: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect(); if (!rect || useGame.getState().phase !== 'playing') return;
    const dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2, d = Math.max(35, Math.hypot(dx, dy));
    setStick({ x: dx / d * 35, y: dy / d * 35 }); engine.input.moveX = dx / d; engine.input.moveZ = dy / d; engine.input.aiming = false;
  };
  const stop = () => { setStick({ x: 0, y: 0 }); engine.input.moveX = 0; engine.input.moveZ = 0; };
  const phase = useGame(s => s.phase);
  useEffect(() => { if (phase !== 'playing') stop(); }, [phase]);
  return <div className="touch-controls"><div className="joystick" ref={base} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e); }} onPointerUp={stop} onPointerCancel={stop} role="button" aria-label="Touch movement joystick" tabIndex={0}><span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }}><Crosshair size={20} /></span></div>{showDash && <button className="touch-dash" onPointerDown={() => { engine.input.dash = true; }} aria-label="Phase shift"><Wind size={26} /><span>DASH</span></button>}</div>;
}

function PauseOverlay({ open }: { open: (p: Panel) => void }) {
  const canExtract = useGame(s => s.canExtract);
  return <motion.div className="game-overlay pause-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="pause-card"><span className="eyebrow"><Pause size={14} /> SIGNAL SUSPENDED</span><h2>Paused.</h2><p>Enemies and mission timers are paused.</p><button className="primary-button" onClick={() => useGame.getState().setPhase('playing')}>RESUME PROTOCOL <Play size={17} fill="currentColor" /></button><button className="secondary-button" onClick={() => open('settings')}>SYSTEM SETTINGS <SlidersHorizontal size={15} /></button>{canExtract && <button className="secondary-button" onClick={() => engine.extract()}>EXTRACT & BANK CREDITS <ArrowUpRight size={14} /></button>}<button className="text-button" onClick={() => { engine.publish(); useGame.getState().saveRun(engine.score, engine.kills, false, engine.salvage); }}>END RUN <ArrowUpRight size={13} /></button><button className="secondary-button" onClick={() => open('controls')}>VISUAL FLIGHT MANUAL <Crosshair size={15} /></button><small>PRESS ESC TO RESUME</small></div></motion.div>;
}

function ResultOverlay({ start, open }: { start: () => void; open: (p: Panel) => void }) {
  const s = useGame(), won = s.phase === 'won';
  return <motion.div className="game-overlay result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="result-card"><span className="result-symbol">{won ? <Trophy size={40} /> : <Hexagon size={40} />}</span><span className="eyebrow">{won ? 'EXTRACTION SUCCESSFUL' : 'CORE CONNECTION TERMINATED'}</span><h2>{won ? <>Extracted.</> : <>Run ended.</>}</h2><p>{won ? 'Credits banked. Choose your next deployment.' : 'Upgrade your core or try another ship.'}</p><div className="result-stats"><div><span>FINAL SCORE</span><strong>{number(s.score)}</strong></div><div><span>SURVIVED</span><strong>{time(s.time)}</strong></div><div><span>ELIMINATED</span><strong>{number(s.kills)}</strong></div></div><details className="result-detail"><summary>RUN DETAILS</summary><div className="result-extra"><span>PEAK CHAIN <strong>×{Math.floor(s.peakCombo)}</strong></span><span>ELITES <strong>{s.elites}</strong></span><span>SALVAGE <strong>{s.salvage} CR</strong></span><span>RESCUED <strong>{s.rescued}</strong></span><span>MISSIONS <strong>{s.missionsCompleted}</strong></span><span>SENTINELS <strong>{s.sentinels}</strong></span><span>FRONTS <strong>{s.chapter}</strong></span></div></details><div className="credits-earned"><Cpu size={18} /><span>CORE CREDITS EARNED</span><strong>+{s.earned} CR</strong></div><button className="primary-button" onClick={start}>DEPLOY AGAIN <RotateCcw size={18} /></button><button className="secondary-button result-ship-button" onClick={() => open('ships')}>CHOOSE NEXT SHIP <ArrowUpRight size={14} /></button><div className="result-actions"><button className="secondary-button" onClick={() => open('core')}>UPGRADE CORE <ArrowUpRight size={14} /></button><button className="secondary-button" onClick={() => s.setPhase('menu')}>COMMAND CENTER <ArrowRight size={14} /></button></div></div></motion.div>;
}

export default function GameShell() {
  useShipSync();
  const phase = useGame(s => s.phase), sound = useGame(s => s.sound);
  const reducedEffects = useGame(s => s.reducedEffects);
  const [panel, setPanel] = useState<Panel>(null);
  const compact = useCompactHUD(), [intelOpen, setIntelOpen] = useState(false), intelPaused = useRef(false);
  const closeIntel = useCallback(() => {
    setIntelOpen(false);
    if (intelPaused.current && useGame.getState().phase === 'paused') useGame.getState().setPhase('playing');
    intelPaused.current = false;
  }, []);
  const openIntel = () => {
    const s = useGame.getState(); if (s.phase !== 'playing' && s.phase !== 'paused') return;
    intelPaused.current = s.phase === 'playing';
    if (intelPaused.current) s.setPhase('paused');
    engine.input.keys.clear(); engine.input.moveX = 0; engine.input.moveZ = 0; engine.input.aiming = false;
    setIntelOpen(true);
  };
  const previousCompact = useRef(compact);
  useEffect(() => { if (previousCompact.current !== compact && intelOpen) closeIntel(); previousCompact.current = compact; }, [compact, intelOpen, closeIntel]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if(e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target instanceof HTMLElement && e.target.closest('input,textarea,select,dialog'))return; if(useGame.getState().phase==='playing'||useGame.getState().phase==='paused'){e.preventDefault();if(intelOpen)closeIntel();else openIntel()} }; window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key); }, [intelOpen,closeIntel]);
  useEffect(() => { if (phase !== 'paused' && intelOpen) { setIntelOpen(false); intelPaused.current = false; } }, [phase, intelOpen]);
  const intelHelp = () => { if (useGame.getState().phase === 'playing') useGame.getState().setPhase('paused'); setIntelOpen(false); intelPaused.current = false; setPanel('ordnance'); };
  const closePanel = useRef(() => setPanel(null));
  useEffect(() => { useGame.getState().hydrate(); return () => audio.stopMusic(); }, []);
  useEffect(() => { audio.setEnabled(sound); }, [sound]);
  useEffect(() => { if (phase === 'playing') audio.startMusic(); else audio.stopMusic(); }, [phase]);
  const start = () => { setPanel(null); void audio.unlock().catch(() => { useGame.setState({ sound: false }); }); useGame.getState().start(); };
  return <MotionConfig reducedMotion={reducedEffects ? 'always' : 'user'}><div className={`app-shell ${phase === 'menu' ? 'is-menu' : 'is-game'} ${reducedEffects ? 'reduced-effects' : ''}`}>
    <div className="arena-canvas"><ArenaBoundary>{(phase !== 'menu' || !compact) && <Arena />}</ArenaBoundary></div>
    <AnimatePresence mode="wait">{phase === 'menu' ? <LaunchMenu key="menu" open={setPanel} start={start} /> : <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="game-interface">{compact ? <MobileHUD resumeOnClose={intelPaused.current} intelOpen={intelOpen} onIntelOpen={openIntel} onIntelClose={closeIntel} onHelp={intelHelp} movement={<TouchControls showDash={false} />} /> : <FlightHUD resumeOnClose={intelPaused.current} intelOpen={intelOpen} onIntelOpen={openIntel} onIntelClose={closeIntel} onHelp={intelHelp} />}<AnimatePresence>{phase === 'paused' && !intelOpen && <PauseOverlay key="pause" open={setPanel} />}{(phase === 'dead' || phase === 'won') && <ResultOverlay key="result" start={start} open={setPanel} />}</AnimatePresence></motion.div>}</AnimatePresence>
    <AnimatePresence>{panel && <Modal key={panel} panel={panel} close={closePanel.current} />}</AnimatePresence>
  </div></MotionConfig>;
}
