import { afterEach, beforeEach, expect, test } from 'bun:test';
import * as THREE from 'three';
import { GameEngine, LIMITS } from '../src/game/engine';
import { DRONE_FIRE, DRONE_GUN, DRONE_ORBIT, droneMuzzle, dronePose } from '../src/game/orbital-drones';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { terrainHeight, terrainProp } from '../src/game/terrain';
import { friendlyInLine } from '../src/game/targeting';

let game: GameEngine;
const previous = useGame.getState();
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'glaive', difficulty: 'standard', runMode: 'expedition', profile: structuredClone(EMPTY_PROFILE), aimMode: 'assisted' });
  game = new GameEngine(14); game.reset(); game.player.invulnerable = 1000; game.weapons.pulse = 0;
});
afterEach(() => useGame.setState(previous));
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }
function target(x = 0, z = 8) { game.spawn(2, x, z); const e = game.enemies.at(-1)!; e.hp = e.maxHp = 10000; return e; }
function firstShot() { for (let i = 0; i < 90; i++) { game.tick(1 / 60); const b = game.bolts.find(b => b.drone !== undefined); if (b) return b; } throw new Error('No drone shot in the clear fixture.'); }

test('escort turns toward a live hostile and fires a real damaging bolt from its visible barrel', () => {
  const e = target(), b = firstShot(), gun = game.droneGuns[b.drone!];
  const muzzle = droneMuzzle(dronePose(game.time, b.drone!, 2, game.player), gun.yaw, gun.barrel);
  expect(b.enemy).toBe(false); expect(b.target).toBe(e.id); expect(b.range).toBe(12); expect(b.damage).toBe(11);
  expect(b.x - b.vx / 60).toBeCloseTo(muzzle.x, 9); expect(b.z - b.vz / 60).toBeCloseTo(muzzle.z, 9); expect(b.y! - b.vy! / 60).toBeCloseTo(muzzle.y, 9);
  expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(22, 9); expect(gun.flash).toBe(DRONE_FIRE.flashDuration);
  expect(Math.abs(Math.atan2(b.vx, b.vz) - Math.atan2(Math.sin(gun.yaw), Math.cos(gun.yaw)))).toBeLessThan(1e-8);
  advance(0.45); expect(e.hp).toBeLessThan(e.maxHp);
});
test('muzzle positions match the complete model transform including bank, pitch and both barrels', () => {
  for (const time of [0, 1, 12]) for (const yaw of [-2, 0, 1.8]) for (const side of [-1, 1] as const) {
    const pose = dronePose(time, 1, 4, { x: 7, z: -4 });
    const v = new THREE.Vector3(side * DRONE_GUN.x, DRONE_GUN.y, DRONE_GUN.z + DRONE_GUN.tip * DRONE_GUN.scale).multiplyScalar(DRONE_ORBIT.scale).applyEuler(new THREE.Euler(pose.pitch, yaw, pose.bank, 'XYZ')).add(new THREE.Vector3(pose.x, pose.y, pose.z));
    const actual = droneMuzzle(pose, yaw, side); expect(actual.x).toBeCloseTo(v.x, 10); expect(actual.y).toBeCloseTo(v.y, 10); expect(actual.z).toBeCloseTo(v.z, 10);
  }
});
test('each drone has its own cooldown, alternates barrels and cannot accumulate a catch-up burst', () => {
  target(); firstShot(); const gun = game.droneGuns[0]; expect(gun.shots).toBe(1); expect(gun.barrel).toBe(-1);
  advance(0.3); expect(gun.shots).toBe(1); advance(0.9); expect(gun.shots).toBe(2); expect(gun.barrel).toBe(1);
  expect(game.droneGuns[1].shots).toBeGreaterThan(0); expect(game.droneGuns[1].shots).toBeLessThanOrEqual(2);
  game.enemies = []; advance(2); const shots = gun.shots; target(); game.tick(1 / 60); expect(gun.shots - shots).toBeLessThanOrEqual(1);
});
test('Precision with no pointer or a reversed aiming cone holds drone fire', () => {
  target(); useGame.setState({ aimMode: 'precision' }); advance(0.7);
  expect(game.droneGuns.every(g => g.shots === 0)).toBe(true);
  game.input.aiming = true; game.input.aimX = 0; game.input.aimZ = 12; advance(0.8);
  const shots = game.droneGuns.reduce((n, g) => n + g.shots, 0); expect(shots).toBeGreaterThan(0);
  game.input.aimZ = -12; advance(0.5); expect(game.droneGuns.reduce((n, g) => n + g.shots, 0)).toBe(shots);
});
test('drones retain a visible lock then release a dead hostile without homing old shots at a replacement', () => {
  const e = target(), b = firstShot(), velocity = { x: b.vx, z: b.vz }; const replacement = target(3, 7);
  game.tick(1 / 60); expect(game.droneGuns[0].targetId).toBe(e.id); expect(b.vx).toBe(velocity.x); expect(b.vz).toBe(velocity.z);
  game.hitEnemy(e, 1e9); game.hitStop = 0; advance(0.1); expect(game.droneGuns[0].targetId).toBe(replacement.id);
  expect(b.target).toBe(e.id); expect(b.vx).toBe(velocity.x); expect(b.vz).toBe(velocity.z);
});
test('targets beyond twelve metres from the whole escort ring do not trigger shots', () => {
  target(0, 22); advance(1); expect(game.droneGuns.every(g => g.targetId === 0 && g.shots === 0)).toBe(true);
});
test('a tall rock between escort and hostile blocks its locked firing lane', () => {
  let rock = null;
  for (let x = 1; x < 6 && !rock; x++) for (let z = 1; z < 6; z++) { const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; } }
  expect(rock).not.toBeNull(); const r = rock!;
  game.player.x = r.x - r.radius - 6; game.player.z = r.z; target(r.x + r.radius + 1.3, r.z);
  game.droneGuns[0].active = true; game.droneGuns[0].yaw = Math.PI / 2;
  game.tick(1 / 60); expect(game.droneGuns[0].shots).toBe(0); expect(game.droneGuns[0].targetId).toBe(0);
});
test('a rescue pilot on the actual drone firing lane holds that drone without rescuing or damaging the pilot', () => {
  const e = target(); game.missions.tick(8, game.player, 0, () => 0.5);
  const pose = dronePose(1 / 60, 0, 2, game.player), pilot = game.missions.mission!.targets[0];
  pilot.x = (pose.x + e.x) / 2; pilot.z = (pose.z + e.z) / 2;
  game.missions.mission!.targets.slice(1).forEach(p => { p.x = 100; p.z = 100; });
  game.droneGuns[0].active = true; game.droneGuns[0].yaw = Math.atan2(e.x - pose.x, e.z - pose.z);
  game.tick(1 / 60); expect(game.droneGuns[0].shots).toBe(0); expect(game.droneGuns[0].targetId).toBe(0); expect(pilot.done).toBe(false); expect(pilot.progress).toBe(0);
});
test('escorts cannot shoot through the mothership even if a hostile is within their range', () => {
  const e = target(-8, 0); const pose = dronePose(1 / 60, 0, 2, game.player);
  expect(friendlyInLine(pose, e, [{ x: 0, z: 0, radius: 1.15 }])).toBe(true);
  game.tick(1 / 60); expect(game.droneGuns[0].targetId).toBe(0); expect(game.droneGuns[0].shots).toBe(0);
});
test('an already launched escort shot is intercepted if the core moves into its lane', () => {
  target(); const b = firstShot();
  game.player.x = b.x + b.vx / 120; game.player.z = b.z + b.vz / 120; game.tick(1 / 60);
  expect(game.bolts).not.toContain(b); expect(game.player.hp).toBe(100); expect(game.shield).toBe(40);
});
test('pause, hit-stop, death and restart suspend or clear firing state with no delayed shot', () => {
  target(); firstShot(); const state = structuredClone(game.droneGuns), bolts = structuredClone(game.bolts);
  useGame.getState().setPhase('paused'); game.tick(5); expect(game.droneGuns).toEqual(state); expect(game.bolts).toEqual(bolts);
  useGame.getState().setPhase('playing'); game.hitStop = 0.05; game.tick(1 / 60); expect(game.droneGuns).toEqual(state);
  useGame.setState({ phase: 'dead' }); game.tick(5); expect(game.droneGuns).toEqual(state);
  game.reset(); expect(game.droneGuns.every(g => !g.active && g.shots === 0 && g.flash === 0 && g.targetId === 0)).toBe(true); expect(game.bolts).toHaveLength(0);
});
test('shared projectile capacity holds fire without false flashes, cooldown spending or unbounded firing speed', () => {
  target(); game.haste = 0.01; game.weapons.glaive = 6;
  game.bolts = Array.from({ length: LIMITS.bolts }, () => ({ x: 0, z: -25, vx: 0, vz: 0, age: 0, enemy: false, target: 0, damage: 0 }));
  advance(0.3); expect(game.bolts).toHaveLength(LIMITS.bolts); expect(game.droneGuns.every(g => g.shots === 0 && g.flash === 0)).toBe(true);
  game.bolts = []; advance(1); expect(game.bolts.length).toBeLessThanOrEqual(LIMITS.bolts);
  expect(game.droneGuns.some(g => g.shots > 0)).toBe(true); expect(game.droneGuns.every(g => g.shots <= 3)).toBe(true);
  expect(game.droneGuns).toHaveLength(7);
});
