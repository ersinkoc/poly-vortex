import { audio } from './audio';
import { useGame } from './store';
import { SECTORS, sectorAt } from './progression';
import { MissionDirector } from './missions';
import { clearTerrainPosition, terrainImpact } from './terrain';
import { angleDifference, friendlyInLine, PULSE_RANGE, selectTarget, turnTowards } from './targeting';
import { ROCKET_CAPACITY, SUPPLY_RULES, supplyLifetime } from './supplies';
import { EncounterDirector } from './director';
import { inspectLauncher, LAUNCHER_COPY, ROCKET_RULES } from './launcher';
import { VISUAL_LIMITS, type Blast, type Scorch } from './visuals';
import { RewardReel } from './reward-reel';
import { previewUpgrade } from './upgrade-preview';
import { shieldContact, shieldImpact, SHIELD_IMPACT, type HitSource, type ShieldHit } from './shield-impact';
import type { Arc, Bolt, Cache, DamageText, Entity, Gem, Hazard, Input, Particle, Rocket, Shockwave, Supply, Upgrade, UpgradeId, Vortex, WeaponId } from './types';

export const LIMITS = { enemies: 280, bolts: 500, rockets: 16, particles: 1000, gems: 400, shockwaves: 40, damageTexts: 40, hazards: 12, supplies: 10, caches: 8 };
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
  shield: ['Aegis plating', 'Add 15 regenerating shield capacity per power level.'],
  critical: ['Targeting matrix', 'Add 7% critical chance. Critical hits deal double damage.'],
  pierce: ['Penetrator rounds', 'Pulse bolts punch through an additional hostile per power level.'],
};

