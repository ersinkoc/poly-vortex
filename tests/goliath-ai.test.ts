import { afterEach, beforeEach, expect, test } from 'bun:test';
import * as THREE from 'three';
import { GameEngine, LIMITS, RUN_DURATION } from '../src/game/engine';
import { GOLIATH, goliathMuzzle, goliathPose } from '../src/game/goliath-ai';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { terrainHeight, terrainProp } from '../src/game/terrain';

const previous = useGame.getState(), previousAudio = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', runMode: 'expedition', aimMode: 'precision', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(53); game.reset(); game.structures = []; game.weapons.pulse = 0; game.player.invulnerable = 1000; game.roverBay.nextWave = 1000;
  // A service hold isolates the existing hostile from reinforcements and strikes.
  game.service = { x: 1000, z: 1000, progress: 0, remaining: 1000, serviced: true };
});
afterEach(() => { useGame.setState(previous); audio.enabled = previousAudio; });
function tank(x = 0, z = 10, elite = false) { game.spawn(2, x, z, elite); const e = game.enemies.at(-1)!; e.hp = e.maxHp = 10000; return e; }
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }

test('a distant heavy approaches then stays inside a firing band without closing on the core', () => {
  const e = tank(0, 20); advance(8); expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(9); expect(Math.hypot(e.x, e.z)).toBeLessThanOrEqual(12);
  const z = e.z; advance(4); expect(e.z).toBeCloseTo(z, 8); expect(game.player.hp).toBe(100);
});

test('a nearby heavy backs away and crowd avoidance cannot push it into the core', () => {
  const e = tank(0, 3); game.spawn(0, 0, 4); game.enemies[1].hp = 10000;
  game.tick(1 / 60); expect(e.z).toBeGreaterThan(3); expect(e.vz).toBeGreaterThan(0);
  game.enemies = [e]; advance(7); expect(e.z).toBeGreaterThanOrEqual(9); expect(e.z).toBeLessThan(9.1);
});

test('heavy cannons warn for a full second before emitting one slow aimed shell', () => {
  const e = tank(); e.timer = 0; game.tick(1 / 60);
  expect(e.cannon?.remaining).toBe(1); expect(game.bolts).toHaveLength(0); advance(0.9); expect(game.bolts).toHaveLength(0);
  advance(0.1); const b = game.bolts.find(b => b.heavy === e.id)!;
  expect(b).toBeDefined(); expect(game.bolts.filter(b => b.heavy === e.id)).toHaveLength(1); expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(5.5, 9);
  expect(b.damage).toBe(18); expect(b.range).toBe(20); expect(b.enemy).toBe(true); expect(e.cannon).toBeUndefined(); expect(e.cannonShots).toBe(1);
  const muzzle = goliathMuzzle(e, game.player, e.cannonFlash!.side);
  expect(b.x - b.vx / 60).toBeCloseTo(muzzle.x, 9); expect(b.z - b.vz / 60).toBeCloseTo(muzzle.z, 9); expect(b.y! - b.vy! / 60).toBeCloseTo(muzzle.y, 9);
});

test('normal and elite cannons leave at least 7.5 seconds between shots and never release catch-up volleys', () => {
  for (const elite of [false, true]) {
    game.enemies = []; game.bolts = []; const e = tank(0, 10, elite); e.timer = 0; const shots: number[] = [];
    for (let i = 0; i < 60 * 17; i++) { const before = e.cannonShots ?? 0; game.tick(1 / 60); if ((e.cannonShots ?? 0) !== before) shots.push(game.time); }
    expect(shots).toHaveLength(3); expect(shots[1] - shots[0]).toBeGreaterThanOrEqual(7.5 - 1e-8); expect(shots[2] - shots[1]).toBeGreaterThanOrEqual(7.5 - 1e-8);
    e.timer = -100; game.tick(1 / 60); expect(e.cannonShots).toBe(3); expect(e.cannon?.remaining).toBe(1);
  }
});

