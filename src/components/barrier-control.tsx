'use client';
import { ShieldCheck } from 'lucide-react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { BARRIER } from '@/game/barrier';
export default function BarrierControl({ mobile = false }: { mobile?: boolean }) {
  const active = useGame(s => s.barrier), cooldown = useGame(s => s.barrierCooldown), phase = useGame(s => s.phase);
  const ship = useGame(s => s.activeShip), duration = BARRIER.duration + (ship === 'aegis' ? 1 : 0);
  const ready = phase === 'playing' && cooldown <= 0;
  return <button className={`${mobile ? 'mobile-action ' : ''}barrier-control ${active > 0 ? 'engaged' : ready ? 'ready' : ''}`} aria-label="Activate Aegis Overdrive" disabled={!ready} title={`R: ${duration}s full core protection. ${BARRIER.cooldown}s recharge. Drones retain their own hull.`} onClick={() => { engine.input.barrier = true; }}>
    <ShieldCheck size={mobile ? 22 : 20}/><span>{active > 0 ? `SAFE ${active.toFixed(1)}s` : cooldown > 0 ? `${Math.ceil(cooldown)}s` : 'AEGIS'}</span>{!mobile && <kbd>R</kbd>}
  </button>;
}
