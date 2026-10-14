import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { GameEngine, LIMITS } from '../src/game/engine';
import { validateCheckpoint, restoreCheckpoint } from '../src/game/checkpoint';
import { FLIGHTFRAMES, SHIP_IDS, shipId } from '../src/game/flightframes';
import { HOSTILE_WEAPONS, enemyWeapon } from '../src/game/enemy-weapons';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';

const previous = useGame.getState(), sound = audio.enabled;
let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', ship: 'vector', activeShip: 'vector', loadout: 'pulse', aimMode: 'assisted', runMode: 'expedition', difficulty: 'standard', maxHp: 100, profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(73); game.reset(); game.player.invulnerable = 1000; game.weapons.pulse = 0;
  game.roverBay.nextWave = 1000; game.service = { x: 1000, z: 1000, remaining: 1000, progress: 0, serviced: true };
});
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });

test('new flightframes deploy their own stats and have selectable portraits', () => {
  expect(SHIP_IDS).toEqual(['vector', 'wraith', 'aegis', 'nova', 'bastion']);
  for (const id of ['nova', 'bastion'] as const) {
    expect(shipId(id)).toBe(id);
    expect(existsSync(`public${FLIGHTFRAMES[id].portrait}`)).toBe(true);
    useGame.setState({ phase: 'menu' }); useGame.getState().selectShip(id); useGame.getState().start(); game.reset();
    expect(game.ship).toBe(id); expect(game.player.maxHp).toBe(FLIGHTFRAMES[id].hull); expect(game.shield).toBe(FLIGHTFRAMES[id].shield);
  }
});

test('rail lance launches a penetrating slug and scatter array launches five distinct short-range lanes', () => {
  game.spawn(2, 0, 8); game.enemies[0].timer = 100; game.enemies[0].hp = game.enemies[0].maxHp = 10000;
  game.weapons.rail = 1; game.time = 3.67; game.tick(1 / 60);
  const rail = game.bolts.find(b => b.playerWeapon === 'rail');
  expect(rail).toMatchObject({ enemy: false, damage: 74, pierce: 1, range: 27 });
  game.bolts = []; game.weapons.rail = 0; game.weapons.scatter = 1; game.time = 2.39; game.tick(1 / 60);
  const pellets = game.bolts.filter(b => b.playerWeapon === 'scatter');
  expect(pellets).toHaveLength(5); expect(new Set(pellets.map(b => b.vx.toFixed(3))).size).toBe(5);
  expect(pellets.every(b => b.range === 11 && b.target === 0)).toBe(true);
  expect(game.bolts.length).toBeLessThanOrEqual(LIMITS.bolts);
});

test('flak and ion platforms rotate into the fleet, while an unprotected ion impact drains EMP', () => {
  const variants = Array.from({ length: 5 }, (_, i) => enemyWeapon({ id: i + 1, kind: 1, x: 0, z: 8, hp: 20, maxHp: 20, radius: .6, age: 0, timer: 0, elite: false }));
  expect(variants).toEqual(['plasma', 'laser', 'missile', 'flak', 'ion']);
  expect(HOSTILE_WEAPONS.flak.rounds).toBe(5);
  game.player.invulnerable = 0; game.surge = 60; game.shieldDelay = 0;
  game.bolts.push({ x: 0, y: .95, z: -1, vx: 0, vz: 60, age: 0, enemy: true, target: 0, damage: 8, hostileWeapon: 'ion' });
  game.tick(1 / 60);
  expect(game.surge).toBeCloseTo(42 + 0.8 / 60, 6); expect(game.shieldDelay).toBe(6);
  game.player.invulnerable = 0; game.barrier = 1; game.surge = 60;
  game.bolts.push({ x: 0, y: .95, z: -1, vx: 0, vz: 60, age: 0, enemy: true, target: 0, damage: 8, hostileWeapon: 'ion' });
  game.tick(1 / 60); expect(game.surge).toBeGreaterThan(59);
});

test('flak platform releases a spread of five actual projectiles', () => {
  game.spawn(1, 0, 8); const raider = game.enemies[0]; raider.weapon = 'flak'; raider.hp = raider.maxHp = 10000; raider.timer = 0;
  const headings: number[] = [];
  for (let frame = 0; frame < 100 && headings.length < 5; frame++) {
    const before = raider.weaponShots ?? 0;
    game.tick(1 / 60);
    if ((raider.weaponShots ?? 0) > before) {
      const shot = game.bolts.filter(b => b.hostileWeapon === 'flak').at(-1);
      if (!shot) throw new Error('flak shot was not launched');
      headings.push(Math.atan2(shot.vx, shot.vz));
    }
  }
  expect(headings).toHaveLength(5);
  expect(Math.max(...headings) - Math.min(...headings)).toBeGreaterThan(0.3);
});

test('old checkpoints missing the new weapon levels remain resumable with those modules offline', () => {
  game.spawn(1, 0, 10); const old = game.checkpoint();
  delete (old.state.weapons as Record<string, unknown>).rail;
  delete (old.state.weapons as Record<string, unknown>).scatter;
  const resumed = new GameEngine(999);
  expect(validateCheckpoint(old, resumed)).toBe(true);
  expect(restoreCheckpoint(resumed, old)).toBe(true);
  expect(resumed.weapons.rail).toBe(0); expect(resumed.weapons.scatter).toBe(0);
  expect(resumed.weapons.pulse).toBe(game.weapons.pulse);
});

test('new module levels and ship identity survive a checkpoint round trip', () => {
  game.ship = 'nova'; game.startingLoadout = 'rail'; game.weapons.rail = 4; game.weapons.scatter = 2;
  const saved = JSON.parse(JSON.stringify(game.checkpoint()));
  const resumed = new GameEngine(9);
  expect(restoreCheckpoint(resumed, saved)).toBe(true);
  expect(resumed.ship).toBe('nova'); expect(resumed.startingLoadout).toBe('rail');
  expect(resumed.weapons.rail).toBe(4); expect(resumed.weapons.scatter).toBe(2);
});
