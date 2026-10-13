import { afterEach, beforeEach, expect, test } from 'bun:test';
import * as THREE from 'three';
import { GameEngine, LIMITS } from '../src/game/engine';
import { DroneRack, DroneFormation, DRONE_BATTERY, DRONE_FORMATION, DRONE_HULL, droneClearance, droneContact } from '../src/game/orbital-drones';
import { DRONE_DOCK, PLAYER_SCALE, droneDockPose, playerFlightPose } from '../src/game/player-pose';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';

const previous = useGame.getState(), sound = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', loadout: 'glaive', aimMode: 'precision', runMode: 'expedition', difficulty: 'standard', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(14); game.reset(); game.player.invulnerable = 1000;
});
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) { game.enemies = []; game.tick(1 / 60); } }
function rackAdvance(rack: DroneRack, seconds: number, clear = true) { for (let i = 0; i < Math.round(seconds * 60); i++) rack.tick(1 / 60, clear); }

test('each sortie consumes independent battery and staggered reserves start a real recall', () => {
  const rack = new DroneRack(); rack.reset(1); const before = rack.snapshot(); rackAdvance(rack, 2);
  expect(rack.units[0].battery).toBeCloseTo(before[0].battery - DRONE_BATTERY.drain * 2, 5);
  expect(rack.units[1].battery).toBeLessThan(rack.units[0].battery);
  rackAdvance(rack, 13); expect(rack.units[1].state).toBe('returning'); expect(rack.units[0].state).toBe('flight');
  expect(rack.units[1].battery).toBeCloseTo(DRONE_BATTERY.reserve, 5);
});

test('returning aircraft recharge only after docking, then launch only at full battery', () => {
  const rack = new DroneRack(); rack.reset(1); rack.units[0].battery = 20; rack.tick(1 / 60);
  expect(rack.units[0].state).toBe('returning'); rackAdvance(rack, 1); expect(rack.units[0].battery).toBe(20);
  rackAdvance(rack, 1); expect(rack.units[0].state).toBe('charging'); expect(rack.airborne).not.toContain(0);
  rackAdvance(rack, 3); expect(rack.units[0].battery).toBeCloseTo(57.5, 4); expect(rack.units[0].state).toBe('charging');
  rackAdvance(rack, 3.5); expect(rack.units[0].state).toBe('launching'); expect(rack.units[0].battery).toBe(100);
  rackAdvance(rack, 1.4); expect(rack.units[0].state).toBe('flight'); expect(rack.airborne).toContain(0);
});

test('one shared hatch serializes inbound and outbound aircraft without deleting survivors', () => {
  const rack = new DroneRack(); rack.reset(6); for (const u of rack.units) u.battery = 20;
  let sawCharging = false, sawLaunch = false;
  for (let i = 0; i < 1800; i++) {
    rack.tick(1 / 60);
    expect(rack.units.filter(u => u.state === 'returning' || u.state === 'launching').length).toBeLessThanOrEqual(1);
    expect(rack.slots.length).toBe(7); expect(rack.units.every(u => u.hp === DRONE_HULL.hp)).toBe(true);
    sawCharging ||= rack.units.some(u => u.state === 'charging'); sawLaunch ||= rack.units.some(u => u.state === 'launching');
  }
  expect(sawCharging).toBe(true); expect(sawLaunch).toBe(true);
});

test('an obstructed hatch holds the approach above the ship and delays launch without airborne charging', () => {
  const rack = new DroneRack(); rack.reset(1); rack.units[0].battery = 20; rack.tick(1 / 60, false); rackAdvance(rack, 5, false);
  expect(rack.units[0].state).toBe('returning'); expect(rack.units[0].phaseTime).toBeCloseTo(DRONE_BATTERY.returnDuration * 0.55, 5); expect(rack.units[0].battery).toBe(20);
  rackAdvance(rack, 1); expect(rack.units[0].state).toBe('charging');
  rack.units[0].battery = 100; rackAdvance(rack, 1, false); expect(rack.units[0].state).toBe('charging');
  rack.tick(1 / 60); expect(rack.units[0].state).toBe('launching');
});

