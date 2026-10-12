import { TERRAIN_CELL, terrainHeight, terrainProp } from './terrain';
import type { Entity } from './types';

export const DRONE_ORBIT = { radius: 3, capacity: 7, scale: 0.85 } as const;
export const DRONE_FORMATION = { altitude: 2.85, compactRadius: 2.6, combatRadius: 4.4, separation: 1.8, bodyRadius: 0.85, clearance: 0.12, response: 3, angleSpeed: 2 } as const;
export const droneCount = (level: number) => level > 0 ? Math.min(DRONE_ORBIT.capacity, Math.floor(level) + 1) : 0;
export const DRONE_FIRE = { range: 12, interval: 0.9, minInterval: 0.35, speed: 22, turnSpeed: 10, alignment: 0.08, acquisitionInterval: 0.16, flashDuration: 0.12 } as const;
export const DRONE_GUN = { x: 0.27, y: -0.04, z: 0.32, scale: 0.55, tip: 0.56 } as const;
export type DroneGun = { active: boolean; yaw: number; pitch: number; targetId: number; cooldown: number; acquisition: number; flash: number; barrel: -1 | 1; shots: number };
export const createDroneGuns = (): DroneGun[] => Array.from({ length: DRONE_ORBIT.capacity }, () => ({ active: false, yaw: 0, pitch: 0, targetId: 0, cooldown: 0, acquisition: 0, flash: 0, barrel: -1, shots: 0 }));
export const droneDamage = (level: number) => level > 0 ? 9 + Math.min(6, level) * 2 : 0;
export const DRONE_HULL = { hp: 40, repair: 20, hitFlash: 0.3 } as const;
export class DroneRack {
  capacity = 0;
  readonly units = Array.from({ length: DRONE_ORBIT.capacity }, (_, id) => ({ id, hp: 0, hit: 0 }));
  readonly slots: number[] = [];
  reset(level: number) { this.capacity = 0; for (const u of this.units) { u.hp = 0; u.hit = 0; } this.install(level); }
  install(level: number) {
    const capacity = droneCount(level);
    for (let i = this.capacity; i < capacity; i++) this.units[i].hp = DRONE_HULL.hp;
    this.capacity = Math.max(this.capacity, capacity); this.refresh();
  }
  refresh() { this.slots.length = 0; for (let i = 0; i < this.capacity; i++) if (this.units[i].hp > 0) this.slots.push(i); }
  tick(dt: number) { for (const u of this.units) u.hit = Math.max(0, u.hit - dt); }
  hurt(id: number, damage: number) {
    const u = this.units[id]; if (!u || u.hp <= 0 || !Number.isFinite(damage) || damage <= 0) return false;
    u.hp = Math.max(0, u.hp - damage); u.hit = DRONE_HULL.hitFlash; this.refresh(); return true;
  }
  repair(amount = DRONE_HULL.repair as number) { for (const id of this.slots) this.units[id].hp = Math.min(DRONE_HULL.hp, this.units[id].hp + amount); }
  service() {
    this.repair(DRONE_HULL.hp);
    const lost = this.units.slice(0, this.capacity).find(u => u.hp <= 0);
    if (lost) { lost.hp = DRONE_HULL.hp; lost.hit = 0; } this.refresh();
  }
}
export type DronePose = { x: number; y: number; z: number; yaw: number; pitch: number; bank: number };

