'use client';

import { ArrowUpRight, ShieldCheck, Navigation } from 'lucide-react';
import { useGame } from '@/game/store';
import { engine } from '@/game/engine';
import { DOCK_COPY, doctrineAt, EXPEDITION } from '@/game/expedition';

export default function ExpeditionHUD() {
  const s = useGame(), dock = s.service, doctrine = doctrineAt(s.chapter);
  if (s.activeMode !== 'expedition') return null;
  return <aside className={`expedition-panel ${dock ? 'service-open' : ''}`} aria-label="Expedition status" style={{ '--fleet-color': doctrine.color } as React.CSSProperties}>
    <div className="expedition-heading"><Navigation size={12} /><span>EXPEDITION {String(s.chapter).padStart(2, '0')}</span><strong>{s.sentinels} CLEARED</strong></div>
    {dock ? <>
      <div className="service-title"><ShieldCheck size={16} /><strong>{dock.serviced ? 'SERVICE COMPLETE' : 'FIELD SERVICE'}</strong><span>{Math.ceil(dock.remaining)}s</span></div>
      <p>{dock.serviced ? 'Extract at the beacon, or keep your build for the next front.' : 'Reach the green beacon. Clear its perimeter, stop and hold for 3s.'}</p>
      <div className="service-progress"><i style={{ width: `${dock.progress / EXPEDITION.dockDuration * 100}%` }} /></div>
      <strong className="doctrine-name">{DOCK_COPY[s.dockStatus]}</strong>
      <small>{Math.ceil(s.dockDistance)}m TO BEACON · {dock.serviced ? '+35% HULL · +3 ROCKETS · +1 CHARGE · SHIELD' : `${dock.progress.toFixed(1)} / 3.0s DOCKING`}</small>
      <button disabled={!s.canExtract || s.phase !== 'playing'} onClick={() => engine.extract()}>EXTRACT & BANK CREDITS <ArrowUpRight size={14} /></button>
      <small>NEXT FRONT IN {Math.ceil(dock.remaining)}s · CONTINUES AUTOMATICALLY</small>
    </> : <><strong className="doctrine-name">{doctrine.name}</strong><p>{doctrine.detail}</p><small>KEEP YOUR BUILD · SERVICE & EXTRACTION AFTER EACH SENTINEL</small></>}
  </aside>;
}
