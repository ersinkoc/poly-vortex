import { beforeEach, expect, test } from 'bun:test';
import { MissionDirector } from '../src/game/missions';
import { buildTerrainTextures, clearTerrainPosition, terrainHeight, terrainProp } from '../src/game/terrain';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';

const random = () => 0.5;
let director: MissionDirector;
beforeEach(() => { director = new MissionDirector(); });
test('first operation creates three nearby reachable pilots after eight seconds', () => {
  expect(director.tick(7, { x: 0, z: 0 }, 0, random)).toEqual([]);
  expect(director.tick(1, { x: 0, z: 0 }, 0, random)).toEqual(['started']);
  expect(director.mission!.kind).toBe('rescue'); expect(director.mission!.targets).toHaveLength(3);
  for (const target of director.mission!.targets) { expect(Number.isFinite(target.x)).toBe(true); expect(Math.hypot(target.x, target.z)).toBeGreaterThan(5); const copy = { ...target }; clearTerrainPosition(copy, 2); expect(copy.x).toBeCloseTo(target.x, 6); expect(copy.z).toBeCloseTo(target.z, 6); }
});
test('rescue requires proximity and dwell, rescues each pilot once, and completes once', () => {
  director.tick(8, { x: 0, z: 0 }, 0, random); const mission = director.mission!;
  director.tick(1, { x: 100, z: 100 }, 0, random); expect(director.rescued).toBe(0);
  const pilot = mission.targets[0]; director.tick(1, pilot, 0, random); expect(director.rescued).toBe(0);
  director.tick(1, { x: 100, z: 100 }, 0, random); expect(pilot.progress).toBe(0.25);
  expect(director.tick(1.25, pilot, 0, random)).toEqual(['rescued']); expect(director.tick(1, pilot, 0, random)).toEqual([]);
  director.tick(1.5, mission.targets[1], 0, random); expect(director.tick(1.5, mission.targets[2], 0, random)).toEqual(['rescued', 'complete']);
  expect(director.rescued).toBe(3); expect(director.completed).toBe(1); expect(mission.status).toBe('complete'); expect(director.tick(1, mission.targets[2], 0, random)).toEqual([]);
});
test('expired rescue stops extracting and progresses to a relay operation', () => {
  director.tick(8, { x: 0, z: 0 }, 0, random); const mission = director.mission!;
  mission.remaining = 0.5; expect(director.tick(2, mission.targets[0], 0, random)).toEqual(['failed']); expect(director.rescued).toBe(0);
  director.tick(8, { x: 0, z: 0 }, 7, random); expect(director.mission!.kind).toBe('uplink');
  const relay = director.mission!.targets[0]; director.tick(3, relay, 7, random); director.tick(2, { x: 100, z: 100 }, 7, random); expect(director.mission!.progress).toBe(3);
  expect(director.tick(5, relay, 7, random)).toEqual(['complete']);
});
test('blockade counts only new kills and cycles back to a fresh rescue', () => {
  director.tick(8, { x: 0, z: 0 }, 100, random); director.tick(70, { x: 100, z: 100 }, 100, random); director.tick(8, { x: 0, z: 0 }, 100, random); director.tick(45, { x: 100, z: 100 }, 100, random); director.tick(8, { x: 0, z: 0 }, 100, random);
  expect(director.mission!.kind).toBe('hunt'); director.tick(1, { x: 0, z: 0 }, 119, random); expect(director.mission!.progress).toBe(19); expect(director.tick(1, { x: 0, z: 0 }, 120, random)).toEqual(['complete']);
  director.tick(10, { x: 100, z: 100 }, 120, random); expect(director.mission!.kind).toBe('rescue'); expect(director.mission!.id).toBe(4); expect(director.mission!.progress).toBe(0);
});
test('HUD snapshots cannot mutate live targets and resetting clears all operation state', () => {
  director.tick(8, { x: 0, z: 0 }, 0, random); const copy = director.snapshot()!; copy.targets[0].done = true; expect(director.mission!.targets[0].done).toBe(false);
  director.reset(); expect(director.mission).toBeNull(); expect(director.completed).toBe(0); expect(director.rescued).toBe(0); expect(director.tick(7, { x: 0, z: 0 }, 0, random)).toEqual([]);
});
test('engine pauses missions and rewards successful extraction exactly once', () => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, difficulty: 'standard', loadout: 'pulse', profile: structuredClone(EMPTY_PROFILE) });
  const game = new GameEngine(123); game.reset(); game.missions.tick(8, game.player, 0, random); game.player.hp = 60; game.surge = 30; game.player.invulnerable = 100;
  useGame.setState({ phase: 'paused' }); game.tick(1); expect(game.missions.mission!.remaining).toBe(70);
  useGame.setState({ phase: 'playing' });
  for (const target of game.missions.mission!.targets) {
    game.player.x = target.x; game.player.z = target.z;
    for (let i = 0; i < 91; i++) { game.enemies = []; game.bolts = []; game.gems = []; game.hazards = []; game.tick(1 / 60); }
  }
  expect(game.salvage).toBe(45); expect(game.missions.rescued).toBe(3); expect(game.player.hp).toBe(75); expect(game.score).toBe(1500); expect(game.surge).toBeGreaterThanOrEqual(55);
  game.tick(1 / 60); expect(game.salvage).toBe(45); game.publish(); expect(useGame.getState().rescued).toBe(3);
  game.reset(); expect(useGame.getState().mission).toBeNull(); expect(useGame.getState().rescued).toBe(0);
});
test('world height is finite, depressed, and continuous across cell boundaries', () => {
  for (let x = -100; x < 100; x += 2) for (let z = -40; z < 40; z += 2) { const y = terrainHeight(x, z); expect(Number.isFinite(y)).toBe(true); expect(y).toBeLessThan(-0.1); expect(y).toBeGreaterThan(-2); }
  for (const x of [-32, -16, 0, 16, 32]) expect(Math.abs(terrainHeight(x - 0.001, 10) - terrainHeight(x + 0.001, 10))).toBeLessThan(0.01);
});
test('terrain collision pushes actors and objectives out of a boulder without invalid coordinates', () => {
  const prop = terrainProp(3, 3)!; expect(prop).not.toBeNull(); const actor = { x: prop.x, z: prop.z }; clearTerrainPosition(actor, 0.7); expect(Math.hypot(actor.x - prop.x, actor.z - prop.z)).toBeCloseTo(prop.radius + 0.7, 6);
  const safe = { ...actor }; clearTerrainPosition(safe, 0.7); expect(safe.x).toBeCloseTo(actor.x, 6); expect(safe.z).toBeCloseTo(actor.z, 6);
});
test('procedural stone maps are deterministic with color-space-correct surface channels', () => {
  const a = buildTerrainTextures(32), b = buildTerrainTextures(32);
  expect(a.map.image.data).toEqual(b.map.image.data); expect(a.normal.image.data).toEqual(b.normal.image.data); expect(a.map.colorSpace).toBe('srgb'); expect(a.normal.colorSpace).toBe(''); expect(a.roughness.image.data?.length).toBe(4096);
  [...Object.values(a), ...Object.values(b)].forEach(t => t.dispose());
});
