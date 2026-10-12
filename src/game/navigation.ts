import type { Mission } from './missions';
import type { Supply } from './types';
import { ROCKET_CAPACITY, supplyLifetime } from './supplies';

export type NavigationSignal = { x: number; z: number; label: string; color: string; distance: number };
export type ScreenSignal = NavigationSignal & { screenX: number; screenY: number; edge: boolean; angle: number };
export function navigationSignals(player: { x: number; z: number; hp: number; maxHp: number }, mission: Mission | null, supplies: readonly Supply[], ammo: number): NavigationSignal[] {
  const signals: NavigationSignal[] = [];
  const d = (p: { x: number; z: number }) => Math.hypot(p.x - player.x, p.z - player.z);
  const nearest = <T extends { x: number; z: number }>(items: readonly T[]) => items.reduce<T | undefined>((a, b) => !a || d(b) < d(a) ? b : a, undefined);
  const goal = mission?.status === 'active' ? nearest(mission.targets.filter(t => !t.done)) : undefined;
  if (goal) signals.push({ ...goal, label: mission!.kind === 'rescue' ? 'RESCUE PILOT' : 'RESTORE RELAY', color: '#ffdfa5', distance: d(goal) });
  for (const type of ['repair', 'ammo'] as const) {
    if (type === 'repair' && player.hp >= player.maxHp || type === 'ammo' && ammo >= ROCKET_CAPACITY) continue;
    const item = nearest(supplies.filter(s => s.type === type && s.age < supplyLifetime(s)));
    if (item) signals.push({ ...item, label: type === 'repair' ? 'FIELD REPAIR' : 'AMMO RELOAD', color: type === 'repair' ? '#ffa1a8' : '#a2d8ff', distance: d(item) });
  }
  return signals;
}
