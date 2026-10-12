import type { Upgrade, WeaponId } from './types';
export const UPGRADE_LIMITS = { speed: 2.8, haste: 0.28 } as const;

export type BuildStats = { weapons: Record<WeaponId, number>; damage: number; speed: number; magnet: number; haste: number; criticalChance: number; piercing: number; maxShield: number; hp: number; maxHp: number };
export type StatChange = { label: string; before: string; after: string };
export function previewUpgrade(s: BuildStats, u: Upgrade): StatChange[] {
  const { id, power } = u;
  const pct = (v: number) => `${Math.round(v * 100)}%`, fixed = (v: number) => v.toFixed(1);
  const row = (label: string, before: string, after: string) => [{ label, before, after }];
  if (id in s.weapons) {
    const w = id as WeaponId, a = s.weapons[w], b = Math.min(6, a + power);
    const rows = row(a ? 'MODULE LEVEL' : 'NEW WEAPON', a ? `LV ${a}` : 'OFFLINE', `LV ${b}`);
    if (w === 'pulse') rows.push(...row('BOLT DAMAGE', fixed((15 + a * 4) * s.damage), fixed((15 + b * 4) * s.damage)), ...row('VOLLEY', `${Math.ceil(a / 2)} bolts`, `${Math.ceil(b / 2)} bolts`));
    else if (w === 'glaive') rows.push(...row('ESCORT DRONES', `${a ? a + 1 : 0}`, `${b + 1}`));
    else if (w === 'cryo') rows.push(...row('VORTEX RADIUS', a ? `${fixed(3.5 + a * 0.3)}m` : '—', `${fixed(3.5 + b * 0.3)}m`));
    else rows.push(...row('CHAIN TARGETS', a ? `${Math.min(5, 2 + a)}` : '—', `${Math.min(5, 2 + b)}`));
    return rows;
  }
  if (id === 'damage') return row('WEAPON DAMAGE', pct(s.damage), pct(s.damage + 0.2 * power));
  if (id === 'speed') return row('TOP SPEED', `${fixed(7.5 * s.speed)}m/s`, `${fixed(7.5 * Math.min(UPGRADE_LIMITS.speed, s.speed + 0.12 * power))}m/s`);
  if (id === 'magnet') return row('PRISM REACH', `${fixed(4.5 * s.magnet)}m`, `${fixed(4.5 * (s.magnet + 0.3 * power))}m`);
  if (id === 'haste') return row('DASH COOLDOWN', `${fixed(3 * s.haste)}s`, `${fixed(3 * Math.max(UPGRADE_LIMITS.haste, s.haste * 0.9 ** power))}s`);
  if (id === 'critical') return row('CRITICAL CHANCE', pct(s.criticalChance), pct(Math.min(0.75, s.criticalChance + 0.07 * power)));
  if (id === 'pierce') return row('EXTRA PENETRATIONS', `${s.piercing}`, `${Math.min(6, s.piercing + power)}`);
  if (id === 'shield') return row('SHIELD CAPACITY', `${s.maxShield}`, `${s.maxShield + 15 * power}`);
  return [...row('MAX INTEGRITY', `${s.maxHp}`, `${s.maxHp + 10 * power}`), ...row('INSTANT REPAIR', `${Math.ceil(s.hp)} HP`, `${Math.ceil(Math.min(s.maxHp + 10 * power, s.hp + 35 * power))} HP`)];
}
