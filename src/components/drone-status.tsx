'use client';

import { DRONE_HULL } from '@/game/orbital-drones';

export default function DroneStatus({ hull }: { hull: readonly number[] }) {
  const alive = hull.filter(hp => hp > 0).length;
  return <div className="drone-status" role="img" aria-label={`${alive}/${hull.length} escorts operational. ${hull.map((hp, i) => `Drone ${i + 1}: ${Math.ceil(hp)}/${DRONE_HULL.hp} hull`).join('. ')}`} title="Repair crates: +20 surviving escort hull. Field service: repair survivors and rebuild one lost escort.">
    <span>{alive}/{hull.length} ACTIVE</span>
    <div className="drone-hull-pips">{hull.map((hp, i) => <i key={i} className={hp <= 0 ? 'lost' : hp <= DRONE_HULL.hp / 3 ? 'damaged' : ''}><b style={{ height: `${hp / DRONE_HULL.hp * 100}%` }} /></i>)}</div>
  </div>;
}
