import { beforeEach, expect, test } from 'bun:test';
import { buildVfxTextures, DESTRUCTION, rubbleAt, VISUAL_LIMITS, wreckFragment } from '../src/game/visuals';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, aimMode: 'assisted', loadout: 'pulse', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(75); game.reset(); game.player.invulnerable = 100;
});
test('procedural effect sprites are deterministic with transparent borders and visible centers', () => {
  const a = buildVfxTextures(32), b = buildVfxTextures(32);
  try {
    for (const key of ['fire', 'glow', 'smoke', 'scorch'] as const) {
      const pixels = a[key].image.data!; expect(pixels).toEqual(b[key].image.data!); expect(pixels.length).toBe(32 * 32 * 4); expect(a[key].colorSpace).toBe('');
      expect(pixels[(16 * 32 + 16) * 4 + 3]).toBeGreaterThan(60);
      for (let i = 0; i < 32; i++) { expect(pixels[i * 4 + 3]).toBe(0); expect(pixels[(31 * 32 + i) * 4 + 3]).toBe(0); expect(pixels[(i * 32) * 4 + 3]).toBe(0); expect(pixels[(i * 32 + 31) * 4 + 3]).toBe(0); }
    }
  } finally { [...Object.values(a), ...Object.values(b)].forEach(t => t.dispose()); }
});
test('dense explosions preserve the newest blast and remain inside visual pool budgets', () => {
  for (let i = 0; i < 100; i++) game.blast(i, 0, 2);
  expect(game.blasts).toHaveLength(VISUAL_LIMITS.blasts); expect(game.blasts.at(-1)?.x).toBe(99); expect(game.scorches).toHaveLength(VISUAL_LIMITS.scorches);
  expect(VISUAL_LIMITS.blasts * 6).toBeLessThanOrEqual(VISUAL_LIMITS.puffs); expect(VISUAL_LIMITS.blasts * 8).toBeLessThanOrEqual(VISUAL_LIMITS.debris);
});
test('energy discharges do not leave fire scars and visual noise never changes gameplay randomness', () => {
  const control = new GameEngine(75); for (let i = 0; i < 50; i++) game.blast(i, 0, 2, '#84ddff', true);
  expect(game.scorches).toHaveLength(0); expect(game.random()).toBe(control.random());
});
test('visual lifetimes freeze on pause, expire during play and clear on restart', () => {
  game.blast(0, 0, 2); useGame.setState({ phase: 'paused' }); game.tick(5); expect(game.blasts[0].age).toBe(0); expect(game.scorches[0].age).toBe(0);
  useGame.setState({ phase: 'playing' });
  for (let i = 0; i < 1450; i++) { game.enemies = []; game.bolts = []; game.gems = []; game.hazards = []; game.tick(1 / 60); }
  expect(game.blasts).toHaveLength(0); expect(game.scorches).toHaveLength(0); game.blast(0, 0, 2); game.reset(); expect(game.blasts).toHaveLength(0); expect(game.scorches).toHaveLength(0);
});
test('enemy destruction emits one size-appropriate explosion and rocket detonation cannot duplicate it', () => {
  game.spawn(2, 0, 8); game.hitEnemy(game.enemies[0], 10000); expect(game.blasts).toHaveLength(1); expect(game.scorches).toHaveLength(1);
  const rocket = { x: 20, z: 20, vx: 0, vz: 14, target: 0, age: 0, traveled: 0, trail: 0 }; game.explodeRocket(rocket); game.explodeRocket(rocket); expect(game.blasts).toHaveLength(2);
});
test('decorative rubble is deterministic, finite and remains below the weapon firing plane', () => {
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) for (let i = 0; i < 4; i++) {
    const a = rubbleAt(x, z, i); expect(a).toEqual(rubbleAt(x, z, i)); expect(Object.values(a).every(Number.isFinite)).toBe(true); expect(a.x).toBeGreaterThanOrEqual(x * 16); expect(a.x).toBeLessThan((x + 1) * 16); expect(a.height).toBeLessThan(0.31);
  }
});


test('all vehicle classes leave physical wreck effects, while energy bursts remain clean', () => {
  for (const kind of [0, 1, 2, 3] as const) {
    game.enemies = []; game.spawn(kind, 12, 0); const e = game.enemies[0]; game.hitEnemy(e, 100000);
    const blast = game.blasts.at(-1)!; expect(blast.energy).toBe(false); expect(blast.y).toBeCloseTo(e.radius * 0.75 + 0.3, 8);
    const count = game.blasts.length; game.hitEnemy(e, 100000); expect(game.blasts.length).toBe(count);
  }
  game.blast(20, 0, 2, '#84ddff', true); expect(game.blasts.at(-1)!.energy).toBe(true);
});

test('wreckage fragments fall from their actual altitude, bounce and settle without visual RNG affecting combat', () => {
  const b = { id: 7, x: 0, y: 3, z: 0, age: 0, size: 2, color: '#ffab65', energy: false }, ground = () => 0.2;
  for (let j = 0; j < DESTRUCTION.debrisCount; j++) {
    const start = wreckFragment(b, j, ground); expect(start.y).toBe(3);
    for (let i = 0; i <= 60; i++) {
      const p = wreckFragment({ ...b, age: i / 10 }, j, ground); expect(Object.values(p).every(Number.isFinite)).toBe(true); expect(p.y).toBeGreaterThanOrEqual(0.29 - 1e-8);
    }
    const rest = wreckFragment({ ...b, age: 5 }, j, ground); expect(rest.y).toBeCloseTo(0.29, 8); expect(rest.spin).toBeLessThan(5);
    expect(wreckFragment({ ...b, age: 6 }, j, ground).fade).toBe(0);
  }
});

test('a lethal core hit emits exactly one physical wreck without duplicate run rewards', () => {
  game.player.invulnerable = 0; game.shield = 0; game.hurt(10000);
  expect(useGame.getState().phase).toBe('dead'); expect(game.blasts).toHaveLength(1); expect(game.blasts[0].energy).toBe(false);
  const runs = useGame.getState().profile.runs; game.hurt(10000); expect(game.blasts).toHaveLength(1); expect(useGame.getState().profile.runs).toBe(runs);
});
