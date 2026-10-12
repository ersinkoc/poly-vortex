import { beforeEach, expect, test } from 'bun:test';
import { GameEngine, LIMITS } from '../src/game/engine';
import { audio } from '../src/game/audio';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE, type Rocket } from '../src/game/types';
import { ROCKET_CAPACITY, supplyLifetime } from '../src/game/supplies';
import { terrainHeight, terrainProp } from '../src/game/terrain';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE), choices: [] });
  game = new GameEngine(88); game.reset(); game.player.invulnerable = 100;
});
const target = () => { game.spawn(2, 0, 8); const enemy = game.enemies.at(-1)!; enemy.hp = enemy.maxHp = 10000; return enemy; };
const shell = (x = 0, z = 5): Rocket => ({ x, z, vx: 0, vz: 14, target: 0, age: 0, traveled: 0, trail: 0 });
test('six finite rockets launch manually, cooldown prevents spam, and empty racks hold fire', () => {
  target(); expect(game.rocketAmmo).toBe(6); expect(game.fireRocket()).toBe(true); expect(game.rocketAmmo).toBe(5); expect(game.fireRocket()).toBe(false); expect(game.rocketAmmo).toBe(5);
  for (let i = 0; i < 5; i++) { game.rocketCooldown = 0; expect(game.fireRocket()).toBe(true); }
  game.rocketCooldown = 0; expect(game.fireRocket()).toBe(false); expect(game.rocketAmmo).toBe(0); expect(game.rockets).toHaveLength(6);
});
test('rocket launch rejects empty aim, unaligned targets, pause, and full render pools without spending ammo', () => {
  target(); game.input.aiming = true; game.input.aimZ = -10; expect(game.fireRocket()).toBe(false);
  game.input.aimZ = 10; game.player.angle = Math.PI; expect(game.fireRocket()).toBe(false); game.player.angle = 0;
  useGame.setState({ phase: 'paused' }); expect(game.fireRocket()).toBe(false); useGame.setState({ phase: 'playing' });
  game.rockets = Array.from({ length: LIMITS.rockets }, () => shell()); expect(game.fireRocket()).toBe(false); expect(game.rocketAmmo).toBe(ROCKET_CAPACITY);
});
test('ammo crates refill three rockets, add EMP charge, respect capacity, and consume only once', () => {
  game.rocketAmmo = 0; game.surge = 50; const crate = { x: 0, z: 0, type: 'ammo' as const, age: 0 };
  game.collectSupply(crate); expect(game.rocketAmmo).toBe(3); expect(game.surge).toBe(70); game.collectSupply(crate); expect(game.rocketAmmo).toBe(3);
  game.rocketAmmo = 5; game.collectSupply({ x: 0, z: 0, type: 'ammo', age: 50 }); expect(game.rocketAmmo).toBe(6); expect(game.surge).toBe(90);
  game.collectSupply({ x: 0, z: 0, type: 'ammo', age: 70 }); expect(game.surge).toBe(90);
});
test('a recharge crate stays available when both resources are already full', () => {
  const crate = { x: 0, z: 0, type: 'ammo' as const, age: 0 }; game.collectSupply(crate); expect(crate.age).toBe(0);
  target(); game.fireRocket(); game.collectSupply(crate); expect(game.rocketAmmo).toBe(6); expect(crate.age).toBe(100);
});
test('rockets do not recharge over time; crate and medical caps are independent', () => {
  game.rocketAmmo = 0;
  for (let i = 0; i < 1300; i++) { game.enemies = []; game.gems = []; game.bolts = []; game.hazards = []; game.tick(1 / 60); }
  expect(game.rocketAmmo).toBe(0); expect(game.supplies.filter(s => s.type === 'ammo')).toHaveLength(1); expect(game.supplies.filter(s => s.type === 'repair')).toHaveLength(0);
  expect(game.dropSupply('repair', 6, 0)).toBe(true); expect(game.dropSupply('repair', 8, 0)).toBe(false);
  expect(game.dropSupply('ammo', 0, 8)).toBe(true); expect(game.dropSupply('ammo', 0, 10)).toBe(false);
});
test('protected pilots block rocket launch and remain unaffected by nearby blasts', () => {
  target(); game.missions.tick(8, game.player, 0, () => 0.5);
  game.missions.mission!.targets.forEach((t, i) => { t.x = i === 0 ? 0 : 100; t.z = i === 0 ? 4 : 100; });
  expect(game.fireRocket()).toBe(false); expect(game.rocketAmmo).toBe(6);
  const before = game.missions.snapshot(); game.explodeRocket(shell(0, 4)); expect(game.missions.snapshot()).toEqual(before); expect(game.missions.rescued).toBe(0);
});
test('rocket explosions deal direct and nearby damage, spare distant hostiles, and cannot detonate twice', () => {
  const direct = target(); game.spawn(2, 2, 8); game.spawn(2, 10, 8); const nearby = game.enemies[1], far = game.enemies[2]; nearby.hp = far.hp = 10000;
  const rocket = shell(0, 8); game.explodeRocket(rocket, direct.id); expect(direct.hp).toBe(9870); expect(nearby.hp).toBeLessThan(10000); expect(far.hp).toBe(10000); const hp = direct.hp;
  game.explodeRocket(rocket, direct.id); expect(direct.hp).toBe(hp); expect(game.shockwaves.length).toBeGreaterThan(0);
});
test('a launched rocket travels into a hostile and explodes with bounded particle effects', () => {
  const enemy = target(); game.fireRocket();
  for (let i = 0; i < 90; i++) { game.hitStop = 0; game.tick(1 / 60); }
  expect(game.rockets).toHaveLength(0); expect(enemy.hp).toBeLessThan(9871); expect(game.rocketAmmo).toBe(5); expect(game.particles.length).toBeLessThanOrEqual(LIMITS.particles);
});
test('cover blocks launching and a rocket in flight hits the wall before a hostile behind it', () => {
  let obstacle: ReturnType<typeof terrainProp> = null;
  for (let x = 1; x < 6; x++) for (let z = 1; z < 6; z++) { const p = terrainProp(x, z); if (p && p.radius < 1.5 && terrainHeight(p.x, p.z) + p.height > 1) obstacle = p; }
  if (!obstacle) throw new Error('Missing deterministic tall obstacle.'); const p = obstacle;
  game.player.x = p.x - p.radius - 4; game.player.z = p.z; game.player.angle = Math.PI / 2; game.spawn(2, p.x + p.radius + 1, p.z); const enemy = game.enemies.at(-1)!; enemy.hp = 10000;
  expect(game.fireRocket()).toBe(false); expect(game.rocketAmmo).toBe(6);
  const rocket = shell(p.x - p.radius - 0.15, p.z); rocket.vx = 26; rocket.vz = 0; game.rockets.push(rocket); game.tick(1 / 60);
  expect(rocket.age).toBe(10); expect(Math.hypot(rocket.x - enemy.x, rocket.z - enemy.z)).toBeLessThan(4.5); expect(enemy.hp).toBe(10000);
});