test('wind-up locks a dodgeable aim point instead of tracking the player until firing', () => {
  const e = tank(); e.timer = 0; game.tick(1 / 60); expect(e.cannon?.aimX).toBe(0);
  game.player.x = 3; advance(1); const b = game.bolts.find(b => b.heavy === e.id)!;
  expect(e.cannonFlash!.aimX).toBe(0); expect(e.cannonFlash!.aimZ).toBe(0);
  const muzzle = goliathMuzzle(e, game.player, e.cannonFlash!.side);
  expect(Math.atan2(b.vx, b.vz)).toBeCloseTo(Math.atan2(-muzzle.x, -muzzle.z), 9);
  expect(Math.abs(Math.atan2(b.vx, b.vz) - Math.atan2(game.player.x - muzzle.x, -muzzle.z))).toBeGreaterThan(0.2);
});

test('cover holds fire and leaving the band during wind-up cancels the shot', () => {
  let rock = null;
  for (let x = 1; x < 8 && !rock; x++) for (let z = 1; z < 8; z++) { const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; } }
  const r = rock!; expect(r).not.toBeNull(); game.player.x = r.x - 5; game.player.z = r.z; const e = tank(r.x + 5, r.z); e.timer = 0;
  advance(3); expect(e.cannonShots ?? 0).toBe(0); expect(e.cannon).toBeUndefined();
  game.enemies = []; game.player.x = 0; game.player.z = 0; const clear = tank(); clear.timer = 0; game.tick(1 / 60); expect(clear.cannon).toBeDefined();
  game.player.z = -10; game.tick(1 / 60); expect(clear.cannon).toBeUndefined(); expect(clear.cannonShots ?? 0).toBe(0); expect(clear.timer).toBe(GOLIATH.retry);
});

test('a full shared projectile pool cannot produce a false cannon flash or delayed burst', () => {
  const e = tank(); e.timer = 0; game.bolts = Array.from({ length: LIMITS.bolts }, () => ({ x: 30, z: 30, vx: 0, vz: 0, enemy: false, target: 0, age: 0, damage: 0 }));
  game.tick(1 / 60); advance(1); expect(e.cannonShots ?? 0).toBe(0); expect(e.cannonFlash).toBeUndefined(); expect(e.timer).toBe(GOLIATH.reload);
  game.bolts = []; game.tick(1 / 60); expect(e.cannonShots ?? 0).toBe(0); expect(e.cannon).toBeUndefined();
});

test('cannon wind-up and reload freeze on pause, hit-stop and death; restart removes their state', () => {
  const e = tank(); e.timer = 0; game.tick(1 / 60); const before = structuredClone(e);
  useGame.getState().setPhase('paused'); game.tick(20); expect(e).toEqual(before);
  useGame.getState().setPhase('playing'); game.hitStop = 0.05; game.tick(1 / 60); expect(e).toEqual(before);
  useGame.setState({ phase: 'dead' }); game.tick(20); expect(e).toEqual(before); game.reset(); expect(game.enemies).toHaveLength(0); expect(game.bolts).toHaveLength(0);
});

test('heavy muzzle positions match the rendered banked body transform and both barrels', () => {
  const e = tank(); e.age = 2; e.cannon = { remaining: 0.5, aimX: 3, aimZ: -4 }; const pose = goliathPose(e, game.player);
  for (const side of [-1, 1] as const) {
    const expected = new THREE.Vector3(side * 0.14, 0.65, 0.858).multiplyScalar(e.radius).applyEuler(new THREE.Euler(pose.pitch, pose.yaw, pose.bank, 'XYZ')).add(new THREE.Vector3(pose.x, pose.y, pose.z)), actual = goliathMuzzle(e, game.player, side);
    expect(actual.x).toBeCloseTo(expected.x, 10); expect(actual.y).toBeCloseTo(expected.y, 10); expect(actual.z).toBeCloseTo(expected.z, 10);
  }
});

test('Sentinel arrival recalls charging heavies and their live cannon shells', () => {
  game.service = null; const e = tank(); e.timer = 0; game.tick(1 / 60); advance(1); expect(game.bolts.some(b => b.heavy === e.id)).toBe(true);
  game.time = RUN_DURATION; game.tick(1 / 60); expect(game.enemies).toHaveLength(1); expect(game.enemies[0].kind).toBe(3); expect(game.bolts.some(b => b.heavy !== undefined)).toBe(false);
});
