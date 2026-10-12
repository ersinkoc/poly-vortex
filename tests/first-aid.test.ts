import { beforeEach, expect, test } from 'bun:test';
import { audio } from '../src/game/audio';
import { GameEngine, LIMITS } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';

let game: GameEngine;
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE), choices: [] });
  game = new GameEngine(101); game.reset();
});
const advance = (seconds: number) => {
  for (let n = 0; n < Math.round(seconds * 60); n++) {
    game.enemies = []; game.bolts = []; game.gems = []; game.hazards = []; game.hitStop = 0; game.tick(1 / 60);
  }
};

test('first-aid repairs immediately and continues at four integrity per second', () => {
  game.player.hp = 20; game.shield = 5;
  const kit = { x: 0, z: 0, type: 'repair' as const, age: 0 };
  game.collectSupply(kit); expect(game.player.hp).toBe(48); expect(game.shield).toBe(20); expect(game.repairTime).toBe(8);
  advance(2); expect(game.player.hp).toBeCloseTo(56, 4); expect(game.repairTime).toBeCloseTo(6, 4);
  game.collectSupply(kit); expect(game.player.hp).toBeCloseTo(56, 4); expect(game.repairTime).toBeCloseTo(6, 4);
  advance(7); expect(game.player.hp).toBeCloseTo(80, 4); expect(game.repairTime).toBe(0);
});
test('first-aid spawns periodically without requiring any kills and respects the pool cap', () => {
  advance(29.9); expect(game.supplies.filter(s => s.type === 'repair')).toHaveLength(0);
  advance(0.2); const kit = game.supplies.find(s => s.type === 'repair'); expect(kit).toBeDefined(); expect(Math.hypot(kit!.x, kit!.z)).toBeCloseTo(6, 4); expect(game.kills).toBe(0);
  expect(game.dropSupply('repair', 10, 10)).toBe(false);
  advance(75); expect(game.supplies.filter(s => s.type === 'repair')).toHaveLength(1);
  game.supplies = Array.from({ length: LIMITS.supplies }, () => ({ x: 100, z: 100, type: 'repair' as const, age: 0 }));
  advance(30); expect(game.supplies).toHaveLength(LIMITS.supplies);
});
test('paused repair freezes and new runs clear its effect and restart its drop timer', () => {
  game.player.hp = 30; game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 });
  useGame.setState({ phase: 'paused' }); game.tick(1); expect(game.player.hp).toBe(58); expect(game.repairTime).toBe(8);
  useGame.setState({ phase: 'playing' }); game.reset(); expect(game.repairTime).toBe(0); expect(useGame.getState().repair).toBe(0); advance(11); expect(game.supplies).toHaveLength(0);
});
test('additional kits refresh fast repair without stacking rates or exceeding maximum integrity', () => {
  game.player.hp = 40; game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 }); advance(2);
  game.collectSupply({ x: 0, z: 0, type: 'repair', age: 0 }); expect(game.player.hp).toBe(100); expect(game.repairTime).toBe(8);
  game.player.hp = 50; advance(1); expect(game.player.hp).toBeCloseTo(54, 4);
  game.player.hp = 99; advance(1); expect(game.player.hp).toBe(100); game.publish(); expect(useGame.getState().repair).toBeCloseTo(6, 4);
});
