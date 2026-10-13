'use client';

import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { sentinelDefense } from '@/game/sentinel';

export default function SentinelMeter({ compact = false }: { compact?: boolean }) {
  const { bossPhase: phase } = useGame();
  const boss = engine.enemies.find(e => e.kind === 3 && e.hp > 0); if (!boss) return null;
  const defense = sentinelDefense(boss.age), width = `${boss.hp / boss.maxHp * 100}%`;
  return <div className={`${compact ? 'mobile-boss-meter' : 'boss-bar'} ${defense.armored ? 'armored' : 'exposed'}`} aria-label="Sentinel integrity and reactor state" title={defense.armored ? 'Armor sealed. Save rockets for the exposed reactor.' : 'Reactor exposed. Fire your rockets now.'}>
    <span>SENTINEL · PHASE {phase || 1} · {defense.armored ? 'ARMORED' : 'EXPOSED'} {defense.remaining.toFixed(1)}s</span>
    {compact ? <i><b style={{ width }} /></i> : <div><i style={{ width }} /></div>}
  </div>;
}
