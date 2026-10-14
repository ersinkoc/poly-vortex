'use client';

import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { sentinelDefense } from '@/game/sentinel';
import { livePart } from '@/game/battlefield';

export default function SentinelMeter({ compact = false }: { compact?: boolean }) {
  const { bossPhase: phase } = useGame();
  const boss = engine.enemies.find(e => e.kind === 3 && e.hp > 0); if (!boss) return null;
  const defense = sentinelDefense(boss.age), width = `${boss.hp / boss.maxHp * 100}%`, generator = livePart(boss,'generator');
  return <div className={`${compact ? 'mobile-boss-meter' : 'boss-bar'} ${defense.armored ? 'armored' : 'exposed'}`} aria-label="Sentinel integrity and reactor state" title={defense.armored ? 'Armor sealed. Save rockets for the exposed reactor.' : 'Reactor exposed. Fire your rockets now.'}>
    <span>SENTINEL · PHASE {phase || 1} · {!generator ? 'GENERATOR DESTROYED' : defense.armored ? 'ARMORED' : 'EXPOSED'} · {boss.parts?.filter(p=>p.hp>0).length ?? 4}/4 MODULES</span>
    {compact ? <i><b style={{ width }} /></i> : <div><i style={{ width }} /></div>}
  </div>;
}
