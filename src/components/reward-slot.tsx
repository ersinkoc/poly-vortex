'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, Check, Cpu, Crosshair, Disc3, Orbit, Shield, Snowflake, Sparkles, Wind, Zap } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { reelPosition, REEL_TIMING, type RewardRoll } from '@/game/reward-reel';
import type { UpgradeId } from '@/game/types';

const icons: Record<UpgradeId, typeof Cpu> = { pulse: Crosshair, glaive: Disc3, cryo: Snowflake, tesla: Zap, damage: Cpu, speed: Wind, magnet: Orbit, repair: Shield, haste: Wind, shield: Shield, critical: Crosshair, pierce: ArrowRight };
const ROW_HEIGHT = 64;

function Reel({ roll }: { roll: RewardRoll }) {
  const strip = useRef<HTMLDivElement>(null), progress = useRef<HTMLElement>(null);
  const reduced = useGame(s => s.reducedEffects);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const active = engine.rewards.active;
      if (active?.id === roll.id) {
        if (strip.current) strip.current.style.transform = `translate3d(0,${-reelPosition(active, reduced) * ROW_HEIGHT}px,0)`;
        if (progress.current) progress.current.style.transform = `scaleX(${Math.min(1, active.elapsed / REEL_TIMING.spin)})`;
      }
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [roll.id, reduced]);
  return <>
    <div className="reward-window" aria-hidden="true"><span className="reward-marker">▸</span><div className="reward-strip" ref={strip}>
      {Array.from({ length: roll.choices.length * 9 }, (_, i) => {
        const choice = roll.choices[i % roll.choices.length], Icon = icons[choice.id];
        return <div className={`reward-symbol rarity-${choice.rarity.toLowerCase()}`} key={i}><Icon size={27} strokeWidth={1.5} /><div><small>{choice.rarity} / +{choice.power}</small><strong>{choice.title}</strong></div></div>;
      })}
    </div></div>
    <div className="reward-progress" aria-hidden="true"><i ref={progress} /></div>
  </>;
}

export default function RewardSlot() {
  const roll = useGame(s => s.reward), queued = useGame(s => s.rewardQueued), phase = useGame(s => s.phase);
  if (!roll || phase === 'dead' || phase === 'won' || phase === 'menu') return null;
  const winner = roll.choices[roll.winner];
  const change = roll.changes[0];
  return <aside className={`reward-slot ${roll.installed ? `installed rarity-${winner.rarity.toLowerCase()}` : ''}`} aria-label="Automatic upgrade reel">
    <header><span><Sparkles size={12} /> {roll.source === 'salvage' ? 'ELITE SALVAGE' : `CORE LEVEL ${roll.level}`}</span><b>{queued ? `+${queued} QUEUED` : 'AUTO'}</b></header>
    <Reel key={roll.id} roll={roll} />
    <div className="reward-status" role="status" aria-live="polite" aria-atomic="true">{roll.installed ? <><span className="sr-only">{winner.title} installed · +{winner.power}. </span><Check size={12} /><span>{change?.label ?? 'MODULE INSTALLED'}</span>{change && <strong>{change.before}<ArrowRight size={9} /><b>{change.after}</b></strong>}</> : <><Cpu size={12} /><span>{phase === 'paused' ? 'SUSPENDED · RESUME TO INSTALL' : 'DECODING · KEEP MOVING'}</span></>}</div>
  </aside>;
}
