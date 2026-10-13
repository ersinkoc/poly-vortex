import type { EnemyWeapon } from './enemy-weapons';

export type WeaponId = 'pulse' | 'glaive' | 'cryo' | 'tesla';
export type Phase = 'menu' | 'playing' | 'paused' | 'dead' | 'won';
export type Difficulty = 'standard' | 'overdrive';
export type UpgradeId = WeaponId | 'damage' | 'speed' | 'magnet' | 'repair' | 'haste' | 'shield' | 'critical' | 'pierce';
export type Upgrade = { id: UpgradeId; title: string; description: string; rarity: 'COMMON' | 'RARE' | 'OVERCLOCKED'; power: number };
export type Entity = { id: number; x: number; z: number; hp: number; maxHp: number; kind: 0 | 1 | 2 | 3; radius: number; age: number; timer: number; elite: boolean; vx?: number; vz?: number; escortShotAt?: number; weapon?: EnemyWeapon; ranged?: { remaining: number; aimX: number; aimY: number; aimZ: number; rounds: number }; weaponShots?: number; weaponFlash?: { at: number; aimX: number; aimZ: number; side: -1 | 1 }; cannon?: { remaining: number; aimX: number; aimZ: number }; cannonFlash?: { at: number; aimX: number; aimZ: number; side: -1 | 1 }; cannonShots?: number };
export type Bolt = { x: number; z: number; vx: number; vz: number; age: number; enemy: boolean; target: number; damage: number; pierce?: number; hits?: number[]; traveled?: number; range?: number; drone?: number; heavy?: number; hostileWeapon?: EnemyWeapon; y?: number; vy?: number };
export type Rocket = { x: number; z: number; vx: number; vz: number; age: number; target: number; traveled: number; trail: number; aimX?: number; aimZ?: number };
export type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; maxLife: number; color: string; size: number };
export type Gem = { x: number; z: number; value: number; age: number };
export type Arc = { points: [number, number][]; life: number };
export type Vortex = { x: number; z: number; life: number; radius: number };
export type Shockwave = { x: number; z: number; radius: number; life: number; maxLife: number; color: string };
export type DamageText = { x: number; z: number; value: number; critical: boolean; life: number };
export type Hazard = { x: number; z: number; radius: number; age: number; delay: number; duration: number; detonated: boolean };
export type Supply = { x: number; z: number; type: 'repair' | 'magnet' | 'overdrive' | 'ammo'; age: number };
export type Cache = { x: number; z: number; age: number };
export type Profile = { credits: number; best: number; runs: number; wins: number; totalKills: number; achievements: string[]; upgrades: { armor: number; reactor: number; thrusters: number } };
export type Input = { keys: Set<string>; aimX: number; aimZ: number; aiming: boolean; dash: boolean; surge: boolean; rocket: boolean; bomb: boolean; moveX: number; moveZ: number };

export const WEAPONS: Record<WeaponId, { name: string; code: string; description: string; color: string }> = {
  pulse: { name: 'Pulse laser', code: 'PL-01', description: 'Rapid-fire homing bolts. Precision, at the speed of light.', color: '#bbff57' },
  glaive: { name: 'Escort drones', code: 'ED-02', description: 'Independent 12m escort lasers. 40 hull each. At 20% battery they dock, recharge and launch again. Enemy fire can destroy airborne units; repairs heal survivors and field service rebuilds one.', color: '#6ee7ff' },
  cryo: { name: 'Cryo-singularity', code: 'CS-03', description: 'A gravitational anomaly. Pull them in. Tear them apart.', color: '#a48bfa' },
  tesla: { name: 'Tesla arc', code: 'TA-04', description: 'Chain lightning that jumps through up to five targets.', color: '#ffbf6a' },
};
export const EMPTY_PROFILE: Profile = { credits: 0, best: 0, runs: 0, wins: 0, totalKills: 0, achievements: [], upgrades: { armor: 0, reactor: 0, thrusters: 0 } };
