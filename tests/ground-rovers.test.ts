import { afterEach, beforeEach, expect, test } from 'bun:test';
import { RoverBay, ROVER_RULES, roverPose, roverWheelSite, type GroundRover } from '../src/game/ground-rovers';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE, type Entity } from '../src/game/types';
import { audio } from '../src/game/audio';
import { terrainHeight, terrainImpact, terrainProp, type TerrainProp } from '../src/game/terrain';

const previous = useGame.getState(), previousAudio = audio.enabled;
beforeEach(() => { audio.enabled = false; useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', difficulty: 'standard', runMode: 'expedition', profile: structuredClone(EMPTY_PROFILE), aimMode: 'precision' }); });
afterEach(() => { useGame.setState(previous); audio.enabled = previousAudio; });
const rover = (changes: Partial<GroundRover> = {}): GroundRover => ({ id: 1, x: 0, z: 0, yaw: 0, age: 0, traveled: 0, range: 9, parked: 0, fuse: ROVER_RULES.fuse, state: 'rolling', ...changes });
const hostile = (x: number, z: number, hp = 100): Entity => ({ id: 1, kind: 0, x, z, hp, maxHp: hp, radius: 0.5, age: 0, timer: 5, elite: false });
function bayAdvance(bay: RoverBay, seconds: number, enemies: readonly Entity[] = [], deploy = false, onBlast: (r: GroundRover) => boolean = () => true) {
  for (let i = 0; i < Math.round(seconds * 60); i++) bay.tick(1 / 60, { x: 0, z: 0 }, enemies, deploy, onBlast);
}
function engine() { const g = new GameEngine(77); g.reset(); g.weapons.pulse = 0; g.player.invulnerable = 1000; g.director.recover(); g.roverBay.nextWave = 1000; return g; }
function advance(g: GameEngine, seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) g.tick(1 / 60); }

test('automatic bay waits ten seconds, emits only complete 3/6-way fans and varies them reproducibly', () => {
  const counts = new Set<number>();
  for (let seed = 0; seed < 32; seed++) {
    const a = new RoverBay(seed), b = new RoverBay(seed);
    bayAdvance(a, 9.98, [], true); expect(a.units).toHaveLength(0); a.tick(1 / 60, { x: 0, z: 0 }, [], true, () => true);
    bayAdvance(b, 10, [], true); expect(a.units).toEqual(b.units); expect([3, 6]).toContain(a.units.length); counts.add(a.units.length);
    expect(a.nextWave).toBeGreaterThanOrEqual(24); expect(a.nextWave).toBeLessThanOrEqual(36);
    const angles = a.units.map(r => r.yaw);
    for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeGreaterThan(Math.PI * 2 / angles.length - 0.18);
    for (const r of a.units) { expect(r.range).toBeGreaterThanOrEqual(9); expect(r.range).toBeLessThanOrEqual(14); }
  }
  expect([...counts].sort()).toEqual([3, 6]);
});

test('rovers actually drive, stay at their own destination, and rotate wheels by traveled distance', () => {
  const bay = new RoverBay(1); bay.units = [rover()]; bayAdvance(bay, 1);
  expect(bay.units[0].x).toBe(0); expect(bay.units[0].z).toBeCloseTo(4.6, 7); expect(bay.units[0].traveled).toBeCloseTo(4.6, 7);
  bayAdvance(bay, 1.1); const r = bay.units[0]; expect(r.state).toBe('armed'); expect(r.z).toBeCloseTo(9, 7);
  const site = { x: r.x, z: r.z, traveled: r.traveled }; bayAdvance(bay, 1); expect(r).toMatchObject(site);
});

test('a rock stops a rover on the approach side without letting it clip or tunnel through', () => {
  const rock = terrainProp(1, 1)!; expect(rock).not.toBeNull(); const bay = new RoverBay(2);
  bay.units = [rover({ x: rock.x - rock.radius - ROVER_RULES.bodyRadius - 0.1, z: rock.z, yaw: Math.PI / 2 })];
  bayAdvance(bay, 1); const r = bay.units[0]; expect(r.state).toBe('armed'); expect(r.x).toBeLessThan(rock.x - rock.radius - ROVER_RULES.bodyRadius + 1e-6);
  expect(r.traveled).toBeLessThan(0.11);
});

test('enemies trigger an armed destination mine once after a short visible warning', () => {
  const bay = new RoverBay(2); const r = rover({ state: 'armed', age: 2 }); bay.units = [r]; let blasts = 0;
  const blast = () => { blasts++; return true; }, enemies = [hostile(1.9, 0)];
  bay.tick(1 / 60, { x: 0, z: 0 }, enemies, false, blast); expect(r.state).toBe('primed'); expect(blasts).toBe(0);
  bayAdvance(bay, 0.3, enemies, false, blast); expect(blasts).toBe(0); expect(r.fuse).toBeGreaterThan(0);
  bayAdvance(bay, 0.05, enemies, false, blast); expect(blasts).toBe(1); expect(bay.units).toHaveLength(0);
  bayAdvance(bay, 2, enemies, false, blast); expect(blasts).toBe(1);
});

test('launch grace prevents instant contact detonation, then a moving rover stops when triggered', () => {
  const bay = new RoverBay(2), r = rover(); bay.units = [r]; const enemies = [hostile(0, 1)];
  bayAdvance(bay, 0.5, enemies); expect(r.state).toBe('rolling'); bayAdvance(bay, 0.1, enemies); expect(r.state).toBe('primed');
  const z = r.z, spin = r.traveled; bayAdvance(bay, 0.2, enemies); expect(r.z).toBe(z); expect(r.traveled).toBe(spin);
});

test('idle parked mines self-detonate and entire launches defer at capacity', () => {
  const bay = new RoverBay(3); bay.units = Array.from({ length: 12 }, (_, i) => rover({ id: i + 1, x: i * 3, state: 'armed', age: 2 })); bay.nextWave = 0;
  bay.tick(1 / 60, { x: 0, z: 0 }, [], true, () => true); expect(bay.units).toHaveLength(12); expect(bay.waves).toBe(0); expect(bay.nextWave).toBe(1);
  let blasts = 0; bayAdvance(bay, 12.4, [], false, () => { blasts++; return true; }); expect(blasts).toBe(12); expect(bay.units).toHaveLength(0);
  bayAdvance(bay, 1, [], true); expect([3, 6]).toContain(bay.units.length); expect(bay.waves).toBe(1);
});

test('repeated launches remain bounded across long expeditions', () => {
  const bay = new RoverBay(3);
  for (let i = 0; i < 60 * 300; i++) { bay.tick(1 / 60, { x: Math.sin(i / 500) * 4, z: 0 }, [], true, () => true); expect(bay.units.length).toBeLessThanOrEqual(ROVER_RULES.capacity); }
  expect(bay.waves).toBeGreaterThan(7);
});

test('chassis pitch and bank follow ground samples and four distinct wheel sites remain on their axle', () => {
  const r = rover({ x: 21.4, z: 23.8, yaw: 0.7 }), pose = roverPose(r), sites = [-1, 1].flatMap(side => [-1, 1].map(end => roverWheelSite(r, side, end)));
  expect(new Set(sites.map(p => `${p.x}:${p.z}`)).size).toBe(4); expect(Object.values(pose).every(Number.isFinite)).toBe(true);
  expect(pose.y).toBeCloseTo(sites.reduce((s, p) => s + terrainHeight(p.x, p.z), 0) / 4 + ROVER_RULES.wheelRadius, 10);
  expect(Math.abs(pose.pitch) + Math.abs(pose.bank)).toBeGreaterThan(0.001);
});

test('rover blast clears ordinary hostiles, damages bosses finitely and protects friendlies', () => {
  const g = engine(); g.spawn(0, 3.5, 0); g.spawn(3, 0, 4); const boss = g.enemies[1], hp = boss.hp;
  g.player.invulnerable = 0; g.player.hp = 37; g.shield = 12; g.shieldDelay = 10;
  g.missions.tick(8, g.player, 0, () => 0.5); const pilot = g.missions.mission!.targets[0]; pilot.x = 3; pilot.z = 0;
  g.roverBay.units = [rover({ state: 'primed', age: 2 })]; advance(g, 0.35);
  expect(g.kills).toBe(1); expect(boss.hp).toBeCloseTo(hp - ROVER_RULES.damage, 8); expect(boss.hp).toBeGreaterThan(0);
  expect(g.player.hp).toBe(37); expect(g.shield).toBe(12); expect(pilot.done).toBe(false); expect(g.roverBay.units).toHaveLength(0);
  expect(g.blasts.some(b => b.size === 2.8)).toBe(true); expect(g.shockwaves.some(w => w.radius === 4.2)).toBe(true);
});

test('nearby cover blocks the rover blast, while distant targets remain untouched', () => {
  const g = engine(); let rock: TerrainProp | null = null;
  for (let x = 1; x < 10 && !rock; x++) for (let z = 1; z < 10; z++) { const p = terrainProp(x, z); if (p && p.radius < 1.5 && terrainHeight(p.x, p.z) + p.height > 0.9) { rock = p; break; } }
  expect(rock).not.toBeNull();
  const r = rover({ x: rock!.x - rock!.radius - 0.6, z: rock!.z, state: 'armed', age: 2 });
  g.spawn(0, rock!.x + rock!.radius + 0.6, rock!.z); const protectedEnemy = g.enemies[0], hp = protectedEnemy.hp;
  expect(Math.hypot(r.x - protectedEnemy.x, r.z - protectedEnemy.z)).toBeLessThan(ROVER_RULES.blastRadius); expect(terrainImpact(r, protectedEnemy, 0)).not.toBeNull();
  g.spawn(2, r.x, r.z + 18); const distant = g.enemies[1], distantHp = distant.hp;
  g.roverBay.units = [r]; advance(g, 0.2); expect(r.state).toBe('armed'); r.state = 'primed'; advance(g, 0.35);
  expect(protectedEnemy.hp).toBe(hp); expect(distant.hp).toBe(distantHp);
});

test('pause, hit-stop and ended runs freeze the bay; reset clears vehicles and restores the first cycle', () => {
  const g = engine(); g.roverBay.units = [rover()]; g.roverBay.nextWave = 3;
  const before = structuredClone(g.roverBay.units); useGame.getState().setPhase('paused'); g.tick(30); expect(g.roverBay.units).toEqual(before); expect(g.roverBay.nextWave).toBe(3);
  useGame.getState().setPhase('playing'); g.hitStop = 0.05; g.tick(1 / 60); expect(g.roverBay.units).toEqual(before);
  useGame.setState({ phase: 'dead' }); g.tick(30); expect(g.roverBay.units).toEqual(before);
  g.reset(); expect(g.roverBay.units).toHaveLength(0); expect(g.roverBay.nextWave).toBe(10); expect(g.roverBay.waves).toBe(0);
});

test('service holds new launches while existing armed mines finish their fuse', () => {
  const g = engine(); g.service = { x: 12, z: 0, remaining: 20, progress: 0, serviced: false }; g.roverBay.nextWave = 0.1;
  g.roverBay.units = [rover({ state: 'primed', age: 2 })]; advance(g, 0.5);
  expect(g.roverBay.waves).toBe(0); expect(g.roverBay.nextWave).toBe(0.1); expect(g.roverBay.units).toHaveLength(0);
  g.service = null; g.hitStop = 0; advance(g, 0.12); expect(g.roverBay.waves).toBe(1);
});

test('a Classic boss kill ends the run immediately and prevents another rover from detonating in that tick', () => {
  const g = engine(); g.runMode = 'classic'; g.spawn(3, 0, 3); g.enemies[0].hp = 100;
  const first = rover({ id: 1, state: 'primed', fuse: 0.001 }), second = rover({ id: 2, x: 4, state: 'primed', fuse: 0.001 });
  g.roverBay.units = [first, second]; g.tick(1 / 60);
  expect(useGame.getState().phase).toBe('won'); expect(g.kills).toBe(1); expect(first.state).toBe('detonated'); expect(second.state).toBe('primed'); expect(second.age).toBe(0);
  g.tick(1); expect(second.age).toBe(0); expect(second.fuse).toBe(0.001);
});

test('automatic rover deployments spend no B bombs or rockets and do not consume enemy RNG', () => {
  const g = engine(), control = engine(); g.roverBay.nextWave = 0; g.tick(1 / 60); control.tick(1 / 60);
  expect([3, 6]).toContain(g.roverBay.units.length); expect(g.chargeAmmo).toBe(3); expect(g.rocketAmmo).toBe(6); expect(g.random()).toBe(control.random());
  expect(useGame.getState().roverWaves).toBe(1); expect(useGame.getState().roverMoving).toBe(g.roverBay.units.length);
});
