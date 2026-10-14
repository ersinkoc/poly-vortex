import type { WeaponId } from './types';
import { DRONE_FIRE, droneDamage } from './orbital-drones';
import { UPGRADE_LIMITS } from './upgrade-preview';
import { CHARGE_RULES } from './ground-charges';

export const SENTINEL = { armorTime: 3.2, exposedTime: 3.3, armoredDamage: 0.6, exposedDamage: 1.35, firstStrike: 5.5, strikeDelay: 1.6 } as const;
export function sentinelDefense(age: number) {
  const cycle = SENTINEL.armorTime + SENTINEL.exposedTime, t = Math.max(0, age) % cycle;
  const armored = t < SENTINEL.armorTime;
  return { armored, factor: armored ? SENTINEL.armoredDamage : SENTINEL.exposedDamage, remaining: (armored ? SENTINEL.armorTime : cycle) - t };
}
export type SentinelBuild = { weapons: Record<WeaponId, number>; damage: number; haste: number; criticalChance: number; escorts: number; chapter: number; overdrive: boolean };
/** Snapshot sustained firepower at arrival. Later upgrades do not move its health bar. */
export function sentinelHealth(build: SentinelBuild) {
  const { weapons: w } = build, haste = Math.max(UPGRADE_LIMITS.haste, build.haste), damage = Math.max(1, build.damage);
  const pulse = w.pulse > 0 ? Math.ceil(w.pulse / 2) * (15 + w.pulse * 4) * (1 + Math.min(0.75, build.criticalChance)) / (Math.max(0.1, 0.46 - w.pulse * 0.045) * haste) : 0;
  const escort = Math.min(build.escorts, w.glaive > 0 ? w.glaive + 1 : 0) * droneDamage(w.glaive) / Math.max(DRONE_FIRE.minInterval, DRONE_FIRE.interval * haste);
  const cryo = w.cryo > 0 ? (12 + w.cryo * 7) * 3.5 / (6 * haste) : 0;
  const tesla = w.tesla > 0 ? (22 + w.tesla * 12) / (2 * haste) : 0;
  const rail = w.rail > 0 ? (60 + w.rail * 14) / (Math.max(1.2, 4 - w.rail * 0.32) * haste) : 0;
  const scatter = w.scatter > 0 ? (5 + w.scatter * 2) * 3 / (Math.max(0.85, 2.6 - w.scatter * 0.2) * haste) : 0;
  const sustained = (pulse * 0.75 + escort * 0.55 + cryo * 0.55 + tesla * 0.85 + rail * 0.75 + scatter * 0.6) * damage;
  const front = 1 + Math.min(1.2, Math.log2(Math.max(1, build.chapter)) * 0.16);
  return Math.ceil(Math.max(5500 * front + sustained * 20, CHARGE_RULES.damage * damage * 8) * (build.overdrive ? 1.25 : 1));
}
