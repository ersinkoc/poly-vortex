export const DRONE_ORBIT = { radius: 3, angularSpeed: 2.3, capacity: 7, scale: 0.85 } as const;
export const droneCount = (level: number) => level > 0 ? Math.min(DRONE_ORBIT.capacity, Math.floor(level) + 1) : 0;
export const DRONE_FIRE = { range: 12, interval: 0.9, minInterval: 0.35, speed: 22, turnSpeed: 10, alignment: 0.08, acquisitionInterval: 0.16, flashDuration: 0.12 } as const;
export const DRONE_GUN = { x: 0.27, y: -0.04, z: 0.32, scale: 0.55, tip: 0.56 } as const;
export type DroneGun = { active: boolean; yaw: number; targetId: number; cooldown: number; acquisition: number; flash: number; barrel: -1 | 1; shots: number };
export const createDroneGuns = (): DroneGun[] => Array.from({ length: DRONE_ORBIT.capacity }, () => ({ active: false, yaw: 0, targetId: 0, cooldown: 0, acquisition: 0, flash: 0, barrel: -1, shots: 0 }));
export const droneDamage = (level: number) => level > 0 ? 9 + Math.min(6, level) * 2 : 0;

/** Rendering and contact interception use the same world-space orbit and simulation clock. */
export function dronePose(time: number, index: number, count: number, player: { x: number; z: number }) {
  const angle = time * DRONE_ORBIT.angularSpeed + index / Math.max(1, count) * Math.PI * 2;
  return {
    x: player.x + Math.cos(angle) * DRONE_ORBIT.radius,
    y: 0.95 + Math.sin(time * 2.1 + index * 0.9) * 0.045,
    z: player.z + Math.sin(angle) * DRONE_ORBIT.radius,
    yaw: -angle,
    pitch: Math.sin(time * 1.4 + index) * 0.035,
    bank: -0.12,
  };
}

/** Matches the model's XYZ body transform, so tracers and flashes leave the visible muzzle. */
export function droneMuzzle(pose: ReturnType<typeof dronePose>, yaw: number, side: -1 | 1) {
  const x = side * DRONE_GUN.x * DRONE_ORBIT.scale, y = DRONE_GUN.y * DRONE_ORBIT.scale, z = (DRONE_GUN.z + DRONE_GUN.tip * DRONE_GUN.scale) * DRONE_ORBIT.scale;
  const bx = x * Math.cos(pose.bank) - y * Math.sin(pose.bank), by = x * Math.sin(pose.bank) + y * Math.cos(pose.bank);
  const rx = bx * Math.cos(yaw) + z * Math.sin(yaw), rz = -bx * Math.sin(yaw) + z * Math.cos(yaw);
  return { x: pose.x + rx, y: pose.y + by * Math.cos(pose.pitch) - rz * Math.sin(pose.pitch), z: pose.z + by * Math.sin(pose.pitch) + rz * Math.cos(pose.pitch) };
}
