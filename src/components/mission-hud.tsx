'use client';

import { ArrowUp, Check, Clock, Radio, Users } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';

export default function MissionHUD() {
  const s = useGame(), m = s.mission;
  if (!m) return null;
  const target = m.targets.filter(t => !t.done).sort((a, b) => Math.hypot(a.x - engine.player.x, a.z - engine.player.z) - Math.hypot(b.x - engine.player.x, b.z - engine.player.z))[0];
  const distance = target ? Math.hypot(target.x - engine.player.x, target.z - engine.player.z) : 0;
  const angle = target ? Math.atan2(target.x - engine.player.x, -(target.z - engine.player.z)) * 180 / Math.PI : 0;
  const channel = target ? target.progress / (m.kind === 'rescue' ? 1.5 : 8) : 0;
  return <aside className={`mission-panel mission-${m.status}`} aria-label="Active field mission">
    <div className="mission-top"><span>{m.kind === 'rescue' ? <Users size={12} /> : <Radio size={12} />} FIELD OPERATION</span><strong><Clock size={10} /> {Math.ceil(m.remaining)}s</strong></div>
    <h3>{m.title}</h3><p>{m.description}</p>
    <div className="mission-meter"><i style={{ width: `${m.progress / m.goal * 100}%` }} /></div>
    <div className="mission-progress"><strong>{m.status === 'complete' ? <><Check size={12} /> COMPLETE</> : m.status === 'failed' ? 'SIGNAL LOST' : `${m.kind === 'uplink' ? m.progress.toFixed(1) : m.progress} / ${m.goal} ${m.kind === 'rescue' ? 'PILOTS' : m.kind === 'hunt' ? 'HOSTILES' : 'SECONDS'}`}</strong><span>+{m.reward} CR</span></div>
    {m.status === 'active' && target && <div className="mission-navigation"><ArrowUp size={18} style={{ transform: `rotate(${angle}deg)` }} /><span>{Math.ceil(distance)}m TO {m.kind === 'rescue' ? 'PILOT' : 'RELAY'}</span>{channel > 0 && <strong>{Math.floor(channel * 100)}% {m.kind === 'rescue' ? 'EXTRACTING' : 'LINKING'}</strong>}</div>}
    <div className="mission-summary">{s.rescued} RESCUED · {s.missionsCompleted} MISSIONS COMPLETE</div>
  </aside>;
}
