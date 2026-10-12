import { beforeEach, describe, expect, test } from 'bun:test';
import { GameEngine, LIMITS, RUN_DURATION } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE), earned: 0 });
  game = new GameEngine(42); game.reset();
});

describe('combat simulation', () => {
  test('movement has inertia and diagonal movement is normalized', () => {
    game.input.keys.add('KeyD'); for (let i = 0; i < 60; i++) game.tick(1 / 60);
    const straight = game.player.x; const beforeRelease = game.player.vx;
    game.input.keys.clear(); game.tick(1 / 60); expect(game.player.vx).toBeGreaterThan(0); expect(game.player.vx).toBeLessThan(beforeRelease);
    game.reset(); game.input.keys.add('KeyD'); game.input.keys.add('KeyW'); for (let i = 0; i < 60; i++) game.tick(1 / 60);
    expect(Math.hypot(game.player.x, game.player.z)).toBeCloseTo(straight, 4);
  });
  test('dash grants invulnerability and cannot be retriggered on cooldown', () => {
    game.player.invulnerable = 0; game.input.keys.add('KeyD'); game.input.dash = true; game.tick(1 / 60);
    expect(game.player.dashCooldown).toBeGreaterThan(2.9); expect(game.player.vx).toBe(32);
    game.hurt(90); expect(game.player.hp).toBe(100);
    game.input.dash = true; game.tick(1 / 60); expect(game.player.dashCooldown).toBeLessThan(3);
  });
  test('auto-fire kills a nearby chaser and leaves collectible XP', () => {
    game.spawn(0, 0, 5); for (let i = 0; i < 70; i++) game.tick(1 / 60);
    expect(game.kills).toBeGreaterThan(0); expect(game.score).toBeGreaterThan(0); expect(game.gems.length + game.xp).toBeGreaterThan(0);
  });
  test('a goliath death deals splash damage without duplicate rewards', () => {
    game.spawn(2, 0, 5); game.spawn(0, 0, 6); const goliath = game.enemies[0];
    game.hitEnemy(goliath, 10000); expect(game.kills).toBe(2); expect(game.gems).toHaveLength(2);
    game.hitEnemy(goliath, 10000); expect(game.kills).toBe(2);
  });
  test('orbiters emit hostile projectile rings', () => {
    game.spawn(1, 0, 8); game.enemies[0].timer = 0; game.tick(1 / 60);
    expect(game.bolts.filter(b => b.enemy)).toHaveLength(8);
  });
  test('every specialized loadout remains capable of firing the basic cannon', () => {
    useGame.setState({ loadout: 'cryo' }); game.reset(); expect(game.weapons.cryo).toBe(1); expect(game.weapons.pulse).toBe(1);
    game.spawn(0, 0, 5); game.tick(1 / 60); expect(game.bolts.some(b => !b.enemy)).toBe(true);
  });
  test('orbital blades damage enemies at their orbit', () => {
    game.weapons.glaive = 1; game.spawn(2, 3, 0); const enemy = game.enemies[0], hp = enemy.hp;
    for (let i = 0; i < 10; i++) game.tick(1 / 60); expect(enemy.hp).toBeLessThan(hp);
  });
  test('cryo generates gravity wells and damages enemies within them', () => {
    game.weapons.cryo = 1; game.spawn(2, 0, 8); const enemy = game.enemies[0], hp = enemy.hp;
    for (let i = 0; i < 155; i++) game.tick(1 / 60); expect(game.vortices.length).toBeGreaterThan(0); expect(enemy.hp).toBeLessThan(hp);
  });
  test('tesla chains through nearby distinct enemies', () => {
    game.weapons.tesla = 3; for (let i = 0; i < 5; i++) game.spawn(2, i * 2, 8);
    for (let i = 0; i < 65; i++) game.tick(1 / 60);
    expect(game.arcs.length).toBeGreaterThan(0); expect(game.arcs[0].points).toHaveLength(6);
  });
  test('enemy and debris pools are bounded', () => {
    for (let i = 0; i < 500; i++) game.spawn(0);
    for (let i = 0; i < 100; i++) game.burst(0, 0, '#fff', 30);
    expect(game.enemies).toHaveLength(LIMITS.enemies); expect(game.particles).toHaveLength(LIMITS.particles);
  });
  test('the sentinel always spawns when a full enemy pool reaches the extraction time', () => {
    game.time = RUN_DURATION; for (let i = 0; i < LIMITS.enemies; i++) game.spawn(0);
    game.tick(1 / 60); expect(game.enemies.some(e => e.kind === 3)).toBe(true); expect(game.enemies.length).toBeLessThanOrEqual(LIMITS.enemies);
  });
});

