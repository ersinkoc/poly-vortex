import { missionGoal, type Mission } from './missions';
import type { Supply } from './types';
import { ROCKET_CAPACITY, supplyLifetime } from './supplies';
import type { ServiceDock } from './expedition';
import { CHARGE_RULES } from './ground-charges';

export type NavigationSignal = { x: number; z: number; label: string; color: string; distance: number };
export type ScreenSignal = NavigationSignal & { screenX: number; screenY: number; edge: boolean; angle: number };
export function navigationSignals(player: { x: number; z: number; hp: number; maxHp: number }, mission: Mission | null, supplies: readonly Supply[], ammo: number, service?: ServiceDock | null, chargeAmmo: number = CHARGE_RULES.capacity): NavigationSignal[] {
  const signals: NavigationSignal[] = [];
  const d = (p: { x: number; z: number }) => Math.hypot(p.x - player.x, p.z - player.z);
  if (service && service.remaining > 0) signals.push({ x: service.x, z: service.z, label: service.serviced ? 'EXTRACTION BEACON' : 'SERVICE BEACON', color: '#82ffc5', distance: d(service) });
  const nearest = <T extends { x: number; z: number }>(items: readonly T[]) => items.reduce<T | undefined>((a, b) => !a || d(b) < d(a) ? b : a, undefined);
  const goal = mission?.status === 'active' ? missionGoal(mission,player) : undefined;
  if (goal) signals.push({ ...goal, color: goal.label === 'EVACUATION ZONE' ? '#82ffc5' : '#ffdfa5', distance: d(goal) });
  if (mission?.status === 'active' && mission.kind === 'escort' && mission.destination) signals.push({ ...mission.destination,label:'CONVOY DESTINATION',color:'#82ffc5',distance:d(mission.destination) });
  for (const type of ['repair', 'ammo'] as const) {
    if (type === 'repair' && player.hp >= player.maxHp || type === 'ammo' && ammo >= ROCKET_CAPACITY && chargeAmmo >= CHARGE_RULES.capacity) continue;
    const item = nearest(supplies.filter(s => s.type === type && s.age < supplyLifetime(s)));
    if (item) signals.push({ ...item, label: type === 'repair' ? 'FIELD REPAIR' : 'AMMO RELOAD', color: type === 'repair' ? '#ffa1a8' : '#a2d8ff', distance: d(item) });
  }
  return signals.slice(0, 3);
}
