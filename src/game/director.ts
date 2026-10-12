export type EncounterPhase = 'insertion' | 'buildup' | 'assault' | 'recovery' | 'sentinel';
export const ENCOUNTERS = {
  insertion: { title: 'INSERTION', detail: 'Get moving. Scout the amber rescue signals.', duration: 12, rate: 0.65, color: '#8bd8ff' },
  buildup: { title: 'CONTACTS BUILDING', detail: 'Collect prisms. Prepare your dash and ordnance.', duration: 16, rate: 1, color: '#d0f58a' },
  assault: { title: 'SWARM ASSAULT', detail: 'Keep moving. Use cover, rockets and your EMP.', duration: 12, rate: 1.55, color: '#ff9e78' },
  recovery: { title: 'REINFORCEMENTS PAUSED', detail: 'Clear remaining threats. Recover and finish your operation.', duration: 8, rate: 0, color: '#8effcc' },
  sentinel: { title: 'SENTINEL ENGAGED', detail: 'Face the guardian alone. Dodge its barrages and strike warnings.', duration: 0, rate: 0, color: '#ff7899' },
} as const;

/** Changes reinforcement pacing only. Existing enemies and damage stay intact. */
export class EncounterDirector {
  phase: EncounterPhase = 'insertion'; elapsed = 0; round = 1; stress = 0;
  private reliefCooldown = 0;
  get remaining() { return Math.max(0, ENCOUNTERS[this.phase].duration - this.elapsed); }
  get spawnRate() { return ENCOUNTERS[this.phase].rate; }
  reset() { this.phase = 'insertion'; this.elapsed = 0; this.round = 1; this.stress = 0; this.reliefCooldown = 0; }
  recover() {
    if (this.phase === 'sentinel' || this.phase === 'recovery') return;
    this.phase = 'recovery'; this.elapsed = 0; this.reliefCooldown = 28;
  }
  tick(dt: number, pressure: number, boss: boolean, service = false) {
    this.stress += (Math.max(0, Math.min(1, pressure)) - this.stress) * (1 - Math.exp(-dt * 2));
    if (boss) { this.phase = 'sentinel'; this.elapsed = 0; return; }
    if (service) { this.phase = 'recovery'; this.elapsed = 0; return; }
    if (this.phase === 'sentinel') { this.phase = 'recovery'; this.elapsed = 0; this.reliefCooldown = 28; }
    this.elapsed += dt; this.reliefCooldown = Math.max(0, this.reliefCooldown - dt);
    if ((this.phase === 'assault' || this.phase === 'buildup') && this.elapsed >= 6 && this.stress > 0.78 && this.reliefCooldown <= 0) { this.recover(); return; }
    while (this.elapsed >= ENCOUNTERS[this.phase].duration) {
      this.elapsed -= ENCOUNTERS[this.phase].duration;
      if (this.phase === 'insertion') this.phase = 'buildup';
      else if (this.phase === 'buildup') this.phase = 'assault';
      else if (this.phase === 'assault') { this.phase = 'recovery'; this.reliefCooldown = 28; }
      else { this.phase = 'buildup'; this.round++; }
    }
  }
}
