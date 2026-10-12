import type { Entity } from './types';

export const GOLIATH = { holdMin: 9, holdMax: 12, fireRange: 12.5, retreat: 0.65, firstShot: 3.5, reload: 6.5, windup: 1, retry: 2.5, shellSpeed: 5.5, shellRange: 20, damage: 18, flash: 0.18 } as const;
export function goliathRadial(distance: number, speed: number) { return distance > GOLIATH.holdMax ? speed : distance < GOLIATH.holdMin ? -speed * GOLIATH.retreat : 0; }
export function goliathPose(e: Entity, target: { x: number; z: number }) {
  const flash = e.cannonFlash && e.age - e.cannonFlash.at < GOLIATH.flash ? e.cannonFlash : null, aim = e.cannon ?? flash;
  return { x: e.x, y: e.radius * 0.75 + 0.3 + Math.sin(e.age * 2 + e.id) * 0.045, z: e.z, yaw: Math.atan2((aim?.aimX ?? target.x) - e.x, (aim?.aimZ ?? target.z) - e.z), pitch: Math.sin(e.age + e.id) * 0.025, bank: Math.cos(e.age * 1.5 + e.id) * 0.025 };
}
export function goliathMuzzle(e: Entity, target: { x: number; z: number }, side: -1 | 1) {
  const pose = goliathPose(e, target), x = side * 0.14 * e.radius, y = 0.65 * e.radius, z = 0.858 * e.radius;
  const bx = x * Math.cos(pose.bank) - y * Math.sin(pose.bank), by = x * Math.sin(pose.bank) + y * Math.cos(pose.bank);
  const rx = bx * Math.cos(pose.yaw) + z * Math.sin(pose.yaw), rz = -bx * Math.sin(pose.yaw) + z * Math.cos(pose.yaw);
  return { x: pose.x + rx, y: pose.y + by * Math.cos(pose.pitch) - rz * Math.sin(pose.pitch), z: pose.z + by * Math.sin(pose.pitch) + rz * Math.cos(pose.pitch) };
}
