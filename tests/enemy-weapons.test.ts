import { afterEach, beforeEach, expect, test } from 'bun:test';
import * as THREE from 'three';
import { GameEngine, LIMITS, RUN_DURATION } from '../src/game/engine';
import { HOSTILE_WEAPONS, rangedMuzzle, rangedPose, type EnemyWeapon } from '../src/game/enemy-weapons';
import { terrainHeight, terrainProp } from '../src/game/terrain';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';

const previous = useGame.getState(), sound = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', loadout: 'pulse', runMode: 'expedition', difficulty: 'standard', aimMode: 'precision', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(53); game.reset(); game.weapons.pulse = 0; game.player.invulnerable = 1000; game.roverBay.nextWave = 1000;
  game.service = { x: 1000, z: 1000, progress: 0, remaining: 1000, serviced: true };
});
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }
function hostile(weapon: EnemyWeapon, z = HOSTILE_WEAPONS[weapon].min + 1) {
  game.spawn(1, 0, z); const e = game.enemies.at(-1)!; e.weapon = weapon; e.hp = e.maxHp = 10000; e.timer = 0; return e;
}

test('ranged enemies and Sentinel reverse before crowd pressure can drive them into the core', () => {
  for (const kind of [1, 3] as const) {
    game.enemies = []; game.spawn(kind, 0, 3); const e = game.enemies[0]; e.hp = e.maxHp = 10000; e.timer = 100;
    game.spawn(0, 0, 4); game.enemies[1].hp = 10000; game.tick(1 / 60);
    expect(e.vz).toBeGreaterThan(0);
    game.enemies = [e]; advance(12); expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(kind === 3 ? 12 : 7);
    expect(game.player.hp).toBe(100);
  }
});

test('the opening wave contains ranged threats before fourteen seconds', () => {
  game.service = null; advance(12); expect(game.enemies.some(e => e.kind === 1)).toBe(true);
});

for (const weapon of ['plasma', 'laser', 'missile', 'flak', 'ion'] as const) {
  test(`${weapon} warns, locks a dodgeable aim point and emits its own salvo and reload`, () => {
    const e = hostile(weapon), rule = HOSTILE_WEAPONS[weapon]; game.tick(1 / 60);
    expect(e.ranged?.remaining).toBe(rule.windup); expect(game.bolts).toHaveLength(0);
    game.player.x = 2; advance(rule.windup - 0.05); expect(game.bolts).toHaveLength(0);
    advance(0.05); const b = game.bolts.find(b => b.enemy)!; expect(b.hostileWeapon).toBe(weapon);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(rule.speed, 8); expect(b.damage).toBe(rule.damage); expect(b.range).toBe(rule.range);
    expect(e.weaponFlash?.aimX).toBe(0);
    const muzzle = rangedMuzzle(e, game.player, e.weaponFlash!.side);
    expect(b.x - b.vx / 60).toBeCloseTo(muzzle.x, 8); expect(b.z - b.vz / 60).toBeCloseTo(muzzle.z, 8);
    advance(0.4); expect(e.weaponShots).toBe(rule.rounds); expect(e.ranged).toBeUndefined();
    const shots = e.weaponShots; advance(rule.reload - 0.5); expect(e.weaponShots).toBe(shots);
  });
  test(`${weapon} retreats from nearby core and holds its own firing distance`, () => {
    const e = hostile(weapon, 3); e.timer = 100; advance(12); const d = Math.hypot(e.x, e.z);
    expect(d).toBeGreaterThanOrEqual(HOSTILE_WEAPONS[weapon].min); expect(d).toBeLessThan(HOSTILE_WEAPONS[weapon].max + 0.1);
    expect(e.weaponShots ?? 0).toBe(0);
  });
}

test('blocked cover and escaping firing range cancel a prepared shot', () => {
  const e = hostile('laser'); game.tick(1 / 60); expect(e.ranged).toBeDefined(); game.player.z = -30;
  game.tick(1 / 60); expect(e.ranged).toBeUndefined(); expect(e.weaponShots ?? 0).toBe(0);
  let rock = null;
  for (let x = 1; x < 8 && !rock; x++) for (let z = 1; z < 8; z++) { const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; } }
  const r = rock!; expect(r).not.toBeNull(); game.enemies = []; game.player.x = r.x - 6; game.player.z = r.z;
  game.spawn(1, r.x + 6, r.z); const blocked = game.enemies[0]; blocked.weapon = 'laser'; blocked.timer = 0; advance(0.5);
  expect(blocked.ranged).toBeUndefined(); expect(blocked.weaponShots ?? 0).toBe(0);
});

test('a full projectile pool cannot produce false muzzle flashes or catch-up salvos', () => {
  const e = hostile('plasma'); game.bolts = Array.from({ length: LIMITS.bolts }, () => ({ x: 30, z: 30, vx: 0, vz: 0, enemy: false, target: 0, age: 0, damage: 0 }));
  game.tick(1 / 60); advance(0.55); expect(e.weaponShots ?? 0).toBe(0); expect(e.weaponFlash).toBeUndefined(); expect(e.ranged).toBeUndefined();
  game.bolts = []; advance(1); expect(e.weaponShots ?? 0).toBe(0);
});

test('fast hostile lasers hit the swept hull and elevated rounds pass above it', () => {
  game.player.invulnerable = 0; game.shield = 0; game.shieldDelay = 100;
  game.bolts.push({ x: 0, y: 0.95, z: -2, vx: 0, vz: 240, enemy: true, target: 0, age: 0, damage: 12, hostileWeapon: 'laser' });
  game.tick(1 / 60); expect(game.player.hp).toBe(88); expect(game.bolts).toHaveLength(0);
  game.player.invulnerable = 0; game.bolts.push({ x: 0, y: 3, z: -2, vx: 0, vz: 240, enemy: true, target: 0, age: 0, damage: 12, hostileWeapon: 'laser' });
  game.tick(1 / 60); expect(game.player.hp).toBe(88);
});

test('windups freeze during pause and hit-stop; reset and Sentinel arrival discard prepared salvos', () => {
  const e = hostile('missile'); game.tick(1 / 60); const before = structuredClone(e);
  useGame.setState({ phase: 'paused' }); game.tick(1); expect(e).toEqual(before);
  useGame.setState({ phase: 'playing' }); game.hitStop = 0.05; game.tick(1 / 60); expect(e).toEqual(before); game.hitStop = 0;
  game.service = null; game.time = RUN_DURATION; game.tick(1 / 60); expect(game.enemies).toHaveLength(1); expect(game.enemies[0].kind).toBe(3); expect(game.bolts.some(b => b.hostileWeapon)).toBe(false);
  game.reset(); expect(game.enemies).toHaveLength(0); expect(game.bolts).toHaveLength(0);
});

test('both hostile muzzles match the banked rendered barrel geometry', () => {
  const e = hostile('laser'); e.age = 2; e.ranged = { remaining: 0.5, aimX: 3, aimY: 0.95, aimZ: -4, rounds: 1 }; const pose = rangedPose(e, game.player);
  for (const side of [-1, 1] as const) {
    const expected = new THREE.Vector3(side * 0.88, 0.05, 0.608).multiplyScalar(e.radius).applyEuler(new THREE.Euler(pose.pitch, pose.yaw, pose.bank, 'XYZ')).add(new THREE.Vector3(pose.x, pose.y, pose.z)), actual = rangedMuzzle(e, game.player, side);
    expect(actual.x).toBeCloseTo(expected.x, 10); expect(actual.y).toBeCloseTo(expected.y, 10); expect(actual.z).toBeCloseTo(expected.z, 10);
  }
});
