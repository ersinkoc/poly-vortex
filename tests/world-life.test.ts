import { afterEach, beforeEach, expect, test } from 'bun:test';
import { WorldLife, LIFE_RULES, lifePose, type LifeActor } from '../src/game/world-life';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { terrainHeight, terrainProp } from '../src/game/terrain';

const previous = useGame.getState(), sound = audio.enabled;
beforeEach(() => { audio.enabled = false; useGame.setState({ phase: 'playing', loadout: 'pulse', runMode: 'expedition', difficulty: 'standard', aimMode: 'assisted', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) }); });
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });
function actor(extra: Partial<LifeActor> = {}): LifeActor { return { id: 1, kind: 'fox', x: 5, z: 0, yaw: Math.PI / 2, age: 0, life: 40, stride: 0, speed: 0, fright: 0, goalX: 8, goalZ: 0, think: 5, recover: 0, launchHeight: 0, ...extra }; }
function advance(life: WorldLife, seconds: number, allow = true) { for (let i = 0; i < Math.round(seconds * 60); i++) life.tick(1 / 60, { x: 0, z: 0 }, [], [], allow); }

test('occasional wildlife visits are seeded, sparse and bounded throughout a long session', () => {
  const a = new WorldLife(), b = new WorldLife(); a.reset(43); b.reset(43);
  advance(a, 6.9); expect(a.actors).toHaveLength(0); advance(a, 0.2); expect(a.actors).toHaveLength(1);
  advance(b, 7.1); expect(a.actors).toEqual(b.actors);
  for (let i = 0; i < 60 * 600; i++) { a.tick(1 / 60, { x: 0, z: 0 }, [], []); expect(a.actors.length).toBeLessThanOrEqual(LIFE_RULES.wildlife); }
});

test('animals flee nearby explosions and hostile bodies instead of charging the core', () => {
  const life = new WorldLife(); life.reset(4); const fox = actor(); life.actors = [fox];
  for (let i = 0; i < 120; i++) life.tick(1 / 60, { x: 0, z: 0 }, [], [{ id: 1, x: 4, z: 0, age: 0.1, size: 2, color: '#fff', energy: false }], false);
  expect(fox.x).toBeGreaterThan(8); expect(fox.fright).toBeGreaterThan(0); expect(fox.speed).toBeGreaterThan(2.5);
  fox.x = 5; fox.z = 0; fox.yaw = Math.PI / 2;
  life.tick(0.1, { x: 0, z: 0 }, [{ id: 1, kind: 0, x: 4, z: 0, hp: 1, maxHp: 1, radius: 0.5, age: 0, timer: 0, elite: false }], [], false);
  expect(fox.goalX).toBeGreaterThan(fox.x);
});

test('Goliath wrecks sometimes produce runners and crawling survivors while unmanned types produce none', () => {
  const life = new WorldLife(); life.reset(53);
  for (const kind of [0, 1, 3] as const) life.escapeCrew({ id: kind + 1, kind, x: 0, z: 8, radius: 1 }, { x: 0, z: 0 });
  expect(life.actors).toHaveLength(0);
  for (let i = 0; i < 20; i++) life.escapeCrew({ id: 100 + i, kind: 2, x: 0, z: 8, radius: 1.1 }, { x: 0, z: 0 });
  expect(life.actors.some(a => a.recover > 0)).toBe(true); expect(life.actors.some(a => a.recover === 0)).toBe(true);
  expect(life.actors.length).toBeLessThanOrEqual(LIFE_RULES.crew);
  const count = life.actors.length, existing = life.actors[0]; life.escapeCrew({ id: existing.source!, kind: 2, x: 0, z: 8, radius: 1.1 }, { x: 0, z: 0 }); expect(life.actors).toHaveLength(count);
});

