import type { Bolt, Entity } from './types';

export type EnemyWeapon = 'autocannon' | 'plasma' | 'laser' | 'missile' | 'flak' | 'ion';
export const HOSTILE_WEAPONS = {
  autocannon: { name: 'INTERCEPTOR GUNS', color: '#ff718b', min: 5.5, max: 8, range: 18, windup: 0.55, reload: 4.2, speed: 11, damage: 4, rounds: 2, gap: 0.2 },
  plasma: { name: 'PLASMA BURST', color: '#ff638a', min: 7, max: 10, range: 18, windup: 0.55, reload: 3.5, speed: 8, damage: 6, rounds: 3, gap: 0.18 },
  laser: { name: 'LASER SNIPER', color: '#c48aff', min: 11, max: 14, range: 24, windup: 1.1, reload: 4.5, speed: 24, damage: 12, rounds: 1, gap: 0 },
  missile: { name: 'ROCKET PLATFORM', color: '#ffbc65', min: 12, max: 16, range: 20, windup: 0.9, reload: 5.5, speed: 5.5, damage: 16, rounds: 1, gap: 0 },
  flak: { name: 'FLAK RAIDER', color: '#ff8d64', min: 6, max: 9, range: 16, windup: 0.7, reload: 4.8, speed: 10, damage: 3, rounds: 5, gap: 0.08 },
  ion: { name: 'ION DISRUPTOR', color: '#69e5ff', min: 9, max: 12, range: 20, windup: 1, reload: 5.2, speed: 9, damage: 8, rounds: 1, gap: 0 },
} as const;
export const INTERCEPTOR = { salvoSpacing: 0.35, maxWindups: 4, retreat: 1.2 } as const;
export const enemyWeapon = (e: Entity): EnemyWeapon => e.weapon ?? (e.kind === 0 ? 'autocannon' : e.kind === 1 ? (['plasma', 'laser', 'missile', 'flak', 'ion'] as const)[(e.id - 1) % 5] : 'plasma');
export function hostileBand(e: Entity) { return e.kind === 3 ? { min: 12, max: 16 } : HOSTILE_WEAPONS[enemyWeapon(e)]; }
export function rangedPose(e: Entity, target: { x: number; z: number }) {
  const flash = e.weaponFlash && e.age - e.weaponFlash.at < 0.16 ? e.weaponFlash : null, aim = e.ranged ?? flash;
  return { x: e.x, y: e.radius * 0.75 + 0.3 + Math.sin(e.age * 2 + e.id) * 0.045, z: e.z, yaw: Math.atan2((aim?.aimX ?? target.x) - e.x, (aim?.aimZ ?? target.z) - e.z), pitch: Math.sin(e.age + e.id) * 0.025, bank: Math.cos(e.age * 1.5 + e.id) * (e.kind === 0 ? 0.09 : 0.025) };
}
export function rangedMuzzle(e: Entity, target: { x: number; z: number }, side: -1 | 1) {
  const pose = rangedPose(e, target), small = e.kind === 0;
  const x = side * (small ? 0.51 : 0.88) * e.radius, y = (small ? -0.05 : 0.05) * e.radius, z = (small ? 0.358 : 0.608) * e.radius;
  const bx = x * Math.cos(pose.bank) - y * Math.sin(pose.bank), by = x * Math.sin(pose.bank) + y * Math.cos(pose.bank);
  const rx = bx * Math.cos(pose.yaw) + z * Math.sin(pose.yaw), rz = -bx * Math.sin(pose.yaw) + z * Math.cos(pose.yaw);
  return { x: pose.x + rx, y: pose.y + by * Math.cos(pose.pitch) - rz * Math.sin(pose.pitch), z: pose.z + by * Math.sin(pose.pitch) + rz * Math.cos(pose.pitch) };
}
export const hostileBoltColor = (b: Bolt) => b.hostileWeapon ? HOSTILE_WEAPONS[b.hostileWeapon].color : b.heavy !== undefined ? '#ffc280' : '#ff4088';
/** Swept core collision keeps fast laser rounds from crossing the hull between ticks. */
export function coreContact(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, p: { x: number; z: number }) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, length = dx * dx + dy * dy + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (0.95 - a.y) * dy + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - 0.95, a.z + dz * t - p.z) < 0.7;
}