/** Conservative flight volume covers the complete model, even when its gun pitches down. */
export function droneClearance(x: number, z: number, enemies: readonly Entity[] = []) {
  let y = Math.max(DRONE_FORMATION.altitude, terrainHeight(x, z) + DRONE_FORMATION.bodyRadius + DRONE_FORMATION.clearance);
  const cx = Math.floor(x / TERRAIN_CELL), cz = Math.floor(z / TERRAIN_CELL);
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
    const prop = terrainProp(ix, iz);
    if (prop && Math.hypot(x - prop.x, z - prop.z) < prop.radius + DRONE_FORMATION.bodyRadius + DRONE_FORMATION.clearance) y = Math.max(y, terrainHeight(prop.x, prop.z) + prop.height + DRONE_FORMATION.bodyRadius + DRONE_FORMATION.clearance);
  }
  for (const e of enemies) if (e.hp > 0 && Math.hypot(x - e.x, z - e.z) < e.radius * 1.35 + DRONE_FORMATION.bodyRadius + DRONE_FORMATION.clearance) y = Math.max(y, e.radius * 1.8 + 0.35 + DRONE_FORMATION.bodyRadius + DRONE_FORMATION.clearance);
  return y;
}

export class DroneFormation {
  radius: number = DRONE_ORBIT.radius;
  count = 0;
  readonly slots: number[] = [];
  mode: 'hover' | 'compact' | 'spread' = 'hover';
  readonly poses: DronePose[] = Array.from({ length: DRONE_ORBIT.capacity }, () => ({ x: 0, y: DRONE_FORMATION.altitude, z: 0, yaw: 0, pitch: 0, bank: 0 }));
  private angles = Array<number>(DRONE_ORBIT.capacity).fill(0);
  reset(player: { x: number; z: number; angle?: number }, count = 0) { this.count = 0; this.slots.length = 0; this.radius = DRONE_ORBIT.radius; this.mode = 'hover'; this.tick(0, 0, player, count, []); }
  tick(dt: number, time: number, player: { x: number; z: number; vx?: number; vz?: number; angle?: number; dashTime?: number }, requested: number, enemies: readonly Entity[], liveSlots?: readonly number[]) {
    const next = liveSlots ?? Array.from({ length: Math.max(0, Math.min(DRONE_ORBIT.capacity, requested)) }, (_, i) => i), count = next.length;
    if (!count) { this.count = 0; this.slots.length = 0; this.radius = DRONE_ORBIT.radius; this.mode = 'hover'; return; }
    const cx = Math.floor(player.x / TERRAIN_CELL), cz = Math.floor(player.z / TERRAIN_CELL);
    let clutter = false;
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) { const prop = terrainProp(ix, iz); if (prop && Math.hypot(player.x - prop.x, player.z - prop.z) < prop.radius + 6) clutter = true; }
    const speed = Math.hypot(player.vx ?? 0, player.vz ?? 0), compact = clutter || speed > 4.5 || (player.dashTime ?? 0) > 0;
    const combat = enemies.some(e => e.hp > 0 && Math.hypot(e.x - player.x, e.z - player.z) < 10);
    this.mode = compact ? 'compact' : combat ? 'spread' : 'hover';
    const targetRadius = compact ? DRONE_FORMATION.compactRadius : combat ? DRONE_FORMATION.combatRadius : DRONE_ORBIT.radius;
    this.radius += (targetRadius - this.radius) * (1 - Math.exp(-dt * DRONE_FORMATION.response));
    for (let rank = 0; rank < count; rank++) {
      const i = next[rank], joining = !this.slots.includes(i);
      const targetAngle = rank / count * Math.PI * 2, pose = this.poses[i];
      if (joining) this.angles[i] = targetAngle;
      else this.angles[i] += Math.max(-dt * DRONE_FORMATION.angleSpeed, Math.min(dt * DRONE_FORMATION.angleSpeed, targetAngle - this.angles[i]));
      pose.x = player.x + Math.cos(this.angles[i]) * this.radius; pose.z = player.z + Math.sin(this.angles[i]) * this.radius;
      const required = droneClearance(pose.x, pose.z, enemies);
      // Look ahead along the core's motion to climb before entering an obstacle.
      const ahead = droneClearance(pose.x + (player.vx ?? 0) * 0.4, pose.z + (player.vz ?? 0) * 0.4, enemies);
      const targetY = Math.max(required, ahead) + 0.025 * (1 + Math.sin(time * 1.6 + i));
      pose.y = joining ? targetY : Math.max(required, pose.y + (targetY - pose.y) * (1 - Math.exp(-dt * 5)));
      // New slots yield vertically while existing slots redistribute. The ordered
      // projection guarantees separation without pushing any drone into the core.
      for (let j = 0; j < rank; j++) {
        const neighbor = this.poses[next[j]], d2 = (pose.x - neighbor.x) ** 2 + (pose.z - neighbor.z) ** 2;
        if (d2 < DRONE_FORMATION.separation ** 2) pose.y = Math.max(pose.y, neighbor.y + Math.sqrt(DRONE_FORMATION.separation ** 2 - d2));
      }
      pose.yaw = player.angle ?? 0; pose.pitch = Math.sin(time * 1.4 + i) * 0.02; pose.bank = Math.cos(time * 1.2 + i) * 0.025;
    }
    this.count = count;
    this.slots.length = 0; this.slots.push(...next);
  }
}

