import { clearTerrainPosition } from './terrain';
export type MissionKind = 'rescue' | 'uplink' | 'hunt';
export type MissionTarget = { id: number; x: number; z: number; progress: number; done: boolean };
export type Mission = { id: number; kind: MissionKind; title: string; description: string; status: 'active' | 'complete' | 'failed'; remaining: number; progress: number; goal: number; reward: number; targets: MissionTarget[]; startKills: number };
export type MissionEvent = 'started' | 'rescued' | 'complete' | 'failed';

export class MissionDirector {
  mission: Mission | null = null;
  completed = 0; rescued = 0;
  private delay = 8; private serial = 0;
  reset() { this.mission = null; this.completed = 0; this.rescued = 0; this.delay = 8; this.serial = 0; }
  tick(dt: number, player: { x: number; z: number }, kills: number, random: () => number): MissionEvent[] {
    const events: MissionEvent[] = [];
    if (!this.mission || this.mission.status !== 'active') {
      this.delay -= dt;
      if (this.delay > 0) return events;
      const kind = (['rescue', 'uplink', 'hunt'] as const)[this.serial % 3];
      const count = kind === 'rescue' ? 3 : kind === 'uplink' ? 1 : 0;
      const heading = random() * Math.PI * 2;
      const targets = Array.from({ length: count }, (_, i) => {
        const angle = heading + i * Math.PI * 2 / Math.max(1, count); const radius = 7 + random() * 4;
        const target = { id: i, x: player.x + Math.sin(angle) * radius, z: player.z + Math.cos(angle) * radius, progress: 0, done: false }; clearTerrainPosition(target, 2); return target;
      });
      this.mission = { id: ++this.serial, kind, title: kind === 'rescue' ? 'NO ONE LEFT BEHIND' : kind === 'uplink' ? 'RESTORE THE UPLINK' : 'BREAK THE BLOCKADE', description: kind === 'rescue' ? 'Stay near each stranded pilot for 1.5s to extract.' : kind === 'uplink' ? 'Hold the relay perimeter for 8s. Progress is retained.' : 'Eliminate 20 hostiles before the signal closes.', status: 'active', remaining: kind === 'rescue' ? 70 : 45, progress: 0, goal: kind === 'rescue' ? 3 : kind === 'uplink' ? 8 : 20, reward: kind === 'rescue' ? 45 : 30, targets, startKills: kills };
      return ['started'];
    }
    const mission = this.mission;
    // Only the part of a tick before the deadline can count towards an objective.
    const step = Math.min(dt, mission.remaining); mission.remaining = Math.max(0, mission.remaining - dt);
    if (mission.kind === 'hunt') mission.progress = Math.min(mission.goal, Math.max(0, kills - mission.startKills));
    else for (const target of mission.targets) {
      if (target.done) continue;
      const nearby = Math.hypot(player.x - target.x, player.z - target.z) < (mission.kind === 'rescue' ? 2.4 : 3.5);
      const required = mission.kind === 'rescue' ? 1.5 : 8;
      target.progress = Math.min(required, Math.max(0, target.progress + (nearby ? step : mission.kind === 'rescue' ? -step * 0.75 : 0)));
      if (target.progress >= required - 1e-8) {
        target.done = true; target.progress = required;
        if (mission.kind === 'rescue') { mission.progress++; this.rescued++; events.push('rescued'); }
      }
      if (mission.kind === 'uplink') mission.progress = target.progress;
    }
    if (mission.progress >= mission.goal) { mission.status = 'complete'; this.completed++; this.delay = 10; events.push('complete'); }
    else if (mission.remaining <= 0) { mission.status = 'failed'; this.delay = 8; events.push('failed'); }
    return events;
  }
  snapshot(): Mission | null { return this.mission ? { ...this.mission, targets: this.mission.targets.map(t => ({ ...t })) } : null; }
}
