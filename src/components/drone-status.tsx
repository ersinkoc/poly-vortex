'use client';

import { DRONE_HULL, type DroneTelemetry, type DroneState } from '@/game/orbital-drones';

const labels: Record<DroneState, string> = { flight: 'AIR', waiting: 'QUEUED', returning: 'RETURN', charging: 'CHARGE', launching: 'LAUNCH', lost: 'LOST' };
function Batteries({ units }: { units: readonly DroneTelemetry[] }) {
  return <div className="drone-battery-list" role="group" aria-label="Individual drone batteries">{units.map(u => <div className={`drone-battery-row state-${u.state}`} key={u.id}>
    <span>D{u.id + 1}</span><strong>{u.hp > 0 ? `${Math.round(u.battery)}%` : '—'}</strong><small>{labels[u.state]}</small>
    <div className="drone-energy-bar" role="progressbar" aria-label={`Drone ${u.id + 1} battery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.battery)}><i style={{ width: `${u.battery}%` }} /></div>
    <em>{Math.ceil(u.hp)}/{DRONE_HULL.hp} HULL</em>
  </div>)}</div>;
}
export default function DroneStatus({ hull, units, detailed = false }: { hull: readonly number[]; units: readonly DroneTelemetry[]; detailed?: boolean }) {
  const airborne = units.filter(u => u.hp > 0 && u.state !== 'charging').length;
  const description = units.map(u => `Drone ${u.id + 1}: ${Math.ceil(u.hp)}/${DRONE_HULL.hp} hull, ${Math.round(u.battery)}% battery, ${labels[u.state]}`).join('. ');
  if (detailed) return <section className="drone-console" aria-label="Escort batteries"><h3>DRONE BAY · {airborne}/{units.length} AIR</h3><Batteries units={units} /><p>20% reserve: recall. Docked drones recharge; lost drones need field service.</p></section>;
  return <details className="drone-status">
    <summary aria-label="Drone battery status" title={description}><span>{airborne}/{hull.length} AIR</span>
      <div className="drone-hull-pips" aria-hidden="true">{hull.map((hp, i) => <i key={i} className={hp <= 0 ? 'lost' : hp <= DRONE_HULL.hp / 3 ? 'damaged' : ''}><b style={{ height: `${hp / DRONE_HULL.hp * 100}%` }} /></i>)}</div>
      <div className="drone-battery-pips" aria-hidden="true">{units.map(u => <i key={u.id} className={`state-${u.state}`}><b style={{ height: `${u.battery}%` }} /></i>)}</div>
    </summary>
    <div className="drone-status-details"><h3>ESCORT BATTERIES</h3><Batteries units={units} /><p>HULL / BATTERY · TAP TO CLOSE</p></div>
  </details>;
}
