import { expect, test } from 'bun:test';
import { ROVER_RULES, type GroundRover } from '../src/game/ground-rovers';
import { RoverRadar, ROVER_RADAR, roverSweep } from '../src/game/rover-radar';
import { buildRoverField, placeRoverField } from '../src/game/rover-field';
import { buildRoverRadar } from '../src/game/ship-models';
import { terrainHeight, terrainProp, type TerrainProp } from '../src/game/terrain';
import type { Entity } from '../src/game/types';

const rover = (): GroundRover => ({ id: 1, x: 0, z: 0, yaw: 0, age: 2, traveled: 9, range: 9, parked: 0, fuse: ROVER_RULES.fuse, state: 'armed' });
const enemy = (r: GroundRover, distance = 3, angle = roverSweep(r), id = 1): Entity => ({ id, kind: 0, x: r.x + Math.sin(angle) * distance, z: r.z + Math.cos(angle) * distance, hp: 10, maxHp: 10, radius: .5, age: 0, timer: 0, elite: false });

test('radar detects a swept live hostile, then tracks and fades its echo without modifying combat actors', () => {
  const r = rover(), e = enemy(r), radar = new RoverRadar(), before = structuredClone([r, e]);
  expect(radar.scan(r, [e])).toHaveLength(1); expect([r, e]).toEqual(before);
  r.age += .2; e.x += .1; const echo = radar.scan(r, [e])[0]; expect(echo.x).toBe(e.x); expect(echo.life).toBeLessThan(ROVER_RADAR.hold);
  r.age += 1.61; expect(radar.scan(r, [e])).toHaveLength(0);
});
test('range, dead targets, launch grace and stone cover suppress radar contacts', () => {
  const r = rover(), radar = new RoverRadar(), dead = enemy(r); dead.hp = 0;
  expect(radar.scan(r, [enemy(r, 4.3), dead])).toHaveLength(0); r.age = 0; expect(radar.scan(r, [enemy(r)])).toHaveLength(0);
  let found: TerrainProp | null = null;
  for (let x = 1; x < 10 && !found; x++) for (let z = 1; z < 10; z++) { const p = terrainProp(x, z); if (p && p.radius < 1.5 && terrainHeight(p.x, p.z) + p.height > .9) { found = p; break; } }
  expect(found).not.toBeNull(); const rock = found!;
  r.x = rock.x - rock.radius - .5; r.z = rock.z; r.age = 2; r.yaw = Math.PI / 2 - r.id * 1.37 - r.age * Math.PI * 2 / ROVER_RADAR.period;
  const hidden = enemy(r, rock.radius * 2 + 1, Math.PI / 2); expect(Math.hypot(hidden.x - r.x, hidden.z - r.z)).toBeLessThan(ROVER_RADAR.range);
  expect(radar.scan(r, [hidden])).toHaveLength(0);
});
test('low frame rates still register enemies crossed by the sweep, and duplicate contacts stay bounded', () => {
  const r = rover(), radar = new RoverRadar(); radar.scan(r, []);
  const mid = roverSweep({ ...r, age: r.age + .5 }), targets = Array.from({ length: 20 }, (_, id) => enemy(r, 2.8, mid, id));
  r.age += 1; expect(radar.scan(r, targets)).toHaveLength(ROVER_RADAR.contacts);
  radar.scan(r, targets); expect(new Set(radar.echoes.map(e => e.id)).size).toBe(ROVER_RADAR.contacts);
});
test('pause freezes sweep and echoes, slot reuse clears stale contacts, and detonation removes them', () => {
  const r = rover(), radar = new RoverRadar(), e = enemy(r); radar.scan(r, [e]); r.age += .2; radar.scan(r, [e]);
  const before = structuredClone(radar.echoes), angle = roverSweep(r); radar.scan(r, [e]); expect(radar.echoes).toEqual(before); expect(roverSweep(r)).toBe(angle);
  r.id++; expect(radar.scan(r, [])).toHaveLength(0); r.state = 'detonated'; expect(radar.scan(r, [enemy(r)])).toHaveLength(0);
});
test('minefield projection follows terrain at each vertex and reuses a bounded pool without moving another slot', () => {
  const g = buildRoverField();
  try {
    placeRoverField(g, 0, 21, 23); const p = g.getAttribute('position'), slots = g.getAttribute('fieldSlot');
    for (let i = 0; i < p.count; i++) if (slots.getX(i) === 0) expect(p.getY(i)).toBeCloseTo(terrainHeight(p.getX(i), p.getZ(i)) + .065, 5); else expect(p.getY(i)).toBe(0);
    expect(p.count).toBeLessThan(11000); expect(Math.max(...Array.from(slots.array))).toBe(ROVER_RULES.capacity - 1);
  } finally { g.dispose(); }
});
test('procedural rotating radar has finite dish geometry and a distinct signal mesh', () => {
  const model = buildRoverRadar();
  try { for (const g of Object.values(model)) { expect(g.getAttribute('position').count).toBeGreaterThan(0); expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true); } }
  finally { Object.values(model).forEach(g => g.dispose()); }
});
