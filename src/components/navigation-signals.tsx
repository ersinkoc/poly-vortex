'use client';

import { useGame } from '@/game/store';

export default function NavigationSignals() {
  const signals = useGame(s => s.navigation), phase = useGame(s => s.phase);
  if (phase !== 'playing') return null;
  return <div className="navigation-layer" aria-label="Nearby objective and supply signals">{signals.map(signal => <div key={signal.label} className="navigation-signal" style={{ left: signal.screenX, top: signal.screenY, '--signal-color': signal.color } as React.CSSProperties}><i style={{ transform: signal.edge ? `rotate(${signal.angle}deg)` : undefined }}>{signal.edge ? '↑' : '+'}</i><span>{signal.label}</span><strong>{Math.ceil(signal.distance)}m</strong></div>)}</div>;
}