describe('run lifecycle and progression', () => {
  test('pause freezes simulation, movement, and damage', () => {
    useGame.setState({ phase: 'paused' }); game.input.keys.add('KeyD'); game.player.invulnerable = 0;
    game.tick(1); game.hurt(100); expect(game.time).toBe(0); expect(game.player.x).toBe(0); expect(game.player.hp).toBe(100);
  });
  test('XP starts an automatic reel while combat and movement continue', () => {
    game.xp = game.nextXp; game.checkLevel(); const roll = game.rewards.active!;
    expect(useGame.getState().phase).toBe('playing'); expect(roll.choices).toHaveLength(3); expect(new Set(roll.choices.map(c => c.id)).size).toBe(3);
    game.input.keys.add('KeyD'); game.tick(0.1); expect(game.time).toBeGreaterThan(0); expect(game.player.x).toBeGreaterThan(0);
    expect(roll.installed).toBe(false); expect(game.level).toBe(2);
  });
  test('the reel does not install a module before its spin finishes', () => {
    game.xp = 12; game.checkLevel(); const roll = game.rewards.active!;
    game.tick(0.1); expect(roll.installed).toBe(false); expect(useGame.getState().reward?.installed).toBe(false); expect(useGame.getState().phase).toBe('playing');
  });
  test('multiple levels worth of XP queue all rewards without discarding XP', () => {
    game.xp = 100; game.checkLevel();
    expect(game.level).toBe(4); expect(game.xp).toBe(18); expect(game.rewards.queued).toBe(2); expect(useGame.getState().phase).toBe('playing');
    expect(game.rewards.active?.level).toBe(2);
  });
  test('taking damage resets combo and a lethal hit ends a run exactly once', () => {
    game.player.invulnerable = 0; game.combo = 5; game.streak = 48; game.hurt(10); expect(game.combo).toBe(1);
    game.player.invulnerable = 0; game.hurt(200); expect(useGame.getState().phase).toBe('dead'); expect(useGame.getState().profile.runs).toBe(1);
    useGame.getState().saveRun(999, 999, false); expect(useGame.getState().profile.runs).toBe(1);
  });
  test('destroying the sentinel wins and earns extraction credits', () => {
    useGame.setState({ runMode: 'classic' }); game.reset();
    game.spawn(3, 0, 12); game.hitEnemy(game.enemies[0], 100000);
    const s = useGame.getState(); expect(s.phase).toBe('won'); expect(s.profile.wins).toBe(1); expect(s.earned).toBe(100); expect(s.profile.best).toBe(10000);
  });
  test('new runs clear transient effects, input, weapons, and score', () => {
    game.spawn(2); game.weapons.tesla = 5; game.score = 500; game.input.dash = true; game.input.keys.add('KeyW'); game.burst(0, 0, '#fff'); game.time = 100;
    game.reset(); expect(game.enemies).toHaveLength(0); expect(game.particles).toHaveLength(0); expect(game.score).toBe(0); expect(game.time).toBe(0); expect(game.input.dash).toBe(false); expect(game.input.keys.size).toBe(0); expect(game.weapons.tesla).toBe(0);
  });
  test('restarting clears the previous run explosion pulse timestamp', () => {
    game.time = 140; game.pulse = { x: 25, z: 30, time: 139 }; game.reset();
    expect(game.pulse.time).toBeLessThan(0); expect(game.pulse.x).toBe(0); expect(game.pulse.z).toBe(0);
  });
  test('core purchases require credits, cap at five, and improve the next run', () => {
    useGame.getState().purchase('armor'); expect(useGame.getState().profile.upgrades.armor).toBe(0);
    useGame.setState({ profile: { ...structuredClone(EMPTY_PROFILE), credits: 1000 } });
    for (let i = 0; i < 7; i++) useGame.getState().purchase('armor'); expect(useGame.getState().profile.upgrades.armor).toBe(5); expect(useGame.getState().profile.credits).toBe(250);
    useGame.getState().start(); game.reset(); expect(game.player.maxHp).toBe(175);
  });
});