test('injured crew land, crawl and recover to a running stance on the actual terrain', () => {
  const life = new WorldLife(); life.reset(5); const crew = actor({ kind: 'crew', recover: 6, launchHeight: 0.8 }); life.actors = [crew];
  expect(lifePose(crew).crawl).toBe(1); expect(lifePose(crew).y).toBeGreaterThan(terrainHeight(crew.x, crew.z) + 0.8);
  advance(life, 1, false); expect(crew.speed).toBeLessThan(0.7); expect(lifePose(crew).crawl).toBe(1);
  advance(life, 6, false); expect(lifePose(crew).crawl).toBe(0); expect(crew.speed).toBeGreaterThan(1.5); expect(lifePose(crew).y).toBeGreaterThan(terrainHeight(crew.x, crew.z));
});

test('solid rocks clear actor bodies and far or expired extras leave their bounded pools', () => {
  let rock = null;
  for (let x = 1; x < 8 && !rock; x++) for (let z = 1; z < 8; z++) { rock = terrainProp(x, z); if (rock) break; }
  expect(rock).not.toBeNull(); const p = rock!; const life = new WorldLife(); life.reset(8);
  const a = actor({ x: p.x, z: p.z, goalX: p.x + 5, goalZ: p.z }); life.actors = [a]; life.tick(1 / 60, p, [], [], false);
  expect(Math.hypot(a.x - p.x, a.z - p.z)).toBeGreaterThanOrEqual(p.radius + 0.3 - 1e-8);
  life.actors = [actor({ age: 40 }), actor({ id: 2, x: 100 })]; life.tick(0.1, { x: 0, z: 0 }, [], [], false); expect(life.actors).toHaveLength(0);
});

test('boss and service windows hold new wildlife visits while existing extras keep escaping', () => {
  const life = new WorldLife(); life.reset(7); advance(life, 30, false); expect(life.actors).toHaveLength(0);
  advance(life, 7.1, true); expect(life.actors).toHaveLength(1); const a = life.actors[0], age = a.age;
  advance(life, 1, false); expect(a.age).toBeGreaterThan(age);
});

test('real tank destruction emits crew only once and paused, hit-stopped or ended runs freeze their motion', () => {
  const g = new GameEngine(53); g.reset(); g.weapons.pulse = 0;
  for (let i = 0; i < 8; i++) { g.spawn(2, 0, 10 + i * 5); g.hitEnemy(g.enemies.at(-1)!, 100000); }
  expect(g.worldLife.actors.length).toBeGreaterThan(0); const count = g.worldLife.actors.length, kills = g.kills;
  g.hitEnemy(g.enemies.at(-1)!, 100000); expect(g.worldLife.actors).toHaveLength(count); expect(g.kills).toBe(kills);
  const before = structuredClone(g.worldLife.actors);
  for (const phase of ['paused', 'dead', 'won'] as const) { useGame.setState({ phase }); g.tick(1); expect(g.worldLife.actors).toEqual(before); }
  useGame.setState({ phase: 'playing' }); g.hitStop = 0.05; g.tick(0.02); expect(g.worldLife.actors).toEqual(before);
  g.reset(); expect(g.worldLife.actors).toHaveLength(0);
});

test('extra noncombatants never enter weapon targeting or alter damage, rewards and combat randomness', () => {
  const a = new GameEngine(53), b = new GameEngine(53); a.reset(); b.reset(); a.player.invulnerable = b.player.invulnerable = 1000;
  a.worldLife.actors.push(actor({ kind: 'crew', source: 77, life: 50, x: 0, z: 3 }));
  for (let i = 0; i < 60 * 30; i++) { a.tick(1 / 60); b.tick(1 / 60); }
  expect([a.kills, a.score, a.xp, a.player.hp, a.salvage]).toEqual([b.kills, b.score, b.xp, b.player.hp, b.salvage]);
  expect(a.enemies).toEqual(b.enemies); expect(a.random()).toBe(b.random());
  a.enemies = []; a.targetId = 0; a.worldLife.actors = [actor({ x: 0, z: 2 })]; a.publish(); expect(useGame.getState().target).toBeNull();
});
