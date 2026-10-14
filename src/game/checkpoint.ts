import type { GameEngine } from './engine';
import { SHIP_IDS } from './flightframes';
import { WEAPONS } from './types';
import { ENEMY_ROLES } from './battlefield';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export const CHECKPOINT_SCHEMA = 1;
const SYSTEMS = ['roverBay', 'droneFormation', 'droneRack', 'rewards', 'director', 'missions', 'worldLife'] as const;
const OMIT = new Set<string>([...SYSTEMS, 'input', 'pendingResume']);
export type EngineCheckpoint = { schema: 1; state: JsonObject; systems: Record<(typeof SYSTEMS)[number], JsonObject> };
const record = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e15;
const numbers = (v: unknown, keys: string[]) => record(v) && keys.every(k => finite(v[k]));
const optionalNumbers = (v: JsonObject, keys: string[]) => keys.every(k => v[k] === undefined || finite(v[k]));
const weapon = (v: Json | undefined) => v === undefined || member(v, ['autocannon', 'plasma', 'laser', 'missile', 'flak', 'ion']);
const member = (v: unknown, values: readonly (string | number)[]) => values.includes(v as string | number);
const rows = (v: unknown, max: number, check: (row: Json) => boolean): v is Json[] => Array.isArray(v) && v.length <= max && v.every(check);
const safeTree = (v: unknown, depth = 0): v is Json => depth <= 18 && (v === null || typeof v === 'boolean' || typeof v === 'string' && v.length <= 2000 || finite(v) || Array.isArray(v) && v.length <= 2048 && v.every(x => safeTree(x, depth + 1)) || record(v) && Object.keys(v).length <= 140 && Object.entries(v).every(([k, x]) => !['__proto__', 'prototype', 'constructor'].includes(k) && safeTree(x, depth + 1)));
const own = (object: object, omit = new Set<string>()) => Object.fromEntries(Object.entries(object).filter(([key, value]) => !omit.has(key) && typeof value !== 'function'));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function captureCheckpoint(engine: GameEngine): EngineCheckpoint {
  return clone({ schema: CHECKPOINT_SCHEMA, state: own(engine, OMIT), systems: Object.fromEntries(SYSTEMS.map(key => [key, own(engine[key])])) }) as EngineCheckpoint;
}

const OPTIONAL_STATE = ['structures', 'frameCharge', 'district'];
function sameFields(data: JsonObject, template: object, optional: string[] = []) {
  const expected = own(template), keys = Object.keys(expected);
  return Object.keys(data).every(key=>keys.includes(key)) && keys.every(key => !Object.hasOwn(data,key) ? optional.includes(key) : (expected[key] === null || typeof expected[key] === 'object' ? typeof data[key] === 'object' : typeof expected[key] === typeof data[key]));
}

function attack(v: Json | undefined, heavy = false) {
  return v === undefined || numbers(v, ['remaining', 'aimX', 'aimZ', ...(heavy ? [] : ['aimY', 'rounds'])]);
}
function mission(v: Json) {
  return v === null || numbers(v, ['id', 'remaining', 'progress', 'goal', 'reward', 'startKills']) && record(v) && member(v.kind, ['rescue', 'uplink', 'hunt', 'escort', 'salvage', 'sabotage']) && member(v.status, ['active', 'complete', 'failed']) && typeof v.title === 'string' && typeof v.description === 'string' && (v.blocked===undefined||typeof v.blocked==='string') && (v.evacuation===undefined||!!numbers(v.evacuation,['x','z','progress'])) && (['escort','salvage'].includes(String(v.kind)) ? !!numbers(v.destination,['x','z']) : v.destination===undefined||!!numbers(v.destination,['x','z'])) && rows(v.targets, 3, t => numbers(t, ['id', 'x', 'z', 'progress']) && record(t) && typeof t.done === 'boolean' && (t.stage===undefined||member(t.stage,['stranded','following','evacuated'])) && (t.hp===undefined||finite(t.hp)&&t.hp>=0&&t.hp<=180) && (t.injured===undefined||typeof t.injured==='boolean'));
}

