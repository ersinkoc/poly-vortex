import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine, LIMITS, RUN_DURATION } from '../src/game/engine';
import { DOCTRINES, EXPEDITION, dockStatus, doctrineAt, fleetScale } from '../src/game/expedition';
import { EncounterDirector } from '../src/game/director';
import { navigationSignals } from '../src/game/navigation';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';
import { previewUpgrade } from '../src/game/upgrade-preview';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', aimMode: 'assisted', runMode: 'expedition', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(127); game.reset(); game.player.invulnerable = 10000;
});
afterEach(() => useGame.setState({ runMode: 'expedition', phase: 'menu', profile: structuredClone(EMPTY_PROFILE), sentinels: 0, time: 0 }));
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }
function defeat() {
  game.time = game.chapterStarted + RUN_DURATION; game.spawn(3, 0, 10); const boss = game.enemies.find(e => e.kind === 3 && e.hp > 0)!;
  game.hitEnemy(boss, 1e9); game.hitStop = 0; return boss;
}
function park() { game.player.x = game.service!.x; game.player.z = game.service!.z; game.player.vx = 0; game.player.vz = 0; game.gems = []; }

test('a Sentinel opens field service without ending the expedition or erasing its build', () => {
  game.weapons.tesla = 4; game.level = 9; game.xp = 7; game.nextXp = 1000;
  game.spawn(0, 20, 20); const survivor = game.enemies[0]; const boss = defeat();
  expect(useGame.getState().phase).toBe('playing'); expect(useGame.getState().profile.runs).toBe(0);
  expect(game.service?.remaining).toBe(30); expect(game.sentinels).toBe(1); expect(game.salvage).toBe(50);
  expect(game.enemies).toContain(survivor); expect(game.weapons.tesla).toBe(4); expect(game.xp).toBe(7); expect(game.level).toBe(9);
  game.hitEnemy(boss, 1e9); expect(game.sentinels).toBe(1); expect(game.salvage).toBe(50);
});
test('classic still extracts immediately at the first Sentinel', () => {
  useGame.setState({ runMode: 'classic' }); game.reset(); defeat();
  expect(useGame.getState().phase).toBe('won'); expect(game.service).toBeNull(); expect(useGame.getState().profile.wins).toBe(1);
});
test('field service clears lingering strikes but remaining hostiles continue fighting', () => {
  game.addHazard(0, 0, 3, 2);
  game.bolts.push({ x: 0, z: 0, vx: 1, vz: 1, age: 0, damage: 10, target: 0, enemy: true });
  game.spawn(0, 22, 0); const enemy = game.enemies[0]; defeat(); game.input.aiming = true; game.input.aimZ = -10;
  const x = enemy.x; advance(10);
  expect(enemy.x).toBeLessThan(x); expect(game.hazards).toHaveLength(0); expect(game.bolts.some(b => b.enemy)).toBe(false);
  expect(game.enemies.filter(e => e.hp > 0)).toHaveLength(1);
});
test('the exact Sentinel kill tick cannot apply a projectile that the service window cleared', () => {
  game.time = RUN_DURATION; game.bossSpawned = true; game.player.invulnerable = 0; game.spawn(3, 0, 10);
  const boss = game.enemies[0];
  game.bolts.push({ x: 0, z: 10, vx: 0, vz: 0, age: 0, damage: 1e9, target: boss.id, enemy: false }, { x: 0, z: 0, vx: 0, vz: 0, age: 0, damage: 10, target: 0, enemy: true });
  game.tick(1 / 60); expect(game.service).not.toBeNull(); expect(game.shield).toBe(40); expect(game.player.hp).toBe(100);
});
test('three seconds of safe stationary docking repairs and rearms once at resource caps', () => {
  defeat(); park(); game.player.hp = 30; game.shield = 10; game.rocketAmmo = 0; game.surge = 10;
  advance(2.9); expect(game.service?.serviced).toBe(false); expect(game.rocketAmmo).toBe(0);
  advance(0.2); expect(game.service?.serviced).toBe(true); expect(game.player.hp).toBe(65); expect(game.shield).toBe(40); expect(game.rocketAmmo).toBe(3);
  expect(game.surge).toBeGreaterThan(62); expect(game.surge).toBeLessThan(64); expect(game.canExtract).toBe(true);
  game.player.hp = 20; game.rocketAmmo = 0; advance(4); expect(game.player.hp).toBe(20); expect(game.rocketAmmo).toBe(0);
  game.reset(); defeat(); park(); game.player.hp = 95; game.rocketAmmo = 5; game.surge = 98; advance(3.1);
  expect(game.player.hp).toBe(100); expect(game.shield).toBe(game.maxShield); expect(game.rocketAmmo).toBe(6); expect(game.surge).toBe(100);
});
test('moving away, a fresh hit or a nearby hostile interrupts unfinished service', () => {
  defeat(); park(); advance(1); expect(game.service!.progress).toBeGreaterThan(0.9);
  game.player.x += 10; advance(0.1); expect(game.service!.progress).toBe(0); park(); advance(1);
  game.player.invulnerable = 0; game.hurt(5); expect(game.service!.progress).toBe(0); game.hitStop = 0; advance(1); expect(game.service!.progress).toBe(0);
  game.shieldDelay = 0; game.spawn(2, game.service!.x + 4, game.service!.z); advance(0.1); expect(game.service!.progress).toBe(0);
  expect(dockStatus(game.player, game.service, game.enemies, 0)).toBe('threats');
  game.enemies = []; game.player.vx = 8; expect(dockStatus(game.player, game.service, [], 0)).toBe('moving');
});
test('extraction requires serviced safe docking and banks the run exactly once', () => {
  expect(game.extract()).toBe(false); defeat(); park(); expect(game.extract()).toBe(false); advance(3.1);
  game.player.x += 10; expect(game.extract()).toBe(false); park(); game.shieldDelay = 1; expect(game.extract()).toBe(false);
  game.shieldDelay = 0; useGame.getState().setPhase('paused'); expect(game.extract()).toBe(true);
  const s = useGame.getState(); expect(s.phase).toBe('won'); expect(s.profile.runs).toBe(1); expect(s.profile.wins).toBe(1); expect(s.earned).toBe(150);
  expect(game.extract()).toBe(false); expect(useGame.getState().profile.credits).toBe(150);
});
test('pause freezes service, docking, next-front timers and automatic rewards', () => {
  defeat(); park(); advance(1); const dock = { ...game.service! }, clock = game.time;
  useGame.getState().setPhase('paused'); game.tick(60); expect(game.time).toBe(clock); expect(game.service).toEqual(dock);
  useGame.getState().setPhase('playing'); advance(0.2); expect(game.service!.progress).toBeGreaterThan(dock.progress);
});
test('continuation retains XP and queued modules, starts a fresh front and reserves its next boss', () => {
  defeat(); game.player.x = 100; game.gems = []; game.xp = 7; game.level = 9; game.weapons.cryo = 4;
  game.service!.remaining = 0.02; game.rewards.enqueue('salvage', game.level); game.tick(1 / 60); game.tick(1 / 60);
  expect(game.chapter).toBe(2); expect(game.service).toBeNull(); expect(game.sector).toBe(0); expect(game.bossSpawned).toBe(false);
  expect(game.weapons.cryo).toBe(4); expect(game.xp).toBe(7); expect(game.level).toBe(9); expect(game.rewards.active).not.toBeNull();
  expect(useGame.getState().phase).toBe('playing'); expect(game.chapterTime).toBe(0);
  game.time = game.chapterStarted + RUN_DURATION;
  for (let i = 0; i < LIMITS.enemies; i++) game.spawn(0);
  game.tick(1 / 60); expect(game.enemies.filter(e => e.kind === 3 && e.hp > 0)).toHaveLength(1); expect(game.enemies.length).toBeLessThanOrEqual(LIMITS.enemies);
  game.tick(1 / 60); expect(game.enemies.filter(e => e.kind === 3 && e.hp > 0)).toHaveLength(1);
});
test('an unused service window expires without awarding free supplies or automatic extraction', () => {
  defeat(); game.player.x = 100; game.gems = []; game.rocketAmmo = 0; game.player.hp = 40;
  advance(30.2); expect(game.service).toBeNull(); expect(game.chapter).toBe(2); expect(game.player.hp).toBe(40); expect(game.rocketAmmo).toBe(0);
  expect(game.extract()).toBe(false); expect(useGame.getState().profile.runs).toBe(0);
});
test('deep-run salvage, finite escalation and fleet doctrines keep long expeditions varied', () => {
  const names = new Set(Array.from({ length: 4 }, (_, i) => doctrineAt(i + 1).name)); expect(names.size).toBe(4); expect(doctrineAt(5)).toBe(DOCTRINES[0]);
  for (const chapter of [1, 2, 4, 10, 100, 10000]) {
    const scale = fleetScale(chapter, 1e9); expect(scale.speed).toBeLessThanOrEqual(2.2); expect(scale.pressure).toBeLessThanOrEqual(6.5); expect(Number.isFinite(scale.health)).toBe(true);
  }
  game.chapter = 100; defeat(); expect(game.salvage).toBe(200);
  expect(fleetScale(2, 0).health).toBeLessThan(fleetScale(1, 180).health);
});
test('service navigation takes priority but never exceeds three world markers', () => {
  defeat(); game.player.hp = 30; game.rocketAmmo = 0;
  const signals = navigationSignals(game.player, null, [{ x: 1, z: 1, age: 0, type: 'ammo' }, { x: 2, z: 2, age: 0, type: 'repair' }], 0, game.service);
  expect(signals).toHaveLength(3); expect(signals[0].label).toBe('SERVICE BEACON');
  game.service!.serviced = true; expect(navigationSignals(game.player, null, [], 6, game.service)[0].label).toBe('EXTRACTION BEACON');
});
test('director exits its old Sentinel state when the engagement ends', () => {
  const d = new EncounterDirector(); d.tick(1, 1, true); d.tick(1, 0, false); expect(d.phase).toBe('recovery'); expect(d.remaining).toBe(7);
  d.tick(7, 0, false); expect(d.phase).toBe('buildup');
});
test('changing route mid-flight applies next deployment and restarting clears all expedition state', () => {
  defeat(); useGame.setState({ runMode: 'classic' }); expect(game.runMode).toBe('expedition'); expect(game.service).not.toBeNull();
  game.reset(); expect(game.runMode).toBe('classic'); expect(game.chapter).toBe(1); expect(game.sentinels).toBe(0); expect(game.service).toBeNull(); expect(game.chapterStarted).toBe(0);
});
test('long-run upgrades display the actual capped result and exclude exhausted movement modules', () => {
  game.speed = 2.75; game.haste = 0.29;
  const stats = { ...game, hp: 100, maxHp: 100 };
  expect(previewUpgrade(stats, { id: 'speed', power: 3, title: '', description: '', rarity: 'OVERCLOCKED' })[0].after).toBe('21.0m/s');
  expect(previewUpgrade(stats, { id: 'haste', power: 3, title: '', description: '', rarity: 'OVERCLOCKED' })[0].after).toBe('0.8s');
  game.speed = 2.8; game.haste = 0.28;
  for (let i = 0; i < 50; i++) expect(game.createChoices().some(u => u.id === 'speed' || u.id === 'haste')).toBe(false);
});
test('a long deployment unlocks depth and endurance milestones without duplicate profile credits', () => {
  game.sentinels = 3; game.chapter = 4; game.time = 650; game.publish(); useGame.getState().saveRun(1000, 300, false, 150);
  const s = useGame.getState(); expect(s.profile.achievements).toContain('deep-run'); expect(s.profile.achievements).toContain('endurance'); expect(s.earned).toBe(260);
  useGame.getState().saveRun(1000, 300, false, 150); expect(useGame.getState().profile.runs).toBe(1); expect(useGame.getState().profile.credits).toBe(260);
});

