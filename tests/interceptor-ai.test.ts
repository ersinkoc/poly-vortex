import { afterEach, beforeEach, expect, test } from 'bun:test';
import * as THREE from 'three';
import { GameEngine } from '../src/game/engine';
import { rangedMuzzle, rangedPose } from '../src/game/enemy-weapons';
import { audio } from '../src/game/audio';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { terrainHeight, terrainProp, terrainImpact } from '../src/game/terrain';

const previous = useGame.getState(), sound = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', loadout: 'pulse', runMode: 'expedition', difficulty: 'standard', aimMode: 'precision', ship: 'vector', activeShip: 'vector', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(91); game.reset(); game.weapons.pulse = 0; game.player.invulnerable = 1000;
  game.roverBay.nextWave = 1000;
  game.service = { x: 1000, z: 1000, progress: 0, remaining: 1000, serviced: true };
});
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }
function interceptor(x: number, z: number) {
  game.spawn(0, x, z); const e = game.enemies.at(-1)!; e.hp = e.maxHp = 10000; e.timer = 0; return e;
}

test('small gunships withdraw from the core, flank at range and never settle beneath it', () => {
  for (const origin of [[0, 0], [0, 0.4], [0, 3], [0, 12]]) {
    game.reset(); game.weapons.pulse = 0; game.player.invulnerable = 1000;
    game.service = { x: 1000, z: 1000, progress: 0, remaining: 1000, serviced: true };
    const e = interceptor(origin[0], origin[1]); e.timer = 100;
    advance(8);
    expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(5.5);
    expect(Math.hypot(e.x, e.z)).toBeLessThan(8.5);
    expect(Math.abs(e.vx ?? 0) + Math.abs(e.vz ?? 0)).toBeGreaterThan(0.2);
    expect(game.player.hp).toBe(100);
  }
});

test('an interceptor warns, fires from its twin guns at a fixed aim point, then reloads', () => {
  const e = interceptor(0, 7); game.tick(1 / 60);
  expect(e.ranged).toBeDefined(); expect(game.bolts).toHaveLength(0);
  game.player.x = 2;
  advance(0.8);
  expect(e.weaponShots).toBe(2); expect(e.weaponFlash?.aimX).toBe(0);
  expect(game.bolts.filter(b => b.enemy)).toHaveLength(2);
  expect(game.bolts.every(b => b.damage === 4 && b.hostileWeapon === 'autocannon')).toBe(true);
  expect(e.ranged).toBeUndefined(); advance(3); expect(e.weaponShots).toBe(2);
});

test('crowded gunships retreat despite neighbors pushing them towards the core', () => {
  const e = interceptor(0, 3); e.timer = 100;
  for (let i = 0; i < 8; i++) interceptor((i % 3 - 1) * 0.15, 3.3 + i * 0.03).timer = 100;
  game.tick(1 / 60); expect(e.vz).toBeGreaterThan(0);
  advance(8); expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(5.5);
});

test('a large wave staggers gun salvos instead of opening a synchronized bullet wall', () => {
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; interceptor(Math.sin(a) * 7, Math.cos(a) * 7); }
  let pending = 0, shots = 0;
  for (let i = 0; i < 120; i++) {
    game.tick(1 / 60);
    pending = Math.max(pending, game.enemies.filter(e => e.kind === 0 && e.ranged).length);
    shots = game.enemies.reduce((n, e) => n + (e.weaponShots ?? 0), 0);
  }
  expect(pending).toBeGreaterThan(0); expect(pending).toBeLessThanOrEqual(4);
  expect(shots).toBeGreaterThan(2); expect(shots).toBeLessThanOrEqual(12);
});

test('interceptor windups freeze on pause and discard the shot when the core escapes', () => {
  const e = interceptor(0, 7); game.tick(1 / 60); expect(e.ranged).toBeDefined();
  const before = structuredClone(e);
  useGame.setState({ phase: 'paused' }); game.tick(1); expect(e).toEqual(before);
  useGame.setState({ phase: 'playing' }); game.player.z = -30; game.tick(1 / 60);
  expect(e.ranged).toBeUndefined(); expect(game.bolts).toHaveLength(0);
  game.reset(); expect(game.enemies).toHaveLength(0); expect(game.bolts).toHaveLength(0);
});

test('stone cover prevents interceptor salvos', () => {
  let rock = null;
  for (let x = 1; x < 10 && !rock; x++) for (let z = 1; z < 10; z++) {
    const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; }
  }
  expect(rock).not.toBeNull(); const r = rock!;
  game.player.x = r.x - r.radius - 1; game.player.z = r.z;
  const e = interceptor(r.x + r.radius + 1, r.z);
  expect(terrainImpact(e, game.player)).not.toBeNull(); advance(0.5);
  expect(e.weaponShots ?? 0).toBe(0); expect(game.bolts).toHaveLength(0);
});

test('gun salvos actually damage a stationary core while a sideways dodge escapes the locked shot', () => {
  for (const dodge of [false, true]) {
    game.reset(); game.weapons.pulse = 0; game.player.invulnerable = 0; game.shield = 0; game.shieldDelay = 100;
    game.service = { x: 1000, z: 1000, progress: 0, remaining: 1000, serviced: true };
    const e = interceptor(0, 7); game.tick(1 / 60); expect(e.ranged).toBeDefined();
    if (dodge) game.player.x = 3;
    advance(2);
    expect(e.weaponShots).toBe(2);
    if (dodge) expect(game.player.hp).toBe(100); else expect(game.player.hp).toBeLessThan(100);
  }
});

test('interceptors briefly lead moving cores but do not track them after the warning starts', () => {
  game.player.vx = 5;
  const e = interceptor(0, 7); game.tick(1 / 60); expect(e.ranged?.aimX).toBeGreaterThan(game.player.x);
  const locked = e.ranged!.aimX;
  game.player.x = -3; game.tick(1 / 60); expect(e.ranged?.aimX).toBe(locked);
});

test('small gunship muzzle and locked orientation match its rendered barrel geometry', () => {
  const e = interceptor(0, 7); e.age = 2; e.ranged = { remaining: 0.5, aimX: 3, aimY: 0.95, aimZ: -4, rounds: 2 };
  const pose = rangedPose(e, game.player);
  for (const side of [-1, 1] as const) {
    const expected = new THREE.Vector3(side * 0.51, -0.05, 0.358).multiplyScalar(e.radius).applyEuler(new THREE.Euler(pose.pitch, pose.yaw, pose.bank, 'XYZ')).add(new THREE.Vector3(pose.x, pose.y, pose.z));
    const actual = rangedMuzzle(e, game.player, side);
    expect(actual.x).toBeCloseTo(expected.x, 10); expect(actual.y).toBeCloseTo(expected.y, 10); expect(actual.z).toBeCloseTo(expected.z, 10);
  }
});