test('successful laser shots spend battery; blocked capacity never charges a nonexistent shot', () => {
  useGame.setState({ aimMode: 'assisted' }); game.weapons.pulse = 0; game.spawn(2, 0, 8); const target = game.enemies.at(-1)!; target.hp = target.maxHp = 10000;
  const initial = game.droneRack.units.map(u => u.battery);
  for (let i = 0; i < 90; i++) game.tick(1 / 60);
  expect(game.droneGuns.some(g => g.shots > 0)).toBe(true);
  for (let i = 0; i < 2; i++) expect(game.droneRack.units[i].battery).toBeCloseTo(initial[i] - 1.5 * DRONE_BATTERY.drain - game.droneGuns[i].shots * DRONE_BATTERY.shotCost, 4);
  game.bolts = Array.from({ length: LIMITS.bolts }, () => ({ x: 50, z: 50, vx: 0, vz: 0, enemy: false, target: 0, damage: 0, age: 0 }));
  game.droneGuns.forEach(g => { g.cooldown = 0; }); const shots = game.droneGuns.map(g => g.shots), energy = game.droneRack.units.map(u => u.battery);
  game.tick(1 / 60); expect(game.droneGuns.map(g => g.shots)).toEqual(shots);
  for (let i = 0; i < 2; i++) expect(game.droneRack.units[i].battery).toBeCloseTo(energy[i] - DRONE_BATTERY.drain / 60, 5);
});

test('waiting, returning, docked and launching escorts cannot acquire locks or fire', () => {
  useGame.setState({ aimMode: 'assisted' }); game.weapons.pulse = 0; game.spawn(2, 0, 8); const e = game.enemies.at(-1)!; e.hp = e.maxHp = 10000;
  for (const state of ['waiting', 'returning', 'charging', 'launching'] as const) {
    for (const u of game.droneRack.units.slice(0, 2)) { u.state = state; u.phaseTime = 0; u.battery = state === 'charging' ? 40 : 20; }
    game.droneGuns.forEach(g => { g.targetId = e.id; g.flash = 0.1; }); const shots = game.droneGuns.map(g => g.shots);
    game.tick(1 / 60); expect(game.droneGuns.map(g => g.shots)).toEqual(shots); expect(game.droneGuns.every(g => !g.active && !g.targetId && !g.flash)).toBe(true);
  }
});

test('docked units leave the rendered formation and their prior positions cannot absorb hostile fire', () => {
  const old = { ...game.droneFormation.poses[0] }; game.droneRack.units[0].state = 'charging'; game.droneRack.units[0].battery = 40; game.droneRack.refresh();
  game.bolts.push({ x: old.x, y: old.y, z: old.z, vx: 0, vz: 0, vy: 0, damage: 100, enemy: true, target: 0, age: 0 });
  game.tick(1 / 60); expect(game.droneFormation.slots).not.toContain(0); expect(game.droneRack.units[0].hp).toBe(40); expect(game.droneRack.slots).toContain(0);
});

test('returning aircraft remain vulnerable and destroyed units never recharge or relaunch', () => {
  game.droneRack.units[0].state = 'returning'; game.droneRack.units[0].phaseTime = 0; game.tick(1 / 60);
  const p = game.droneFormation.poses[0]; game.bolts.push({ x: p.x, y: p.y, z: p.z, vx: 0, vz: 0, vy: 0, damage: 100, enemy: true, target: 0, age: 0 });
  game.tick(1 / 60); expect(game.droneRack.snapshot()[0].state).toBe('lost'); advance(40);
  expect(game.droneRack.units[0].hp).toBe(0); expect(game.droneRack.units[0].battery).toBe(0); expect(game.droneRack.airborne).not.toContain(0);
});

test('docking and launch follow the moving hull and preserve clearance throughout repeated seven-drone cycles', () => {
  const rack = new DroneRack(), formation = new DroneFormation(), p = { x: 0, z: 0, vx: 7.5, vz: 0, angle: 0.5 };
  rack.reset(6); formation.reset(p, 7);
  for (let frame = 0; frame < 3600; frame++) {
    const time = frame / 60; p.x += p.vx / 60; p.angle += 0.005;
    const dock = droneDockPose(time, p), clear = droneClearance(dock.x, dock.z, [], 0, 0) <= dock.y + 0.02;
    rack.tick(1 / 60, clear); formation.tick(1 / 60, time, p, rack.airborne.length, [], rack.airborne, rack.units);
    for (const id of formation.slots) {
      const a = formation.poses[id], scale = a.scale ?? 1;
      expect(Object.values(a).every(Number.isFinite)).toBe(true); expect(scale).toBeGreaterThanOrEqual(0); expect(scale).toBeLessThanOrEqual(1);
      expect(a.y).toBeGreaterThanOrEqual(droneClearance(a.x, a.z, [], DRONE_FORMATION.bodyRadius * scale, 0) - 1e-8);
      for (const other of formation.slots) if (other < id) {
        const b = formation.poses[other], required = DRONE_FORMATION.separation * (scale + (b.scale ?? 1)) / 2;
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThanOrEqual(required - 1e-8);
      }
    }
  }
});

