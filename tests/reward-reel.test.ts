import { beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { RewardReel, reelPosition, REEL_TIMING } from '../src/game/reward-reel';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE, type Upgrade } from '../src/game/types';

let game: GameEngine;
const award = (id: Upgrade['id'], power = 1): Upgrade => ({ id, power, title: id, description: '', rarity: power > 1 ? 'RARE' : 'COMMON' });
const advance = (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) game.tick(1 / 60); };
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE) });
  game = new GameEngine(674); game.reset(); game.player.invulnerable = 100;
});

test('a cache installs only its preselected random winner and never pauses combat', () => {
  game.createChoices = () => [award('damage'), award('speed'), award('magnet')];
  game.collectCache({ x: 0, z: 0, age: 0 }); const roll = game.rewards.active!;
  expect(useGame.getState().phase).toBe('playing'); expect(roll.installed).toBe(false);
  game.input.keys.add('KeyD'); advance(1.6);
  expect(game.time).toBeGreaterThan(1.5); expect(game.player.x).toBeGreaterThan(5);
  expect([game.damage, game.speed, game.magnet]).toEqual([1, 1, 1]);
  advance(0.15); expect(roll.installed).toBe(true);
  const values = [game.damage, game.speed, game.magnet], expected = [1, 1, 1]; expected[roll.winner] += [0.2, 0.12, 0.3][roll.winner];
  expect(values).toEqual(expected); expect(useGame.getState().reward?.installed).toBe(true);
  advance(0.5); expect([game.damage, game.speed, game.magnet]).toEqual(expected);
  expect(game.salvage).toBe(20);
});

test('multiple overlapping crates are consumed once and every reward drains in FIFO order', () => {
  game.createChoices = () => [award('damage', 2)];
  const caches = Array.from({ length: 4 }, () => ({ x: 0, z: 0, age: 0 }));
  caches.forEach(c => { game.collectCache(c); game.collectCache(c); });
  expect(game.salvage).toBe(80); expect(game.rewards.queued).toBe(3);
  for (let n = 1; n <= 4; n++) {
    expect(game.rewards.active?.id).toBe(n); advance(1.75);
    expect(game.damage).toBeCloseTo(1 + n * 0.4); expect(game.rewards.active?.installed).toBe(true);
    advance(1.35);
  }
  expect(game.rewards.active).toBeNull(); expect(game.rewards.queued).toBe(0); expect(useGame.getState().reward).toBeNull();
});

test('pause and ended runs cannot install an award; restart discards pending awards', () => {
  game.createChoices = () => [award('damage')]; game.collectCache({ x: 0, z: 0, age: 0 });
  advance(0.5); const elapsed = game.rewards.active!.elapsed;
  useGame.getState().setPhase('paused'); advance(3);
  expect(game.damage).toBe(1); expect(game.rewards.active!.elapsed).toBe(elapsed);
  useGame.getState().setPhase('playing'); advance(1.25); expect(game.damage).toBe(1.2);
  game.collectCache({ x: 0, z: 0, age: 0 }); useGame.setState({ phase: 'dead' }); advance(5);
  expect(game.damage).toBe(1.2); game.reset();
  expect(game.rewards.active).toBeNull(); expect(game.rewards.queued).toBe(0); expect(useGame.getState().reward).toBeNull();
});

test('queued candidates are generated after installation and exclude maxed modules', () => {
  game.weapons.pulse = 5;
  const factory = game.createChoices.bind(game); let calls = 0;
  game.createChoices = salvage => ++calls === 1 ? [award('pulse', 3)] : factory(salvage);
  game.collectCache({ x: 0, z: 0, age: 0 }); game.collectCache({ x: 0, z: 0, age: 0 });
  expect(calls).toBe(1); advance(3.1);
  expect(game.weapons.pulse).toBe(6); expect(calls).toBe(2);
  expect(game.rewards.active!.choices.some(u => u.id === 'pulse')).toBe(false);
  expect(game.rewards.active!.choices.every(u => u.rarity !== 'COMMON')).toBe(true);
});

test('magnet XP and same-tick crates queue without losing either source', () => {
  game.caches.push({ x: 0, z: 0, age: 0 }, { x: 0, z: 0, age: 0 });
  game.gems.push({ x: 50, z: 50, value: 100, age: 0 });
  game.collectSupply({ x: 0, z: 0, type: 'magnet', age: 0 }); game.tick(1 / 60);
  expect(game.level).toBe(4); expect(game.xp).toBe(18); expect(game.salvage).toBe(40);
  expect(game.caches).toHaveLength(0); expect(game.rewards.queued).toBe(4); expect(useGame.getState().phase).toBe('playing');
  expect(game.rewards.active!.source).toBe('salvage');
});

test('an automatic upgrade roll preserves a queued rocket launch', () => {
  game.spawn(2, 0, 8); game.enemies[0].hp = game.enemies[0].maxHp = 10000;
  game.player.angle = 1; expect(game.requestRocket()).toBe(true); expect(game.rocketPending).toBeGreaterThan(0);
  game.xp = game.nextXp; game.checkLevel(); advance(0.25);
  expect(game.rocketAmmo).toBe(5); expect(game.rockets).toHaveLength(1); expect(game.rewards.active?.installed).toBe(false);
  expect(useGame.getState().phase).toBe('playing');
});

test('random selection covers every candidate; the reel stops on exactly that candidate', () => {
  const choices = [award('damage'), award('speed'), award('magnet')];
  for (const random of [0, 0.4, 0.999999]) {
    const installed: Upgrade[] = [];
    const reel = new RewardReel(() => choices, () => random, u => { installed.push(u); return []; });
    reel.enqueue('level', 2); const roll = reel.active!;
    expect(reelPosition(roll)).toBe(0); reel.tick(REEL_TIMING.spin);
    expect(installed).toEqual([choices[Math.floor(random * 3)]]);
    expect(reelPosition(roll) % choices.length).toBe(roll.winner);
    expect(reelPosition(roll, true)).toBe(reelPosition(roll));
    reel.tick(0.2); expect(installed).toHaveLength(1);
  }
});

test('reduced motion holds one symbol during decoding without changing the award timer', () => {
  const reel = new RewardReel(() => [award('speed'), award('damage')], () => 0.9, () => []);
  reel.enqueue('salvage', 1); const roll = reel.active!;
  reel.tick(0.8); expect(reelPosition(roll, true)).toBe(0); expect(roll.installed).toBe(false);
  reel.tick(1); expect(roll.installed).toBe(true); expect(reelPosition(roll, true) % 2).toBe(1);
});

test('invalid clock input cannot resolve a reward or consume its queue', () => {
  let installed = 0; const reel = new RewardReel(() => [award('damage')], () => 0, () => { installed++; return []; });
  reel.enqueue('level', 2); reel.enqueue('salvage', 2);
  for (const dt of [NaN, Infinity, -1, 0]) expect(reel.tick(dt)).toBe(false);
  expect(reel.active!.elapsed).toBe(0); expect(reel.queued).toBe(1); expect(installed).toBe(0);
});
