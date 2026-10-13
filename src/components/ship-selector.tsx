'use client';

import { Check, ArrowUpRight } from 'lucide-react';
import { FLIGHTFRAMES, SHIP_IDS } from '@/game/flightframes';
import { useGame } from '@/game/store';

export default function ShipSelector() {
  const selected = useGame(s => s.ship), phase = useGame(s => s.phase), profile = useGame(s => s.profile);
  const locked = phase === 'playing' || phase === 'paused';
  return <><p className="panel-intro">Choose your flightframe. All three are available from the start; your arsenal and permanent upgrades work with every ship.</p><div className="ship-choices">{SHIP_IDS.map(id => {
    const f = FLIGHTFRAMES[id];
    return <button key={id} className={`ship-choice ${selected === id ? 'selected' : ''}`} style={{ '--ship-color': f.color } as React.CSSProperties} aria-label={`Select ${f.name}`} aria-pressed={selected === id} disabled={locked} onClick={() => useGame.getState().selectShip(id)}>
      <div className="ship-choice-top"><span>{f.code} / {f.role}</span>{selected === id ? <Check size={18}/> : <ArrowUpRight size={18}/>}</div>
      <svg viewBox="-80 -85 160 170" aria-hidden="true"><path d={id === 'aegis' ? 'M0 -70 L25 -25 L72 33 L67 62 L23 55 L0 63 L-23 55 L-67 62 L-72 33 L-25 -25 Z' : id === 'wraith' ? 'M0 -80 L12 -12 L64 49 L52 70 L16 50 L0 58 L-16 50 L-52 70 L-64 49 L-12 -12 Z' : 'M0 -75 L17 -25 L72 32 L65 57 L18 50 L0 62 L-18 50 L-65 57 L-72 32 L-17 -25 Z'}/><path className="cockpit" d="M0 -46 L9 -15 L6 22 L-6 22 L-9 -15 Z"/><path className="engine-line" d="M-25 51 L-25 72 M25 51 L25 72"/></svg>
      <h3>{f.name}</h3><p>{f.description}</p><dl><div><dt>HULL</dt><dd>{f.hull + profile.upgrades.armor * 15}</dd></div><div><dt>SHIELD</dt><dd>{f.shield}</dd></div><div><dt>SPEED</dt><dd>{Math.round(f.speed * 100)}%</dd></div><div><dt>DAMAGE</dt><dd>{Math.round(f.damage * 100)}%</dd></div></dl><strong className="ship-choice-state">{selected === id ? 'READY FOR DEPLOYMENT' : 'SELECT FLIGHTFRAME'}</strong>
    </button>;
  })}</div>{locked && <p className="panel-intro">Finish this deployment to change ships.</p>}<a className="fleet-link" href="/hangar" target="_blank" rel="noreferrer">INSPECT IN 3D DRYDOCK <ArrowUpRight size={15}/></a></>;
}
