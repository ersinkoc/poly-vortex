import type { Entity } from './types';
import { coreContact, enemyWeapon, HOSTILE_WEAPONS, rangedMuzzle } from './enemy-weapons';
import { GOLIATH, goliathMuzzle } from './goliath-ai';
import { terrainImpact } from './terrain';

export const THREAT_SIGNALS = { capacity: 12, directions: 3, targets: 4, coreClearance: 3, directionGap: 0.6, targetGap: 0.9 } as const;
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
  readonly directions: WeaponThreat[] = [];
  readonly targets: WeaponThreat[] = [];
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
    // Render a few urgent bearings, rather than stacking every lock on the hull.
    // These reuse sorted slots; all locks still contribute to the alarm/countdown.
    this.directions.length = 0; this.targets.length = 0;
    for (let i = 0; i < this.count; i++) {
      const threat = this.slots[i];
      if (threat.dangerous && this.directions.length < THREAT_SIGNALS.directions && !this.directions.some(shown => {
        const angle = threat.bearing - shown.bearing;
        return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < THREAT_SIGNALS.directionGap;
      })) this.directions.push(threat);
      if (this.targets.length < THREAT_SIGNALS.targets && Math.hypot(threat.x - player.x, threat.z - player.z) >= THREAT_SIGNALS.coreClearance
        && !this.targets.some(shown => Math.hypot(threat.x - shown.x, threat.z - shown.z) < THREAT_SIGNALS.targetGap)) this.targets.push(threat);
    }
  }
}