export class GameEngine {
  shieldHits: ShieldHit[] = [];
  readonly rewards: RewardReel;
  blasts: Blast[] = []; scorches: Scorch[] = []; private visualId = 0;
  director = new EncounterDirector();
  missions = new MissionDirector();
  targetId = 0;
  rockets: Rocket[] = []; rocketAmmo = ROCKET_CAPACITY; rocketCooldown = 0;
  rocketPending = 0; private pendingRocketTarget = 0;
  rocketNotice = ''; rocketNoticeKind: 'success' | 'warning' = 'success'; rocketNoticeTime = 0;
  player = { x: 0, z: 0, vx: 0, vz: 0, angle: 0, hp: 100, maxHp: 100, hullHit: 0, invulnerable: 0, dashTime: 0, dashCooldown: 0 };
  input: Input = { keys: new Set(), aimX: 0, aimZ: -8, aiming: false, dash: false, surge: false, rocket: false, moveX: 0, moveZ: 0 };
  enemies: Entity[] = []; bolts: Bolt[] = []; particles: Particle[] = []; gems: Gem[] = []; arcs: Arc[] = []; vortices: Vortex[] = [];
  shockwaves: Shockwave[] = []; damageTexts: DamageText[] = []; hazards: Hazard[] = []; supplies: Supply[] = []; caches: Cache[] = [];
  shield = 40; maxShield = 40; surge = 100; sector = 0; bossPhase = 0; peakCombo = 1; eliteKills = 0; salvage = 0;
  criticalChance = 0.05; piercing = 0; overdriveTime = 0; repairTime = 0; shieldDelay = 0;
  announcement = ''; announcementDetail = ''; announcementTime = 0;
  weapons: Record<WeaponId, number> = { pulse: 1, glaive: 0, cryo: 0, tesla: 0 };
  time = 0; xp = 0; nextXp = 12; level = 1; score = 0; kills = 0; combo = 1; streak = 0;
  trauma = 0; hitFlash = 0; hitStop = 0; pulse = { x: 0, z: 0, time: -10 };
  damage = 1; speed = 1; magnet = 1; haste = 1; bossSpawned = false;
  private uid = 0; private spawnTimer = 0; private shotTimer = 0; private cryoTimer = 2; private teslaTimer = 1;
  private hudTimer = 0; private comboTimer = 0; private seed: number; private overdrive = false;
  private hazardTimer = 37; private supplyTimer = 24; private repairTimer = SUPPLY_RULES.repair.first as number; private ammoTimer = SUPPLY_RULES.ammo.first as number;
  private lastCombatSupply = -25;
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.rewards = new RewardReel(source => this.createChoices(source === 'salvage'), () => this.random(), choice => this.installUpgrade(choice));
  }
  random() { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296; }
  reset() {
    this.shieldHits = [];
    this.rewards.reset(); this.publishRewards();
    this.blasts = []; this.scorches = []; this.visualId = 0;
    this.director.reset();
    useGame.setState({ navigation: [] });
    this.missions.reset();
    this.targetId = 0;
    this.rockets = []; this.rocketAmmo = ROCKET_CAPACITY; this.rocketCooldown = 0; this.ammoTimer = SUPPLY_RULES.ammo.first;
    this.rocketPending = 0; this.pendingRocketTarget = 0; this.rocketNotice = ''; this.rocketNoticeTime = 0; this.rocketNoticeKind = 'success';
    this.lastCombatSupply = -25;
    const s = useGame.getState();
    this.player = { x: 0, z: 0, vx: 0, vz: 0, angle: 0, hp: s.maxHp, maxHp: s.maxHp, hullHit: 0, invulnerable: 1.5, dashTime: 0, dashCooldown: 0 };
    this.enemies = []; this.bolts = []; this.particles = []; this.gems = []; this.arcs = []; this.vortices = [];
    this.shockwaves = []; this.damageTexts = []; this.hazards = []; this.supplies = []; this.caches = [];
    this.shield = 40; this.maxShield = 40; this.surge = 100; this.sector = 0; this.bossPhase = 0; this.peakCombo = 1; this.eliteKills = 0; this.salvage = 0;
    this.criticalChance = 0.05; this.piercing = 0; this.overdriveTime = 0; this.repairTime = 0; this.shieldDelay = 0; this.hazardTimer = 37; this.supplyTimer = 24; this.repairTimer = SUPPLY_RULES.repair.first;
    this.announcement = ''; this.announcementDetail = ''; this.announcementTime = 0;
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
    this.input.surge = false;
    this.input.rocket = false;
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
  spawn(kind: Entity['kind'], x?: number, z?: number, elite = false) {
    if (this.enemies.length >= LIMITS.enemies) {
      if (kind !== 3) return;
      // Reserve a slot for the extraction objective even at maximum horde density.
      const expendable = this.enemies.findIndex(e => e.kind !== 3);
      if (expendable < 0) return;
      this.enemies.splice(expendable, 1);
    }
    const angle = this.random() * Math.PI * 2, r = 19 + this.random() * 6;
    const isElite = elite && kind !== 3;
    const hp = [16, 35, 100, 2200][kind] * (1 + this.time / 240) * (this.overdrive ? 1.3 : 1) * (isElite ? 2.8 : 1);
    this.enemies.push({ id: ++this.uid, x: x ?? this.player.x + Math.sin(angle) * r, z: z ?? this.player.z + Math.cos(angle) * r, hp, maxHp: hp, kind, radius: [0.48, 0.62, 1.1, 2.3][kind] * (isElite ? 1.18 : 1), age: 0, timer: 1 + this.random() * 2, elite: isElite });
  }
  announce(title: string, detail: string) { this.announcement = title; this.announcementDetail = detail; this.announcementTime = 5; }
  wave(x: number, z: number, radius: number, color: string, life = 0.7) {
    if (this.shockwaves.length < LIMITS.shockwaves) this.shockwaves.push({ x, z, radius, color, life, maxLife: life });
  }
  blast(x: number, z: number, size: number, color = '#ff9a51', energy = false) {
    if (this.blasts.length >= VISUAL_LIMITS.blasts) this.blasts.shift();
    this.blasts.push({ id: ++this.visualId, x, z, size, color, age: 0, energy });
    if (!energy && size >= 1.1) { if (this.scorches.length >= VISUAL_LIMITS.scorches) this.scorches.shift(); this.scorches.push({ x, z, size: size * 1.1, age: 0 }); }
  }
  activateSurge() {
    if (useGame.getState().phase !== 'playing' || this.surge < 100) return false;
    this.surge = 0; this.player.invulnerable = Math.max(this.player.invulnerable, 0.65);
    const p = this.player; this.wave(p.x, p.z, 11, '#74ecff', 0.9); this.burst(p.x, p.z, '#9cf6ff', 55);
    this.blast(p.x, p.z, 2.2, '#84ddff', true);
    for (const e of [...this.enemies]) if (distance(e, p) < 11) { this.hitEnemy(e, (48 + this.level * 5) * this.damage); const d = distance(e, p) || 1; e.x += (e.x - p.x) / d * 2; e.z += (e.z - p.z) / d * 2; }
    this.bolts = this.bolts.filter(b => !b.enemy || distance(b, p) > 13);
    // Kills caused by the discharge cannot instantly recharge that discharge.
    this.surge = 0;
    this.trauma = 0.6; this.hitStop = 0.05; audio.surge(); this.publish(); return true;
  }
  addHazard(x: number, z: number, radius = 3.2, delay = 1.8) {
    if (this.hazards.length < LIMITS.hazards) this.hazards.push({ x, z, radius, delay, age: 0, duration: 0.5, detonated: false });
  }
  dropSupply(type: Supply['type'], x: number, z: number) {
    const cap = type === 'repair' || type === 'ammo' ? SUPPLY_RULES[type].cap : LIMITS.supplies;
    if (this.supplies.length >= LIMITS.supplies || this.supplies.filter(s => s.type === type && s.age < supplyLifetime(s)).length >= cap) return false;
    const supply: Supply = { x, z, type, age: 0 }; clearTerrainPosition(supply, 1.2); this.supplies.push(supply); return true;
  }
  launcherLock() {
    const allies = this.missions.mission?.kind === 'rescue' && this.missions.mission.status === 'active' ? this.missions.mission.targets.filter(t => !t.done) : [];
    const s = useGame.getState();
    return inspectLauncher({ phase: s.phase, ammo: this.rocketAmmo, cooldown: this.rocketCooldown, active: this.rockets.length, limit: LIMITS.rockets, player: this.player, input: this.input, mode: s.aimMode, lockedId: this.targetId, enemies: this.enemies, allies });
  }
  rocketFeedback(message: string, kind: 'success' | 'warning' = 'warning') { this.rocketNotice = message; this.rocketNoticeKind = kind; this.rocketNoticeTime = 2.5; }
  cancelRocket(reason?: string) { if (this.rocketPending > 0 && reason) this.rocketFeedback(reason); this.rocketPending = 0; this.pendingRocketTarget = 0; }
  requestRocket() {
    const lock = this.launcherLock();
    if (lock.status === 'paused') { this.cancelRocket(); return false; }
    if (this.rocketPending > 0) return false;
    if (lock.status === 'ready') return this.fireRocket();
    if (lock.status === 'aligning' && lock.target) {
      this.rocketPending = ROCKET_RULES.intentWindow; this.pendingRocketTarget = lock.target.id;
      this.rocketFeedback('SHOT QUEUED · hold the same hostile while the ship turns.', 'success'); this.publish(); return true;
    }
    this.rocketFeedback(`${LAUNCHER_COPY[lock.status].title} · ${LAUNCHER_COPY[lock.status].hint}`); this.publish(); return false;
  }
  fireRocket() {
    const lock = this.launcherLock();
    if (lock.status !== 'ready' || !lock.target || !lock.start) return false;
    const { target, angle, start } = lock;
    this.cancelRocket(); this.rocketAmmo--; this.rocketCooldown = ROCKET_RULES.cooldown; this.targetId = target.id;
    this.rockets.push({ ...start, vx: Math.sin(angle) * 14, vz: Math.cos(angle) * 14, age: 0, target: target.id, traveled: 0, trail: 0, aimX: target.x, aimZ: target.z });
    this.burst(start.x, start.z, '#ffc17a', 6); this.wave(start.x, start.z, 1.5, '#ffbb73', 0.25);
    this.rocketFeedback(`ROCKET AWAY · ${this.rocketAmmo}/${ROCKET_CAPACITY} rounds remaining.`, 'success');
    audio.rocket(); this.publish(); return true;
  }
  explodeRocket(rocket: Rocket, directHit = 0) {
    if (rocket.age >= 10) return; rocket.age = 10;
    this.blast(rocket.x, rocket.z, 2.1);
    this.wave(rocket.x, rocket.z, ROCKET_RULES.blastRadius, '#ffb876', 0.85); this.wave(rocket.x, rocket.z, 1.7, '#fff1c4', 0.4); this.burst(rocket.x, rocket.z, '#ff9b57', 48);
    this.trauma = Math.min(1, this.trauma + 0.55); this.hitStop = 0.05; audio.explosion();
    for (const enemy of [...this.enemies]) {
      const d = distance(enemy, rocket);
      if (enemy.hp > 0 && d < ROCKET_RULES.blastRadius && (enemy.id === directHit || !terrainImpact(rocket, enemy, -0.15))) this.hitEnemy(enemy, ROCKET_RULES.damage * this.damage * (enemy.id === directHit ? 1 : 1 - d / ROCKET_RULES.blastRadius * 0.7));
      if (useGame.getState().phase !== 'playing') break;
    }
  }
  collectSupply(supply: Supply) {
    if (useGame.getState().phase !== 'playing' || supply.age >= supplyLifetime(supply)) return;
    if (supply.type === 'ammo') {
      const rounds = Math.min(3, ROCKET_CAPACITY - this.rocketAmmo), charge = Math.min(20, 100 - this.surge);
      if (!rounds && !charge) return;
      this.rocketAmmo += rounds; this.surge += charge; this.announce('ORDNANCE RECHARGED', `+${rounds} rockets · +${Math.round(charge)} EMP charge.`);
      this.rocketFeedback(rounds ? `AMMO RELOADED · +${rounds} rocket${rounds === 1 ? '' : 's'} · rack ${this.rocketAmmo}/${ROCKET_CAPACITY} · +${Math.round(charge)} EMP.` : `EMP RECHARGED · +${Math.round(charge)} charge · rack ${this.rocketAmmo}/${ROCKET_CAPACITY}.`, 'success'); this.publish();
    }
    if (supply.type === 'repair') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 28); this.shield = Math.min(this.maxShield, this.shield + 15); this.repairTime = 8;
      this.announce('FIELD REPAIR ACTIVE', '+28 integrity · +15 shield · 4 integrity/sec for 8 seconds.');
      this.burst(supply.x, supply.z, '#ff5768', 20);
    }
    if (supply.type === 'magnet') { for (const gem of this.gems) { this.xp += gem.value; gem.value = 0; } }
    if (supply.type === 'overdrive') this.overdriveTime = 9;
    this.wave(supply.x, supply.z, 3, supply.type === 'repair' ? '#ff5768' : supply.type === 'ammo' ? '#83c6ff' : supply.type === 'magnet' ? '#68eee4' : '#ffbf68');
    supply.age = 100; audio.salvage();
  }
  collectCache(cache: Cache) {
    if (useGame.getState().phase !== 'playing' || cache.age >= 90) return;
    cache.age = 100; this.salvage += 20; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 10);
    this.player.invulnerable = Math.max(this.player.invulnerable, 1);
    this.wave(cache.x, cache.z, 4, '#ffd073'); audio.salvage();
    this.rewards.enqueue('salvage', this.level); this.publishRewards(); this.publish();
  }
  burst(x: number, z: number, color: string, count = 14) {
    for (let i = 0; i < count && this.particles.length < LIMITS.particles; i++) {
      const a = this.random() * Math.PI * 2, v = 2 + this.random() * 6, life = 0.3 + this.random() * 0.6;
      this.particles.push({ x, z, y: 0.7, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 2 + this.random() * 4, life, maxLife: life, color, size: 0.06 + this.random() * 0.13 });
    }
  }
  hitEnemy(enemy: Entity, damage: number, critical = false) {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage; this.comboTimer = 4; this.streak++; this.combo = 1 + Math.min(9, Math.floor(this.streak / 12));
    this.peakCombo = Math.max(this.peakCombo, this.combo);
    if (damage >= 3 && this.damageTexts.length < LIMITS.damageTexts) this.damageTexts.push({ x: enemy.x, z: enemy.z, value: Math.round(damage), critical, life: 0.75 });
    if (enemy.hp > 0) { this.burst(enemy.x, enemy.z, '#e8ffc6', 3); return; }
    this.kills++; this.score += Math.round([100, 200, 500, 10000][enemy.kind] * this.combo);
    this.surge = Math.min(100, this.surge + (enemy.elite ? 12 : 3));
    if (enemy.elite) { this.eliteKills++; if (this.caches.length < LIMITS.caches) this.caches.push({ x: enemy.x, z: enemy.z, age: 0 }); this.wave(enemy.x, enemy.z, 5, '#ffcf6c'); }
    else if (this.kills % 45 === 0 && this.time - this.lastCombatSupply >= 25 && this.dropSupply(this.kills % 90 ? 'magnet' : 'overdrive', enemy.x, enemy.z)) this.lastCombatSupply = this.time;
    this.burst(enemy.x, enemy.z, colors[enemy.kind], enemy.kind >= 2 ? 40 : 13);
    this.blast(enemy.x, enemy.z, [0.7, 1.05, 1.8, 3.5][enemy.kind], enemy.kind === 1 ? '#ca95ff' : '#ffab65', enemy.kind === 1);
    if (this.gems.length < LIMITS.gems) this.gems.push({ x: enemy.x, z: enemy.z, value: [3, 7, 18, 100][enemy.kind], age: 0 });
    this.pulse = { x: enemy.x, z: enemy.z, time: this.time };
    this.wave(enemy.x, enemy.z, enemy.kind >= 2 ? 4 : 1.8, colors[enemy.kind], enemy.kind >= 2 ? 0.8 : 0.4);
    this.trauma = Math.min(1, this.trauma + (enemy.kind >= 2 ? 0.35 : 0.025));
    if (enemy.kind >= 2) {
      this.hitStop = 0.05; audio.explosion();
      // Splash iterates a snapshot: chained goliath deaths must never mutate this traversal.
      for (const other of [...this.enemies]) if (other.id !== enemy.id && other.hp > 0 && distance(other, enemy) < 4) this.hitEnemy(other, 35 * this.damage);
    }
    if (enemy.kind === 3) { this.publish(); useGame.getState().saveRun(this.score, this.kills, true, this.salvage); }
  }
  hurt(amount: number, source?: HitSource) {
    if (this.player.invulnerable > 0 || useGame.getState().phase !== 'playing') return;
    const absorbed = Math.min(this.shield, amount); this.shield -= absorbed; this.shieldDelay = 4;
    const impact = absorbed > 0 ? shieldImpact(this.player, source, absorbed, this.shield === 0) : null;
    if (impact) { if (this.shieldHits.length >= SHIELD_IMPACT.capacity) this.shieldHits.shift(); this.shieldHits.push(impact); }
    const hullLoss = amount - absorbed;
    this.player.hp = Math.max(0, this.player.hp - hullLoss); this.player.invulnerable = 0.85;
    if (hullLoss > 0) this.player.hullHit = 0.65;
    this.streak = 0; this.combo = 1; this.hitFlash = 0.6; this.trauma = 0.7; this.hitStop = 0.05;
    const point = hullLoss > 0 || !impact ? this.player : shieldContact(this.player, impact);
    this.burst(point.x, point.z, hullLoss > 0 ? '#ffb16b' : '#72dfff', 20); hullLoss > 0 ? audio.hit() : audio.shield();
    if (hullLoss > 0) this.wave(this.player.x, this.player.z, 2, '#ff7150', 0.35);
    if (this.player.hp === 0) { this.publish(); useGame.getState().saveRun(this.score, this.kills, false, this.salvage); }
  }
  createChoices(salvage = false): Upgrade[] {
    const pool = (Object.keys(defs) as UpgradeId[]).filter(id => (!(id in this.weapons) || this.weapons[id as WeaponId] < 6) && (id !== 'critical' || this.criticalChance < 0.75) && (id !== 'pierce' || this.piercing < 6));
    const picks: Upgrade[] = [];
    while (picks.length < 3 && pool.length) {
      const id = pool.splice(Math.floor(this.random() * pool.length), 1)[0];
      const r = this.random(); const rarity = r > 0.91 ? 'OVERCLOCKED' : salvage || r > 0.62 ? 'RARE' : 'COMMON';
      picks.push({ id, title: defs[id][0], description: defs[id][1], rarity, power: rarity === 'OVERCLOCKED' ? 3 : rarity === 'RARE' ? 2 : 1 });
    }
    return picks;
  }
  private installUpgrade(choice: Upgrade) {
    const changes = previewUpgrade({ ...this, hp: this.player.hp, maxHp: this.player.maxHp }, choice);
    const { id, power } = choice;
    if (id in this.weapons) this.weapons[id as WeaponId] = Math.min(6, this.weapons[id as WeaponId] + power);
    else if (id === 'damage') this.damage += 0.2 * power;
    else if (id === 'speed') this.speed += 0.12 * power;
    else if (id === 'magnet') this.magnet += 0.3 * power;
    else if (id === 'haste') this.haste *= Math.pow(0.9, power);
    else if (id === 'shield') { this.maxShield += 15 * power; this.shield = this.maxShield; }
    else if (id === 'critical') this.criticalChance = Math.min(0.75, this.criticalChance + 0.07 * power);
    else if (id === 'pierce') this.piercing = Math.min(6, this.piercing + power);
    else if (id === 'repair') { this.player.maxHp += 10 * power; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35 * power); }
    audio.level(); return changes;
  }
  checkLevel() {
    if (this.xp < this.nextXp || useGame.getState().phase !== 'playing') return;
    while (this.xp >= this.nextXp) {
      this.xp -= this.nextXp; this.level++; this.nextXp = Math.round(12 + Math.pow(this.level, 1.45) * 6);
      this.rewards.enqueue('level', this.level);
    }
    this.player.invulnerable = Math.max(this.player.invulnerable, 1);
    this.publishRewards(); this.publish();
  }
  private publishRewards() { useGame.setState({ reward: this.rewards.snapshot(), rewardQueued: this.rewards.queued }); }
  publish() {
    const target = this.enemies.find(e => e.id === this.targetId && e.hp > 0);
    const lock = this.launcherLock();
    useGame.setState({
      launcherStatus: lock.status, rocketPending: this.rocketPending, rocketLock: lock.target ? { kind: lock.target.kind, distance: distance(lock.target, this.player), alignment: lock.alignment } : null,
      rocketNotice: this.rocketNotice, rocketNoticeKind: this.rocketNoticeKind, rocketNoticeTime: this.rocketNoticeTime,
      encounter: this.director.phase, encounterRemaining: this.director.remaining, encounterRound: this.director.round, combatPressure: this.director.stress,
      rocketAmmo: this.rocketAmmo, rocketCapacity: ROCKET_CAPACITY, rocketCooldown: this.rocketCooldown, rocketReady: lock.status === 'ready',
      targeting: this.input.aiming ? 'aim' : 'auto', target: target ? { id: target.id, kind: target.kind, distance: distance(target, this.player), hp: target.hp, maxHp: target.maxHp } : null,
      time: this.time, hp: this.player.hp, maxHp: this.player.maxHp, xp: this.xp, nextXp: this.nextXp, level: this.level, score: this.score, kills: this.kills, combo: this.combo, dash: this.player.dashCooldown, enemies: this.enemies.length, weapons: { ...this.weapons },
      shield: this.shield, maxShield: this.maxShield, surge: this.surge, sector: this.sector, bossPhase: this.bossPhase, peakCombo: this.peakCombo, elites: this.eliteKills, caches: this.caches.length, salvage: this.salvage, overdrive: this.overdriveTime, repair: this.repairTime, announcement: this.announcement, announcementDetail: this.announcementDetail, announcementTime: this.announcementTime,
      mission: this.missions.snapshot(), missionsCompleted: this.missions.completed, rescued: this.missions.rescued,
    });
  }
  tick(dt: number) {
    if (useGame.getState().phase !== 'playing') { this.cancelRocket('SHOT CANCELLED · gameplay suspended. No ammunition spent.'); return; }
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.time += dt; const p = this.player;
    const nearby = this.enemies.reduce((count, e) => count + (e.hp > 0 && distance(e, p) < 7 ? e.kind >= 2 ? 3 : 1 : 0), 0);
    const pressure = Math.min(1, nearby / 18 * 0.6 + (1 - p.hp / p.maxHp) * 0.4 + (1 - this.shield / this.maxShield) * 0.2);
    this.director.tick(dt, pressure, this.time >= RUN_DURATION);
    this.rocketCooldown = Math.max(0, this.rocketCooldown - dt);
    this.rocketNoticeTime = Math.max(0, this.rocketNoticeTime - dt);
    p.hp = Math.min(p.maxHp, p.hp + Math.min(dt, this.repairTime) * 4); this.repairTime = Math.max(0, this.repairTime - dt);
    this.announcementTime = Math.max(0, this.announcementTime - dt); this.overdriveTime = Math.max(0, this.overdriveTime - dt);
    this.shieldDelay -= dt; if (this.shieldDelay <= 0) this.shield = Math.min(this.maxShield, this.shield + dt * 7);
    this.surge = Math.min(100, this.surge + dt * 0.8);
    const nextSector = sectorAt(this.time);
    if (nextSector !== this.sector) { this.sector = nextSector; const zone = SECTORS[this.sector]; this.announce(zone.event, zone.description); audio.tone(240, 0.4, 'triangle', 0.2, 480); }
    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0 && this.director.phase !== 'recovery') { this.hazardTimer = this.sector >= 3 ? 6 : 11; this.addHazard(p.x + p.vx * 0.55, p.z + p.vz * 0.55); }
    this.supplyTimer -= dt;
    this.repairTimer -= dt;
    if (this.repairTimer <= 0) {
      this.repairTimer = SUPPLY_RULES.repair.interval + this.random() * SUPPLY_RULES.repair.variance; const a = this.random() * Math.PI * 2;
      this.dropSupply('repair', p.x + Math.sin(a) * 6, p.z + Math.cos(a) * 6);
    }
    this.ammoTimer -= dt;
    if (this.ammoTimer <= 0) { this.ammoTimer = SUPPLY_RULES.ammo.interval + this.random() * SUPPLY_RULES.ammo.variance; const a = this.random() * Math.PI * 2; this.dropSupply('ammo', p.x + Math.sin(a) * 8, p.z + Math.cos(a) * 8); }
    if (this.supplyTimer <= 0 && this.supplies.length < LIMITS.supplies) {
      this.supplyTimer = 40; const a = this.random() * Math.PI * 2;
      this.dropSupply(this.sector % 2 ? 'overdrive' : 'magnet', p.x + Math.sin(a) * 8, p.z + Math.cos(a) * 8);
    }
    if (this.input.surge) this.activateSurge(); this.input.surge = false;
    if (useGame.getState().phase !== 'playing') return;
    p.invulnerable = Math.max(0, p.invulnerable - dt); p.dashTime = Math.max(0, p.dashTime - dt); p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.hullHit = Math.max(0, p.hullHit - dt * 2);
    this.trauma = Math.max(0, this.trauma - dt * 1.8); this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    this.comboTimer -= dt; if (this.comboTimer <= 0) { this.combo = Math.max(1, this.combo - dt * 2); this.streak = 0; }
    const k = this.input.keys;
    let mx = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft')) + this.input.moveX;
    let mz = Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp')) + this.input.moveZ;
    const length = Math.hypot(mx, mz); if (length > 1) { mx /= length; mz /= length; }
    if (this.input.aiming) p.angle = turnTowards(p.angle, Math.atan2(this.input.aimX - p.x, this.input.aimZ - p.z), dt * 10);
    else if (length > 0 && !this.targetId) p.angle = Math.atan2(mx, mz);
    if (this.input.dash && p.dashCooldown <= 0) {
      p.dashTime = 0.2; p.invulnerable = 0.38; p.dashCooldown = 3 * this.haste;
      const dx = this.input.aiming ? this.input.aimX - p.x : length > 0 ? mx : Math.sin(p.angle);
      const dz = this.input.aiming ? this.input.aimZ - p.z : length > 0 ? mz : Math.cos(p.angle);
      const d = Math.hypot(dx, dz) || 1; p.vx = dx / d * 32; p.vz = dz / d * 32;
      this.burst(p.x, p.z, '#baff58', 24); this.trauma = 0.2; audio.dash();
      this.wave(p.x, p.z, 2.7, '#bdff76', 0.4);
    }
    this.input.dash = false;
    if (p.dashTime <= 0) { const lerp = 1 - Math.exp(-11 * dt); p.vx += (mx * 7.5 * this.speed - p.vx) * lerp; p.vz += (mz * 7.5 * this.speed - p.vz) * lerp; }
    else this.burst(p.x, p.z, '#9effcf', 2);
    p.x += p.vx * dt; p.z += p.vz * dt;
    clearTerrainPosition(p, 0.7);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.director.spawnRate > 0) {
      const pressure = 1 + this.time / 45;
      this.spawnTimer = Math.max(0.09, 0.75 / pressure) / (this.overdrive ? 1.4 : 1) / this.director.spawnRate;
      const r = this.random(); this.spawn(this.time > 35 && r > 0.91 ? 2 : this.time > 14 && r > 0.72 ? 1 : 0, undefined, undefined, this.time > 25 && this.uid % (this.sector >= 2 ? 8 : 12) === 0);
    }
    if (this.time >= RUN_DURATION && !this.bossSpawned) { this.bossSpawned = true; this.spawn(3, p.x, p.z - 18); audio.explosion(); }
    // Spatial bins keep flocking local; avoid a quadratic whole-horde comparison.
    const bins = new Map<string, Entity[]>();
    for (const e of this.enemies) {
      const key = `${Math.floor(e.x / 2)},${Math.floor(e.z / 2)}`; const bin = bins.get(key);
      if (bin) bin.push(e); else bins.set(key, [e]);
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.age += dt; e.timer -= dt;
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 0.01;
      const speed = [2.8, 2.1, 1.4, 1.15][e.kind] * (1 + this.time / 360) * (this.overdrive ? 1.2 : 1) * (e.elite ? 1.14 : 1);
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
      clearTerrainPosition(e, e.radius);
      if (d < e.radius + 0.6) this.hurt([10, 14, 24, 35][e.kind], e);
      if (e.kind === 3) {
        const stage = e.hp / e.maxHp > 0.66 ? 1 : e.hp / e.maxHp > 0.33 ? 2 : 3;
        if (stage !== this.bossPhase) {
          this.bossPhase = stage; this.announce(stage === 1 ? 'SENTINEL // PHASE I' : stage === 2 ? 'SENTINEL // PHASE II' : 'SENTINEL // ENRAGED', stage === 1 ? 'Destroy the guardian to extract.' : stage === 2 ? 'Spiral barrage. Keep circling.' : 'Targeted volleys. Save a phase shift.');
          e.timer = Math.min(e.timer, 0.6); this.wave(e.x, e.z, 7, '#ff5478', 1);
          if (stage > 1) { this.addHazard(p.x, p.z, 4, 2); for (let i = 0; i < 4; i++) this.spawn(0); }
        }
      }
      if ((e.kind === 1 || e.kind === 3) && e.timer <= 0 && d < 26) {
        e.timer = e.kind === 3 ? this.bossPhase === 3 ? 0.65 : this.bossPhase === 2 ? 0.5 : 1.5 : e.elite ? 2.2 : 3.5;
        const count = e.kind === 3 ? this.bossPhase === 2 ? 7 : this.bossPhase === 3 ? 11 : 18 : 8;
        for (let j = 0; j < count && this.bolts.length < LIMITS.bolts; j++) {
          const a = e.kind === 3 && this.bossPhase === 3 ? Math.atan2(dx, dz) + (j - 5) * 0.105 : j / count * Math.PI * 2 + e.age * (this.bossPhase === 2 ? 1.8 : 0.4);
          const velocity = e.kind === 3 && this.bossPhase > 1 ? 6 : 4.5;
          this.bolts.push({ x: e.x, z: e.z, vx: Math.sin(a) * velocity, vz: Math.cos(a) * velocity, enemy: true, age: 0, target: 0, damage: e.elite ? 14 : 10 });
        }
      }
      if (this.weapons.glaive) {
        for (let j = 0; j < this.weapons.glaive + 1; j++) {
          const a = this.time * 2.3 + j / (this.weapons.glaive + 1) * Math.PI * 2;
          if (Math.hypot(e.x - p.x - Math.cos(a) * 3, e.z - p.z - Math.sin(a) * 3) < e.radius + 0.7) this.hitEnemy(e, dt * 65 * this.damage);
        }
      }
    }
    if (useGame.getState().phase !== 'playing') return;
    const friendlies = this.missions.mission?.kind === 'rescue' && this.missions.mission.status === 'active' ? this.missions.mission.targets.filter(t => !t.done) : [];
    const primary = selectTarget(this.enemies, p, this.input, this.targetId, friendlies, PULSE_RANGE, useGame.getState().aimMode); this.targetId = primary?.id ?? 0;
    if (primary && !this.input.aiming) p.angle = turnTowards(p.angle, Math.atan2(primary.x - p.x, primary.z - p.z), dt * 6);
    const facingTarget = primary && Math.abs(angleDifference(Math.atan2(primary.x - p.x, primary.z - p.z), p.angle)) < (this.input.aiming ? 0.5 : 0.25);
    if (this.input.rocket) this.requestRocket(); this.input.rocket = false;
    if (this.rocketPending > 0) {
      const lock = this.launcherLock(); this.rocketPending = Math.max(0, this.rocketPending - dt);
      if (!lock.target || lock.target.id !== this.pendingRocketTarget || !['ready', 'aligning'].includes(lock.status)) {
        this.cancelRocket(); this.rocketFeedback('SHOT CANCELLED · lock lost. No ammunition spent.'); this.publish();
      } else if (lock.status === 'ready') this.fireRocket();
      else if (this.rocketPending <= 0) { this.cancelRocket(); this.rocketFeedback('ALIGNMENT TIMED OUT · aim steadily and press E again.'); this.publish(); }
    }
    this.shotTimer -= dt;
    if (primary && facingTarget && this.shotTimer <= 0) {
      this.shotTimer = Math.max(0.1, 0.46 - this.weapons.pulse * 0.045) * this.haste * (this.overdriveTime > 0 ? 0.55 : 1); audio.shot();
      const count = Math.ceil(this.weapons.pulse / 2), muzzleLead = Math.min(0.8, Math.max(0.1, distance(primary, p) - primary.radius - 0.15));
      for (let i = 0; i < count && this.bolts.length < LIMITS.bolts; i++) {
        const side = (i - (count - 1) / 2) * 0.18, x = p.x + Math.sin(p.angle) * muzzleLead + Math.cos(p.angle) * side, z = p.z + Math.cos(p.angle) * muzzleLead - Math.sin(p.angle) * side;
        if (terrainImpact(p, { x, z })) continue;
        const d = Math.hypot(primary.x - x, primary.z - z) || 1;
        this.bolts.push({ x, z, vx: (primary.x - x) / d * 22, vz: (primary.z - z) / d * 22, enemy: false, age: 0, target: primary.id, damage: (15 + this.weapons.pulse * 4) * this.damage * (this.overdriveTime > 0 ? 1.35 : 1), pierce: this.piercing, hits: [], traveled: 0, range: PULSE_RANGE });
      }
    }
    this.cryoTimer -= dt;
    if (this.weapons.cryo && primary && distance(primary, p) < 16 && this.cryoTimer <= 0) {
      this.cryoTimer = 6 * this.haste; this.vortices.push({ x: primary.x, z: primary.z, radius: 3.5 + this.weapons.cryo * 0.3, life: 3.5 }); audio.tone(100, 0.5, 'sine', 0.35, 400);
    }
    this.teslaTimer -= dt;
    if (this.weapons.tesla && primary && distance(primary, p) < 15 && this.teslaTimer <= 0) {
      this.teslaTimer = 2 * this.haste; const points: [number, number][] = [[p.x, p.z]]; const hit = new Set<number>(); let origin: { x: number; z: number } = p;
      for (let i = 0; i < Math.min(5, 2 + this.weapons.tesla); i++) {
        let target: Entity | undefined = i === 0 ? primary : undefined, best = 7;
        if (i > 0) for (const e of this.enemies) { const d = distance(e, origin); if (e.hp > 0 && !hit.has(e.id) && d < best && !terrainImpact(origin, e) && !friendlyInLine(origin, e, friendlies)) { best = d; target = e; } }
        if (!target) break; hit.add(target.id); points.push([target.x, target.z]); this.hitEnemy(target, (22 + this.weapons.tesla * 12) * this.damage); origin = target;
      }
      this.arcs.push({ points, life: 0.24 }); audio.tone(1600, 0.14, 'sawtooth', 0.18, 100);
    }
    const byId = new Map(this.enemies.map(e => [e.id, e]));
    for (const rocket of this.rockets) {
      if (rocket.age >= 10) continue; rocket.age += dt;
      const target = byId.get(rocket.target), speed = Math.min(26, Math.hypot(rocket.vx, rocket.vz) + dt * 18); let angle = Math.atan2(rocket.vx, rocket.vz);
      if (target && target.hp > 0) { rocket.aimX = target.x; rocket.aimZ = target.z; }
      if (rocket.target && rocket.aimX !== undefined && rocket.aimZ !== undefined) { const desired = Math.atan2(rocket.aimX - rocket.x, rocket.aimZ - rocket.z); if (Math.abs(angleDifference(desired, angle)) < Math.PI * 0.6) angle = turnTowards(angle, desired, dt * 3); else rocket.target = 0; }
      rocket.vx = Math.sin(angle) * speed; rocket.vz = Math.cos(angle) * speed;
      const previous = { x: rocket.x, z: rocket.z }; rocket.x += rocket.vx * dt; rocket.z += rocket.vz * dt; rocket.traveled += speed * dt;
      const wall = terrainImpact(previous, rocket);
      let contact = Infinity, directHit = 0; const dx = rocket.x - previous.x, dz = rocket.z - previous.z, segmentLength2 = dx * dx + dz * dz;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        const ox = previous.x - enemy.x, oz = previous.z - enemy.z, c = ox * ox + oz * oz - (enemy.radius + 0.22) ** 2, dot = ox * dx + oz * dz, discriminant = dot * dot - segmentLength2 * c;
        if (discriminant < 0) continue;
        const t = c <= 0 ? 0 : (-dot - Math.sqrt(discriminant)) / (segmentLength2 || 1);
        if (t >= 0 && t <= 1 && t < contact) { contact = t; directHit = enemy.id; }
      }
      let airburst = false;
      if (rocket.target && (!target || target.hp <= 0) && rocket.aimX !== undefined && rocket.aimZ !== undefined) {
        const ox = previous.x - rocket.aimX, oz = previous.z - rocket.aimZ, c = ox * ox + oz * oz - 0.7 ** 2, dot = ox * dx + oz * dz, discriminant = dot * dot - segmentLength2 * c;
        if (discriminant >= 0) { const t = c <= 0 ? 0 : (-dot - Math.sqrt(discriminant)) / (segmentLength2 || 1); if (t >= 0 && t <= 1 && t < contact) { contact = t; directHit = 0; airburst = true; } }
      }
      const wallT = wall ? Math.hypot(wall.x - previous.x, wall.z - previous.z) / (Math.sqrt(segmentLength2) || 1) : Infinity;
      if (wall && wallT <= contact) { rocket.x = wall.x; rocket.z = wall.z; this.explodeRocket(rocket); continue; }
      if (friendlyInLine(previous, rocket, friendlies)) { rocket.age = 10; this.burst(rocket.x, rocket.z, '#8cdfff', 6); continue; }
      if (directHit || airburst) { rocket.x = previous.x + dx * contact; rocket.z = previous.z + dz * contact; this.explodeRocket(rocket, directHit); continue; }
      if (rocket.age >= 4 || rocket.traveled >= 32) { this.explodeRocket(rocket); continue; }
      rocket.trail += dt; if (rocket.trail > 0.04) { rocket.trail = 0; this.burst(rocket.x, rocket.z, '#8e9492', 1); }
    }
    this.rockets = this.rockets.filter(r => r.age < 4);
    if (useGame.getState().phase !== 'playing') return;
    for (const b of this.bolts) {
      b.age += dt;
      if (!b.enemy) {
        const target = byId.get(b.target);
        if (target && target.hp > 0) {
          const dx = target.x - b.x, dz = target.z - b.z, d = Math.hypot(dx, dz) || 1;
          const desired = Math.atan2(dx / d, dz / d), heading = Math.atan2(b.vx, b.vz), speed = Math.hypot(b.vx, b.vz);
          if (Math.abs(angleDifference(desired, heading)) < Math.PI * 0.55) { const angle = turnTowards(heading, desired, dt * 2.2); b.vx = Math.sin(angle) * speed; b.vz = Math.cos(angle) * speed; } else b.target = 0;
        }
      }
      const oldX = b.x, oldZ = b.z; b.x += b.vx * dt; b.z += b.vz * dt;
      b.traveled = (b.traveled ?? 0) + Math.hypot(b.x - oldX, b.z - oldZ);
      const impact = terrainImpact({ x: oldX, z: oldZ }, b);
      if (impact) { b.x = impact.x; b.z = impact.z; b.age = 10; this.burst(b.x, b.z, '#e0d2ad', 3); continue; }
      if (!b.enemy && friendlyInLine({ x: oldX, z: oldZ }, b, friendlies)) { b.age = 10; this.burst(b.x, b.z, '#89eadd', 3); continue; }
      if (b.traveled > (b.range ?? Infinity)) { b.age = 10; continue; }
      if (b.enemy) { if (distance(b, p) < 0.7) { this.hurt(b.damage, b); b.age = 10; } }
      else for (const e of this.enemies) if (e.hp > 0 && !b.hits?.includes(e.id) && distance(b, e) < e.radius + 0.25) {
        const critical = this.random() < this.criticalChance; this.hitEnemy(e, b.damage * (critical ? 2 : 1), critical); (b.hits ??= []).push(e.id);
        if ((b.pierce ?? 0) <= 0) b.age = 10; else { b.pierce!--; b.target = 0; }
        break;
      }
    }
    this.bolts = this.bolts.filter(b => b.age < 4);
    this.enemies = this.enemies.filter(e => e.hp > 0 && (e.kind === 3 || distance(e, p) < 45));
    for (const g of this.gems) {
      g.age += dt; const d = distance(g, p);
      if (d < 4.5 * this.magnet) { const v = Math.min(d, (12 + g.age * 0.2) * dt); g.x += (p.x - g.x) / (d || 1) * v; g.z += (p.z - g.z) / (d || 1) * v; }
      if (d < 0.8) { this.xp += g.value; g.value = 0; audio.pickup(); }
    }
    this.gems = this.gems.filter(g => g.value > 0 && g.age < 60);
    for (const h of this.hazards) {
      h.age += dt;
      if (!h.detonated && h.age >= h.delay) { h.detonated = true; this.blast(h.x, h.z, h.radius * 0.7, '#ff6b9c', true); this.wave(h.x, h.z, h.radius * 1.5, '#ff658d'); this.burst(h.x, h.z, '#ff6488', 35); if (distance(h, p) < h.radius) this.hurt(24, h); }
    }
    this.hazards = this.hazards.filter(h => h.age < h.delay + h.duration);
    for (const s of this.supplies) { s.age += dt; if (distance(s, p) < 1.1) this.collectSupply(s); }
    this.supplies = this.supplies.filter(s => s.age < supplyLifetime(s));
    for (const c of this.caches) { c.age += dt; if (distance(c, p) < 1.2) this.collectCache(c); }
    this.caches = this.caches.filter(c => c.age < 90);
    this.checkLevel();
    if (useGame.getState().phase === 'playing' && this.rewards.tick(dt)) { this.publishRewards(); this.publish(); }
    if (useGame.getState().phase === 'playing') for (const event of this.missions.tick(dt, p, this.kills, () => this.random())) {
      const mission = this.missions.mission!;
      if (event === 'started') this.announce(mission.title, mission.description);
      if (event === 'rescued') { this.wave(p.x, p.z, 4, '#ffd797'); this.burst(p.x, p.z, '#ffe4a6', 18); audio.salvage(); }
      if (event === 'complete') {
        this.director.recover();
        this.salvage += mission.reward; this.score += 1500; this.surge = Math.min(100, this.surge + 25); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
        this.announce('MISSION COMPLETE', `+${mission.reward} credits · +15 integrity · +25 EMP charge.`); this.wave(p.x, p.z, 6, '#82ffc5'); audio.salvage(); this.publish();
      }
      if (event === 'failed') this.announce('SIGNAL LOST', 'The window closed. A new operation will follow.');
    }
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= dt * 8; }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const a of this.arcs) a.life -= dt; this.arcs = this.arcs.filter(a => a.life > 0);
    for (const v of this.vortices) v.life -= dt; this.vortices = this.vortices.filter(v => v.life > 0);
    for (const w of this.shockwaves) w.life -= dt; this.shockwaves = this.shockwaves.filter(w => w.life > 0);
    for (const d of this.damageTexts) d.life -= dt; this.damageTexts = this.damageTexts.filter(d => d.life > 0);
    for (const hit of this.shieldHits) hit.age += dt; this.shieldHits = this.shieldHits.filter(hit => hit.age < SHIELD_IMPACT.life);
    for (const b of this.blasts) b.age += dt; this.blasts = this.blasts.filter(b => b.age < 2.4);
    for (const s of this.scorches) s.age += dt; this.scorches = this.scorches.filter(s => s.age < 22);
    audio.combo = this.combo;
    this.hudTimer += dt; if (this.hudTimer > 0.1) { this.hudTimer = 0; this.publish(); }
  }
}
export const engine = new GameEngine();
