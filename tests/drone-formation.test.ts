import { afterEach, beforeEach, expect, test } from 'bun:test';
import { DroneFormation, DRONE_FORMATION, droneClearance, droneInLine, dronePose } from '../src/game/orbital-drones';
import { GameEngine } from '../src/game/engine';
import { terrainHeight, terrainProp } from '../src/game/terrain';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE, type Entity } from '../src/game/types';
import { audio } from '../src/game/audio';

const previous = useGame.getState(), previousAudio = audio.enabled;
beforeEach(() => { audio.enabled = false; useGame.setState({ phase: 'playing', loadout: 'glaive', difficulty: 'standard', runMode: 'expedition', aimMode: 'precision', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) }); });
afterEach(() => { useGame.setState(previous); audio.enabled = previousAudio; });
const player = () => ({ x: 0, z: 0, vx: 0, vz: 0, angle: 0, dashTime: 0 });
const enemy = (x: number, z: number, radius = 0.48): Entity => ({ id: 1, x, z, radius, kind: 0, hp: 1000, maxHp: 1000, age: 0, timer: 5, elite: false });
function safety(f: DroneFormation, p: { x: number; z: number }, enemies: readonly Entity[] = []) {
  for (let i = 0; i < f.count; i++) {
    const a = f.poses[i]; expect(Object.values(a).every(Number.isFinite)).toBe(true); expect(a.y + 1e-8).toBeGreaterThanOrEqual(droneClearance(a.x, a.z, enemies));
    expect(Math.hypot(a.x - p.x, a.z - p.z)).toBeGreaterThanOrEqual(2.6 - 1e-8);
    for (let j = 0; j < i; j++) { const b = f.poses[j]; expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThanOrEqual(DRONE_FORMATION.separation - 1e-8); }
  }
}

test('resting escorts hover above the core without continuously circling it', () => {
  const f = new DroneFormation(), p = player(); f.reset(p, 7); const positions = f.poses.map(a => ({ x: a.x, z: a.z }));
  for (let i = 0; i < 180; i++) f.tick(1 / 60, i / 60, p, 7, []);
  expect(f.poses.map(a => ({ x: a.x, z: a.z }))).toEqual(positions); expect(f.mode).toBe('hover'); expect(f.radius).toBe(3);
  expect(f.poses.every(a => a.y >= 2.85 && a.y < 2.91)).toBe(true); safety(f, p);
  expect(dronePose(3, 0, 7, p, f)).toBe(f.poses[0]);
});

test('a nearby fight smoothly spreads the formation and fast flight contracts it again', () => {
  const f = new DroneFormation(), p = player(), threats = [enemy(0, 8)]; f.reset(p, 7); f.tick(1 / 60, 0, p, 7, threats);
  expect(f.radius).toBeGreaterThan(3); expect(f.radius).toBeLessThan(3.1); expect(f.mode).toBe('spread');
  for (let i = 0; i < 120; i++) f.tick(1 / 60, i / 60, p, 7, threats); expect(f.radius).toBeGreaterThan(4.39); safety(f, p, threats);
  p.vx = 7.5; f.tick(1 / 60, 2, p, 7, threats); expect(f.radius).toBeGreaterThan(4.2); expect(f.mode).toBe('compact');
  for (let i = 0; i < 120; i++) f.tick(1 / 60, 2 + i / 60, p, 7, threats); expect(f.radius).toBeLessThan(2.61); safety(f, p, threats);
});

test('all module growth transitions maintain full-body separation while new drones join', () => {
  for (let initial = 2; initial <= 6; initial++) for (let next = initial + 1; next <= 7; next++) {
    const f = new DroneFormation(), p = player(); f.reset(p, initial);
    for (let i = 0; i < 120; i++) { f.tick(1 / 60, i / 60, p, next, []); safety(f, p); expect(Math.max(...f.poses.slice(0, f.count).map(a => a.y))).toBeLessThan(8); }
    expect(f.count).toBe(next); expect(Math.max(...f.poses.slice(0, next).map(a => a.y))).toBeLessThan(3);
  }
});

