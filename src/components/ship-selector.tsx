'use client';

import { Check, ArrowUpRight } from 'lucide-react';
import { FLIGHTFRAMES, SHIP_IDS, SHIP_TRAITS } from '@/game/flightframes';
import { useGame } from '@/game/store';

export default function ShipSelector() {
  const selected = useGame(s => s.ship), phase = useGame(s => s.phase), profile = useGame(s => s.profile);
  const locked = phase === 'playing' || phase === 'paused';
  return <><p className="panel-intro">Choose your flightframe. All {SHIP_IDS.length} are available from the start; your arsenal and permanent upgrades work with every ship.</p><div className="ship-choices">{SHIP_IDS.map(id => {
    const f = FLIGHTFRAMES[id];
    return <button key={id} className={`ship-choice ${selected === id ? 'selected' : ''}`} style={{ '--ship-color': f.color } as React.CSSProperties} aria-label={`Select ${f.name}`} aria-pressed={selected === id} disabled={locked} onClick={() => useGame.getState().selectShip(id)}>
      <div className="ship-choice-top"><span>{f.code} / {f.role}</span>{selected === id ? <Check size={18}/> : <ArrowUpRight size={18}/>}</div>
      <img src={f.portrait} width={420} height={300} alt={`${f.name} warship`} />
      <h3>{f.name}</h3><p>{f.description}</p><p><strong>{SHIP_TRAITS[id].name}</strong> · {SHIP_TRAITS[id].detail}</p><dl><div><dt>HULL</dt><dd>{f.hull + profile.upgrades.armor * 15}</dd></div><div><dt>SHIELD</dt><dd>{f.shield}</dd></div><div><dt>SPEED</dt><dd>{Math.round(f.speed * (1 + profile.upgrades.thrusters * .06) * 100)}%</dd></div><div><dt>DAMAGE</dt><dd>{Math.round(f.damage * (1 + profile.upgrades.reactor * .08) * 100)}%</dd></div></dl><strong className="ship-choice-state">{selected === id ? 'READY FOR DEPLOYMENT' : 'SELECT FLIGHTFRAME'}</strong>
    </button>;
  })}</div>{locked && <p className="panel-intro">Finish this deployment to change ships.</p>}<a className="fleet-link" href="/hangar" target="_blank" rel="noreferrer">INSPECT IN 3D DRYDOCK <ArrowUpRight size={15}/></a></>;
}
