'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, Plus, Radio, Shield, Zap } from 'lucide-react';
import { engine } from '@/game/engine';
import { SECTORS } from '@/game/progression';
import { useGame } from '@/game/store';
import MissionHUD from './mission-hud';
import TargetReadout from './target-lock';

export default function TacticalHUD() {
  const s = useGame(); const sector = SECTORS[s.sector];
  const contacts = engine.enemies.filter(e => Math.hypot(e.x - engine.player.x, e.z - engine.player.z) < 32).slice(0, 48);
  return <>
    <MissionHUD />
    <TargetReadout />
    <div className="tactical-meters"><div><span><Shield size={10} /> AEGIS SHIELD</span><strong>{Math.ceil(s.shield)} / {s.maxShield}</strong></div><div className="shield-meter"><i style={{ width: `${s.shield / s.maxShield * 100}%` }} /></div></div>
    <div className={`sector-readout ${s.sector === 4 ? 'boss-sector' : ''}`} style={{ color: sector.color }}><Radio size={11} /><span>SECTOR {String(s.sector + 1).padStart(2, '0')} / {sector.name}</span></div>
    <div className="radar-panel"><div className="radar-heading"><span>PROXIMITY SCAN</span><i /></div><svg viewBox="0 0 100 100" aria-label="Nearby enemies, salvage, and first-aid radar"><circle cx="50" cy="50" r="44" fill="#0a1716" stroke="#88cab42b" /><circle cx="50" cy="50" r="28" fill="none" stroke="#88cab418" /><circle cx="50" cy="50" r="13" fill="none" stroke="#88cab418" /><path d="M6 50H94M50 6V94" stroke="#88cab420" /><circle cx="50" cy="50" r="2.5" fill="#baff75" />{contacts.map(e => <circle key={e.id} cx={50 + (e.x - engine.player.x) * 1.35} cy={50 + (e.z - engine.player.z) * 1.35} r={e.kind === 3 ? 3.5 : e.elite ? 2.4 : 1.5} fill={e.elite ? '#ffd170' : e.kind === 1 ? '#ba99ff' : '#ff718e'} />)}{engine.caches.map((c, i) => Math.hypot(c.x - engine.player.x, c.z - engine.player.z) < 30 && <rect key={`c${i}`} x={48 + (c.x - engine.player.x) * 1.35} y={48 + (c.z - engine.player.z) * 1.35} width="4" height="4" fill="#ffd170" />)}{engine.supplies.map((supply, i) => supply.type === 'repair' && supply.age < 45 && Math.hypot(supply.x - engine.player.x, supply.z - engine.player.z) < 30 && <path key={`med${i}`} d="M-3 0H3M0-3V3" transform={`translate(${50 + (supply.x - engine.player.x) * 1.35},${50 + (supply.z - engine.player.z) * 1.35})`} stroke="#ff5269" strokeWidth="2" />)}{s.mission?.status === 'active' && s.mission.targets.map(t => !t.done && Math.hypot(t.x - engine.player.x, t.z - engine.player.z) < 30 && <circle key={`pilot${t.id}`} cx={50 + (t.x - engine.player.x) * 1.35} cy={50 + (t.z - engine.player.z) * 1.35} r="3" fill="#ffe0a0" stroke="#fff4d1" strokeWidth="0.6" />)}</svg><div className="radar-footer"><span>{s.elites} ELITES DOWN</span><span>{s.salvage} CR SALVAGED</span></div></div>
    <div className="surge-control"><button className={s.surge >= 100 ? 'charged' : ''} disabled={s.surge < 100 || s.phase !== 'playing'} onClick={() => { engine.input.surge = true; }} aria-label="Activate Vortex Surge"><Zap size={22} /><div><span>VORTEX SURGE</span><strong>{s.surge >= 100 ? 'DISCHARGE READY' : `${Math.floor(s.surge)}% CHARGING`}</strong></div><kbd>Q</kbd><i style={{ width: `${s.surge}%` }} /></button></div>
    <div className="combat-buffs">{s.repair > 0 && <div className="combat-buff repair-buff"><Plus size={14} /> FAST REPAIR · +4 HP/s <strong>{s.repair.toFixed(1)}s</strong></div>}{s.overdrive > 0 && <div className="combat-buff"><Zap size={12} /> OVERDRIVE <strong>{s.overdrive.toFixed(1)}s</strong></div>}</div>
    <AnimatePresence>{s.announcementTime > 0 && s.phase === 'playing' && <motion.div key={s.announcement} className="sector-toast" style={{ '--sector-color': sector.color } as React.CSSProperties} initial={{ opacity: 0, y: -12, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, x: '-50%' }}><span><Cpu size={12} /> PROTOCOL TRANSMISSION</span><strong>{s.announcement}</strong><p>{s.announcementDetail}</p></motion.div>}</AnimatePresence>
  </>;
}
