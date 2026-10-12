import { beforeEach, expect, test } from 'bun:test';
import { GameEngine, LIMITS } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE, type Entity } from '../src/game/types';
import { audio } from '../src/game/audio';
import { terrainProp, terrainHeight } from '../src/game/terrain';
import { selectTarget } from '../src/game/targeting';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE), choices: [] });
  game = new GameEngine(77); game.reset(); game.player.invulnerable = 100;
});
// Fill the pool with inactive entities so timed spawning cannot affect the fixture.
const isolate = () => { while (game.enemies.length < LIMITS.enemies) game.enemies.push({ id: 1000 + game.enemies.length, x: 100, z: 100, kind: 0, hp: 0, maxHp: 1, radius: 0.5, age: 0, timer: 100, elite: false }); };
const spawn = (x: number, z: number): Entity => { game.spawn(0, x, z); const e = game.enemies.at(-1)!; e.hp = e.maxHp = 10000; return e; };
const blockingProp = () => {
  for (let x = 1; x < 6; x++) for (let z = 1; z < 6; z++) { const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 0.9) return p; }
  throw new Error('No tall obstacle in the deterministic fixture.');
};

test('an unobstructed hostile ahead remains a valid auto-fire target', () => {
  const ahead = spawn(0, 6); isolate(); game.tick(1 / 60); expect(game.bolts.some(b => !b.enemy && b.target === ahead.id)).toBe(true);
});

test('mouse aim selects a hostile ahead instead of the closer hostile behind', () => {
  const ahead = spawn(0, 8), behind = spawn(0, -3); isolate(); game.input.aiming = true; game.input.aimX = 0; game.input.aimZ = 10;
  game.tick(1 / 60); const shots = game.bolts.filter(b => !b.enemy); expect(shots.length).toBeGreaterThan(0); expect(shots.every(b => b.target === ahead.id && b.target !== behind.id)).toBe(true);
});
test('aiming away from all hostiles holds fire', () => {
  spawn(0, -5); isolate(); game.input.aiming = true; game.input.aimX = 0; game.input.aimZ = 10; game.tick(1 / 60);
  expect(game.bolts.filter(b => !b.enemy)).toHaveLength(0);
});
test('upgraded pulse volleys focus one hostile within range', () => {
  const first = spawn(0, 6); spawn(2, 9); spawn(0, 32); isolate(); game.weapons.pulse = 5; game.input.aiming = true; game.input.aimX = 0; game.input.aimZ = 10;
  game.tick(1 / 60); const shots = game.bolts.filter(b => !b.enemy); expect(shots).toHaveLength(3); expect(shots.every(b => b.target === first.id)).toBe(true);
});
test('cryo cannot deploy onto a hostile outside its range', () => {
  spawn(0, 40); isolate(); game.weapons.cryo = 1; for (let i = 0; i < 150; i++) { isolate(); game.tick(1 / 60); }
  expect(game.vortices).toHaveLength(0);
});
test('solid terrain blocks an otherwise valid pulse target', () => {
  const prop = blockingProp();
  game.player.x = prop.x - prop.radius - 4; game.player.z = prop.z; game.player.angle = Math.PI / 2;
  spawn(prop.x + prop.radius + 4, prop.z); isolate(); game.tick(1 / 60); expect(game.bolts.filter(b => !b.enemy)).toHaveLength(0);
});
test('tracking retains a living visible lock despite small distance changes, then releases a dead lock', () => {
  const first = spawn(0, 6), second = spawn(1, 7);
  expect(selectTarget(game.enemies, game.player, game.input, 0)?.id).toBe(first.id);
  second.z = 5.8; expect(selectTarget(game.enemies, game.player, game.input, first.id)?.id).toBe(first.id);
  first.hp = 0; expect(selectTarget(game.enemies, game.player, game.input, first.id)?.id).toBe(second.id);
});
test('automatic tracking can turn and fire while the ship strafes', () => {
  const target = spawn(0, 8); isolate(); game.input.keys.add('KeyA');
  for (let i = 0; i < 35; i++) game.tick(1 / 60);
  expect(game.player.x).toBeLessThan(-1); expect(target.hp).toBeLessThan(10000);
});
test('an unrescued pilot in the firing line holds fire and is never a hostile target', () => {
  spawn(0, 6); isolate(); game.input.aiming = true; game.input.aimZ = 10;
  game.missions.tick(8, game.player, 0, () => 0.5);
  game.missions.mission!.targets.forEach((t, i) => { t.x = i === 0 ? 0 : 100; t.z = i === 0 ? 3 : 100; });
  game.tick(1 / 60); expect(game.targetId).toBe(0); expect(game.bolts.filter(b => !b.enemy)).toHaveLength(0); expect(game.missions.mission!.targets[0].done).toBe(false);
});
test('both friendly and hostile projectiles stop at solid terrain', () => {
  const prop = blockingProp(); game.player.x = prop.x + prop.radius + 4; game.player.z = prop.z; isolate();
  for (const enemy of [false, true]) game.bolts.push({ x: prop.x - prop.radius - 0.2, z: prop.z, vx: 30, vz: 0, enemy, age: 0, target: 0, damage: 10 });
  game.tick(1 / 60); expect(game.bolts).toHaveLength(0); expect(game.shield).toBe(40); expect(game.particles.length).toBeGreaterThanOrEqual(6);
});
test('a passed target cannot make a guided bolt reverse its flight direction', () => {
  const target = spawn(0, -5); isolate();
  const bolt = { x: 0, z: 1, vx: 0, vz: 22, enemy: false, age: 0, target: target.id, damage: 10 }; game.bolts.push(bolt);
  game.tick(1 / 60); expect(bolt.target).toBe(0); expect(bolt.vx).toBe(0); expect(bolt.vz).toBe(22); expect(bolt.z).toBeGreaterThan(1);
});
test('pulse travel range expires a stray bolt before it can hit a distant hostile', () => {
  const target = spawn(0, 8); isolate(); game.input.aiming = true; game.input.aimZ = -10;
  const bolt = { x: 0, z: 7.7, vx: 0, vz: 22, enemy: false, age: 0, target: 0, damage: 10, range: 2, traveled: 1.9 }; game.bolts.push(bolt);
  game.tick(1 / 60); expect(game.bolts.includes(bolt)).toBe(false); expect(target.hp).toBe(10000);
});
