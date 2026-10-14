'use client';

import { useEffect,useRef,useState } from 'react';
import { Crosshair, Disc3, Layers3, Orbit, Pause, ScanLine, Shield, Snowflake, Volume2, VolumeX, Wind, Zap } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { WEAPONS,type WeaponId } from '@/game/types';
import { FLIGHTFRAMES } from '@/game/flightframes';
import ChargeControl from './charge-control';
import BarrierControl from './barrier-control';
import RocketControl from './rocket-control';
import SentinelMeter from './sentinel-meter';
import RewardSlot from './reward-slot';
import NavigationSignals from './navigation-signals';
import ExpeditionHUD from './expedition-hud';
import { TacticalSheet } from './mobile-hud';

const icons={pulse:Crosshair,glaive:Disc3,cryo:Snowflake,tesla:Zap,rail:ScanLine,scatter:Orbit};
const clock=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
export default function FlightHUD({intelOpen,onIntelOpen,onIntelClose,onHelp,resumeOnClose=true}:{intelOpen:boolean;onIntelOpen:()=>void;onIntelClose:()=>void;onHelp:()=>void;resumeOnClose?:boolean}){
  const s=useGame(),m=s.mission,boss=engine.enemies.some(e=>e.kind===3&&e.hp>0),f=FLIGHTFRAMES[s.activeShip];
  const event = s.announcement.startsWith('SENTINEL') || ['MISSION COMPLETE','SIGNAL LOST','ESCORT LOST'].includes(s.announcement);
  const toggle=useRef<HTMLButtonElement>(null),wasOpen=useRef(false),[intro,setIntro]=useState(true);
  useEffect(()=>{setIntro(true);const timer=setTimeout(()=>setIntro(false),5000);return()=>clearTimeout(timer)},[s.runId]);
  useEffect(()=>{if(wasOpen.current&&!intelOpen)toggle.current?.focus();wasOpen.current=intelOpen},[intelOpen]);
  return <div className="hud hud-clean"><header className="flight-top"><section className="flight-integrity" aria-label="Ship integrity"><span style={{color:f.color}}>{f.name.toUpperCase()} <strong>{Math.ceil(s.hp)}/{s.maxHp}</strong></span><i className={s.hp/s.maxHp<.3?'critical':''}><b style={{width:`${s.hp/s.maxHp*100}%`}}/></i><small><Shield size={11}/>{Math.ceil(s.shield)}/{s.maxShield}</small></section><div className="flight-time"><strong>{clock(s.time)}</strong><span>{s.service?'SERVICE':boss?'SENTINEL':`BOSS ${clock(s.sentinelIn)}`}</span></div><div className="flight-tools"><span className="flight-score">{Math.floor(s.score).toLocaleString('en-US')} <small>SCORE</small></span><button ref={toggle} aria-label="Open tactical overview" aria-haspopup="dialog" aria-expanded={intelOpen} onClick={onIntelOpen}><Layers3 size={18}/><span>TACTICAL</span><kbd>T</kbd></button><button aria-label={s.sound?'Mute audio':'Enable audio'} onClick={()=>useGame.setState({sound:!s.sound})}>{s.sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button aria-label="Pause game" onClick={()=>s.setPhase('paused')}><Pause size={18}/></button></div></header>
    {boss&&<SentinelMeter/>}{!s.service&&m?.status==='active'&&<button className={`flight-objective ${boss?'with-boss':''}`} onClick={onIntelOpen} aria-label="Open current mission details"><Crosshair size={14}/><strong>{m.kind==='rescue'?'RESCUE':m.kind==='hunt'?'ELIMINATE':'UPLINK'} {m.progress.toFixed(m.kind==='uplink'?1:0)}/{m.goal}</strong><span>{Math.ceil(m.remaining)}s</span></button>}
    <NavigationSignals/>{s.service&&<ExpeditionHUD/>}<RewardSlot/>
    {event&&s.announcementTime>2.5&&s.phase==='playing'&&<div className={`flight-event ${boss?'boss-event':''}`} role="status" aria-live="polite">{s.announcement}</div>}
    <footer className="flight-bottom"><div className="flight-modules" aria-label="Installed weapon modules">{(Object.keys(WEAPONS)as WeaponId[]).filter(id=>s.weapons[id]>0).map(id=>{const Icon=icons[id];return <button key={id} onClick={onIntelOpen} title={`${WEAPONS[id].name} · level ${s.weapons[id]}`} style={{color:WEAPONS[id].color}}><Icon size={22}/><span>LV {s.weapons[id]}</span></button>})}</div><div className="flight-abilities"><button disabled={s.phase!=='playing'} className={s.dash<=0?'ready':''} onClick={()=>{engine.input.dash=true}} aria-label="Phase shift"><Wind size={20}/><span>{s.dash<=0?'DASH':`${s.dash.toFixed(1)}s`}</span><kbd>SPACE</kbd></button><ChargeControl/><BarrierControl/><button disabled={s.surge<100||s.phase!=='playing'} onClick={()=>{engine.input.surge=true}} aria-label="Activate Vortex Surge"><Zap size={20}/><span>{s.surge>=100?'EMP':`${Math.floor(s.surge)}%`}</span><kbd>Q</kbd></button></div><RocketControl compact onHelp={onHelp}/></footer>
    <div className="xp-container"><span>LV {s.level}</span><div className="xp-bar"><i style={{width:`${Math.min(100,s.xp/s.nextXp*100)}%`}}/></div><small>{Math.floor(s.xp)}/{s.nextXp} XP</small></div>
    {intro&&s.phase==='playing'&&<div className="flight-start-hint"><kbd>WASD</kbd> Move <Crosshair size={13}/> Aim <kbd>SPACE</kbd> Dash</div>}
    {s.rocketNoticeTime<=0&&s.chargeNoticeTime>0&&<div className="flight-alert" role="status">{s.chargeNotice}</div>}
    {s.repair>0&&<div className="flight-status"><Shield size={12}/>REPAIR {s.repair.toFixed(1)}s</div>}{s.overdrive>0&&<div className="flight-status overdrive"><Zap size={12}/>OVERDRIVE {s.overdrive.toFixed(1)}s</div>}
    {intelOpen&&<TacticalSheet onClose={onIntelClose} onHelp={onHelp} resumeOnClose={resumeOnClose}/>}
  </div>;
}
