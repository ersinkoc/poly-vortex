export const DRONE_ORBIT = { radius: 3, angularSpeed: 2.3, capacity: 7, scale: 0.85 } as const;
export const droneCount = (level: number) => level > 0 ? Math.min(DRONE_ORBIT.capacity, Math.floor(level) + 1) : 0;

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