test('nearby rocks compress the formation and drone volumes stay above their surface', () => {
  const rock = terrainProp(1, 1)!, p = player(), f = new DroneFormation(); p.x = rock.x - rock.radius - 2; p.z = rock.z; f.reset(p, 7);
  for (let i = 0; i < 120; i++) { f.tick(1 / 60, i / 60, p, 7, []); safety(f, p); }
  expect(f.mode).toBe('compact'); expect(f.radius).toBeLessThan(2.61);
  const nearest = f.poses[0]; expect(nearest.y - DRONE_FORMATION.bodyRadius).toBeGreaterThan(terrainHeight(rock.x, rock.z) + rock.height);
});

test('dashing carries the elevated formation across terrain without crossing the core or other escorts', () => {
  const f = new DroneFormation(), p = player(); f.reset(p, 7); p.vx = 32; p.dashTime = 0.2;
  for (let i = 0; i < 240; i++) { p.x += 32 / 60; f.tick(1 / 60, i / 60, p, 7, []); safety(f, p); }
  expect(f.mode).toBe('compact'); expect(f.poses.every(a => a.y - DRONE_FORMATION.bodyRadius > 1.6)).toBe(true);
});

test('a large hostile underneath an escort triggers a safe climb rather than a collision', () => {
  const f = new DroneFormation(), p = player(), boss = enemy(3, 0, 2.3); boss.kind = 3; f.reset(p, 2); f.tick(1 / 60, 1 / 60, p, 2, [boss]);
  expect(f.poses[0].y - DRONE_FORMATION.bodyRadius).toBeGreaterThan(boss.radius * 1.8 + 0.35); safety(f, p, [boss]);
  f.tick(0, 1 / 60, p, 2, [boss]); safety(f, p, [boss]);
});

test('three-dimensional friendly lanes block another drone while permitting shots below its flight volume', () => {
  const f = new DroneFormation(), p = player(); f.reset(p, 2);
  expect(droneInLine({ x: -5, y: 2.87, z: 0 }, { x: 5, y: 2.87, z: 0 }, f.poses, 2, 0)).toBe(true);
  expect(droneInLine({ x: -5, y: 0.9, z: 0 }, { x: 5, y: 0.9, z: 0 }, f.poses, 2, 0)).toBe(false);
  expect(droneInLine({ x: 3, y: 2.87, z: 0 }, { x: 8, y: 1, z: 0 }, f.poses, 2, 0)).toBe(false);
});

test('pause and hit-stop freeze the actual rendered formation; restart clears previous slots and expansion', () => {
  const g = new GameEngine(2); g.reset(); g.weapons.pulse = 0; g.player.invulnerable = 1000; g.spawn(2, 0, 8); g.tick(1 / 60);
  const poses = structuredClone(g.droneFormation.poses), radius = g.droneFormation.radius;
  useGame.getState().setPhase('paused'); g.tick(4); expect(g.droneFormation.poses).toEqual(poses); expect(g.droneFormation.radius).toBe(radius);
  useGame.getState().setPhase('playing'); g.hitStop = 0.05; g.tick(1 / 60); expect(g.droneFormation.poses).toEqual(poses);
  useGame.setState({ loadout: 'pulse' }); g.reset(); expect(g.droneFormation.count).toBe(0); expect(g.droneFormation.radius).toBe(3);
  useGame.setState({ loadout: 'glaive' }); g.reset(); expect(g.droneFormation.count).toBe(2); safety(g.droneFormation, g.player);
});

test('an in-flight escort laser stops at another drone instead of passing through its body', () => {
  const g = new GameEngine(2); g.reset(); g.weapons.pulse = 0;
  const buddy = g.droneFormation.poses[1], bolt = { x: buddy.x - 0.2, y: buddy.y, z: buddy.z, vx: 22, vy: 0, vz: 0, enemy: false, target: 0, age: 0, damage: 11, drone: 0, range: 12 };
  g.bolts.push(bolt); g.tick(1 / 60); expect(g.bolts).not.toContain(bolt); expect(g.player.hp).toBe(100); expect(g.shield).toBe(40);
});
