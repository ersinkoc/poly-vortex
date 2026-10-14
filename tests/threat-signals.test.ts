import { expect, test } from 'bun:test';
import { readWeaponThreat, ThreatSignals, THREAT_SIGNALS } from '../src/game/threat-signals';
import type { Entity } from '../src/game/types';
import { terrainHeight, terrainProp } from '../src/game/terrain';

const core = { x: 0, z: 0 };
const hostile = (id = 1): Entity => ({ id, kind: 0, x: 0, z: 7, radius: 0.48, hp: 16, maxHp: 16, age: 1, timer: 0, elite: false, ranged: { aimX: 0, aimZ: 0, aimY: 0.95, remaining: 0.4, rounds: 2 } });

test('core warnings use the real locked shot and release when a sideways dodge clears its trajectory', () => {
  const e = hostile(), signals = new ThreatSignals(); signals.tick([e], core);
  expect(signals.locks).toBe(1); expect(signals.soonest).toBe(0.4); expect(signals.slots[0].progress).toBeGreaterThan(0);
  signals.tick([e], { x: 3, z: 0 });
  expect(signals.locks).toBe(0); expect(signals.count).toBe(1);
  expect(signals.slots[0].x).toBe(0); expect(signals.slots[0].z).toBe(0);
  // Moving through a fired lane is dangerous even beyond the old target point.
  signals.tick([e], { x: 0, z: -1 }); expect(signals.locks).toBe(1);
});

test('dead enemies, idle guns, escort locks and intervening cover cannot show a false core alarm', () => {
  const signals = new ThreatSignals(), dead = hostile(1), idle = hostile(2), escort = hostile(3);
  dead.hp = 0; idle.ranged = undefined; escort.ranged!.aimY = 3.5;
  signals.tick([dead, idle, escort], core); expect(signals.count).toBe(0); expect(signals.locks).toBe(0);
  let rock = null;
  for (let x = 1; x < 10 && !rock; x++) for (let z = 1; z < 10; z++) { const p = terrainProp(x, z); if (p && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; } }
  const r = rock!, e = hostile(); e.x = r.x + r.radius + 1; e.z = r.z;
  e.ranged!.aimX = r.x - r.radius - 1; e.ranged!.aimZ = r.z;
  signals.tick([e], { x: e.ranged!.aimX, z: e.ranged!.aimZ }); expect(signals.count).toBe(0);
});

test('gun salvos and heavy cannons expose their next release countdown without changing simulation data', () => {
  const gun = hostile(), tank = hostile(2); gun.ranged!.rounds = 1; gun.ranged!.remaining = 0.2;
  tank.kind = 2; tank.radius = 1.1; tank.z = 10; tank.ranged = undefined;
  tank.cannon = { aimX: 0, aimZ: 0, remaining: 0.6 };
  const before = structuredClone([gun, tank]), signals = new ThreatSignals(); signals.tick([gun, tank], core);
  expect(signals.count).toBe(2); expect(signals.locks).toBe(2); expect(signals.soonest).toBe(0.2);
  expect(signals.slots[0].progress).toBe(1); expect(signals.slots[1].color).toBe('#ffc280');
  expect([gun, tank]).toEqual(before);
  const snapshot = structuredClone(signals.slots); signals.tick([gun, tank], core); expect(signals.slots).toEqual(snapshot);
  gun.ranged = undefined; tank.cannon = undefined; signals.tick([gun, tank], core);
  expect(signals.count).toBe(0); expect(signals.locks).toBe(0); expect(signals.soonest).toBe(Infinity);
});

test('warning slots stay bounded and prioritize imminent core threats over safe stale aim points', () => {
  const wave = Array.from({ length: 80 }, (_, i) => { const e = hostile(i + 1); e.ranged!.aimX = 4; return e; });
  const urgent = hostile(81); urgent.ranged!.remaining = 0.05; wave.push(urgent);
  const signals = new ThreatSignals(), slots = [...signals.slots]; signals.tick(wave, core);
  expect(signals.count).toBe(THREAT_SIGNALS.capacity); expect(signals.locks).toBe(1); expect(signals.slots[0].id).toBe(81);
  for (let i = 0; i < slots.length; i++) expect(signals.slots[i]).toBe(slots[i]);
  expect(readWeaponThreat(urgent, core, signals.slots[0])).toBe(true);
});
