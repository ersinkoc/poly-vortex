import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { droneCount, dronePose, DRONE_ORBIT } from '../src/game/orbital-drones';
import { buildDroneRotor } from '../src/game/ship-models';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';

let game: GameEngine;
const previous = useGame.getState();
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'glaive', difficulty: 'standard', runMode: 'expedition', profile: structuredClone(EMPTY_PROFILE), aimMode: 'precision' });
  game = new GameEngine(73); game.reset(); game.player.invulnerable = 100;
});
afterEach(() => useGame.setState(previous));

test('escort counts preserve the saved orbital module, with a seven-drone render cap', () => {
  expect(game.weapons.glaive).toBe(1); expect(game.weapons.pulse).toBe(1); expect(droneCount(0)).toBe(0);
  expect(droneCount(1)).toBe(2); expect(droneCount(5)).toBe(6); expect(droneCount(6)).toBe(7); expect(droneCount(100)).toBe(7);
});
test('every escort follows an equally spaced three-metre ring and faces its flight tangent', () => {
  const player = { x: 101.5, z: -78.2 };
  for (const t of [0, 0.2, 9, 200, 600]) for (let level = 1; level <= 6; level++) {
    const count = droneCount(level);
    for (let i = 0; i < count; i++) {
      const pose = dronePose(t, i, count, player), next = dronePose(t + 0.001, i, count, player);
      expect(Math.hypot(pose.x - player.x, pose.z - player.z)).toBeCloseTo(3, 10);
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      expect((pose.x - player.x) * Math.sin(pose.yaw) + (pose.z - player.z) * Math.cos(pose.yaw)).toBeCloseTo(0, 9);
      expect((next.x - pose.x) * Math.sin(pose.yaw) + (next.z - pose.z) * Math.cos(pose.yaw)).toBeGreaterThan(0);
      const adjacent = dronePose(t, (i + 1) % count, count, player);
      expect(Math.hypot(adjacent.x - pose.x, adjacent.z - pose.z)).toBeCloseTo(2 * DRONE_ORBIT.radius * Math.sin(Math.PI / count), 9);
    }
  }
});
test('the rendered orbit position intercepts a nearby hostile with the original damage rate', () => {
  game.time = 10; const dt = 1 / 60, pose = dronePose(game.time + dt, 0, 2, game.player);
  game.spawn(2, pose.x, pose.z); const enemy = game.enemies[0], hp = enemy.hp;
  game.tick(dt); expect(hp - enemy.hp).toBeCloseTo(65 * dt, 8);
  expect(game.bolts.filter(b => !b.enemy)).toHaveLength(0); // No new unrestricted ranged attack.
});
test('unarmed cores do not gain perimeter damage', () => {
  game.weapons.glaive = 0; game.spawn(2, 3, 0); const enemy = game.enemies[0], hp = enemy.hp;
  game.tick(1 / 60); expect(enemy.hp).toBe(hp);
});
test('pause and hit-stop freeze the escort pose; movement carries the formation and restart removes it', () => {
  game.time = 12; const pose = dronePose(game.time, 0, 2, game.player);
  useGame.getState().setPhase('paused'); game.tick(5); expect(dronePose(game.time, 0, 2, game.player)).toEqual(pose);
  useGame.getState().setPhase('playing'); game.hitStop = 0.05; game.tick(1 / 60); expect(dronePose(game.time, 0, 2, game.player)).toEqual(pose);
  game.hitStop = 0; game.input.keys.add('KeyD'); game.tick(1 / 60);
  const shifted = dronePose(game.time, 0, 2, game.player); expect(game.player.x).toBeGreaterThan(0);
  expect(Math.hypot(shifted.x - game.player.x, shifted.z - game.player.z)).toBeCloseTo(3, 10);
  useGame.setState({ loadout: 'pulse' }); game.reset(); expect(droneCount(game.weapons.glaive)).toBe(0); expect(game.time).toBe(0);
});
test('quadrotor blades fit inside the duct and provide finite instanced GPU attributes', () => {
  const rotor = buildDroneRotor();
  try {
    const p = rotor.getAttribute('position'); expect(p.count / 3).toBe(24);
    expect(rotor.getAttribute('normal').count).toBe(p.count); expect(rotor.getAttribute('uv').count).toBe(p.count);
    expect(Array.from(p.array).every(Number.isFinite)).toBe(true); expect(rotor.boundingSphere!.radius).toBeLessThan(0.215);
  } finally { rotor.dispose(); }
});
