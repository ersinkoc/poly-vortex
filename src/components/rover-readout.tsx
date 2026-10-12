'use client';

import { Truck } from 'lucide-react';
import { useGame } from '@/game/store';
import { ROVER_RULES } from '@/game/ground-rovers';

export default function RoverReadout() {
  const moving = useGame(s => s.roverMoving), armed = useGame(s => s.roverArmed), next = useGame(s => s.roverNextWave), service = useGame(s => !!s.service);
  return <div className="rover-readout" role="status" aria-live="off" aria-label="Automatic ground rover bay" title={`Automatic 3- or 6-way deployment every ${ROVER_RULES.intervalMin}–${ROVER_RULES.intervalMax}s. Rovers drive out, arm at their destination and explode on enemy proximity. Friendly core and pilots are protected.`}><Truck size={11} /><span>ROVER BAY / AUTO</span><strong>{moving} ROLLING · {armed} ARMED</strong><small>{service ? 'SERVICE HOLD' : `NEXT ${Math.ceil(next)}s`}</small></div>;
}
