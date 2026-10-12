import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { CHARGE_RULES, chargeRemaining } from '../src/game/ground-charges';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { terrainHeight, terrainImpact, terrainProp } from '../src/game/terrain';
import { navigationSignals } from '../src/game/navigation';

let game: GameEngine;
const previous = useGame.getState();
beforeEach(() => {
  audio.enabled = false;
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', runMode: 'expedition', profile: structuredClone(EMPTY_PROFILE), aimMode: 'precision' });
  game = new GameEngine(44); game.reset(); game.player.invulnerable = 1000; game.weapons.pulse = 0; game.director.recover();
});
afterEach(() => useGame.setState(previous));
function advance(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.tick(1 / 60); }

test('B intent plants one finite ground charge at the ship position with a full three-second fuse', () => {
  game.player.x = 1; game.player.z = 2; game.input.bomb = true; game.tick(1 / 60);
  expect(game.charges).toHaveLength(1); expect(game.charges[0]).toMatchObject({ x: 1, z: 2, age: 0, stage: 3, detonated: false });
  expect(chargeRemaining(game.charges[0])).toBe(3); expect(game.chargeAmmo).toBe(2); expect(game.input.bomb).toBe(false);
  expect(useGame.getState().chargeAmmo).toBe(2); expect(useGame.getState().charges).toHaveLength(1);
  game.tick(1 / 60); expect(game.charges).toHaveLength(1);
});
test('nearby chasers, orbiters and goliaths survive until the fuse then die once to the same blast', () => {
  game.spawn(0, 2, 0); game.spawn(1, 0, 3); game.spawn(2, -2, 0); game.placeCharge(); const charge = game.charges[0];
  advance(2.98); expect(game.kills).toBe(0); expect(charge.detonated).toBe(false); expect(game.charges).toHaveLength(1);
  game.tick(1 / 60); expect(charge.detonated).toBe(true); expect(game.charges).toHaveLength(0); expect(game.kills).toBe(3);
  expect(game.blasts.some(b => b.size === 4.5)).toBe(true); expect(game.shockwaves.some(w => w.radius === 5.5)).toBe(true); expect(game.pulse.x).toBe(0);
  const score = game.score; game.hitStop = 0; advance(2); expect(game.kills).toBe(3); expect(game.score).toBe(score);
});
test('a planted bomb stays behind and destroys a pursuer that enters its radius during the countdown', () => {
  game.placeCharge(); const charge = game.charges[0]; game.player.z = -12; game.spawn(0, 0, 9); const enemy = game.enemies[0];
  advance(2.8); expect(enemy.hp).toBeGreaterThan(0); expect(Math.hypot(enemy.x - charge.x, enemy.z - charge.z)).toBeLessThan(CHARGE_RULES.radius);
  expect(charge.x).toBe(0); expect(charge.z).toBe(0); advance(0.2); expect(enemy.hp).toBeLessThanOrEqual(0); expect(game.kills).toBe(1);
});
test('blast is strong but finite against bosses and does not touch hostiles outside its radius', () => {
  game.spawn(3, 0, 4); const boss = game.enemies[0]; const hp = boss.hp; game.damage = 2;
  game.spawn(2, 0, 20); const distant = game.enemies[1], distantHp = distant.hp; game.placeCharge(); advance(3);
  expect(boss.hp).toBeCloseTo(hp - CHARGE_RULES.damage * 2, 8); expect(boss.hp).toBeGreaterThan(0); expect(distant.hp).toBe(distantHp);
});
test('an intervening rock protects a nearby hostile from the ground blast', () => {
  let rock = null;
  for (let x = 1; x < 10 && !rock; x++) for (let z = 1; z < 10; z++) { const p = terrainProp(x, z); if (p && p.radius < 1.6 && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; } }
  expect(rock).not.toBeNull(); const r = rock!;
  game.player.x = r.x - r.radius - 0.8; game.player.z = r.z; game.spawn(2, r.x + r.radius + 1.2, r.z); const enemy = game.enemies[0], hp = enemy.hp;
  game.placeCharge(); const charge = game.charges[0];
  expect(Math.hypot(enemy.x - charge.x, enemy.z - charge.z)).toBeLessThan(CHARGE_RULES.radius); expect(terrainImpact(charge, enemy, 0)).not.toBeNull();
  advance(3); expect(enemy.hp).toBe(hp); expect(charge.detonated).toBe(true);
});
test('friendly IFF protects the ship and unrescued pilots inside the explosion', () => {
  game.player.invulnerable = 0; game.player.hp = 23; game.shield = 7; game.shieldDelay = 10;
  game.missions.tick(8, game.player, 0, () => 0.5); const pilot = game.missions.mission!.targets[0];
  pilot.x = 4; pilot.z = 0; game.missions.mission!.targets.slice(1).forEach(p => { p.x = 100; p.z = 100; });
  game.placeCharge(); advance(3); expect(game.player.hp).toBe(23); expect(game.shield).toBe(7); expect(pilot.done).toBe(false); expect(pilot.progress).toBe(0); expect(game.missions.rescued).toBe(0);
});
test('cooldown and spacing reject rapid or stacked placement without spending another bomb', () => {
  expect(game.placeCharge()).toBe(true); expect(game.placeCharge()).toBe(false); expect(game.chargeAmmo).toBe(2);
  game.player.x = 2; expect(game.placeCharge()).toBe(false); advance(1.3); game.player.x = 0;
  expect(game.placeCharge()).toBe(false); expect(game.chargeNotice).toContain('MOVE CLEAR'); expect(game.chargeAmmo).toBe(2);
  game.player.x = 2; expect(game.placeCharge()).toBe(true); expect(game.chargeAmmo).toBe(1); expect(game.charges).toHaveLength(2);
});
test('active and inventory limits hold even when ammunition is reloaded while charges remain armed', () => {
  for (let i = 0; i < 3; i++) { game.player.x = i * 2; game.chargeCooldown = 0; expect(game.placeCharge()).toBe(true); }
  expect(game.charges).toHaveLength(CHARGE_RULES.activeLimit); expect(game.chargeAmmo).toBe(0); expect(game.placeCharge()).toBe(false); expect(game.chargeNotice).toContain('EMPTY');
  game.collectSupply({ x: 0, z: 0, age: 0, type: 'ammo' }); expect(game.chargeAmmo).toBe(1); game.chargeCooldown = 0; game.player.x = 8;
  expect(game.placeCharge()).toBe(false); expect(game.chargeAmmo).toBe(1); expect(game.charges).toHaveLength(3);
});
test('ammo crates refill exactly one bomb even when rockets and EMP are full, and only consume once', () => {
  game.chargeAmmo = 1; game.rocketAmmo = 6; game.surge = 100; const crate = { x: 0, z: 0, age: 0, type: 'ammo' as const };
  game.collectSupply(crate); expect(game.chargeAmmo).toBe(2); expect(crate.age).toBe(100); expect(game.rocketNotice).toContain('+1 ground charge');
  game.collectSupply(crate); expect(game.chargeAmmo).toBe(2);
  game.collectSupply({ ...crate, age: 0 }); expect(game.chargeAmmo).toBe(3);
  const full = { ...crate, age: 0 }; game.collectSupply(full); expect(full.age).toBe(0); expect(game.chargeAmmo).toBe(3);
});
test('bomb stock never regenerates passively and empty bomb racks receive an ammo navigation signal', () => {
  game.chargeAmmo = 0; advance(5); expect(game.chargeAmmo).toBe(0);
  const signals = navigationSignals(game.player, null, [{ x: 4, z: 0, type: 'ammo', age: 0 }], 6, null, 0);
  expect(signals).toHaveLength(1); expect(signals[0].label).toBe('AMMO RELOAD');
});
test('field service refills one charge at capacity and cannot repeat its reward', () => {
  game.service = { x: 0, z: 0, remaining: 20, progress: 0, serviced: false }; game.chargeAmmo = 1; advance(3.1);
  expect(game.service?.serviced).toBe(true); expect(game.chargeAmmo).toBe(2); advance(2); expect(game.chargeAmmo).toBe(2);
});
test('pause and hit-stop freeze fuse and stock; ended runs cancel input and restart clears planted bombs', () => {
  game.placeCharge(); advance(1); const before = structuredClone(game.charges), time = game.time;
  useGame.getState().setPhase('paused'); game.input.bomb = true; game.tick(30); expect(game.charges).toEqual(before); expect(game.time).toBe(time); expect(game.input.bomb).toBe(false); expect(game.placeCharge()).toBe(false);
  useGame.getState().setPhase('playing'); game.hitStop = 0.05; game.tick(1 / 60); expect(game.charges).toEqual(before);
  useGame.setState({ phase: 'dead' }); game.tick(30); expect(game.charges).toEqual(before); expect(game.chargeAmmo).toBe(2);
  game.reset(); expect(game.charges).toHaveLength(0); expect(game.chargeAmmo).toBe(3); expect(game.chargeCooldown).toBe(0); expect(game.input.bomb).toBe(false);
});
test('HUD snapshots cannot mutate fuse state and deployment does not disturb enemy generation randomness', () => {
  const control = new GameEngine(44); control.reset(); game.placeCharge(); useGame.getState().charges[0].age = 999;
  expect(game.charges[0].age).toBe(0); expect(game.random()).toBe(control.random());
  game.spawn(0, 0, 8); control.spawn(0, 0, 8); expect(game.enemies[0].id).toBe(control.enemies[0].id);
});
