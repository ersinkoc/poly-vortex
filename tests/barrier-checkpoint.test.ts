import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { BARRIER } from '../src/game/barrier';
import { validateCheckpoint, restoreCheckpoint } from '../src/game/checkpoint';
import { claimRun, claimResume, saveCheckpoint, loadSave, saveProfile, readProfile, SAVE_KEY, SAVE_BACKUP_KEY, LOCAL_WRITER_ID, type SavedFlight, type FlightResult } from '../src/game/local-save';

let game: GameEngine;
let beforeState: ReturnType<typeof useGame.getState>, sound: boolean;
let descriptor: PropertyDescriptor | undefined, memory: Map<string, string>;
beforeEach(() => {
  beforeState = useGame.getState(); sound = audio.enabled; audio.enabled = false;
  descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
  useGame.setState({ phase: 'playing', ship: 'vector', activeShip: 'vector', runKey: 'flight-test', runMode: 'expedition', difficulty: 'standard', aimMode: 'precision', loadout: 'glaive', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(191); game.reset(); game.player.invulnerable = 1000;
});
afterEach(() => { useGame.setState(beforeState); audio.enabled = sound; if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
function advance(g: GameEngine, seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) g.tick(1 / 60); }
function flight(): SavedFlight { return { runKey: game.runKey, savedAt: Date.now(), ship: game.ship, time: game.time, level: game.level, chapter: game.chapter, payload: game.checkpoint() }; }
function result(): FlightResult { return { runKey: game.runKey, endedAt: Date.now(), won: true, score: 9000, kills: 90, time: game.time, ship: game.ship, level: game.level, chapter: game.chapter, sentinels: 1, rescued: 3, achievements: ['first-run', 'breaker'] }; }

test('Aegis gives full core protection without consuming shield, hull or resetting the combo', () => {
  game.player.invulnerable = 0; game.shield = 12; game.shieldDelay = 100; game.combo = 4; expect(game.activateBarrier()).toBe(true);
  game.hurt(100000, { x: 3, z: 0 }); expect(game.player.hp).toBe(100); expect(game.shield).toBe(12); expect(game.combo).toBe(4);
  expect(game.shieldHits).toHaveLength(1); expect(game.activateBarrier()).toBe(false);
  game.weapons.pulse = 0; game.roverBay.nextWave = 1000; game.service = { x: 1000, z: 1000, remaining: 1000, serviced: true, progress: 0 };
  game.bolts.push({ x: 0, y: 0.95, z: -1, vx: 0, vz: 60, age: 0, target: 0, enemy: true, damage: 100 });
  game.addHazard(0, 0, 3, 0.01); game.spawn(0, 0.4, 0); game.tick(1 / 60);
  expect(game.player.hp).toBe(100); expect(game.shield).toBe(12); expect(game.bolts.some(b => b.enemy)).toBe(false);
});
test('short protection expires, a long simulation recharge survives pause, and repeated input cannot bypass it', () => {
  game.activateBarrier(); game.weapons.pulse = 0; game.service = { x: 1000, z: 1000, remaining: 1000, serviced: true, progress: 0 }; game.roverBay.nextWave = 1000;
  advance(game, 2); const protectedTime = game.barrier, cooldown = game.barrierCooldown;
  useGame.setState({ phase: 'paused' }); game.tick(10); expect(game.barrier).toBe(protectedTime); expect(game.barrierCooldown).toBe(cooldown);
  useGame.setState({ phase: 'playing' }); advance(game, 2.1); expect(game.barrier).toBe(0); expect(game.activateBarrier()).toBe(false);
  game.player.invulnerable = 0; game.shield = 0; game.hurt(5); expect(game.player.hp).toBe(95); game.hitStop = 0;
  advance(game, BARRIER.cooldown); expect(game.activateBarrier()).toBe(true);
  game.reset(); expect(game.barrier).toBe(0); expect(game.barrierCooldown).toBe(0);
});
test('a JSON round trip restores the whole flight and advances identically, including controllers, queued rewards and RNG', () => {
  advance(game, 18); game.weapons.pulse = 0; game.placeCharge(); game.activateBarrier(); game.collectCache({ x: 0, z: 0, age: 0 });
  game.droneRack.units[0].battery = 23; advance(game, 0.5);
  const saved = JSON.parse(JSON.stringify(game.checkpoint())); const resumed = new GameEngine(999);
  expect(validateCheckpoint(saved, resumed)).toBe(true); expect(restoreCheckpoint(resumed, saved)).toBe(true);
  expect(resumed.checkpoint()).toEqual(game.checkpoint());
  for (let i = 0; i < 120; i++) { game.tick(1 / 60); resumed.tick(1 / 60); }
  expect(resumed.checkpoint()).toEqual(game.checkpoint()); expect(resumed.random()).toBe(game.random());
});
test('resuming retains protection and cooldown, clears held input and refuses malformed state without partial mutation', () => {
  game.activateBarrier(); advance(game, 1); game.input.keys.add('KeyR'); game.input.rocket = true; game.input.moveX = 1;
  const saved = game.checkpoint(), resumed = new GameEngine(0);
  expect(restoreCheckpoint(resumed, saved)).toBe(true); expect(resumed.barrier).toBeCloseTo(3); expect(resumed.barrierCooldown).toBeCloseTo(89);
  expect(resumed.input.keys.size).toBe(0); expect(resumed.input.rocket).toBe(false); expect(resumed.input.moveX).toBe(0);
  const before = resumed.checkpoint();
  for (const mutate of [(x: typeof saved) => { x.schema = 999 as 1; }, (x: typeof saved) => { x.state.player = { hp: -1 }; }, (x: typeof saved) => { x.systems.rewards.active = { choices: [] }; }, (x: typeof saved) => { x.state.evil = 1; }]) {
    const bad = structuredClone(saved); mutate(bad); expect(restoreCheckpoint(resumed, bad)).toBe(false); expect(resumed.checkpoint()).toEqual(before);
  }
});
test('continue-flight initialization restores the deployment into pause instead of resetting its progress', () => {
  game.activateBarrier(); advance(game, 5); const saved = flight(), resumed = new GameEngine(0);
  expect(resumed.queueResume(saved)).toBe(true); useGame.getState().resumeFlight(saved); resumed.initializeRun();
  expect(useGame.getState().phase).toBe('paused'); expect(resumed.time).toBe(game.time); expect(resumed.barrierCooldown).toBe(game.barrierCooldown);
  const before = resumed.checkpoint(); resumed.tick(10); expect(resumed.checkpoint()).toEqual(before);
});
test('legacy progress migrates to a versioned save and a damaged primary recovers from its current backup', () => {
  memory.set('poly-vortex-profile-v1', JSON.stringify({ ...EMPTY_PROFILE, credits: 123, runs: 2, totalKills: 90, upgrades: { armor: 2, reactor: 1, thrusters: 0 } }));
  expect(readProfile().credits).toBe(123); expect(claimRun(game.runKey)).toBe('saved'); expect(loadSave()?.profile.upgrades.armor).toBe(2);
  const save = flight(); expect(saveCheckpoint(save)).toBe('saved'); expect(loadSave()?.checkpoint).toEqual(save);
  memory.set(SAVE_KEY, '{broken'); expect(loadSave()?.checkpoint).toEqual(save); expect(loadSave()?.profile.credits).toBe(123);
});
test('completion clears both checkpoints, retains last achievement and cannot pay the same flight twice', () => {
  claimRun(game.runKey); saveCheckpoint(flight()); const profile = { ...readProfile(), credits: 100, runs: 1, wins: 1, achievements: ['first-run', 'breaker'] };
  expect(saveProfile(profile, result())).toBe('saved'); expect(loadSave()?.checkpoint).toBeNull(); expect(loadSave()?.lastFlight?.achievements).toContain('breaker');
  expect(saveProfile({ ...profile, credits: 200 }, result())).toBe('conflict'); expect(loadSave()?.profile.credits).toBe(100);
  memory.set(SAVE_KEY, 'corrupt'); expect(loadSave()?.checkpoint).toBeNull(); expect(loadSave()?.profile.credits).toBe(100); expect(memory.has(SAVE_BACKUP_KEY)).toBe(true);
});
test('another tab can take over a flight; the old writer cannot replace its checkpoint or finalize rewards', () => {
  claimRun(game.runKey); const saved = flight(); saveCheckpoint(saved);
  expect(claimResume(game.runKey, 'another-tab')).toBe('saved');
  expect(saveCheckpoint(saved, LOCAL_WRITER_ID)).toBe('conflict'); expect(saveProfile(readProfile(), result())).toBe('conflict');
  expect(loadSave()?.ownerId).toBe('another-tab'); expect(loadSave()?.checkpoint).toEqual(saved);
});
test('quota failures preserve the last good flight and report that the new save was not committed', () => {
  claimRun(game.runKey); const saved = flight(); saveCheckpoint(saved); advance(game, 0.1);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: () => { throw new Error('quota'); } } });
  expect(saveCheckpoint(flight())).toBe('unavailable'); expect(loadSave()?.checkpoint).toEqual(saved);
});
test('a later lost flight cannot erase the last extraction or the last unlocked achievement', () => {
  claimRun(game.runKey); saveProfile({ ...readProfile(), wins: 1, runs: 1, credits: 100 }, result());
  const victory = loadSave()?.lastVictory, achievement = loadSave()?.lastAchievement;
  claimRun('second-flight'); saveProfile({ ...readProfile(), runs: 2, credits: 110 }, { ...result(), runKey: 'second-flight', won: false, achievements: [] });
  expect(loadSave()?.lastFlight?.won).toBe(false); expect(loadSave()?.lastVictory).toEqual(victory); expect(loadSave()?.lastAchievement).toEqual(achievement);
});
test('older code cannot overwrite a save from a future schema version', () => {
  const future = JSON.stringify({ schema: 99, data: 'future-save' }); memory.set(SAVE_KEY, future);
  expect(claimRun(game.runKey)).toBe('unavailable'); expect(memory.get(SAVE_KEY)).toBe(future);
});
test('invalid hostile weapon tags are rejected before a resumed renderer can use them', () => {
  game.spawn(1, 0, 8); const saved = game.checkpoint();
  (saved.state.enemies as { weapon?: string }[])[0].weapon = 'unknown-weapon';
  expect(validateCheckpoint(saved, new GameEngine(0))).toBe(false);
});
