import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine, RUN_DURATION } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { audio } from '../src/game/audio';
import { validateCheckpoint } from '../src/game/checkpoint';
import { claimRun } from '../src/game/local-save';
import { doctrineAt, EXPEDITION } from '../src/game/expedition';
import { DRONE_BATTERY, DRONE_ORBIT } from '../src/game/orbital-drones';
import { ROVER_RULES } from '../src/game/ground-rovers';

let game: GameEngine;
let beforeState: ReturnType<typeof useGame.getState>, sound: boolean;
let descriptor: PropertyDescriptor | undefined, memory: Map<string, string>;
beforeEach(() => {
  beforeState = useGame.getState(); sound = audio.enabled; audio.enabled = false;
  descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
  useGame.setState({ phase: 'playing', maxHp: 100, loadout: 'pulse', runMode: 'expedition', difficulty: 'standard', profile: structuredClone(EMPTY_PROFILE), runKey: 'lifecycle-fronts', saveStatus: 'saved' });
  game = new GameEngine(2307); game.reset(); game.player.invulnerable = 1e6;
});
afterEach(() => { useGame.setState(beforeState); audio.enabled = sound; if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });

function rackInvariants(where: string) {
  expect(game.droneRack.capacity).toBeLessThanOrEqual(DRONE_ORBIT.capacity);
  let transferring = 0;
  for (const u of game.droneRack.units.slice(0, game.droneRack.capacity)) {
    expect(u.battery).toBeGreaterThanOrEqual(0); expect(u.battery).toBeLessThanOrEqual(DRONE_BATTERY.capacity);
    if (u.state === 'returning' || u.state === 'launching') transferring++;
  }
  expect(transferring).toBeLessThanOrEqual(1); // one shared hatch serializes transfers
}
function drainHitStop() { for (let i = 0; i < 12 && game.hitStop > 0; i++) game.tick(1 / 60); }
function settleAtDock() {
  const dock = game.service!;
  game.player.x = dock.x; game.player.z = dock.z; game.player.vx = 0; game.player.vz = 0;
  game.shieldDelay = 0; game.publish();
}

test('successive fronts cycle doctrines, scale the sentinel and stay checkpoint-resumable through extraction', () => {
  expect(claimRun('lifecycle-fronts')).toBe('saved');
  const doctrines = [doctrineAt(1).name, doctrineAt(2).name, doctrineAt(3).name];
  expect(new Set(doctrines).size).toBe(3);
  const sentinelHp: number[] = [];
  for (let front = 1; front <= 3; front++) {
    expect(game.chapter).toBe(front);
    expect(doctrineAt(game.chapter).name).toBe(doctrines[front - 1]);
    game.time = game.chapterStarted + RUN_DURATION; // fast-forward to the extraction window (engine.test.ts precedent)
    game.tick(1 / 60);
    const boss = game.enemies.find(e => e.kind === 3 && e.hp > 0);
    expect(boss).toBeDefined();
    expect(game.enemies.filter(e => e.kind === 3 && e.hp > 0)).toHaveLength(1);
    sentinelHp.push(boss!.maxHp);
    expect(validateCheckpoint(game.checkpoint(), game)).toBe(true); // boss alive is resumable
    boss!.hp = boss!.maxHp * 0.5; game.tick(1 / 60); expect(game.bossPhase).toBe(2);
    boss!.hp = boss!.maxHp * 0.2; game.tick(1 / 60); expect(game.bossPhase).toBe(3);
    game.hitEnemy(boss!, 1e9);
    expect(game.sentinels).toBe(front);
    expect(game.service).not.toBeNull();
    expect(validateCheckpoint(game.checkpoint(), game)).toBe(true); // open service window is resumable
    drainHitStop();
    settleAtDock();
    game.tick(EXPEDITION.dockDuration + 1);
    expect(game.service?.serviced).toBe(true);
    rackInvariants(`front ${front} serviced`);
    if (front < 3) {
      game.tick(EXPEDITION.serviceDuration + 2); // continue instead of extracting
      expect(game.service).toBeNull();
      expect(game.chapter).toBe(front + 1);
      expect(game.sector).toBe(0);
      expect(validateCheckpoint(game.checkpoint(), game)).toBe(true); // next front is resumable
      rackInvariants(`front ${front} expired`);
    }
  }
  expect(sentinelHp[1]).toBeGreaterThan(sentinelHp[0]);
  expect(sentinelHp[2]).toBeGreaterThan(sentinelHp[1]);
  expect(game.extract()).toBe(true);
  const s = useGame.getState();
  expect(s.phase).toBe('won');
  expect(s.profile.achievements).toContain('deep-run'); // three sentinels in one expedition
  expect(s.profile.achievements).toContain('breaker');  // extracted alive
});

test('a forced battery recall and an automatic rover wave stay bounded inside the simulation loop', () => {
  game.weapons.glaive = 2; game.droneRack.install(2);
  const flight = game.droneRack.units.slice(0, game.droneRack.capacity).filter(u => u.state === 'flight').map(u => u.id);
  expect(flight).toHaveLength(3);
  for (const id of flight) { game.droneRack.units[id].battery = DRONE_BATTERY.reserve + 1; game.droneRack.spendShot(id); }
  expect(game.droneRack.snapshot().filter(u => flight.includes(u.id)).every(u => u.state === 'waiting')).toBe(true);
  game.roverBay.nextWave = 0.01; // force the next wave on the following tick
  let sawWave = false, sawFlightAgain = false;
  for (let frame = 0; frame < 60 * 45; frame++) {
    game.enemies = []; // keep the loop free of combat interference
    game.tick(1 / 60);
    rackInvariants(`recall frame ${frame}`);
    sawWave ||= game.roverBay.waves > 0;
    sawFlightAgain ||= game.droneRack.snapshot().some(u => flight.includes(u.id) && u.state === 'flight');
    expect(game.roverBay.units.length).toBeLessThanOrEqual(ROVER_RULES.capacity);
    for (const rover of game.roverBay.units) expect(['rolling', 'armed', 'primed', 'detonated']).toContain(rover.state);
  }
  expect(sawWave).toBe(true);
  expect(sawFlightAgain).toBe(true); // the serialized hatch cycles escorts back to the air
  expect(game.roverBay.units).toHaveLength(0); // every deployed rover armed, primed, detonated and recycled
  expect(game.droneRack.snapshot().every(u => u.hp > 0 || u.state === 'lost')).toBe(true);
});