/** Check the swept laser segment against other drones' full flight volumes. */
export function droneContact(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, poses: readonly DronePose[], slots: readonly number[], owner = -1) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, length2 = dx * dx + dy * dy + dz * dz;
  let contact: { id: number; t: number } | null = null;
  for (const i of slots) {
    if (i === owner) continue; const p = poses[i];
    const ox = a.x - p.x, oy = a.y - p.y, oz = a.z - p.z;
    const c = ox * ox + oy * oy + oz * oz - (DRONE_FORMATION.bodyRadius + 0.06) ** 2, dot = ox * dx + oy * dy + oz * dz, discriminant = dot * dot - length2 * c;
    if (discriminant < 0) continue;
    const t = c <= 0 ? 0 : length2 > 1e-8 ? (-dot - Math.sqrt(discriminant)) / length2 : Infinity;
    if (t >= 0 && t <= 1 && (!contact || t < contact.t)) contact = { id: i, t };
  }
  return contact;
}
export function droneInLine(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, poses: readonly DronePose[], count: number, owner: number, slots?: readonly number[]) {
  return droneContact(a, b, poses, slots ?? Array.from({ length: count }, (_, i) => i), owner) !== null;
}

/** Optional analytic hover pose is useful for previews; gameplay shares the formation state. */
export function dronePose(time: number, index: number, count: number, player: { x: number; z: number }, formation?: DroneFormation): DronePose {
  if (formation) return formation.poses[index];
  const angle = index / Math.max(1, count) * Math.PI * 2;
  return {
    x: player.x + Math.cos(angle) * DRONE_ORBIT.radius,
    y: droneClearance(player.x + Math.cos(angle) * DRONE_ORBIT.radius, player.z + Math.sin(angle) * DRONE_ORBIT.radius) + 0.025 * (1 + Math.sin(time * 1.6 + index)),
    z: player.z + Math.sin(angle) * DRONE_ORBIT.radius,
    yaw: Math.PI / 2 - angle,
    pitch: Math.sin(time * 1.4 + index) * 0.02,
    bank: Math.cos(time * 1.2 + index) * 0.025,
  };
}

/** YXZ preserves local downward gun pitch as the drone turns toward its target. */
export function droneMuzzle(pose: DronePose, yaw: number, side: -1 | 1, pitch = pose.pitch) {
  const x = side * DRONE_GUN.x * DRONE_ORBIT.scale, y = DRONE_GUN.y * DRONE_ORBIT.scale, z = (DRONE_GUN.z + DRONE_GUN.tip * DRONE_GUN.scale) * DRONE_ORBIT.scale;
  const bx = x * Math.cos(pose.bank) - y * Math.sin(pose.bank), by = x * Math.sin(pose.bank) + y * Math.cos(pose.bank);
  const py = by * Math.cos(pitch) - z * Math.sin(pitch), pz = by * Math.sin(pitch) + z * Math.cos(pitch);
  return { x: pose.x + bx * Math.cos(yaw) + pz * Math.sin(yaw), y: pose.y + py, z: pose.z - bx * Math.sin(yaw) + pz * Math.cos(yaw) };
}
