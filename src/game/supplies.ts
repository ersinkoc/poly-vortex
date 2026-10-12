import type { Supply } from './types';

export const SUPPLY_RULES = {
  repair: { first: 30, interval: 55, variance: 20, lifetime: 35, cap: 1 },
  ammo: { first: 18, interval: 35, variance: 15, lifetime: 70, cap: 2 },
} as const;
export const supplyLifetime = (s: Supply) => s.type === 'repair' ? SUPPLY_RULES.repair.lifetime : s.type === 'ammo' ? SUPPLY_RULES.ammo.lifetime : 45;
export const ROCKET_CAPACITY = 6;
