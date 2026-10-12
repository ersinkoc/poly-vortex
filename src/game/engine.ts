import { audio } from './audio';
import { useGame } from './store';
import type { Arc, Bolt, Entity, Gem, Input, Particle, Upgrade, UpgradeId, Vortex, WeaponId } from './types';

export const LIMITS = { enemies: 280, bolts: 500, particles: 1000, gems: 400 };
export const RUN_DURATION = 180;
const colors = ['#ff567f', '#b58aff', '#ffab56', '#ff466d'];
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const defs: Record<UpgradeId, [string, string]> = {
  pulse: ['Pulse laser', 'Add a homing bolt. Increase pulse damage and fire rate.'],
  glaive: ['Orbital glaives', 'Deploy another orbiting blade. Cut through nearby enemies.'],
  cryo: ['Cryo-singularity', 'Create a gravity well that pulls in and shatters the swarm.'],
  tesla: ['Tesla arc', 'Arc between nearby targets. More voltage. More damage.'],
  damage: ['Reactor overclock', 'Increase all weapon damage by 20% per power level.'],
  speed: ['Vector thrusters', 'Increase movement speed by 12% per power level.'],
  magnet: ['Prism magnet', 'Extend XP collection range by 30% per power level.'],
  repair: ['Nanite repair', 'Restore 35 core integrity and increase maximum integrity.'],
  haste: ['Phase capacitor', 'Reduce dash cooldown and weapon intervals by 10%.'],
};

