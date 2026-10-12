import type { Upgrade } from './types';
import type { StatChange } from './upgrade-preview';

export const REEL_TIMING = { spin: 1.7, hold: 1.35 } as const;
export type RewardSource = 'level' | 'salvage';
type RewardRequest = { source: RewardSource; level: number };
export type RewardRoll = RewardRequest & { id: number; choices: Upgrade[]; winner: number; elapsed: number; installed: boolean; changes: StatChange[] };
export function reelPosition(roll: RewardRoll, reducedMotion = false) {
  const destination = roll.choices.length * 8 + roll.winner;
  if (reducedMotion) return roll.installed ? destination : 0;
  const t = Math.min(1, Math.max(0, roll.elapsed / REEL_TIMING.spin));
  return destination * (1 - (1 - t) ** 3);
}

/** One reel, FIFO rewards. Only simulation time can install a module. */
export class RewardReel {
  active: RewardRoll | null = null;
  private pending: RewardRequest[] = [];
  private serial = 0;
  constructor(private create: (source: RewardSource) => Upgrade[], private random: () => number, private install: (upgrade: Upgrade) => StatChange[]) {}
  get queued() { return this.pending.length; }
  enqueue(source: RewardSource, level: number) {
    this.pending.push({ source, level });
    if (!this.active) this.begin();
  }
  private begin() {
    const request = this.pending.shift();
    if (!request) return;
    // Generate from the latest build, after the previous award has installed.
    const choices = this.create(request.source);
    this.active = { ...request, id: ++this.serial, choices, winner: Math.floor(this.random() * choices.length), elapsed: 0, installed: false, changes: [] };
  }
  tick(dt: number) {
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return false;
    let changed = false;
    this.active.elapsed += dt;
    if (!this.active.installed && this.active.elapsed >= REEL_TIMING.spin) {
      this.active.installed = true;
      this.active.changes = this.install(this.active.choices[this.active.winner]);
      changed = true;
    }
    if (this.active.elapsed >= REEL_TIMING.spin + REEL_TIMING.hold) {
      this.active = null; this.begin(); changed = true;
    }
    return changed;
  }
  reset() { this.active = null; this.pending = []; this.serial = 0; }
  snapshot() { return this.active ? { ...this.active } : null; }
}
