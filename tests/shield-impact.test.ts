import { beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { audio } from '../src/game/audio';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { shieldContact, shieldImpact, SHIELD_IMPACT } from '../src/game/shield-impact';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, difficulty: 'standard', loadout: 'pulse', aimMode: 'assisted', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(273); game.reset(); game.player.invulnerable = 0;
});

test('a charged or regenerating shield has no idle impact surface', () => {
  expect(game.shield).toBe(40); expect(game.shieldHits).toHaveLength(0);
  game.shield = 10; game.shieldDelay = 0; game.tick(0.1);
  expect(game.shield).toBeGreaterThan(10); expect(game.shieldHits).toHaveLength(0);
});

test('incoming projectile velocity identifies the struck side even after crossing the core', () => {
  const hit = shieldImpact({ x: 0, z: 0, angle: 0 }, { x: -0.1, z: 0, vx: -12, vz: 0 }, 10, false);
  expect(hit.x).toBeGreaterThan(0.9); expect(Math.abs(hit.z)).toBeLessThan(0.001);
  expect(Math.hypot(hit.x, hit.y, hit.z)).toBeCloseTo(1);
});

test('contact direction is stored relative to the ship and rotates with the shield', () => {
  const p = { x: 10, z: -4, angle: Math.PI / 2 };
  const hit = shieldImpact(p, { x: 20, z: -4 }, 15, false);
  expect(Math.abs(hit.x)).toBeLessThan(0.001); expect(hit.z).toBeGreaterThan(0.9);
  const contact = shieldContact(p, hit); expect(contact.x).toBeGreaterThan(p.x + 1.7); expect(contact.z).toBeCloseTo(p.z);
  p.angle = 0; const rotated = shieldContact(p, hit); expect(rotated.x).toBeCloseTo(p.x); expect(rotated.z).toBeGreaterThan(p.z + 1.7);
});

test('missing, coincident or invalid contact sources produce a finite forward patch', () => {
  const p = { x: 3, z: 8, angle: 2 };
  for (const source of [undefined, { x: 3, z: 8 }, { x: Infinity, z: NaN }]) {
    const hit = shieldImpact(p, source, 10, false);
    expect([hit.x, hit.y, hit.z, hit.power].every(Number.isFinite)).toBe(true); expect(hit.z).toBeGreaterThan(0.9);
  }
});

test('absorption lights a patch and emits contact sparks without a full-core shockwave', () => {
  game.hurt(10, { x: 8, z: 0 });
  expect(game.shield).toBe(30); expect(game.player.hp).toBe(100); expect(game.shieldHits).toHaveLength(1);
  expect(game.shieldHits[0].x).toBeGreaterThan(0.9); expect(game.shieldHits[0].broken).toBe(false);
  expect(game.shockwaves).toHaveLength(0); expect(game.particles[0].x).toBeGreaterThan(1.5);
  game.hurt(10, { x: -8, z: 0 }); expect(game.shieldHits).toHaveLength(1);
});

test('the last absorbed charge leaves one brief collapse patch; bare hull hits cannot add one', () => {
  game.shield = 5; game.hurt(15, { x: 0, z: -8 });
  expect(game.player.hp).toBe(90); expect(game.shield).toBe(0); expect(game.shieldHits[0].broken).toBe(true);
  expect(game.shieldHits[0].z).toBeLessThan(-0.9);
  game.player.invulnerable = 0; game.hurt(10); expect(game.shieldHits).toHaveLength(1); expect(game.player.hp).toBe(80);
});

test('impact lifetime freezes on pause, expires in simulation time, and clears on restart', () => {
  game.hurt(10); useGame.getState().setPhase('paused'); game.tick(5); expect(game.shieldHits[0].age).toBe(0);
  useGame.getState().setPhase('playing'); game.hitStop = 0;
  for (let i = 0; i < 45; i++) game.tick(1 / 60);
  expect(game.shieldHits).toHaveLength(0);
  game.player.invulnerable = 0; game.hurt(10); expect(game.shieldHits).toHaveLength(1); game.reset(); expect(game.shieldHits).toHaveLength(0);
});

test('simultaneous absorbed impacts retain the newest patches within the GPU budget', () => {
  game.shield = 100;
  for (let i = 0; i < 20; i++) { game.player.invulnerable = 0; game.hurt(1, { x: i + 1, z: 1 }); }
  expect(game.shieldHits).toHaveLength(SHIELD_IMPACT.capacity); expect(game.shieldHits.at(-1)?.x).toBeGreaterThan(game.shieldHits[0].x);
});

test('real projectile, contact and hazard paths supply their impact directions', () => {
  game.bolts.push({ x: 0, z: -0.5, vx: 0, vz: 10, age: 0, enemy: true, target: 0, damage: 10 });
  game.tick(1 / 60); expect(game.shieldHits).toHaveLength(1); expect(game.shieldHits[0].z).toBeLessThan(-0.8);
  game.reset(); game.player.invulnerable = 0; game.spawn(0, 0.4, 0); game.tick(1 / 60);
  expect(game.shieldHits[0].x).toBeGreaterThan(0.9);
  game.reset(); game.player.invulnerable = 0; game.addHazard(-1, 0, 3, 0.01); game.tick(0.02);
  expect(game.shieldHits[0].x).toBeLessThan(-0.9);
});

test('directional shield visuals do not consume additional gameplay randomness', () => {
  const control = new GameEngine(273); control.burst(0, 0, '#72dfff', 20);
  game.hurt(10, { x: 0, z: 5 }); expect(game.random()).toBe(control.random());
});
