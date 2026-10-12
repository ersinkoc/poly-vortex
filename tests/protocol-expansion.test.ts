import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { GameEngine, LIMITS } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { sectorAt } from '../src/game/progression';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE), peakCombo: 1, level: 1 });
  game = new GameEngine(101); game.reset();
});

describe('expanded protocol combat', () => {
  test('shield absorbs damage and only recharges after its recovery delay', () => {
    game.player.invulnerable = 0; game.hurt(30); expect(game.shield).toBe(10); expect(game.player.hp).toBe(100);
    game.hitStop = 0; game.tick(0.1); expect(game.shield).toBe(10);
    game.shieldDelay = 0; game.tick(0.1); expect(game.shield).toBeGreaterThan(10);
    game.player.invulnerable = 0; game.hurt(50); expect(game.shield).toBe(0); expect(game.player.hp).toBeLessThan(100);
  });
  test('surge damages nearby hostiles, clears nearby enemy shots, and cannot charge itself', () => {
    game.spawn(0, 0, 5); game.spawn(0, 0, 18);
    game.bolts.push({ x: 2, z: 2, vx: 1, vz: 1, age: 0, enemy: true, target: 0, damage: 10 }, { x: 20, z: 20, vx: 1, vz: 1, age: 0, enemy: true, target: 0, damage: 10 });
    expect(game.activateSurge()).toBe(true); expect(game.kills).toBe(1); expect(game.surge).toBe(0); expect(game.bolts).toHaveLength(1); expect(game.shockwaves.length).toBeGreaterThan(0);
    expect(game.activateSurge()).toBe(false);
  });
  test('paused and ended cores cannot discharge', () => {
    useGame.setState({ phase: 'dead' }); expect(game.activateSurge()).toBe(false); expect(game.surge).toBe(100);
    useGame.setState({ phase: 'paused' }); expect(game.activateSurge()).toBe(false);
  });
  test('elite death drops rare salvage and rewards exactly once', () => {
    game.spawn(0, 0, 5, true); const elite = game.enemies[0]; expect(elite.hp).toBeGreaterThan(16);
    game.hitEnemy(elite, 1000); game.hitEnemy(elite, 1000); expect(game.eliteKills).toBe(1); expect(game.caches).toHaveLength(1);
    game.collectCache(game.caches[0]); expect(game.salvage).toBe(20); expect(game.rewards.active?.source).toBe('salvage'); expect(useGame.getState().phase).toBe('playing');
    expect(game.rewards.active!.choices.every(c => c.rarity !== 'COMMON')).toBe(true);
  });
  test('cache cannot be collected twice while the automatic reel runs', () => {
    const cache = { x: 0, z: 0, age: 0 }; game.collectCache(cache); game.collectCache(cache); expect(game.salvage).toBe(20);
    game.rewards.tick(1.7); game.collectCache(cache); expect(game.salvage).toBe(20); expect(game.player.invulnerable).toBeGreaterThanOrEqual(1);
  });
  test('consecutive caches queue one automatic award each without pausing', () => {
    game.collectCache({ x: 0, z: 0, age: 0 }); game.collectCache({ x: 0, z: 0, age: 0 });
    expect(game.salvage).toBe(40); expect(game.rewards.queued).toBe(1); expect(useGame.getState().rewardQueued).toBe(1); expect(useGame.getState().phase).toBe('playing');
  });
  test('hazards warn before impact and detonate once', () => {
    game.player.invulnerable = 0; game.addHazard(0, 0, 3, 0.2);
    game.tick(0.1); expect(game.shield).toBe(40); expect(game.hazards[0].detonated).toBe(false);
    game.tick(0.1); expect(game.shield).toBe(16); expect(game.hazards[0].detonated).toBe(true);
    game.hitStop = 0; game.player.invulnerable = 0; game.tick(0.1); expect(game.shield).toBe(16);
  });
  test('repair, magnet, and overdrive supplies have distinct effects', () => {
    game.player.hp = 40; game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 }); expect(game.player.hp).toBe(68);
    game.gems.push({ x: 100, z: 100, value: 7, age: 0 }); game.collectSupply({ x: 0, z: 0, type: 'magnet', age: 0 }); expect(game.xp).toBe(7); expect(game.gems[0].value).toBe(0);
    game.collectSupply({ x: 0, z: 0, type: 'overdrive', age: 0 }); expect(game.overdriveTime).toBe(9);
  });
  test('piercing rounds hit distinct enemies without repeatedly damaging the first', () => {
    game.criticalChance = 0; game.spawn(2, 0, 5); game.spawn(2, 0.2, 5); const [a, b] = game.enemies;
    game.bolts.push({ x: 0, z: 5, vx: 0, vz: 0, age: 0, enemy: false, target: 0, damage: 5, pierce: 1, hits: [] });
    game.tick(1 / 60); expect(a.hp).toBe(a.maxHp - 5); game.tick(1 / 60); expect(a.hp).toBe(a.maxHp - 5); expect(b.hp).toBe(b.maxHp - 5);
  });
  test('critical rounds double damage and produce a critical label', () => {
    game.criticalChance = 1; game.spawn(2, 0, 5); const target = game.enemies[0];
    game.bolts.push({ x: 0, z: 5, vx: 0, vz: 0, age: 0, enemy: false, target: 0, damage: 10 }); game.tick(1 / 60);
    expect(target.hp).toBe(target.maxHp - 20); expect(game.damageTexts.some(d => d.critical && d.value === 20)).toBe(true);
  });
  test('boss transitions through three phases and emits warning hazards', () => {
    game.spawn(3, 0, 15); const boss = game.enemies[0]; game.tick(1 / 60); expect(game.bossPhase).toBe(1);
    boss.hp = boss.maxHp * 0.6; game.tick(1 / 60); expect(game.bossPhase).toBe(2); expect(game.hazards.length).toBeGreaterThan(0);
    boss.hp = boss.maxHp * 0.3; game.tick(1 / 60); expect(game.bossPhase).toBe(3); expect(game.announcement).toContain('ENRAGED');
  });
  test('sector boundaries advance exactly and render resources remain capped', () => {
    expect([0, 44.9, 45, 90, 135, 180, 999].map(sectorAt)).toEqual([0, 0, 1, 2, 3, 4, 4]);
    for (let i = 0; i < 100; i++) { game.wave(0, 0, 5, '#fff'); game.addHazard(0, 0); }
    expect(game.shockwaves).toHaveLength(LIMITS.shockwaves); expect(game.hazards).toHaveLength(LIMITS.hazards);
  });
  test('a restart clears hazards, salvage, buffs, queued rewards, and surge inputs', () => {
    game.addHazard(0, 0); game.overdriveTime = 8; game.salvage = 100; game.rewards.enqueue('salvage', 1); game.input.surge = true; game.reset();
    expect(game.hazards).toHaveLength(0); expect(game.salvage).toBe(0); expect(game.overdriveTime).toBe(0); expect(game.rewards.active).toBeNull(); expect(game.rewards.queued).toBe(0); expect(game.input.surge).toBe(false);
  });
  test('pause suspends the automatic reward reel', () => {
    game.xp = 12; game.checkLevel(); useGame.getState().setPhase('paused'); game.tick(2); expect(useGame.getState().phase).toBe('paused'); expect(game.rewards.active?.elapsed).toBe(0); expect(game.rewards.active?.installed).toBe(false);
  });
});

