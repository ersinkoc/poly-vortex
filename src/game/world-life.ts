import { clearTerrainPosition, terrainHeight, terrainImpact } from './terrain';
import { turnTowards } from './targeting';
import type { Entity } from './types';
import type { Blast } from './visuals';

export const LIFE_RULES = { wildlife: 8, crew: 12, capacity: 20, firstVisit: 7, cullRange: 36, escapeLife: 19 } as const;
export type LifeActor = { id: number; kind: 'fox' | 'lizard' | 'crew'; x: number; z: number; yaw: number; age: number; life: number; stride: number; speed: number; fright: number; goalX: number; goalZ: number; think: number; recover: number; source?: number; launchHeight: number };

/** Ambient actors have their own randomness, identities and pools, outside combat. */
export class WorldLife {
  actors: LifeActor[] = [];
  private seed = 1; private serial = 0; private visit: number = LIFE_RULES.firstVisit;
  reset(seed: number) { this.seed = (seed ^ 0x71b5ca93) >>> 0; this.serial = 0; this.visit = LIFE_RULES.firstVisit; this.actors = []; }
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private make(kind: LifeActor['kind'], x: number, z: number, yaw: number, life: number): LifeActor {
    const actor: LifeActor = { id: ++this.serial, kind, x, z, yaw, age: 0, life, stride: this.random() * 6, speed: 0, fright: 0, goalX: x + Math.sin(yaw) * 8, goalZ: z + Math.cos(yaw) * 8, think: 0, recover: 0, launchHeight: 0 };
    clearTerrainPosition(actor, kind === 'crew' ? 0.5 : 0.35); return actor;
  }
  escapeCrew(wreck: Pick<Entity, 'id' | 'kind' | 'x' | 'z' | 'radius'>, core: { x: number; z: number }) {
    if (wreck.kind !== 2 || this.actors.some(a => a.source === wreck.id) || this.random() > 0.72) return;
    const count = this.random() < 0.4 ? 2 : 1;
    const heading = Math.atan2(wreck.x - core.x, wreck.z - core.z);
    for (let i = 0; i < count && this.actors.filter(a => a.kind === 'crew').length < LIFE_RULES.crew && this.actors.length < LIFE_RULES.capacity; i++) {
      const yaw = heading + (i ? 0.55 : -0.55) + (this.random() - 0.5) * 0.6, radius = wreck.radius + 0.35;
      const actor = this.make('crew', wreck.x + Math.sin(yaw) * radius, wreck.z + Math.cos(yaw) * radius, yaw, LIFE_RULES.escapeLife);
      actor.source = wreck.id; actor.fright = 4; actor.launchHeight = wreck.radius * 0.7;
      actor.recover = i === 1 || this.random() < 0.35 ? 5 + this.random() * 3 : 0;
      actor.goalX = actor.x + Math.sin(yaw) * 14; actor.goalZ = actor.z + Math.cos(yaw) * 14;
      this.actors.push(actor);
    }
  }
  tick(dt: number, core: { x: number; z: number }, enemies: readonly Entity[], blasts: readonly Blast[], allowVisits = true) {
    if (dt <= 0) return;
    if (allowVisits) {
      this.visit -= dt;
      if (this.visit <= 0) {
        this.visit = 19 + this.random() * 13;
        if (this.actors.filter(a => a.kind !== 'crew').length < LIFE_RULES.wildlife && this.actors.length < LIFE_RULES.capacity) {
          const angle = this.random() * Math.PI * 2, r = 9 + this.random() * 5;
          const actor = this.make(this.random() < 0.6 ? 'fox' : 'lizard', core.x + Math.sin(angle) * r, core.z + Math.cos(angle) * r, angle + Math.PI * 0.6, 32 + this.random() * 14);
          this.actors.push(actor);
        }
      }
    }
    for (const a of this.actors) {
      a.age += dt; a.fright = Math.max(0, a.fright - dt); a.think -= dt;
      let fleeX = 0, fleeZ = 0;
      const repel = (x: number, z: number, radius: number) => {
        const dx = a.x - x, dz = a.z - z, d = Math.hypot(dx, dz);
        if (d < radius) { const weight = (radius - d) / Math.max(0.2, d); fleeX += dx * weight; fleeZ += dz * weight; a.fright = Math.max(a.fright, 2.5); }
      };
      repel(core.x, core.z, 3.5);
      for (const e of enemies) if (e.hp > 0) repel(e.x, e.z, e.radius + 4);
      for (const b of blasts) if (!b.energy && b.age < 0.9) repel(b.x, b.z, b.size + 4.5);
      if (Math.hypot(fleeX, fleeZ) > 0.01) { const angle = Math.atan2(fleeX, fleeZ); a.goalX = a.x + Math.sin(angle) * 9; a.goalZ = a.z + Math.cos(angle) * 9; }
      else if (a.think <= 0 || Math.hypot(a.goalX - a.x, a.goalZ - a.z) < 0.7) {
        a.think = 3 + this.random() * 4;
        const angle = a.yaw + (this.random() - 0.5) * 2;
        const travel = a.kind === 'crew' || a.fright > 0 ? 8 : this.random() < 0.45 ? 0 : 3 + this.random() * 5;
        a.goalX = a.x + Math.sin(angle) * travel; a.goalZ = a.z + Math.cos(angle) * travel;
      }
      const moving = Math.hypot(a.goalX - a.x, a.goalZ - a.z) > 0.5;
      const crawl = a.kind === 'crew' && a.age < a.recover;
      const desiredSpeed = !moving ? 0 : crawl ? 0.62 : a.kind === 'crew' ? 1.85 : a.fright > 0 ? a.kind === 'fox' ? 3.1 : 2.2 : a.kind === 'fox' ? 0.8 : 0.48;
      a.speed += (desiredSpeed - a.speed) * Math.min(1, dt * 5);
      const aim = Math.atan2(a.goalX - a.x, a.goalZ - a.z); a.yaw = turnTowards(a.yaw, aim, dt * (a.fright > 0 ? 5 : 1.5));
      const next = { x: a.x + Math.sin(a.yaw) * a.speed * dt, z: a.z + Math.cos(a.yaw) * a.speed * dt };
      if (terrainImpact(a, next, a.kind === 'crew' ? 0.5 : 0.3)) {
        a.yaw += (a.id % 2 ? 1 : -1) * dt * 4;
        a.goalX = a.x + Math.sin(a.yaw) * 4; a.goalZ = a.z + Math.cos(a.yaw) * 4;
      } else { a.x = next.x; a.z = next.z; }
      clearTerrainPosition(a, a.kind === 'crew' ? 0.5 : 0.3);
      a.stride += a.speed * dt * (crawl ? 5 : a.kind === 'crew' ? 8 : 12);
    }
    this.actors = this.actors.filter(a => a.age < a.life && Math.hypot(a.x - core.x, a.z - core.z) < LIFE_RULES.cullRange);
  }
}

export function lifePose(a: LifeActor) {
  const crawl = a.kind === 'crew' ? Math.max(0, Math.min(1, (a.recover - a.age) / 0.8)) : 0;
  const launch = a.kind === 'crew' && a.age < 0.65 ? a.launchHeight * (1 - a.age / 0.65) + Math.sin(a.age / 0.65 * Math.PI) * 0.25 : 0;
  const moving = Math.min(1, a.speed);
  return { y: terrainHeight(a.x, a.z) + (a.kind === 'crew' ? 0.04 + crawl * 0.2 : 0.035) + launch + Math.abs(Math.sin(a.stride)) * 0.015 * moving,
    crawl, scale: (a.kind === 'crew' ? 0.56 : a.kind === 'fox' ? 0.85 : 0.7) * Math.min(1, Math.max(0, (a.life - a.age) / 1.5)), moving };
}
