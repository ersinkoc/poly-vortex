'use client';

import { useGame } from '@/game/store';

export default function BenchmarkStatus() {
  const status = useGame(s => s.benchmarkStatus), progress = useGame(s => s.benchmarkProgress), tier = useGame(s => s.benchmarkTier);
  const waiting = useGame(s => s.benchmarkWaiting);
  if (status !== 'running') return null;
  return <aside className="benchmark-banner" aria-label="Automatic device benchmark">
    <div role="status"><strong>{waiting ? 'Focus the game tab to continue' : 'Testing this device'} · {progress}%</strong><span>{tier?.toUpperCase()} · Measuring the arena and a simulated graphics load. Keep this tab visible and focused. Flight unlocks after the test.</span></div>
    <progress max={100} value={progress} aria-label="Benchmark progress" />
    <button className="secondary-button" onClick={() => useGame.setState({ benchmarkStatus: 'cancelled', benchmarkTier: null })}>SKIP TEST</button>
  </aside>;
}