describe('persistent flight records', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  afterEach(() => { if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  test('old saves retain credits and core upgrades when the new record fields are absent', () => {
    const raw = JSON.stringify({ credits: 123, best: 999, runs: 4, wins: 1, upgrades: { armor: 2, reactor: 1, thrusters: 3 } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => raw } }); useGame.getState().hydrate();
    const p = useGame.getState().profile; expect(p.credits).toBe(123); expect(p.upgrades.armor).toBe(2); expect(p.totalKills).toBe(0); expect(p.achievements).toEqual(expect.arrayContaining(['first-run', 'breaker']));
  });
  test('run results include salvage and unlock milestones without duplicates', () => {
    game.peakCombo = 5; game.level = 10; game.publish(); useGame.getState().saveRun(5000, 250, true, 40);
    const s = useGame.getState(); expect(s.earned).toBe(223); expect(s.profile.totalKills).toBe(250); expect(s.profile.achievements).toEqual(expect.arrayContaining(['first-run', 'hunter', 'breaker', 'chain', 'evolution']));
    useGame.getState().saveRun(5000, 250, true, 40); expect(useGame.getState().profile.totalKills).toBe(250);
  });
  test('audio and performance preferences hydrate without overwriting the flight record', () => {
    const records = JSON.stringify({ ...EMPTY_PROFILE, credits: 75 });
    const settings = JSON.stringify({ sound: false, quality: 'performance', difficulty: 'overdrive', loadout: 'tesla' });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'poly-vortex-settings-v1' ? settings : records, setItem: () => {} } });
    useGame.getState().hydrate(); const s = useGame.getState();
    expect(s.sound).toBe(false); expect(s.quality).toBe('performance'); expect(s.loadout).toBe('tesla'); expect(s.profile.credits).toBe(75);
  });
});
