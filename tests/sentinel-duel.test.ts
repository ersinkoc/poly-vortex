import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine, LIMITS, RUN_DURATION } from '../src/game/engine';
import { EncounterDirector } from '../src/game/director';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';

const previous = useGame.getState(), previousAudio = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', runMode: 'expedition', difficulty: 'standard', loadout: 'pulse', maxHp: 100, aimMode: 'precision', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(91); game.reset(); game.weapons.pulse = 0; game.player.invulnerable = 1000; game.roverBay.nextWave = 1000;
});
afterEach(() => { useGame.setState(previous); audio.enabled = previousAudio; });
function enter() { game.time = game.chapterStarted + RUN_DURATION - 1 / 120; game.tick(1 / 60); }
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }

test('Sentinel arrival replaces a full horde with exactly one boss without death rewards', () => {
  for (let i = 0; i < LIMITS.enemies; i++) game.spawn((i % 3) as 0 | 1 | 2, 12 + i % 6, 12 + i % 5, i % 2 === 0);
  game.score = 500; game.kills = 7; game.xp = 3; game.gems = [{ x: 6, z: 0, value: 7, age: 0 }];
  game.supplies = [{ x: 7, z: 0, type: 'repair', age: 0 }]; game.caches = [{ x: 8, z: 0, age: 0 }];
  enter(); expect(game.enemies).toHaveLength(1); expect(game.enemies[0].kind).toBe(3); expect(game.bossSpawned).toBe(true);
  expect(game.kills).toBe(7); expect(game.score).toBe(500); expect(game.xp).toBe(3); expect(game.gems).toHaveLength(1); expect(game.caches).toHaveLength(1); expect(game.supplies.some(s => s.type === 'repair' && s.x === 7)).toBe(true);
  expect(useGame.getState().enemies).toBe(1); expect(game.director.spawnRate).toBe(0);
});

test('arrival clears incoming horde bullets and old strikes before they can damage the core', () => {
  game.player.hp = 1; game.player.invulnerable = 0; game.shield = 0; game.shieldDelay = 10; game.spawn(0, 0, 0);
  game.bolts.push({ x: 0, z: 0, vx: 0, vz: 0, age: 0, damage: 10, enemy: true, target: 0 }); game.addHazard(0, 0, 4, 0.001);
  enter(); expect(useGame.getState().phase).toBe('playing'); expect(game.player.hp).toBe(1); expect(game.shield).toBe(0); expect(game.bolts.some(b => b.enemy)).toBe(false); expect(game.hazards).toHaveLength(0);
});

test('all three boss phases remain a duel while Sentinel barrages and its own strikes still work', () => {
  enter(); const boss = game.enemies[0];
  for (const health of [1, 0.6, 0.3]) {
    boss.hp = boss.maxHp * health; boss.timer = 0; boss.x = 0; boss.z = 15; game.tick(1 / 60);
    expect(game.enemies).toHaveLength(1); expect(game.enemies[0]).toBe(boss); expect(game.bolts.some(b => b.enemy)).toBe(true); expect(game.director.spawnRate).toBe(0);
  }
  expect(game.bossPhase).toBe(3); expect(game.hazards.length).toBeGreaterThan(0);
  advance(8); expect(game.enemies).toHaveLength(1); expect(game.enemies[0]).toBe(boss);
});

test('stale rocket requests are cancelled on arrival without spending ammunition', () => {
  game.spawn(0, 12, 0); game.targetId = game.enemies[0].id; game.player.angle = Math.PI;
  useGame.setState({ aimMode: 'assisted' }); expect(game.requestRocket()).toBe(true); expect(game.rocketPending).toBeGreaterThan(0);
  game.input.rocket = true; enter(); expect(game.rocketPending).toBe(0); expect(game.rocketAmmo).toBe(6); expect(game.rockets).toHaveLength(0); expect(game.targetId).not.toBe(1);
});

test('normal waves resume after expedition service and the next front receives another isolated Sentinel', () => {
  enter(); const boss = game.enemies[0]; game.hitEnemy(boss, 1e9); game.hitStop = 0;
  game.service!.remaining = 0.001; game.tick(1 / 60); expect(game.chapter).toBe(2); expect(game.bossSpawned).toBe(false);
  advance(2); expect(game.enemies.some(e => e.kind !== 3 && e.hp > 0)).toBe(true);
  enter(); expect(game.enemies).toHaveLength(1); expect(game.enemies[0].kind).toBe(3); expect(game.sentinels).toBe(1);
});

test('Sentinel pacing freezes on pause and redeployment restores normal combat', () => {
  const director = new EncounterDirector(); director.tick(1, 1, true); expect(director.spawnRate).toBe(0);
  game.time = RUN_DURATION - 1 / 120; game.spawn(0, 8, 0); useGame.getState().setPhase('paused'); game.tick(1); expect(game.enemies[0].kind).toBe(0); expect(game.bossSpawned).toBe(false);
  useGame.getState().setPhase('playing'); game.tick(1 / 60); expect(game.enemies).toHaveLength(1); expect(game.enemies[0].kind).toBe(3);
  game.reset(); expect(game.bossSpawned).toBe(false); expect(game.director.spawnRate).toBeGreaterThan(0); expect(game.enemies).toHaveLength(0);
});
