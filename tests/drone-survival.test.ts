import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine, LIMITS } from '../src/game/engine';
import { audio } from '../src/game/audio';
import { DRONE_FORMATION, DRONE_HULL, DroneFormation, DroneRack, droneContact } from '../src/game/orbital-drones';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';

const previous = useGame.getState(), sound = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', loadout: 'glaive', difficulty: 'standard', runMode: 'expedition', aimMode: 'precision', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(14); game.reset(); game.player.invulnerable = 1000;
  game.tick(1 / 60); game.enemies = [];
});
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }
function incoming(id: number, damage: number, height?: number, enemy = true) {
  const p = game.droneFormation.poses[id];
  game.bolts.push({ x: p.x, y: height ?? p.y, z: p.z, vx: 0, vz: 0, vy: 0, damage, enemy, target: 0, age: 0 });
}

test('hostile rounds damage independent escort hull and emit sparks at its actual height', () => {
  const hp = game.player.hp, shield = game.shield;
  incoming(0, 10); game.tick(1 / 60);
  expect(game.droneRack.units[0].hp).toBe(30); expect(game.droneRack.units[1].hp).toBe(40);
  expect(game.droneRack.units[0].hit).toBeGreaterThan(0); expect(game.bolts.length).toBe(0);
  expect(game.particles.some(p => p.y >= DRONE_FORMATION.altitude)).toBe(true);
  expect(game.player.hp).toBe(hp); expect(game.shield).toBe(shield);
});

test('a destroyed escort leaves a permanent empty slot, releases its gun and grants no hostile rewards', () => {
  const counters = [game.kills, game.score, game.xp, game.streak, game.salvage], gun = game.droneGuns[0], survivor = game.droneGuns[1];
  gun.active = true; gun.targetId = 44; gun.flash = 0.1; survivor.shots = 3;
  incoming(0, 50); game.tick(1 / 60);
  expect(game.droneRack.slots).toEqual([1]); expect(game.droneFormation.slots).toEqual([1]); expect(game.droneFormation.count).toBe(1);
  expect(gun.active).toBe(false); expect(gun.targetId).toBe(0); expect(gun.flash).toBe(0);
  expect([game.kills, game.score, game.xp, game.streak, game.salvage]).toEqual(counters);
  expect(game.gems.length).toBe(0); expect(game.supplies.length).toBe(0);
  advance(3); expect(game.droneRack.slots).toEqual([1]); expect(game.droneGuns[1]).toBe(survivor); expect(survivor.shots).toBe(3);
});

test('low rounds pass underneath and friendly lasers cannot damage escorts', () => {
  incoming(0, 100, 0.95); incoming(1, 100, undefined, false); game.tick(1 / 60);
  expect(game.droneRack.units.map(u => u.hp).slice(0, 2)).toEqual([40, 40]);
});

test('swept three-dimensional collision finds the first live escort even when a fast round crosses multiple slots', () => {
  const f = new DroneFormation(); f.poses[1] = { x: 2, y: 3, z: 0, yaw: 0, pitch: 0, bank: 0 }; f.poses[4] = { x: 5, y: 3, z: 0, yaw: 0, pitch: 0, bank: 0 };
  const a = { x: 0, y: 3, z: 0 }, b = { x: 8, y: 3, z: 0 };
  expect(droneContact(a, b, f.poses, [4, 1])?.id).toBe(1);
  expect(droneContact(a, b, f.poses, [4])?.id).toBe(4);
  expect(droneContact({ ...a, y: 0.95 }, { ...b, y: 0.95 }, f.poses, [1, 4])).toBeNull();
  expect(droneContact(a, a, f.poses, [1, 4])).toBeNull();
});

test('one lethal round affects only one drone and all seven can be lost without regrowing', () => {
  game.weapons.glaive = 6; game.tick(1 / 60);
  incoming(0, 100); game.tick(1 / 60); expect(game.droneRack.slots.length).toBe(6);
  for (const id of [...game.droneRack.slots]) incoming(id, 100);
  game.tick(1 / 60); expect(game.droneRack.slots.length).toBe(0); expect(game.droneFormation.count).toBe(0);
  advance(2); expect(game.droneFormation.count).toBe(0); expect(game.droneGuns.every(g => !g.active && !g.targetId)).toBe(true);
  expect(game.particles.length).toBeLessThanOrEqual(LIMITS.particles);
});

test('survivors maintain full-body separation as arbitrary slot casualties redistribute the formation', () => {
  const f = new DroneFormation(), p = { x: 0, z: 0 }, rack = new DroneRack(); rack.reset(6); f.reset(p, 7);
  for (const id of [0, 2, 4, 6]) {
    rack.hurt(id, 100);
    for (let frame = 0; frame < 60; frame++) {
      f.tick(1 / 60, frame / 60, p, rack.slots.length, [], rack.slots);
      for (const a of rack.slots) for (const b of rack.slots) if (a < b) {
        const pa = f.poses[a], pb = f.poses[b];
        expect(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z)).toBeGreaterThanOrEqual(DRONE_FORMATION.separation - 1e-8);
      }
    }
  }
  expect(f.slots).toEqual([1, 3, 5]);
});

