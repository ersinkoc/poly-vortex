import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, aimMode: 'assisted', loadout: 'pulse', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(854); game.reset(); game.player.invulnerable = 100;
});
afterEach(() => useGame.setState({ aimMode: 'assisted' }));
const hostile = (x = 0, z = 8) => { game.spawn(2, x, z); const e = game.enemies.at(-1)!; e.hp = e.maxHp = 10000; return e; };

test('a launch request reports success and spends exactly one round', () => {
  hostile(); expect(game.requestRocket()).toBe(true); expect(game.rocketAmmo).toBe(5); expect(game.rocketNotice).toContain('ROCKET AWAY');
  expect(useGame.getState().launcherStatus).toBe('cycling'); expect(game.requestRocket()).toBe(false); expect(game.rocketAmmo).toBe(5);
});
test('an aligning request waits briefly then launches once at the same hostile', () => {
  const e = hostile(); game.player.angle = 1; expect(game.launcherLock().status).toBe('aligning'); expect(game.requestRocket()).toBe(true);
  expect(game.rocketAmmo).toBe(6); expect(game.rocketPending).toBeGreaterThan(0); expect(game.requestRocket()).toBe(false);
  for (let i = 0; i < 15; i++) game.tick(1 / 60);
  expect(game.rocketAmmo).toBe(5); expect(game.rocketPending).toBe(0); expect(game.rockets[0]?.target).toBe(e.id);
});
test('queued intent never transfers to a replacement hostile', () => {
  const e = hostile(); game.player.angle = 1; game.requestRocket(); e.hp = 0; hostile(1, 8); game.tick(1 / 60);
  expect(game.rocketAmmo).toBe(6); expect(game.rocketPending).toBe(0); expect(game.rocketNotice).toContain('SHOT CANCELLED');
});
test('pause, ended runs and restart cancel pending intent without a late launch', () => {
  for (const phase of ['paused', 'dead'] as const) {
    useGame.setState({ phase: 'playing' }); game.reset(); hostile(); game.player.angle = 1; game.requestRocket();
    useGame.setState({ phase }); game.tick(1); expect(game.rocketPending).toBe(0); expect(game.rocketAmmo).toBe(6);
    useGame.setState({ phase: 'playing' }); for (let i = 0; i < 10; i++) game.tick(1 / 60); expect(game.rocketAmmo).toBe(6);
  }
  game.player.angle = 1; game.requestRocket(); game.reset(); expect(game.rocketPending).toBe(0); expect(game.rocketNoticeTime).toBe(0);
});
test('persistent misalignment times out instead of firing into a different heading', () => {
  hostile(); game.input.aiming = true; game.input.aimZ = 10; game.player.angle = 1; game.requestRocket();
  for (let i = 0; i < 60; i++) { game.player.angle = 1; game.tick(1 / 60); }
  expect(game.rocketAmmo).toBe(6); expect(game.rocketPending).toBe(0); expect(game.rocketNotice).toContain('TIMED OUT');
});
test('blocked attempts explain empty racks, missing aim, distance and protected pilots', () => {
  game.rocketAmmo = 0; expect(game.requestRocket()).toBe(false); expect(game.rocketNotice).toContain('RACK EMPTY');
  game.rocketAmmo = 6; useGame.setState({ aimMode: 'precision' }); expect(game.requestRocket()).toBe(false); expect(game.rocketNotice).toContain('AIM REQUIRED');
  useGame.setState({ aimMode: 'assisted' }); hostile(0, 40); expect(game.launcherLock().status).toBe('range'); expect(game.requestRocket()).toBe(false);
  game.enemies = []; hostile(); game.missions.tick(8, game.player, 0, () => 0.5); game.missions.mission!.targets.forEach((t, i) => { t.x = i === 0 ? 0 : 100; t.z = i === 0 ? 4 : 100; });
  expect(game.launcherLock().status).toBe('pilot'); expect(game.requestRocket()).toBe(false); expect(game.rocketNotice).toContain('PILOT'); expect(game.rocketAmmo).toBe(6);
});
test('refill publishes an immediate rack update and explains the actual capped amount', () => {
  game.rocketAmmo = 5; game.collectSupply({ x: 0, z: 0, type: 'ammo', age: 0 });
  expect(useGame.getState().rocketAmmo).toBe(6); expect(game.rocketNotice).toContain('+1 rocket');
  expect(game.requestRocket()).toBe(false); expect(game.rocketNotice).toContain('NO HOSTILE LOCK');
});

test('manual rocket intent is handled before an automatic Tesla hit removes the target', () => {
  game.spawn(0, 0, 8); const e = game.enemies[0]; game.weapons.pulse = 0;
  for (let i = 0; i < 61; i++) game.tick(1 / 60);
  game.enemies = [e]; game.weapons.tesla = 6; game.input.rocket = true; game.tick(1 / 60);
  expect(game.rocketAmmo).toBe(5);
});

test('a rocket airbursts at its last known target position when another weapon kills that hostile', () => {
  const e = hostile(); game.weapons.pulse = 0; expect(game.fireRocket()).toBe(true); e.hp = 0;
  const nearby = hostile(3, 8);
  for (let i = 0; i < 60; i++) game.tick(1 / 60);
  expect(game.rockets).toHaveLength(0); expect(nearby.hp).toBeLessThan(10000); expect(game.rocketAmmo).toBe(5);
});
