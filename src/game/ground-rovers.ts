import { clearTerrainPosition, terrainHeight, terrainImpact } from './terrain';
import type { Entity } from './types';

export const ROVER_RULES = { capacity: 12, first: 10, intervalMin: 24, intervalMax: 36, speed: 4.6, travelMin: 9, travelMax: 14, bodyRadius: 0.55, wheelRadius: 0.2, track: 0.94, wheelbase: 0.94, armingDelay: 0.6, triggerRadius: 1.6, lifetime: 12, fuse: 0.35, blastRadius: 4.2, damage: 420 } as const;
export type GroundRover = { id: number; x: number; z: number; yaw: number; age: number; traveled: number; range: number; parked: number; fuse: number; state: 'rolling' | 'armed' | 'primed' | 'detonated' };

export function roverWheelSite(rover: Pick<GroundRover, 'x' | 'z' | 'yaw'>, side: number, end: number) {
  const x = side * ROVER_RULES.track / 2, z = end * ROVER_RULES.wheelbase / 2, c = Math.cos(rover.yaw), s = Math.sin(rover.yaw);
  return { x: rover.x + c * x + s * z, z: rover.z - s * x + c * z };
}
export function roverPose(rover: Pick<GroundRover, 'x' | 'z' | 'yaw'>) {
  const height = (side: number, end: number) => { const p = roverWheelSite(rover, side, end); return terrainHeight(p.x, p.z); };
  const lf = height(-1, 1), rf = height(1, 1), lb = height(-1, -1), rb = height(1, -1);
  return { y: (lf + rf + lb + rb) / 4 + ROVER_RULES.wheelRadius, pitch: Math.atan2((lb + rb - lf - rf) / 2, ROVER_RULES.wheelbase), bank: Math.atan2((rf + rb - lf - lb) / 2, ROVER_RULES.track) };
}

export class RoverBay {
  units: GroundRover[] = [];
  nextWave: number = ROVER_RULES.first;
  waves = 0;
  lastBatch = 0;
  private seed = 0;
  private uid = 0;
  constructor(seed: number) { this.reset(seed); }
  reset(seed: number) {
    this.units = []; this.nextWave = ROVER_RULES.first; this.waves = 0; this.lastBatch = 0; this.uid = 0;
    let mixed = (seed ^ 0x6a09e667) >>> 0; mixed = Math.imul(mixed ^ mixed >>> 16, 0x85ebca6b); mixed = Math.imul(mixed ^ mixed >>> 13, 0xc2b2ae35); this.seed = (mixed ^ mixed >>> 16) >>> 0;
  }
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private launch(player: { x: number; z: number }) {
    // Reserve room for a complete six-way launch; never silently emit a partial fan.
    if (this.units.length > ROVER_RULES.capacity - 6) { this.nextWave = 1; return; }
    const count = this.random() < 0.5 ? 3 : 6, heading = this.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const yaw = heading + i / count * Math.PI * 2 + (this.random() - 0.5) * 0.18;
      const site = { x: player.x + Math.sin(yaw) * 1.6, z: player.z + Math.cos(yaw) * 1.6 };
      const spawnX = site.x, spawnZ = site.z;
      clearTerrainPosition(site, ROVER_RULES.bodyRadius + 0.04);
      // A blocked launch leaves the rover on the core's side of the obstacle.
      if (Math.hypot(site.x - spawnX, site.z - spawnZ) > 1e-6) { site.x = player.x; site.z = player.z; clearTerrainPosition(site, ROVER_RULES.bodyRadius + 0.04); }
      this.units.push({ ...site, id: ++this.uid, yaw, age: 0, traveled: 0, range: ROVER_RULES.travelMin + this.random() * (ROVER_RULES.travelMax - ROVER_RULES.travelMin), parked: 0, fuse: ROVER_RULES.fuse, state: 'rolling' });
    }
    this.waves++; this.lastBatch = count; this.nextWave = ROVER_RULES.intervalMin + this.random() * (ROVER_RULES.intervalMax - ROVER_RULES.intervalMin);
  }
  tick(dt: number, player: { x: number; z: number }, enemies: readonly Entity[], deploy: boolean, detonate: (rover: GroundRover) => boolean) {
    let running = true;
    for (const rover of this.units) {
      if (rover.state === 'detonated') continue;
      rover.age += dt;
      if (rover.state === 'primed') {
        rover.fuse = Math.max(0, rover.fuse - dt);
        if (rover.fuse <= 1e-8) { rover.state = 'detonated'; if (!detonate(rover)) { running = false; break; } }
        continue;
      }
      if (rover.state === 'rolling') {
        const step = Math.min(ROVER_RULES.speed * dt, Math.max(0, rover.range - rover.traveled));
        const next = { x: rover.x + Math.sin(rover.yaw) * step, z: rover.z + Math.cos(rover.yaw) * step }, original = { ...next };
        clearTerrainPosition(next, ROVER_RULES.bodyRadius);
        if (Math.hypot(next.x - original.x, next.z - original.z) > 1e-6) rover.state = 'armed';
        else { rover.x = next.x; rover.z = next.z; rover.traveled += step; if (rover.range - rover.traveled <= 1e-8) rover.state = 'armed'; }
      } else rover.parked += dt;
      const contact = rover.age >= ROVER_RULES.armingDelay && enemies.some(e => e.hp > 0 && Math.hypot(e.x - rover.x, e.z - rover.z) <= ROVER_RULES.triggerRadius + e.radius && !terrainImpact(rover, e, 0));
      if (contact || rover.parked >= ROVER_RULES.lifetime) { rover.state = 'primed'; rover.fuse = ROVER_RULES.fuse; }
    }
    this.units = this.units.filter(r => r.state !== 'detonated');
    if (deploy && running) { this.nextWave -= dt; if (this.nextWave <= 1e-8) this.launch(player); }
  }
}