test('twelve simulated minutes cross three fronts with finite bounded combat and live missions', () => {
  game.weapons = { pulse: 6, glaive: 6, cryo: 6, tesla: 6, rail: 6, scatter: 6 }; game.damage = 4; game.xp = 100000;
  for (let frame = 0; frame < 12 * 60 * 60; frame++) {
    game.input.keys.clear(); game.input.keys.add(['KeyD', 'KeyS', 'KeyA', 'KeyW'][Math.floor(frame / 180) % 4]);
    game.tick(1 / 60);
    const boss = game.enemies.find(e => e.kind === 3 && e.hp > 0);
    if (boss) game.hitEnemy(boss, 1e9);
    if (frame % 600 === 0) {
      expect(useGame.getState().phase).toBe('playing'); expect(Number.isFinite(game.player.x + game.player.z + game.player.hp + game.time)).toBe(true);
      expect(game.enemies.length).toBeLessThanOrEqual(LIMITS.enemies); expect(game.bolts.length).toBeLessThanOrEqual(LIMITS.bolts);
      expect(game.particles.length).toBeLessThanOrEqual(LIMITS.particles); expect(game.rocketAmmo).toBeLessThanOrEqual(6);
      expect(game.speed).toBeLessThanOrEqual(2.8); expect(game.haste).toBeGreaterThanOrEqual(0.28);
      expect(game.enemies.every(e => Number.isFinite(e.x + e.z + e.hp))).toBe(true);
    }
  }
  expect(game.time).toBeGreaterThan(650); expect(game.sentinels).toBeGreaterThanOrEqual(3); expect(game.chapter).toBeGreaterThanOrEqual(4);
  expect(game.missions.mission).not.toBeNull(); expect(game.level).toBeGreaterThan(10); expect(useGame.getState().profile.runs).toBe(0);
}, 20000);
