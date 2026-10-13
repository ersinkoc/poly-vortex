/** Gameplay hull and docking geometry share this simulation-time transform. */
export const PLAYER_SCALE = 0.83;
export const DRONE_DOCK = { x: 0, y: 0.34, z: -0.65 } as const;
export type FlightCore = { x: number; z: number; angle?: number; vx?: number; vz?: number };
export function playerFlightPose(time: number, p: FlightCore) {
  return { x: p.x, y: 0.95 + Math.sin(time * 2.5) * 0.045, z: p.z, yaw: p.angle ?? 0, pitch: (p.vz ?? 0) * 0.009, bank: -(p.vx ?? 0) * 0.025 };
}
export function droneDockPose(time: number, p: FlightCore) {
  const core = playerFlightPose(time, p), x = DRONE_DOCK.x * PLAYER_SCALE, y = DRONE_DOCK.y * PLAYER_SCALE, z = DRONE_DOCK.z * PLAYER_SCALE;
  // The hull uses XYZ Euler order: local bank, then yaw, then pitch.
  const bx = x * Math.cos(core.bank) - y * Math.sin(core.bank), by = x * Math.sin(core.bank) + y * Math.cos(core.bank);
  const rx = bx * Math.cos(core.yaw) + z * Math.sin(core.yaw), rz = -bx * Math.sin(core.yaw) + z * Math.cos(core.yaw);
  return { ...core, x: core.x + rx, y: core.y + by * Math.cos(core.pitch) - rz * Math.sin(core.pitch), z: core.z + by * Math.sin(core.pitch) + rz * Math.cos(core.pitch) };
}