test('medical pickups repair survivors within cap but never resurrect lost escorts', () => {
  incoming(0, 100); incoming(1, 30); game.tick(1 / 60);
  game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 });
  expect(game.droneRack.units[0].hp).toBe(0); expect(game.droneRack.units[1].hp).toBe(30);
  game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 }); expect(game.droneRack.units[1].hp).toBe(40);
});

test('module capacity increases commission new identities without replacing an old casualty', () => {
  incoming(0, 100); game.tick(1 / 60); game.weapons.glaive = 3; game.tick(1 / 60);
  expect(game.droneRack.capacity).toBe(4); expect(game.droneRack.slots).toEqual([1, 2, 3]); expect(game.droneRack.units[0].hp).toBe(0);
});

test('field service repairs all survivors and replaces exactly one lost unit, once per dock', () => {
  game.weapons.glaive = 3; game.tick(1 / 60);
  incoming(0, 100); incoming(1, 100); incoming(2, 25); game.tick(1 / 60); game.enemies = [];
  game.service = { x: game.player.x, z: game.player.z, remaining: 25, progress: 0, serviced: false }; game.shieldDelay = 0;
  advance(3.1);
  expect(game.service?.serviced).toBe(true); expect(game.droneRack.slots).toEqual([0, 2, 3]); expect(game.droneRack.units[2].hp).toBe(40);
  advance(3); expect(game.droneRack.slots).toEqual([0, 2, 3]);
});

test('pause, hit-stop and ended runs freeze incoming damage; restarting restores the selected fleet', () => {
  incoming(0, 100); const pending = game.bolts[0];
  for (const phase of ['paused', 'dead', 'won'] as const) { useGame.setState({ phase }); game.tick(0.1); expect(game.droneRack.units[0].hp).toBe(40); expect(pending.age).toBe(0); }
  useGame.setState({ phase: 'playing' }); game.hitStop = 0.05; game.tick(0.02); expect(game.droneRack.units[0].hp).toBe(40);
  game.hitStop = 0; game.tick(1 / 60); expect(game.droneRack.units[0].hp).toBe(0);
  game.reset(); expect(game.droneRack.slots).toEqual([0, 1]); expect(game.droneRack.units[0].hp).toBe(DRONE_HULL.hp); expect(game.bolts.length).toBe(0);
});

test('HUD snapshots preserve slot identities and cannot mutate live drone hull', () => {
  incoming(0, 100); incoming(1, 10); game.tick(1 / 60); game.publish();
  expect(useGame.getState().droneHull).toEqual([0, 30]);
  useGame.getState().droneHull[1] = 1; expect(game.droneRack.units[1].hp).toBe(30);
});

test('Sentinel replaces a ring round with a height-aware shot without extra shots or rapid anti-air spam', () => {
  for (const kind of [3] as const) {
    const g = new GameEngine(14); g.reset(); g.spawn(kind, 0, 8); const e = g.enemies.at(-1)!;
    e.hp = e.maxHp = 100000; e.age = 4; e.timer = 0; g.bossPhase = kind === 3 ? 1 : 0;
    g.tick(1 / 60);
    expect(g.bolts.filter(b => b.enemy).length).toBe(18);
    const shot = g.bolts.find(b => b.enemy && (b.vy ?? 0) > 0); expect(shot).toBeDefined(); expect(e.escortShotAt).toBeGreaterThanOrEqual(4);
    g.bolts = []; e.timer = 0; g.tick(1 / 60); expect(g.bolts.some(b => b.enemy && (b.vy ?? 0) > 0)).toBe(false);
  }
});

test('an aimed hostile anti-air round actually reaches and damages a resting escort', () => {
  game.spawn(1, 0, 8); const e = game.enemies.at(-1)!; e.weapon = 'plasma'; e.timer = 100;
  for (let i = 0; i < 180; i++) { game.enemies = [e]; game.tick(1 / 60); }
  e.age = 4; e.timer = 0; game.tick(1 / 60); e.timer = 100;
  expect(game.bolts.some(b => b.enemy)).toBe(false);
  for (let i = 0; i < 33; i++) { game.enemies = [e]; game.tick(1 / 60); }
  expect(game.bolts.some(b => b.enemy && (b.vy ?? 0) > 0)).toBe(true);
  for (let i = 0; i < 180; i++) { game.enemies = [e]; game.tick(1 / 60); }
  expect(game.droneRack.units.some(u => u.hp > 0 && u.hp < DRONE_HULL.hp)).toBe(true);
});