export class GameEngine {
  player = { x: 0, z: 0, vx: 0, vz: 0, angle: 0, hp: 100, maxHp: 100, invulnerable: 0, dashTime: 0, dashCooldown: 0 };
  input: Input = { keys: new Set(), aimX: 0, aimZ: -8, aiming: false, dash: false, moveX: 0, moveZ: 0 };
  enemies: Entity[] = []; bolts: Bolt[] = []; particles: Particle[] = []; gems: Gem[] = []; arcs: Arc[] = []; vortices: Vortex[] = [];
  weapons: Record<WeaponId, number> = { pulse: 1, glaive: 0, cryo: 0, tesla: 0 };
  time = 0; xp = 0; nextXp = 12; level = 1; score = 0; kills = 0; combo = 1; streak = 0;
  trauma = 0; hitFlash = 0; hitStop = 0; pulse = { x: 0, z: 0, time: -10 };
  damage = 1; speed = 1; magnet = 1; haste = 1; bossSpawned = false;
  private uid = 0; private spawnTimer = 0; private shotTimer = 0; private cryoTimer = 2; private teslaTimer = 1;
  private hudTimer = 0; private comboTimer = 0; private seed: number; private overdrive = false;
  constructor(seed = Date.now()) { this.seed = seed >>> 0; }
  random() { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296; }
  reset() {
    const s = useGame.getState();
    this.player = { x: 0, z: 0, vx: 0, vz: 0, angle: 0, hp: s.maxHp, maxHp: s.maxHp, invulnerable: 1.5, dashTime: 0, dashCooldown: 0 };
    this.enemies = []; this.bolts = []; this.particles = []; this.gems = []; this.arcs = []; this.vortices = [];
    this.weapons = { pulse: 0, glaive: 0, cryo: 0, tesla: 0 }; this.weapons[s.loadout] = 1;
    // Every core has a basic pulse cannon, even with a specialized starting module.
    this.weapons.pulse = Math.max(1, this.weapons.pulse);
    this.time = 0; this.xp = 0; this.nextXp = 12; this.level = 1; this.score = 0; this.kills = 0; this.streak = 0; this.combo = 1;
    this.trauma = 0; this.hitFlash = 0; this.hitStop = 0; this.bossSpawned = false;
    this.pulse = { x: 0, z: 0, time: -10 };
    this.damage = 1 + s.profile.upgrades.reactor * 0.08; this.speed = 1 + s.profile.upgrades.thrusters * 0.06;
    this.magnet = 1; this.haste = 1; this.overdrive = s.difficulty === 'overdrive';
    this.uid = 0; this.spawnTimer = 0; this.shotTimer = 0; this.cryoTimer = 2; this.teslaTimer = 1; this.hudTimer = 0; this.comboTimer = 0;
    this.input.keys.clear(); this.input.dash = false; this.input.moveX = 0; this.input.moveZ = 0; this.input.aiming = false;
    this.publish();
  }
  preview() {
    this.enemies = [];
    for (let i = 0; i < 30; i++) {
      const a = i * 2.39996, r = 7 + this.random() * 10;
      this.spawn(i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0, Math.sin(a) * r, Math.cos(a) * r);
    }
    this.player.invulnerable = 0;
  }
  spawn(kind: Entity['kind'], x?: number, z?: number) {
    if (this.enemies.length >= LIMITS.enemies) {
      if (kind !== 3) return;
      // Reserve a slot for the extraction objective even at maximum horde density.
      const expendable = this.enemies.findIndex(e => e.kind !== 3);
      if (expendable < 0) return;
      this.enemies.splice(expendable, 1);
    }
    const angle = this.random() * Math.PI * 2, r = 19 + this.random() * 6;
    const hp = [16, 35, 100, 2200][kind] * (1 + this.time / 240) * (this.overdrive ? 1.3 : 1);
    this.enemies.push({ id: ++this.uid, x: x ?? this.player.x + Math.sin(angle) * r, z: z ?? this.player.z + Math.cos(angle) * r, hp, maxHp: hp, kind, radius: [0.48, 0.62, 1.1, 2.3][kind], age: 0, timer: 1 + this.random() * 2 });
  }
  burst(x: number, z: number, color: string, count = 14) {
    for (let i = 0; i < count && this.particles.length < LIMITS.particles; i++) {
      const a = this.random() * Math.PI * 2, v = 2 + this.random() * 6, life = 0.3 + this.random() * 0.6;
      this.particles.push({ x, z, y: 0.7, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 2 + this.random() * 4, life, maxLife: life, color, size: 0.06 + this.random() * 0.13 });
    }
  }
  hitEnemy(enemy: Entity, damage: number) {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage; this.comboTimer = 4; this.streak++; this.combo = 1 + Math.min(9, Math.floor(this.streak / 12));
    if (enemy.hp > 0) { this.burst(enemy.x, enemy.z, '#e8ffc6', 3); return; }
    this.kills++; this.score += Math.round([100, 200, 500, 10000][enemy.kind] * this.combo);
    this.burst(enemy.x, enemy.z, colors[enemy.kind], enemy.kind >= 2 ? 40 : 13);
    if (this.gems.length < LIMITS.gems) this.gems.push({ x: enemy.x, z: enemy.z, value: [3, 7, 18, 100][enemy.kind], age: 0 });
    this.pulse = { x: enemy.x, z: enemy.z, time: this.time };
    this.trauma = Math.min(1, this.trauma + (enemy.kind >= 2 ? 0.35 : 0.025));
    if (enemy.kind >= 2) {
      this.hitStop = 0.05; audio.explosion();
      // Splash iterates a snapshot: chained goliath deaths must never mutate this traversal.
      for (const other of [...this.enemies]) if (other.id !== enemy.id && other.hp > 0 && distance(other, enemy) < 4) this.hitEnemy(other, 35 * this.damage);
    }
    if (enemy.kind === 3) { this.publish(); useGame.getState().saveRun(this.score, this.kills, true); }
  }
  hurt(amount: number) {
    if (this.player.invulnerable > 0 || useGame.getState().phase !== 'playing') return;
    this.player.hp = Math.max(0, this.player.hp - amount); this.player.invulnerable = 0.85;
    this.streak = 0; this.combo = 1; this.hitFlash = 0.6; this.trauma = 0.7; this.hitStop = 0.05;
    this.burst(this.player.x, this.player.z, '#ff526f', 20); audio.hit();
    if (this.player.hp === 0) { this.publish(); useGame.getState().saveRun(this.score, this.kills, false); }
  }
  createChoices(): Upgrade[] {
    const pool = (Object.keys(defs) as UpgradeId[]).filter(id => !(id in this.weapons) || this.weapons[id as WeaponId] < 6);
    const picks: Upgrade[] = [];
    while (picks.length < 3 && pool.length) {
      const id = pool.splice(Math.floor(this.random() * pool.length), 1)[0];
      const r = this.random(); const rarity = r > 0.91 ? 'OVERCLOCKED' : r > 0.62 ? 'RARE' : 'COMMON';
      picks.push({ id, title: defs[id][0], description: defs[id][1], rarity, power: rarity === 'OVERCLOCKED' ? 3 : rarity === 'RARE' ? 2 : 1 });
    }
    return picks;
  }
  applyUpgrade(choice: Upgrade) {
    const state = useGame.getState();
    if (state.phase !== 'upgrade' || !state.choices.includes(choice)) return;
    const { id, power } = choice;
    if (id in this.weapons) this.weapons[id as WeaponId] = Math.min(6, this.weapons[id as WeaponId] + power);
    else if (id === 'damage') this.damage += 0.2 * power;
    else if (id === 'speed') this.speed += 0.12 * power;
    else if (id === 'magnet') this.magnet += 0.3 * power;
    else if (id === 'haste') this.haste *= Math.pow(0.9, power);
    else if (id === 'repair') { this.player.maxHp += 10 * power; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35 * power); }
    useGame.setState({ phase: 'playing', choices: [] }); this.checkLevel(); this.publish();
  }
  checkLevel() {
    if (this.xp < this.nextXp || useGame.getState().phase !== 'playing') return;
    this.xp -= this.nextXp; this.level++; this.nextXp = Math.round(12 + Math.pow(this.level, 1.45) * 6);
    this.player.invulnerable = 1; audio.level();
    useGame.setState({ phase: 'upgrade', choices: this.createChoices() }); this.publish();
  }
  publish() {
    useGame.setState({ time: this.time, hp: this.player.hp, maxHp: this.player.maxHp, xp: this.xp, nextXp: this.nextXp, level: this.level, score: this.score, kills: this.kills, combo: this.combo, dash: this.player.dashCooldown, enemies: this.enemies.length, weapons: { ...this.weapons } });
  }
  tick(dt: number) {
    if (useGame.getState().phase !== 'playing') return;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.time += dt; const p = this.player;
    p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashTime = Math.max(0, p.dashTime - dt); p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8); this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    this.comboTimer -= dt; if (this.comboTimer <= 0) { this.combo = Math.max(1, this.combo - dt * 2); this.streak = 0; }
    const k = this.input.keys;
    let mx = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft')) + this.input.moveX;
    let mz = Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp')) + this.input.moveZ;
    const length = Math.hypot(mx, mz); if (length > 1) { mx /= length; mz /= length; }
    if (this.input.aiming) p.angle = Math.atan2(this.input.aimX - p.x, this.input.aimZ - p.z);
    else if (length > 0) p.angle = Math.atan2(mx, mz);
    if (this.input.dash && p.dashCooldown <= 0) {
      p.dashTime = 0.2; p.invulnerable = 0.38; p.dashCooldown = 3 * this.haste;
      const dx = this.input.aiming ? this.input.aimX - p.x : length > 0 ? mx : Math.sin(p.angle);
      const dz = this.input.aiming ? this.input.aimZ - p.z : length > 0 ? mz : Math.cos(p.angle);
      const d = Math.hypot(dx, dz) || 1; p.vx = dx / d * 32; p.vz = dz / d * 32;
      this.burst(p.x, p.z, '#baff58', 24); this.trauma = 0.2; audio.dash();
    }
    this.input.dash = false;
    if (p.dashTime <= 0) { const lerp = 1 - Math.exp(-11 * dt); p.vx += (mx * 7.5 * this.speed - p.vx) * lerp; p.vz += (mz * 7.5 * this.speed - p.vz) * lerp; }
    else this.burst(p.x, p.z, '#9effcf', 2);
    p.x += p.vx * dt; p.z += p.vz * dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const pressure = 1 + this.time / 45;
      this.spawnTimer = Math.max(0.09, 0.75 / pressure) / (this.overdrive ? 1.4 : 1);
      const r = this.random(); this.spawn(this.time > 35 && r > 0.91 ? 2 : this.time > 14 && r > 0.72 ? 1 : 0);
    }
    if (this.time >= RUN_DURATION && !this.bossSpawned) { this.bossSpawned = true; this.spawn(3, p.x, p.z - 18); audio.explosion(); }
    // Spatial bins keep flocking local; avoid a quadratic whole-horde comparison.
    const bins = new Map<string, Entity[]>();
    for (const e of this.enemies) {
      const key = `${Math.floor(e.x / 2)},${Math.floor(e.z / 2)}`; const bin = bins.get(key);
      if (bin) bin.push(e); else bins.set(key, [e]);
    }
    let nearest: Entity | undefined, nearestDistance = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.age += dt; e.timer -= dt;
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 0.01;
      if (d < nearestDistance) { nearestDistance = d; nearest = e; }
      const speed = [2.8, 2.1, 1.4, 1.15][e.kind] * (1 + this.time / 360) * (this.overdrive ? 1.2 : 1);
      let vx = dx / d * speed, vz = dz / d * speed;
      if (e.kind === 1 && d < 10) { const radial = d < 7 ? -0.7 : 0; vx = dx / d * radial - dz / d * 1.4; vz = dz / d * radial + dx / d * 1.4; }
      const bx = Math.floor(e.x / 2), bz = Math.floor(e.z / 2);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const neighbors = bins.get(`${bx + ox},${bz + oz}`); if (!neighbors) continue;
        for (const other of neighbors) {
          if (other === e) continue; const nd = distance(e, other), safe = e.radius + other.radius + 0.25;
          if (nd > 0.01 && nd < safe) { const push = (safe - nd) * 2.5 / nd; vx += (e.x - other.x) * push; vz += (e.z - other.z) * push; }
        }
      }
      for (const v of this.vortices) { const vd = distance(e, v); if (vd < v.radius && vd > 0.1) { vx += (v.x - e.x) / vd * 5; vz += (v.z - e.z) / vd * 5; this.hitEnemy(e, dt * (12 + this.weapons.cryo * 7) * this.damage); } }
      e.x += vx * dt; e.z += vz * dt;
      if (d < e.radius + 0.6) this.hurt([10, 14, 24, 35][e.kind]);
      if ((e.kind === 1 || e.kind === 3) && e.timer <= 0 && d < 26) {
        e.timer = e.kind === 3 ? 1.5 : 3.5;
        const count = e.kind === 3 ? 18 : 8;
        for (let j = 0; j < count && this.bolts.length < LIMITS.bolts; j++) {
          const a = j / count * Math.PI * 2 + e.age * 0.4;
          this.bolts.push({ x: e.x, z: e.z, vx: Math.sin(a) * 4.5, vz: Math.cos(a) * 4.5, enemy: true, age: 0, target: 0, damage: 10 });
        }
      }
      if (this.weapons.glaive) {
        for (let j = 0; j < this.weapons.glaive + 1; j++) {
          const a = this.time * 2.3 + j / (this.weapons.glaive + 1) * Math.PI * 2;
          if (Math.hypot(e.x - p.x - Math.cos(a) * 3, e.z - p.z - Math.sin(a) * 3) < e.radius + 0.7) this.hitEnemy(e, dt * 65 * this.damage);
        }
      }
    }
    this.shotTimer -= dt;
    if (nearest && nearestDistance < 23 && this.shotTimer <= 0) {
      this.shotTimer = Math.max(0.1, 0.46 - this.weapons.pulse * 0.045) * this.haste; audio.shot();
      const targets = this.enemies.filter(e => e.hp > 0).sort((a, b) => distance(a, p) - distance(b, p));
      for (let i = 0; i < Math.ceil(this.weapons.pulse / 2) && this.bolts.length < LIMITS.bolts; i++) {
        const target = targets[i % targets.length]; if (!target) continue;
        const d = distance(target, p) || 1;
        this.bolts.push({ x: p.x, z: p.z, vx: (target.x - p.x) / d * 22, vz: (target.z - p.z) / d * 22, enemy: false, age: 0, target: target.id, damage: (15 + this.weapons.pulse * 4) * this.damage });
      }
    }
    this.cryoTimer -= dt;
    if (this.weapons.cryo && nearest && this.cryoTimer <= 0) {
      this.cryoTimer = 6 * this.haste; this.vortices.push({ x: nearest.x, z: nearest.z, radius: 3.5 + this.weapons.cryo * 0.3, life: 3.5 }); audio.tone(100, 0.5, 'sine', 0.35, 400);
    }
    this.teslaTimer -= dt;
    if (this.weapons.tesla && nearest && nearestDistance < 15 && this.teslaTimer <= 0) {
      this.teslaTimer = 2 * this.haste; const points: [number, number][] = [[p.x, p.z]]; const hit = new Set<number>(); let origin: { x: number; z: number } = p;
      for (let i = 0; i < Math.min(5, 2 + this.weapons.tesla); i++) {
        let target: Entity | undefined, best = i === 0 ? 15 : 7;
        for (const e of this.enemies) { const d = distance(e, origin); if (e.hp > 0 && !hit.has(e.id) && d < best) { best = d; target = e; } }
        if (!target) break; hit.add(target.id); points.push([target.x, target.z]); this.hitEnemy(target, (22 + this.weapons.tesla * 12) * this.damage); origin = target;
      }
      this.arcs.push({ points, life: 0.24 }); audio.tone(1600, 0.14, 'sawtooth', 0.18, 100);
    }
    const byId = new Map(this.enemies.map(e => [e.id, e]));
    for (const b of this.bolts) {
      b.age += dt;
      if (!b.enemy) {
        const target = byId.get(b.target);
        if (target && target.hp > 0) {
          const dx = target.x - b.x, dz = target.z - b.z, d = Math.hypot(dx, dz) || 1;
          b.vx += (dx / d * 22 - b.vx) * Math.min(1, dt * 8); b.vz += (dz / d * 22 - b.vz) * Math.min(1, dt * 8);
        }
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.enemy) { if (distance(b, p) < 0.7) { this.hurt(b.damage); b.age = 10; } }
      else for (const e of this.enemies) if (e.hp > 0 && distance(b, e) < e.radius + 0.25) { this.hitEnemy(e, b.damage); b.age = 10; break; }
    }
    this.bolts = this.bolts.filter(b => b.age < 4);
    this.enemies = this.enemies.filter(e => e.hp > 0 && (e.kind === 3 || distance(e, p) < 45));
    for (const g of this.gems) {
      g.age += dt; const d = distance(g, p);
      if (d < 4.5 * this.magnet) { const v = Math.min(d, (12 + g.age * 0.2) * dt); g.x += (p.x - g.x) / (d || 1) * v; g.z += (p.z - g.z) / (d || 1) * v; }
      if (d < 0.8) { this.xp += g.value; g.value = 0; audio.pickup(); }
    }
    this.gems = this.gems.filter(g => g.value > 0 && g.age < 60);
    this.checkLevel();
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= dt * 8; }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const a of this.arcs) a.life -= dt; this.arcs = this.arcs.filter(a => a.life > 0);
    for (const v of this.vortices) v.life -= dt; this.vortices = this.vortices.filter(v => v.life > 0);
    audio.combo = this.combo;
    this.hudTimer += dt; if (this.hudTimer > 0.1) { this.hudTimer = 0; this.publish(); }
  }
}
export const engine = new GameEngine();
