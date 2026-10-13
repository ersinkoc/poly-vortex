'use client';

import { Radar } from 'lucide-react';
import { useGame } from '@/game/store';
import { ROVER_RULES } from '@/game/ground-rovers';

export default function RoverReadout() {
  const moving = useGame(s => s.roverMoving), armed = useGame(s => s.roverArmed), next = useGame(s => s.roverNextWave), service = useGame(s => !!s.service);
  return <div className="rover-readout" role="status" aria-live="off" aria-label="Automatic ground rover bay" title={`Automatic 3- or 6-way deployment every ${ROVER_RULES.intervalMin}–${ROVER_RULES.intervalMax}s. Roof radar scans the ${ROVER_RULES.blastRadius}m holographic minefield. Inner ${ROVER_RULES.triggerRadius}m ring triggers on hostile proximity. Cyan: armed; amber: detected hostile; red: detonation. Rocks block radar and blast. Friendly core and pilots are protected.`}><Radar size={11} /><span>ROVER BAY / RADAR</span><strong>{moving} ROLLING · {armed} ARMED</strong><small>{service ? 'SERVICE HOLD' : `NEXT ${Math.ceil(next)}s`}</small></div>;
}
