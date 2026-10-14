import type { Entity } from './types';
import { coreContact, enemyWeapon, HOSTILE_WEAPONS, rangedMuzzle } from './enemy-weapons';
import { GOLIATH, goliathMuzzle } from './goliath-ai';
import { terrainImpact } from './terrain';

export const THREAT_SIGNALS = { capacity: 12 } as const;
export type WeaponThreat = { id: number; x: number; z: number; bearing: number; remaining: number; progress: number; dangerous: boolean; color: string };
const emptyThreat = (): WeaponThreat => ({ id: 0, x: 0, z: 0, bearing: 0, remaining: 0, progress: 0, dangerous: false, color: '#ff718b' });

/** Read the already locked shot; these signals never acquire targets or change combat. */
export function readWeaponThreat(e: Entity, player: { x: number; z: number }, out: WeaponThreat): boolean {
  if (e.hp <= 0) return false;
  const charge = e.kind === 2 ? e.cannon : e.kind === 0 || e.kind === 1 ? e.ranged : undefined;
  if (!charge) return false;
  const heavy = e.kind === 2, rule = HOSTILE_WEAPONS[enemyWeapon(e)];
  const aimY = heavy ? 0.95 : e.ranged!.aimY;
  // Airborne escort locks get their own gun flash, never a false core alarm.
  if (Math.abs(aimY - 0.95) > 0.7) return false;
  const side = ((heavy ? e.cannonShots : e.weaponShots) ?? 0) % 2 === 0 ? -1 : 1;
  const aim = { x: charge.aimX, z: charge.aimZ };
  const muzzle = heavy ? goliathMuzzle(e, aim, side) : rangedMuzzle(e, aim, side);
  if (terrainImpact(muzzle, aim)) return false;
  const dx = aim.x - muzzle.x, dz = aim.z - muzzle.z, length = Math.hypot(dx, dz);
  if (length < 0.01) return false;
  const range = heavy ? GOLIATH.shellRange : rule.range;
  const endpoint = { x: muzzle.x + dx / length * range, y: muzzle.y + (aimY - muzzle.y) / length * range, z: muzzle.z + dz / length * range };
  out.id = e.id; out.x = aim.x; out.z = aim.z; out.bearing = Math.atan2(e.x - player.x, e.z - player.z);
  out.remaining = Math.max(0, charge.remaining);
  const betweenRounds = !heavy && e.ranged!.rounds < rule.rounds;
  out.progress = betweenRounds ? 1 : Math.max(0, Math.min(1, 1 - out.remaining / (heavy ? GOLIATH.windup : rule.windup)));
  out.dangerous = coreContact(muzzle, endpoint, player) && !terrainImpact(muzzle, player);
  out.color = heavy ? '#ffc280' : rule.color;
  return true;
}

/** Reused, bounded render slots prioritize shots that can still hit the core. */
export class ThreatSignals {
  readonly slots = Array.from({ length: THREAT_SIGNALS.capacity }, emptyThreat);
  private readonly scratch = emptyThreat();
  count = 0; locks = 0; soonest = Infinity;
  tick(enemies: readonly Entity[], player: { x: number; z: number }) {
    this.count = 0; this.locks = 0; this.soonest = Infinity;
    for (const e of enemies) {
      if (!readWeaponThreat(e, player, this.scratch)) continue;
      const next = this.scratch;
      if (next.dangerous) { this.locks++; this.soonest = Math.min(this.soonest, next.remaining); }
      let at = 0;
      while (at < this.count && (Number(this.slots[at].dangerous) > Number(next.dangerous) || this.slots[at].dangerous === next.dangerous && this.slots[at].remaining <= next.remaining)) at++;
      if (at >= this.slots.length) continue;
      this.count = Math.min(this.slots.length, this.count + 1);
      for (let i = this.count - 1; i > at; i--) Object.assign(this.slots[i], this.slots[i - 1]);
      Object.assign(this.slots[at], next);
    }
  }
}