/** Reject malformed data before touching a live engine, and preserve controller prototypes. */
export function validateCheckpoint(value: unknown, engine: GameEngine): value is EngineCheckpoint {
  if (!safeTree(value) || !record(value) || value.schema !== CHECKPOINT_SCHEMA || !record(value.state) || !record(value.systems)) return false;
  const s = value.state, systems = value.systems;
  if (!sameFields(s, own(engine, OMIT), OPTIONAL_STATE) || !SYSTEMS.every(k => record(systems[k]) && sameFields(systems[k] as JsonObject, engine[k]))) return false;
  if (!optionalNumbers(s,['frameCharge','district']) || s.frameCharge!==undefined&&(Number(s.frameCharge)<0||Number(s.frameCharge)>3) || s.district!==undefined&&!member(s.district,[0,1,2,3])) return false;
  if (s.structures!==undefined&&!rows(s.structures,8,p=>numbers(p,['id','x','z','hp','radius'])&&record(p)&&member(p.kind,['fuel','cover'])&&Number(p.hp)>=0&&Number(p.hp)<=100&&Number(p.radius)>0&&Number(p.radius)<=2)) return false;
  if (!numbers(s.player, ['x', 'z', 'vx', 'vz', 'angle', 'hp', 'maxHp', 'hullHit', 'invulnerable', 'dashTime', 'dashCooldown']) || !record(s.player) || Number(s.player.hp) <= 0 || Number(s.player.hp) > Number(s.player.maxHp)) return false;
  if (!member(s.ship, SHIP_IDS) || !member(s.startingLoadout, Object.keys(WEAPONS)) || !member(s.runMode, ['classic', 'expedition']) || Number(s.time) < 0 || Number(s.level) < 1 || Number(s.chapter) < 1) return false;
  if (!numbers(s.weapons, ['pulse', 'glaive', 'cryo', 'tesla']) || !record(s.weapons) || !optionalNumbers(s.weapons, ['rail', 'scatter']) || !Object.values(s.weapons).every(n => finite(n) && Number.isInteger(n) && n >= 0 && n <= 6)) return false;
  if (!rows(s.enemies, 280, e => numbers(e, ['id', 'x', 'z', 'hp', 'maxHp', 'radius', 'age', 'timer']) && record(e) && Number(e.maxHp) > 0 && member(e.kind, [0, 1, 2, 3]) && typeof e.elite === 'boolean' && weapon(e.weapon) && optionalNumbers(e, ['vx', 'vz', 'weaponShots', 'cannonShots', 'escortShotAt', 'sentinelStrike', 'sentinelHit']) && attack(e.ranged) && attack(e.cannon, true))) return false;
  if (!(s.enemies as JsonObject[]).every(e=>(e.role===undefined||member(e.role,Object.keys(ENEMY_ROLES)))&&optionalNumbers(e,['specialTimer','children','parent','jammed'])&&(e.parts===undefined||rows(e.parts,4,p=>numbers(p,['hp','maxHp'])&&record(p)&&member(p.kind,['leftGun','rightGun','engine','generator'])&&Number(p.maxHp)>0&&Number(p.hp)>=0&&Number(p.hp)<=Number(p.maxHp))&&(e.parts as JsonObject[]).length===4&&new Set((e.parts as JsonObject[]).map(p=>p.kind)).size===4))) return false;
  if (!rows(s.bolts, 500, b => numbers(b, ['x', 'z', 'vx', 'vz', 'age', 'target', 'damage']) && record(b) && typeof b.enemy === 'boolean' && weapon(b.hostileWeapon) && (b.playerWeapon === undefined || member(b.playerWeapon, ['rail', 'scatter'])) && optionalNumbers(b, ['y', 'vy', 'pierce', 'range', 'traveled', 'drone', 'heavy']))) return false;
  if (!(s.bolts as JsonObject[]).every(b=>(b.split===undefined||typeof b.split==='boolean')&&(b.bounce===undefined||member(b.bounce,[0,1]))&&(b.part===undefined||member(b.part,['leftGun','rightGun','engine','generator'])))) return false;
  const pools: [string, number, string[]][] = [
    ['rockets', 16, ['x', 'z', 'vx', 'vz', 'age', 'target', 'traveled', 'trail']], ['particles', 1000, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'maxLife', 'size']],
    ['gems', 400, ['x', 'z', 'value', 'age']], ['vortices', 20, ['x', 'z', 'life', 'radius']], ['shockwaves', 40, ['x', 'z', 'radius', 'life', 'maxLife']],
    ['damageTexts', 40, ['x', 'z', 'value', 'life']], ['hazards', 12, ['x', 'z', 'radius', 'age', 'delay', 'duration']], ['supplies', 10, ['x', 'z', 'age']],
    ['caches', 8, ['x', 'z', 'age']], ['charges', 3, ['id', 'x', 'z', 'age', 'stage']], ['shieldHits', 8, ['x', 'y', 'z', 'age', 'power']],
    ['blasts', 48, ['id', 'x', 'z', 'size', 'age']], ['scorches', 60, ['x', 'z', 'size', 'age']],
  ];
  if (!pools.every(([key, max, fields]) => rows(s[key], max, row => !!numbers(row, fields)))) return false;
  if (!(s.hazards as JsonObject[]).every(h=>h.mine===undefined||typeof h.mine==='boolean')) return false;
  if (!rows(s.arcs, 100, a => record(a) && finite(a.life) && rows(a.points, 16, p => Array.isArray(p) && p.length === 2 && p.every(finite)))) return false;
  if (!rows(s.droneGuns, 7, g => numbers(g, ['yaw', 'pitch', 'targetId', 'cooldown', 'acquisition', 'flash', 'barrel', 'shots']) && record(g) && typeof g.active === 'boolean')) return false;
  if (s.service !== null && !numbers(s.service, ['x', 'z', 'remaining', 'progress'])) return false;
  if (!numbers(s.pulse, ['x', 'z', 'time'])) return false;
  const rack = systems.droneRack as JsonObject, formation = systems.droneFormation as JsonObject, reward = systems.rewards as JsonObject, director = systems.director as JsonObject, missions = systems.missions as JsonObject, rovers = systems.roverBay as JsonObject, life = systems.worldLife as JsonObject;
  const states = ['flight', 'waiting', 'returning', 'charging', 'launching', 'lost'];
  if (!rows(rack.units, 7, u => numbers(u, ['id', 'hp', 'hit', 'battery', 'phaseTime', 'rotor']) && record(u) && member(u.state, states)) || (rack.units as Json[]).length !== 7 || !finite(rack.capacity) || rack.capacity < 0 || rack.capacity > 7) return false;
  if (![rack.slots, rack.airborne, formation.slots].every(v => rows(v, 7, n => finite(n) && Number.isInteger(n) && n >= 0 && n < 7))) return false;
  if (!member(formation.mode, ['hover', 'compact', 'spread']) || !rows(formation.poses, 7, p => numbers(p, ['x', 'y', 'z', 'yaw', 'pitch', 'bank'])) || (formation.poses as Json[]).length !== 7 || !rows(formation.angles, 7, finite) || !rows(formation.starts, 7, p => numbers(p, ['x', 'y', 'z'])) || !rows(formation.lastState, 7, p => p === null || member(p, states))) return false;
  if (!member(director.phase, ['insertion', 'buildup', 'assault', 'recovery', 'sentinel']) || !mission(missions.mission)) return false;
  if(record(missions.mission)){
    const m=missions.mission,targets=m.targets as JsonObject[];
    if(m.kind!=='hunt'&&!targets.length)return false;
    if(Number(m.remaining)<0||targets.some(t=>Number(t.progress)<0))return false;
    if(m.evacuation!==undefined&&(!record(m.evacuation)||Number(m.evacuation.progress)<0||Number(m.evacuation.progress)>3))return false;
    if(m.kind==='rescue'&&targets.some(t=>t.stage!==undefined)&&m.evacuation===undefined)return false;
  }
  if (!rows(rovers.units, 12, r => numbers(r, ['id', 'x', 'z', 'yaw', 'age', 'traveled', 'range', 'parked', 'fuse']) && record(r) && member(r.state, ['rolling', 'armed', 'primed', 'detonated']))) return false;
  if (!rows(life.actors, 20, a => numbers(a, ['id', 'x', 'z', 'yaw', 'age', 'life', 'stride', 'speed', 'fright', 'goalX', 'goalZ', 'think', 'recover', 'launchHeight']) && record(a) && member(a.kind, ['fox', 'lizard', 'crew']))) return false;
  const request = (r: Json) => record(r) && member(r.source, ['level', 'salvage']) && finite(r.level);
  if (!rows(reward.pending, 1024, request)) return false;
  if (reward.active !== null) {
    const r = reward.active;
    if (!request(r) || !record(r) || !numbers(r, ['id', 'winner', 'elapsed']) || typeof r.installed !== 'boolean' || !rows(r.choices, 3, c => record(c) && member(c.id, ['pulse', 'glaive', 'cryo', 'tesla', 'rail', 'scatter', 'damage', 'speed', 'magnet', 'repair', 'haste', 'shield', 'critical', 'pierce']) && member(c.rarity, ['COMMON', 'RARE', 'OVERCLOCKED']) && finite(c.power) && typeof c.title === 'string' && typeof c.description === 'string') || (r.choices as Json[]).length !== 3 || !Number.isInteger(r.winner) || Number(r.winner) < 0 || Number(r.winner) >= 3 || !rows(r.changes, 20, c => record(c) && ['label', 'before', 'after'].every(k => typeof c[k] === 'string'))) return false;
  }
  return true;
}

export function restoreCheckpoint(engine: GameEngine, checkpoint: unknown) {
  if (!validateCheckpoint(checkpoint, engine)) return false;
  const copy = clone(checkpoint);
  Object.assign(engine, { structures: [], frameCharge: 0, district: 0, ...copy.state, weapons: { ...engine.weapons, ...(copy.state.weapons as JsonObject) } });
  for (const key of SYSTEMS) Object.assign(engine[key], copy.systems[key]);
  engine.droneRack.refresh();
  engine.input.keys.clear(); engine.input.dash = false; engine.input.surge = false; engine.input.rocket = false; engine.input.bomb = false; engine.input.barrier = false; engine.input.moveX = 0; engine.input.moveZ = 0; engine.input.aiming = false;
  return true;
}
