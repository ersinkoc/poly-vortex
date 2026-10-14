import type { Entity, WeaponId } from './types';
import { clearTerrainPosition, terrainHeight } from './terrain';
export { districtAt } from './terrain';

export const ENEMY_ROLES = {
  minelayer: { name: 'Mine weaver', color: '#e4a46a', detail: 'Leaves armed mines. Keep clear of amber rings.' },
  shield: { name: 'Aegis tender', color: '#75dfff', detail: 'Protects nearby ships. Destroy its generator first.' },
  bomber: { name: 'Line bomber', color: '#ff7f91', detail: 'Marks a bombing lane before releasing strikes.' },
  carrier: { name: 'Hive carrier', color: '#cfa1ff', detail: 'Launches bounded pairs of interceptor escorts.' },
  hunter: { name: 'Escort hunter', color: '#ffcc65', detail: 'Prioritizes airborne escort drones.' },
} as const;
export type EnemyRole = keyof typeof ENEMY_ROLES;
export type EnemyPart = { kind: 'leftGun' | 'rightGun' | 'engine' | 'generator'; hp: number; maxHp: number };
export const livePart = (e: Entity, kind: EnemyPart['kind']) => !e.parts || (e.parts.find(p => p.kind === kind)?.hp ?? 0) > 0;
export function createParts(hp: number): EnemyPart[] {
  return (['leftGun', 'rightGun', 'engine', 'generator'] as const).map(kind => ({ kind, hp: hp * .12, maxHp: hp * .12 }));
}
export function partPosition(e: Entity, kind: EnemyPart['kind'], core: { x: number; z: number }) {
  const yaw = Math.atan2(core.x - e.x, core.z - e.z), side = kind === 'leftGun' ? -.85 : kind === 'rightGun' ? .85 : 0;
  const front = kind === 'engine' ? -.85 : kind === 'generator' ? 0 : .55;
  return { x: e.x + (Math.cos(yaw) * side + Math.sin(yaw) * front) * e.radius,
    y: e.radius * .75 + .3 + (kind === 'generator' ? .45 : .1), z: e.z + (-Math.sin(yaw) * side + Math.cos(yaw) * front) * e.radius };
}
export function hitPart(e: Entity, amount: number, point: { x: number; z: number }, core: { x: number; z: number }) {
  let nearest: EnemyPart | undefined, best = e.radius * .8;
  for (const part of e.parts ?? []) {
    if (part.hp <= 0) continue;
    const pose = partPosition(e, part.kind, core), d = Math.hypot(point.x - pose.x, point.z - pose.z);
    if (d < best) { best = d; nearest = part; }
  }
  if (!nearest) return undefined;
  nearest.hp = Math.max(0, nearest.hp - amount);
  return nearest.hp === 0 ? nearest : undefined;
}
export function aimedPart(e:Entity,input:{aiming:boolean;aimX:number;aimZ:number},core:{x:number;z:number}) {
  if(!input.aiming||!e.parts||Math.hypot(input.aimX-e.x,input.aimZ-e.z)>e.radius+1.2)return undefined;
  let selected: {part:EnemyPart;position:ReturnType<typeof partPosition>} | undefined,best=e.radius*.6;
  for(const part of e.parts){if(part.hp<=0)continue;const position=partPosition(e,part.kind,core),d=Math.hypot(input.aimX-position.x,input.aimZ-position.z);if(d<best){best=d;selected={part,position};}}
  return selected;
}

export const EVOLUTIONS: Record<WeaponId, { name: string; detail: string }> = {
  pulse: { name: 'Prism battery', detail: 'Every pulse bolt penetrates two additional targets.' },
  glaive: { name: 'Wing network', detail: 'Airborne escorts gain 25% damage; Tesla also recharges their batteries.' },
  cryo: { name: 'Stasis field', detail: 'Singularities slow hostile rounds to 35% speed.' },
  tesla: { name: 'Fleet conductor', detail: 'Each discharge restores 4 battery to airborne escorts.' },
  rail: { name: 'Trident lance', detail: 'The first impact releases three penetrating fragments.' },
  scatter: { name: 'Ricochet array', detail: 'Pellets rebound once from stone cover.' },
};
export const evolved = (level: number) => level >= 6;

export const DISTRICTS = [
  { name: 'OPEN DUNES', color: '#c6b18a', detail: 'Open ground, sparse rock cover.' },
  { name: 'WRECK CANYON', color: '#9ca6b3', detail: 'Dense ruins form narrow firing lanes.' },
  { name: 'RELAY YARD', color: '#8fb7ad', detail: 'Flat industrial ground with fuel depots and barricades.' },
  { name: 'CRATER BASIN', color: '#9c88ab', detail: 'Deep impact bowls and scattered ridges.' },
] as const;
export type Structure = { id: number; x: number; z: number; hp: number; kind: 'fuel' | 'cover'; radius: number };
export function districtStructures(x: number, z: number, chapter: number): Structure[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = i * 2.399 + chapter * .7, r = 8 + i * 2.1;
    const s: Structure = { id: chapter * 100 + i, x: x + Math.sin(a) * r, z: z + Math.cos(a) * r, kind: i % 3 ? 'cover' : 'fuel', hp: i % 3 ? 100 : 45, radius: i % 3 ? 1.1 : .65 };
    clearTerrainPosition(s, s.radius + .4); return s;
  });
}
export function structureContact(a: { x: number; z: number }, b: { x: number; z: number }, structures: readonly Structure[]) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  let nearest: { structure: Structure; t: number; x: number; z: number } | null = null;
  for (const s of structures) {
    if (s.hp <= 0 || terrainHeight(s.x, s.z) + 1.5 < .6) continue;
    const ox = a.x - s.x, oz = a.z - s.z, c = ox * ox + oz * oz - s.radius * s.radius, dot = ox * dx + oz * dz;
    const discriminant = dot * dot - l2 * c;
    if (discriminant < 0 || l2 < 1e-10) continue;
    const t = c <= 0 ? 0 : (-dot - Math.sqrt(discriminant)) / l2;
    if (t >= 0 && t <= 1 && (!nearest || t < nearest.t)) nearest = { structure: s, t, x: a.x + dx * t, z: a.z + dz * t };
  }
  return nearest;
}
export function clearStructurePosition(body: { x: number; z: number }, radius: number, structures: readonly Structure[]) {
  for (const s of structures) {
    const dx=body.x-s.x,dz=body.z-s.z,d=Math.hypot(dx,dz),reach=s.radius+radius;
    if(s.hp<=0||d>=reach)continue;
    body.x=s.x+(d>1e-8?dx/d:1)*reach;body.z=s.z+(d>1e-8?dz/d:0)*reach;
  }
}
