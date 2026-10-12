export type WeaponId = 'pulse' | 'glaive' | 'cryo' | 'tesla';
export type Phase = 'menu' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won';
export type Difficulty = 'standard' | 'overdrive';
export type UpgradeId = WeaponId | 'damage' | 'speed' | 'magnet' | 'repair' | 'haste';
export type Upgrade = { id: UpgradeId; title: string; description: string; rarity: 'COMMON' | 'RARE' | 'OVERCLOCKED'; power: number };
export type Entity = { id: number; x: number; z: number; hp: number; maxHp: number; kind: 0 | 1 | 2 | 3; radius: number; age: number; timer: number };
export type Bolt = { x: number; z: number; vx: number; vz: number; age: number; enemy: boolean; target: number; damage: number };
export type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; maxLife: number; color: string; size: number };
export type Gem = { x: number; z: number; value: number; age: number };
export type Arc = { points: [number, number][]; life: number };
export type Vortex = { x: number; z: number; life: number; radius: number };
export type Profile = { credits: number; best: number; runs: number; wins: number; upgrades: { armor: number; reactor: number; thrusters: number } };
export type Input = { keys: Set<string>; aimX: number; aimZ: number; aiming: boolean; dash: boolean; moveX: number; moveZ: number };

export const WEAPONS: Record<WeaponId, { name: string; code: string; description: string; color: string }> = {
  pulse: { name: 'Pulse laser', code: 'PL-01', description: 'Rapid-fire homing bolts. Precision, at the speed of light.', color: '#bbff57' },
  glaive: { name: 'Orbital glaives', code: 'OG-02', description: 'Rotating blades that turn your perimeter into a kill zone.', color: '#6ee7ff' },
  cryo: { name: 'Cryo-singularity', code: 'CS-03', description: 'A gravitational anomaly. Pull them in. Tear them apart.', color: '#a48bfa' },
  tesla: { name: 'Tesla arc', code: 'TA-04', description: 'Chain lightning that jumps through up to five targets.', color: '#ffbf6a' },
};
export const EMPTY_PROFILE: Profile = { credits: 0, best: 0, runs: 0, wins: 0, upgrades: { armor: 0, reactor: 0, thrusters: 0 } };
