import { ROVER_RULES, type GroundRover } from './ground-rovers';
import { terrainImpact } from './terrain';
import type { Entity } from './types';

export const ROVER_RADAR = { period: 3.6, range: ROVER_RULES.blastRadius, hold: 1.8, contacts: 4, beam: 0.16 } as const;
const TAU = Math.PI * 2;
const wrap = (a: number) => (a % TAU + TAU) % TAU;
export const roverSweep = (r: Pick<GroundRover, 'id' | 'age' | 'yaw'>) => wrap(r.yaw + r.id * 1.37 + r.age * TAU / ROVER_RADAR.period);
export type RoverEcho = { id: number; x: number; z: number; life: number };

/** Visual sensor only: independent from combat targeting, damage and randomness. */
export class RoverRadar {
  readonly echoes: RoverEcho[] = [];
  private id = -1;
  private age = 0;
  reset() { this.echoes.length = 0; this.id = -1; this.age = 0; }
  scan(r: GroundRover, enemies: readonly Entity[]) {
    if (r.id !== this.id || r.age < this.age) { this.reset(); this.id = r.id; this.age = r.age; }
    const dt = Math.max(0, r.age - this.age), angle = roverSweep(r);
    this.age = r.age;
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const echo = this.echoes[i], e = enemies.find(e => e.id === echo.id && e.hp > 0);
      echo.life -= dt;
      if (!e || echo.life <= 0 || Math.hypot(e.x - r.x, e.z - r.z) > ROVER_RADAR.range || terrainImpact(r, e, 0)) this.echoes.splice(i, 1);
      else { echo.x = e.x; echo.z = e.z; }
    }
    if (r.state === 'detonated' || r.age < ROVER_RULES.armingDelay) { this.echoes.length = 0; return this.echoes; }
    // Cover the swept interval as well as the current beam, including low frame rates.
    const swept = Math.min(TAU, dt * TAU / ROVER_RADAR.period + ROVER_RADAR.beam);
    for (const e of enemies) {
      const behind = wrap(angle - Math.atan2(e.x - r.x, e.z - r.z));
      if (e.hp <= 0 || Math.hypot(e.x - r.x, e.z - r.z) > ROVER_RADAR.range || behind > swept || terrainImpact(r, e, 0)) continue;
      const life = ROVER_RADAR.hold - behind * ROVER_RADAR.period / TAU;
      if (life <= 0) continue;
      const existing = this.echoes.find(b => b.id === e.id);
      if (existing) existing.life = Math.max(existing.life, life);
      else if (this.echoes.length < ROVER_RADAR.contacts) this.echoes.push({ id: e.id, x: e.x, z: e.z, life });
    }
    return this.echoes;
  }
}
