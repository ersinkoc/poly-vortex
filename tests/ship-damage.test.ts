import { beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';
import { DAMAGE_LIMITS, DamageTrail, damageHeat, hullDamage, smokeRate } from '../src/game/ship-damage';

let game: GameEngine;
const origins = [{ x: 2, y: 1, z: 3 }, { x: -2, y: 1, z: -3 }];
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(133); game.reset(); game.player.invulnerable = 0;
});

test('damage severity follows integrity ratio, including upgraded hull capacity', () => {
  [100, 90, 60, 30, 0].forEach((hp, i) => expect(hullDamage(hp, 100)).toBeCloseTo([0, 0.1, 0.4, 0.7, 1][i]));
  expect(hullDamage(150, 200)).toBe(0.25); expect(hullDamage(300, 200)).toBe(0); expect(hullDamage(-10, 100)).toBe(1);
  for (const [hp, maxHp] of [[NaN, 100], [50, Infinity], [0, 0], [5, -1]]) expect(hullDamage(hp, maxHp)).toBe(0);
});

test('shield-only hits do not scar the hull; partial absorption exposes real hull loss', () => {
  game.hurt(25); expect(game.player.hp).toBe(100); expect(game.player.hullHit).toBe(0); expect(hullDamage(game.player.hp, game.player.maxHp)).toBe(0);
  expect(game.particles.every(p => p.color === '#72dfff')).toBe(true);
  game.player.invulnerable = 0; game.particles = []; game.hurt(25);
  expect(game.shield).toBe(0); expect(game.player.hp).toBe(90); expect(game.player.hullHit).toBe(0.65);
  expect(game.particles.every(p => p.color === '#ffb16b')).toBe(true);
  game.hurt(100); expect(game.player.hp).toBe(90);
});

test('hull impact decays during play, freezes on pause and clears on restart', () => {
  game.shield = 0; game.hurt(20); game.hitStop = 0;
  useGame.getState().setPhase('paused'); game.tick(1); expect(game.player.hullHit).toBe(0.65);
  useGame.getState().setPhase('playing'); game.tick(0.1); expect(game.player.hullHit).toBeCloseTo(0.45);
  game.reset(); expect(game.player.hullHit).toBe(0); expect(hullDamage(game.player.hp, game.player.maxHp)).toBe(0);
});

test('first aid reduces visible damage and ongoing repair switches off smoke', () => {
  game.player.hp = 20;
  expect(smokeRate(hullDamage(game.player.hp, game.player.maxHp))).toBeGreaterThan(0);
  game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 }); expect(game.player.hp).toBe(48);
  expect(hullDamage(game.player.hp, game.player.maxHp)).toBeCloseTo(0.52);
  for (let i = 0; i < 450; i++) { game.enemies = []; game.bolts = []; game.gems = []; game.tick(1 / 60); }
  expect(game.player.hp).toBeCloseTo(78); expect(smokeRate(hullDamage(game.player.hp, game.player.maxHp))).toBe(0);
});

test('an automatically installed repair reduces visible damage using the new maximum integrity', () => {
  game.player.hp = 40; game.createChoices = () => [{ id: 'repair', title: 'Nanite repair', description: '', rarity: 'RARE', power: 2 }];
  game.xp = game.nextXp; game.checkLevel();
  for (let i = 0; i < 105; i++) game.tick(1 / 60);
  expect(game.player.hp).toBe(110); expect(game.player.maxHp).toBe(120); expect(hullDamage(game.player.hp, game.player.maxHp)).toBeCloseTo(1 / 12);
  game.player.hp = game.player.maxHp; expect(hullDamage(game.player.hp, game.player.maxHp)).toBe(0);
});

test('smoke starts below 60% integrity and exposed hot wiring starts below 35%', () => {
  expect(smokeRate(0.4)).toBe(0); expect(smokeRate(0.6)).toBeGreaterThan(0); expect(damageHeat(0.65)).toBe(0);
  expect(damageHeat(1)).toBe(1); expect(smokeRate(1, false)).toBeLessThan(smokeRate(1));
});

test('dense damaged-engine effects reuse bounded pools with finite world positions', () => {
  const trail = new DamageTrail(), smokePool = trail.smoke, sparkPool = trail.sparks;
  for (let i = 0; i < 600; i++) trail.advance(1 / 60, 1, origins);
  expect(trail.smoke).toBe(smokePool); expect(trail.sparks).toBe(sparkPool);
  expect(trail.smoke).toHaveLength(DAMAGE_LIMITS.smoke); expect(trail.sparks).toHaveLength(DAMAGE_LIMITS.sparks);
  expect(trail.smoke.filter(p => p.age < p.life).length).toBeGreaterThan(10);
  for (const p of [...trail.smoke, ...trail.sparks]) expect(Object.values(p).every(Number.isFinite)).toBe(true);
});

test('damage smoke lingers at its emission point, freezes with zero time, and clears after repair', () => {
  const trail = new DamageTrail(); trail.advance(0.1, 1, origins); const first = trail.smoke.find(p => p.life > 0)!;
  const x = first.x, age = first.age; trail.advance(0, 1, origins); expect(first.age).toBe(age);
  trail.advance(0.1, 1, [{ x: 40, y: 1, z: 40 }]); expect(Math.abs(first.x - x)).toBeLessThan(0.1);
  for (let i = 0; i < 20; i++) trail.advance(0.1, 0, origins);
  expect(trail.smoke.every(p => p.age >= p.life)).toBe(true); expect(trail.sparks.every(p => p.age >= p.life)).toBe(true);
  trail.advance(0.1, 1, origins); trail.reset(); expect(trail.smoke.every(p => p.life === 0)).toBe(true);
});

test('procedural damage effects are deterministic and leave combat randomness untouched', () => {
  const a = new DamageTrail(), b = new DamageTrail(), control = new GameEngine(133);
  for (let i = 0; i < 100; i++) { a.advance(1 / 60, 0.9, origins); b.advance(1 / 60, 0.9, origins); }
  expect(a.smoke).toEqual(b.smoke); expect(a.sparks).toEqual(b.sparks); expect(game.random()).toBe(control.random());
});
