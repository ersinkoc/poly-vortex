export const SHIELD_IMPACT = { capacity: 8, life: 0.7, cells: 5 } as const;
export const SHIELD_SURFACE = { x: 1.7, y: 0.85, z: 1.95 } as const;
export type HitSource = { x: number; z: number; vx?: number; vz?: number };
export type ShieldHit = { x: number; y: number; z: number; age: number; power: number; broken: boolean };
type Pose = { x: number; z: number; angle: number };

/** Incoming projectile direction takes priority over a possibly overshot endpoint. */
export function shieldImpact(player: Pose, source: HitSource | undefined, absorbed: number, broken: boolean): ShieldHit {
  let dx = source ? source.x - player.x : 0, dz = source ? source.z - player.z : 0;
  if (source && Number.isFinite(source.vx) && Number.isFinite(source.vz) && Math.hypot(source.vx!, source.vz!) > 0.001) { dx = -source.vx!; dz = -source.vz!; }
  let distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance) || distance < 0.001) { dx = Math.sin(player.angle); dz = Math.cos(player.angle); distance = 1; }
  dx /= distance; dz /= distance;
  const c = Math.cos(player.angle), s = Math.sin(player.angle), lift = 0.4, length = Math.sqrt(1 + lift * lift);
  return { x: (dx * c - dz * s) / length, y: lift / length, z: (dx * s + dz * c) / length, age: 0, power: Math.min(1.4, 0.8 + absorbed / 40), broken };
}

export function shieldContact(player: Pose, hit: ShieldHit) {
  const x = hit.x * SHIELD_SURFACE.x, z = hit.z * SHIELD_SURFACE.z, c = Math.cos(player.angle), s = Math.sin(player.angle);
  return { x: player.x + x * c + z * s, z: player.z - x * s + z * c };
}
