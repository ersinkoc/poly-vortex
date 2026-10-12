import { terrainImpact } from './terrain';
import type { Entity, Input } from './types';

export const AIM_HALF_ANGLE = 0.45;
export const PULSE_RANGE = 23;
type Position = { x: number; z: number };
export const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const turnTowards = (angle: number, target: number, maxStep: number) => angle + Math.max(-maxStep, Math.min(maxStep, angleDifference(target, angle)));
export function friendlyInLine(a: Position, b: Position, friendlies: readonly (Position & { radius?: number })[]) {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz; if (length2 < 1e-8) return false;
  return friendlies.some(f => { const t = ((f.x - a.x) * dx + (f.z - a.z) * dz) / length2; return t > 0 && t < 1 && Math.hypot(a.x + t * dx - f.x, a.z + t * dz - f.z) < (f.radius ?? 0.75); });
}
export function selectTarget(enemies: readonly Entity[], player: Position, input: Input, lockedId: number, friendlies: readonly Position[] = [], range = PULSE_RANGE, mode: 'assisted' | 'precision' = 'assisted') {
  if (mode === 'precision' && !input.aiming) return undefined;
  const ax = input.aimX - player.x, az = input.aimZ - player.z, aimAngle = Math.atan2(ax, az);
  if (input.aiming && ax * ax + az * az < 0.5) return undefined;
  const score = (e: Entity) => {
    if (e.hp <= 0) return Infinity;
    const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz); if (d > range) return Infinity;
    const angle = Math.abs(angleDifference(Math.atan2(dx, dz), aimAngle)); if (input.aiming && angle > AIM_HALF_ANGLE) return Infinity;
    if (terrainImpact(player, e) || friendlyInLine(player, e, friendlies)) return Infinity;
    return input.aiming ? angle * 12 + d * 0.18 : d;
  };
  const locked = enemies.find(e => e.id === lockedId), lockedScore = locked ? score(locked) : Infinity;
  if (!input.aiming && Number.isFinite(lockedScore)) return locked;
  let best = lockedScore, target = Number.isFinite(lockedScore) ? locked : undefined;
  for (const e of enemies) { const candidate = score(e); if (candidate < best - (target?.id === lockedId ? 1.5 : 0)) { best = candidate; target = e; } }
  return target;
}
