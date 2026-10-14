'use client';

import { ArrowUp, Check, Clock, Radio, Users } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { missionGoal, missionLabel, RESCUE } from '@/game/missions';

export default function MissionHUD() {
  const s = useGame(), m = s.mission;
  if (!m) return null;
  const target = missionGoal(m,engine.player);
  const distance = target ? Math.hypot(target.x - engine.player.x, target.z - engine.player.z) : 0;
  const angle = target ? Math.atan2(target.x - engine.player.x, -(target.z - engine.player.z)) * 180 / Math.PI : 0;
  const channel = target ? target.progress / (m.kind === 'rescue' ? target.label==='EVACUATION ZONE'?RESCUE.evacuation:'injured' in target&&target.injured?RESCUE.wounded:RESCUE.prepare : 8) : 0;
  return <aside className={`mission-panel mission-${m.status}`} aria-label="Active field mission">
    <div className="mission-top"><span>{m.kind === 'rescue' ? <Users size={12} /> : <Radio size={12} />} FIELD OPERATION</span><strong><Clock size={10} /> {Math.ceil(m.remaining)}s</strong></div>
    <h3>{m.title}</h3><p>{m.description}</p>
    {m.blocked&&<p className="mission-blocked" role="status">{m.blocked}</p>}
    {m.kind==='rescue'&&m.evacuation&&<><div className="crew-status">{m.targets.map(t=><span key={t.id}><strong>P{t.id+1} · {t.done?'EVACUATED':t.stage==='following'?'FOLLOWING':t.injured?'WOUNDED':'STRANDED'}</strong><small>{t.done?'SAFE':`${Math.ceil(t.hp??100)}% HEALTH · ${Math.floor(t.progress/(t.injured?RESCUE.wounded:RESCUE.prepare)*100)}% READY`}</small></span>)}</div><p>EVACUATION {m.evacuation.progress.toFixed(1)}/{RESCUE.evacuation}s · Keep crew within 10m.</p></>}
    {m.kind==='escort'&&<p>CONVOY HULL {Math.ceil(m.targets[0]?.hp??0)}%</p>}
    <div className="mission-meter"><i style={{ width: `${m.progress / m.goal * 100}%` }} /></div>
    <div className="mission-progress"><strong>{m.status === 'complete' ? <><Check size={12} /> COMPLETE</> : m.status === 'failed' ? 'SIGNAL LOST' : `${missionLabel(m)} · ${m.kind === 'uplink' ? m.progress.toFixed(1) : m.progress} / ${m.goal}`}</strong><span>+{m.reward} CR</span></div>
    {m.status === 'active' && target && <div className="mission-navigation"><ArrowUp size={18} style={{ transform: `rotate(${angle}deg)` }} /><span>{Math.ceil(distance)}m · {target.label}</span>{channel > 0 && <strong>{Math.min(100,Math.floor(channel * 100))}% READY</strong>}</div>}
    <div className="mission-summary">{s.rescued} RESCUED · {s.missionsCompleted} MISSIONS COMPLETE</div>
  </aside>;
}