test('shared docking anchor exactly matches the rendered XYZ hull transform during banked turns', () => {
  for (const time of [0, 1, 4]) for (const angle of [0, 0.7, -2.4]) {
    const p = { x: 10, z: -20, angle, vx: 7.5, vz: -4 }, core = playerFlightPose(time, p), dock = droneDockPose(time, p);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(core.pitch, core.yaw, core.bank, 'XYZ'));
    const expected = new THREE.Vector3(DRONE_DOCK.x, DRONE_DOCK.y, DRONE_DOCK.z).multiplyScalar(PLAYER_SCALE).applyQuaternion(q).add(new THREE.Vector3(core.x, core.y, core.z));
    expect(dock.x).toBeCloseTo(expected.x, 8); expect(dock.y).toBeCloseTo(expected.y, 8); expect(dock.z).toBeCloseTo(expected.z, 8);
  }
});

test('pause, hit-stop and ended runs freeze battery, charging clocks, rotor rotation and formation', () => {
  game.droneRack.units[0].state = 'charging'; game.droneRack.units[0].battery = 30; game.droneRack.refresh(); game.tick(1 / 60);
  const rack = game.droneRack.snapshot(), poses = structuredClone(game.droneFormation.poses), rotor = game.droneRack.units.map(u => u.rotor);
  for (const phase of ['paused', 'dead', 'won'] as const) { useGame.setState({ phase }); game.tick(0.1); expect(game.droneRack.snapshot()).toEqual(rack); expect(game.droneFormation.poses).toEqual(poses); expect(game.droneRack.units.map(u => u.rotor)).toEqual(rotor); }
  useGame.setState({ phase: 'playing' }); game.hitStop = 0.05; game.tick(0.02); expect(game.droneRack.snapshot()).toEqual(rack);
});

test('restart restores the selected starting roster and discards unfinished battery cycles', () => {
  game.weapons.glaive = 6; advance(25); game.reset();
  expect(game.droneRack.capacity).toBe(2); expect(game.droneRack.airborne).toEqual([0, 1]); expect(game.droneRack.units.slice(0, 2).every(u => u.state === 'flight' && u.phaseTime === 0)).toBe(true);
  expect(game.droneRack.units.slice(2).every(u => u.state === 'lost' && u.battery === 0)).toBe(true); expect(game.droneGuns.every(g => !g.shots)).toBe(true);
});

test('medical repair preserves charge state, and explicit service rebuilds one unit inside the bay', () => {
  const rack = new DroneRack(); rack.reset(2); rack.hurt(0, 100); rack.units[1].state = 'charging'; rack.units[1].battery = 42; rack.hurt(1, 10); rack.hurt(2, 100);
  rack.repair(); expect(rack.units[1].hp).toBe(40); expect(rack.units[1].battery).toBe(42); expect(rack.units[1].state).toBe('charging');
  rack.service(); expect(rack.units[0].state).toBe('charging'); expect(rack.units[0].battery).toBe(100); expect(rack.units[2].state).toBe('lost');
  rack.tick(1 / 60); expect(rack.units[0].state).toBe('launching'); expect(rack.units[1].state).toBe('charging');
});

test('telemetry is copied and invalid clock input cannot progress charging or corrupt battery', () => {
  const rack = new DroneRack(); rack.reset(1); rack.units[0].state = 'charging'; rack.units[0].battery = 40;
  const snapshot = rack.snapshot(); snapshot[0].battery = 0; snapshot[0].state = 'lost'; expect(rack.units[0].battery).toBe(40); expect(rack.units[0].state).toBe('charging');
  const before = rack.snapshot(); for (const dt of [0, -1, NaN, Infinity]) rack.tick(dt); expect(rack.snapshot()).toEqual(before);
  game.publish(); const hud = useGame.getState().droneStatus; hud[0].battery = 0; expect(game.droneRack.units[0].battery).toBe(100);
});

test('scaled docking bodies use their actual flight volume for incoming rounds', () => {
  const formation = new DroneFormation(); formation.poses[0] = { x: 0, y: 2, z: 0, yaw: 0, pitch: 0, bank: 0, scale: 0.2 };
  expect(droneContact({ x: -1, y: 2.5, z: 0 }, { x: 1, y: 2.5, z: 0 }, formation.poses, [0])).toBeNull();
  expect(droneContact({ x: -1, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, formation.poses, [0])?.id).toBe(0);
});
