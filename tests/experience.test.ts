import { afterEach, beforeEach, expect, test } from 'bun:test';
import { EncounterDirector } from '../src/game/director';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE, type Upgrade } from '../src/game/types';
import { audio } from '../src/game/audio';
import { previewUpgrade } from '../src/game/upgrade-preview';
import { navigationSignals } from '../src/game/navigation';

let game: GameEngine;
const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const media = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', aimMode: 'assisted', reducedEffects: false, profile: structuredClone(EMPTY_PROFILE), choices: [] });
  game = new GameEngine(342); game.reset(); game.player.invulnerable = 100;
});
afterEach(() => {
  if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else Reflect.deleteProperty(globalThis, 'localStorage');
  if (media) Object.defineProperty(globalThis, 'matchMedia', media); else Reflect.deleteProperty(globalThis, 'matchMedia');
  useGame.setState({ aimMode: 'assisted', reducedEffects: false });
});

test('encounters build, peak, recover, and begin another wave without changing damage', () => {
  const d = new EncounterDirector(); d.tick(12, 0, false); expect(d.phase).toBe('buildup');
  d.tick(16, 0, false); expect(d.phase).toBe('assault'); expect(d.spawnRate).toBeGreaterThan(1);
  d.tick(12, 0, false); expect(d.phase).toBe('recovery'); expect(d.spawnRate).toBe(0);
  d.tick(8, 0, false); expect(d.phase).toBe('buildup'); expect(d.round).toBe(2);
});
test('high pressure earns bounded relief, then reinforcements resume', () => {
  const d = new EncounterDirector(); d.tick(12, 0, false); d.tick(6, 1, false);
  expect(d.phase).toBe('recovery'); d.tick(8, 1, false); expect(d.phase).toBe('buildup');
  d.tick(6, 1, false); expect(d.phase).toBe('buildup'); expect(d.spawnRate).toBe(1);
});
test('successful operations cannot extend recovery indefinitely or interrupt a boss', () => {
  const d = new EncounterDirector(); d.tick(12, 0, false); d.recover(); d.tick(3, 0, false);
  d.recover(); expect(d.remaining).toBe(5); d.tick(1, 1, true); d.recover(); expect(d.phase).toBe('sentinel'); expect(d.spawnRate).toBeGreaterThan(0);
  d.reset(); expect(d.phase).toBe('insertion'); expect(d.round).toBe(1);
});
test('engine suspends reinforcements during recovery but preserves existing threats', () => {
  game.spawn(0, 0, 12); const enemy = game.enemies[0]; game.director.recover(); game.weapons.pulse = 0;
  // Aim into an empty lane; the existing hostile should continue moving.
  game.input.aiming = true; game.input.aimZ = -10;
  for (let i = 0; i < 120; i++) game.tick(1 / 60);
  expect(game.enemies).toHaveLength(1); expect(enemy.z).toBeLessThan(12); expect(enemy.hp).toBe(enemy.maxHp);
  game.publish(); expect(useGame.getState().encounter).toBe('recovery');
  useGame.setState({ phase: 'paused' }); const remaining = game.director.remaining; game.tick(3); expect(game.director.remaining).toBe(remaining);
});
test('precision holds automatic fire and rocket ammunition when the pointer is absent', () => {
  useGame.setState({ aimMode: 'precision' }); game.spawn(0, 0, 6); game.tick(1 / 60);
  expect(game.targetId).toBe(0); expect(game.bolts.filter(b => !b.enemy)).toHaveLength(0); expect(game.fireRocket()).toBe(false); expect(game.rocketAmmo).toBe(6);
  game.input.aiming = true; game.input.aimZ = 10; game.tick(1 / 60);
  expect(game.targetId).toBe(game.enemies[0].id); expect(game.bolts.some(b => !b.enemy)).toBe(true);
  game.input.aiming = false; game.tick(1 / 60); expect(game.targetId).toBe(0);
});
test('assisted mode still acquires a visible hostile for keyboard play', () => {
  game.spawn(0, 0, 6); game.tick(1 / 60); expect(game.targetId).toBe(game.enemies[0].id);
});
test('upgrade previews show actual clamped module levels and blade counts', () => {
  const u: Upgrade = { id: 'glaive', power: 3, rarity: 'OVERCLOCKED', title: '', description: '' };
  game.weapons.glaive = 5;
  const rows = previewUpgrade({ ...game, ...game.player }, u);
  expect(rows[0].after).toBe('LV 6'); expect(rows[1].after).toBe('7');
  useGame.setState({ phase: 'upgrade', choices: [u] }); game.applyUpgrade(u); expect(game.weapons.glaive).toBe(6);
});
test('previewed repair and critical chance match actual capped installation', () => {
  game.player.hp = 99; game.criticalChance = 0.73;
  const u: Upgrade = { id: 'repair', power: 2, rarity: 'RARE', title: '', description: '' };
  const rows = previewUpgrade({ ...game, ...game.player }, u); expect(rows[1].after).toBe('120 HP');
  useGame.setState({ phase: 'upgrade', choices: [u] }); game.applyUpgrade(u); expect(game.player.hp).toBe(120);
  u.id = 'critical'; const critical = previewUpgrade({ ...game, ...game.player }, u); expect(critical[0].after).toBe('75%');
  useGame.setState({ phase: 'upgrade', choices: [u] }); game.applyUpgrade(u); expect(game.criticalChance).toBe(0.75);
});
test('navigation prioritizes an unfinished pilot and only needed live supplies', () => {
  game.missions.tick(8, game.player, 0, () => 0.5);
  const m = game.missions.mission!; m.targets[0].done = true; m.targets[1].x = 2; m.targets[1].z = 0; m.targets[2].x = 20;
  game.player.hp = 50;
  const supplies = [{ x: 6, z: 0, type: 'repair' as const, age: 0 }, { x: 1, z: 0, type: 'repair' as const, age: 100 }, { x: 4, z: 0, type: 'ammo' as const, age: 0 }];
  const signals = navigationSignals(game.player, m, supplies, 2);
  expect(signals).toHaveLength(3); expect(signals[0].x).toBe(2); expect(signals[1].x).toBe(6); expect(signals[2].label).toBe('AMMO RELOAD');
  game.player.hp = 100; m.status = 'complete'; expect(navigationSignals(game.player, m, supplies, 6)).toHaveLength(0);
});
test('new preferences persist independently while legacy records and settings survive', () => {
  const saved = new Map<string, string>();
  saved.set('poly-vortex-profile-v1', JSON.stringify({ ...EMPTY_PROFILE, credits: 240 }));
  saved.set('poly-vortex-settings-v1', JSON.stringify({ quality: 'performance', aimMode: 'precision', reducedEffects: true }));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) } });
  useGame.getState().hydrate(); expect(useGame.getState().aimMode).toBe('precision'); expect(useGame.getState().reducedEffects).toBe(true); expect(useGame.getState().profile.credits).toBe(240);
  useGame.setState({ aimMode: 'assisted' }); expect(JSON.parse(saved.get('poly-vortex-settings-v1')!).reducedEffects).toBe(true);
  expect(JSON.parse(saved.get('poly-vortex-profile-v1')!).credits).toBe(240);
});
test('reduced motion follows the system preference until explicitly overridden', () => {
  let preference: string | null = null;
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key.includes('settings') ? preference : null, setItem: () => {} } });
  useGame.getState().hydrate(); expect(useGame.getState().reducedEffects).toBe(true);
  preference = JSON.stringify({ reducedEffects: false }); useGame.getState().hydrate(); expect(useGame.getState().reducedEffects).toBe(false);
});

test('system motion detection does not overwrite saved settings before hydration reads them', () => {
  useGame.setState({ quality: 'high', aimMode: 'assisted', reducedEffects: false });
  const saved = new Map([['poly-vortex-settings-v1', JSON.stringify({ quality: 'performance', aimMode: 'precision', reducedEffects: false, sound: false })]]);
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) } });
  useGame.getState().hydrate(); expect(useGame.getState().aimMode).toBe('precision'); expect(useGame.getState().quality).toBe('performance'); expect(useGame.getState().reducedEffects).toBe(false); expect(useGame.getState().sound).toBe(false);
});