test('launcher readiness releases a previously locked hostile when cover blocks the firing lane', () => {
  let obstacle: ReturnType<typeof terrainProp> = null;
  for (let x = 1; x < 6; x++) for (let z = 1; z < 6; z++) { const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 1) obstacle = p; }
  if (!obstacle) throw new Error('Missing tall obstacle.'); const p = obstacle;
  game.player.x = p.x - p.radius - 4; game.player.z = p.z; game.player.angle = Math.PI / 2;
  game.spawn(2, p.x + p.radius + 4, p.z); game.targetId = game.enemies.at(-1)!.id; game.publish();
  expect(game.fireRocket()).toBe(false); expect(useGame.getState().rocketReady).toBe(false); expect(game.rocketAmmo).toBe(6);
});
test('mass kills cannot flood the map with health or repeat combat drops in the same time window', () => {
  for (let i = 0; i < 135; i++) { game.spawn(0, 10, 0); const enemy = game.enemies.at(-1)!; game.hitEnemy(enemy, 1000); }
  expect(game.supplies.filter(s => s.type === 'repair')).toHaveLength(0); expect(game.supplies.length).toBeLessThanOrEqual(1);
});
test('new runs clear in-flight rockets, recharge six rounds, and clear queued launch input', () => {
  target(); game.fireRocket(); game.input.rocket = true; game.reset();
  expect(game.rockets).toHaveLength(0); expect(game.rocketAmmo).toBe(6); expect(game.rocketCooldown).toBe(0); expect(game.input.rocket).toBe(false); expect(useGame.getState().rocketAmmo).toBe(6);
  expect(supplyLifetime({ x: 0, z: 0, type: 'repair', age: 0 })).toBe(35);
});
