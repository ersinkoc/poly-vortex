import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine, RUN_DURATION } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { CHARGE_RULES } from '../src/game/ground-charges';
import { SENTINEL, sentinelDefense } from '../src/game/sentinel';

const previous = useGame.getState(), sound = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', runMode: 'expedition', difficulty: 'standard', loadout: 'pulse', aimMode: 'assisted', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(91); game.reset(); game.player.invulnerable = 10000; game.roverBay.nextWave = 1000;
});
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });
function boss() { game.time = RUN_DURATION; game.bossSpawned = true; game.spawn(3, 0, -14); return game.enemies.at(-1)!; }
function maxBuild() { game.damage = 4; game.haste = 0.28; game.criticalChance = 0.75; game.weapons = { pulse: 6, glaive: 6, cryo: 6, tesla: 6 }; game.droneRack.install(6); }

test('two upgraded ordnance impacts cannot erase a late-run Sentinel', () => {
  game.time = RUN_DURATION; game.damage = 4; game.haste = 0.28; game.criticalChance = 0.75;
  game.weapons = { pulse: 6, glaive: 6, cryo: 6, tesla: 6 }; game.spawn(3, 0, -18); const boss = game.enemies[0];
  game.hitEnemy(boss, CHARGE_RULES.damage * game.damage); game.hitEnemy(boss, CHARGE_RULES.damage * game.damage);
  expect(boss.hp).toBeGreaterThan(0); expect(game.sentinels).toBe(0); expect(game.service).toBeNull();
});

test('arrival snapshots weapon levels, haste, damage and surviving escorts without rescaling mid-fight', () => {
  const weak = boss(); const weakHp = weak.maxHp; game.enemies = []; maxBuild(); const strong = boss();
  expect(strong.maxHp).toBeGreaterThan(weakHp * 3); const hp = strong.maxHp;
  game.damage = 100; game.haste = 0.3; game.tick(1 / 60); expect(strong.maxHp).toBe(hp);
  game.enemies = []; game.damage = 4; game.haste = 0.28; game.chapter = 5; const next = boss(); expect(next.maxHp).toBeGreaterThan(hp);
});

test('sealed armor reduces hits and an exposed reactor rewards burst timing', () => {
  const e = boss(), hp = e.hp; game.hitEnemy(e, 100); expect(e.hp).toBeCloseTo(hp - 60, 8);
  e.age = SENTINEL.armorTime; const before = e.hp; game.hitEnemy(e, 100); expect(e.hp).toBeCloseTo(before - 135, 8);
  expect(e.sentinelHit).toBe(e.age); expect(sentinelDefense(6.5).armored).toBe(true);
  game.enemies = []; game.spawn(0, 10, 0); const chaser = game.enemies[0], chaserHp = chaser.hp; game.hitEnemy(chaser, 10); expect(chaser.hp).toBe(chaserHp - 10);
});

test('mortars warn before impact and progress from single to paired to triple strikes', () => {
  game.weapons.pulse = 0;
  for (const [ratio, count] of [[1, 1], [0.6, 2], [0.3, 3]]) {
    game.enemies = []; game.hazards = []; game.bolts = []; const e = boss(); e.hp = e.maxHp * ratio; e.sentinelStrike = 0;
    game.tick(1 / 60); const strikes = game.hazards.filter(h => h.radius === 2.5);
    expect(strikes).toHaveLength(count); expect(strikes.every(h => h.delay === SENTINEL.strikeDelay && !h.detonated)).toBe(true);
    expect(e.sentinelStrike).toBeGreaterThan(4); expect(game.enemies).toHaveLength(1);
  }
});

test('negative strike timers cannot release a catch-up storm and all boss effects stay bounded', () => {
  game.weapons.pulse = 0; const e = boss(); e.hp = e.maxHp * 0.3; e.sentinelStrike = -100;
  game.tick(1 / 60); expect(game.hazards.filter(h => h.radius === 2.5)).toHaveLength(3);
  for (let i = 0; i < 60 * 20; i++) { game.tick(1 / 60); expect(game.hazards.length).toBeLessThanOrEqual(12); expect(game.bolts.length).toBeLessThanOrEqual(500); }
});

test('pause and hit-stop freeze armor windows, strike windups and health; restart clears the boss', () => {
  game.weapons.pulse = 0; const e = boss(); game.tick(1 / 60); const before = structuredClone(e), window = sentinelDefense(e.age);
  useGame.setState({ phase: 'paused' }); game.tick(20); expect(e).toEqual(before); expect(sentinelDefense(e.age)).toEqual(window);
  useGame.setState({ phase: 'playing' }); game.hitStop = 0.05; game.tick(0.02); expect(e).toEqual(before);
  game.reset(); expect(game.enemies).toHaveLength(0); expect(game.bossSpawned).toBe(false);
});

test('temporary overdrive pickups do not inflate the arrival snapshot, while Overdrive difficulty does', () => {
  const normal = boss().maxHp; game.enemies = []; game.overdriveTime = 15; expect(boss().maxHp).toBe(normal);
  useGame.setState({ difficulty: 'overdrive' }); game.reset(); expect(boss().maxHp).toBeGreaterThan(normal);
});

test('a maximum-module build at fourfold damage must fight through all three phases and still finishes without an artificial damage gate', () => {
  maxBuild(); const e = boss(); game.player.angle = Math.PI;
  game.missions.mission = { id: 1, kind: 'hunt', title: 'TEST', description: '', status: 'active', remaining: 1000, progress: 0, goal: 100000, reward: 0, targets: [], startKills: 0 };
  const phases = new Set<number>(), start = game.time; let ticks = 0;
  while (e.hp > 0 && ticks++ < 60 * 80) { game.tick(1 / 60); phases.add(game.bossPhase); }
  const duration = game.time - start;
  expect(e.hp).toBeLessThanOrEqual(0); expect(duration).toBeGreaterThanOrEqual(10); expect(duration).toBeLessThan(80);
  expect(phases.has(1) && phases.has(2) && phases.has(3)).toBe(true); expect(game.sentinels).toBe(1); expect(game.service).not.toBeNull();
  console.log(`Sentinel max-build duration: ${duration.toFixed(2)}s; hull: ${e.maxHp}`);
});
