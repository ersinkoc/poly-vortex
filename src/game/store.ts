import type { EnemyWeapon } from './enemy-weapons';
import { create } from 'zustand';
import { EMPTY_PROFILE, type Difficulty, type Phase, type Profile, type WeaponId } from './types';
import type { RewardRoll } from './reward-reel';
import { ACHIEVEMENTS } from './progression';
import type { Mission } from './missions';
import { ROCKET_CAPACITY } from './supplies';
import type { EncounterPhase } from './director';
import type { ScreenSignal } from './navigation';
import type { LauncherStatus } from './launcher';
import type { DockStatus, RunMode, ServiceDock } from './expedition';
import { CHARGE_RULES, type GroundCharge } from './ground-charges';
import { ROVER_RULES } from './ground-rovers';
import type { DroneTelemetry } from './orbital-drones';
import { FLIGHTFRAMES, shipId, type ShipId } from './flightframes';
import type { BudgetLevel } from './render-budget';

type GameStore = {
  ship: ShipId; activeShip: ShipId; selectShip: (ship: ShipId) => void;
  adaptiveQuality: boolean; renderBudget: BudgetLevel;
  droneHull: number[];
  droneStatus: DroneTelemetry[];
  roverMoving: number; roverArmed: number; roverNextWave: number; roverWaves: number;
  charges: GroundCharge[]; chargeAmmo: number; chargeCooldown: number; chargeNotice: string; chargeNoticeTime: number;
  runMode: RunMode; activeMode: RunMode; chapter: number; sentinels: number; sentinelIn: number; service: ServiceDock | null; dockDistance: number; canExtract: boolean; dockStatus: DockStatus;
  launcherStatus: LauncherStatus; rocketPending: number; rocketLock: { kind: number; distance: number; alignment: number } | null;
  rocketNotice: string; rocketNoticeKind: 'success' | 'warning'; rocketNoticeTime: number;
  navigation: ScreenSignal[];
  encounter: EncounterPhase; encounterRemaining: number; encounterRound: number; combatPressure: number;
  aimMode: 'assisted' | 'precision'; reducedEffects: boolean;
  rocketAmmo: number; rocketCapacity: number; rocketCooldown: number; rocketReady: boolean;
  targeting: 'aim' | 'auto'; target: { id: number; kind: 0 | 1 | 2 | 3; weapon?: EnemyWeapon; distance: number; hp: number; maxHp: number } | null;
  mission: Mission | null; missionsCompleted: number; rescued: number;
  phase: Phase; difficulty: Difficulty; loadout: WeaponId; sound: boolean; quality: 'high' | 'performance';
  time: number; hp: number; maxHp: number; xp: number; nextXp: number; level: number;
  kills: number; score: number; combo: number; dash: number; enemies: number; fps: number;
  weapons: Record<WeaponId, number>; reward: RewardRoll | null; rewardQueued: number; profile: Profile; earned: number; runId: number;
  shield: number; maxShield: number; surge: number; sector: number; bossPhase: number; peakCombo: number; elites: number; caches: number;
  overdrive: number; repair: number; salvage: number; announcement: string; announcementDetail: string; announcementTime: number;
  setPhase: (phase: Phase) => void; start: () => void; hydrate: () => void;
  saveRun: (score: number, kills: number, won: boolean, bonus?: number) => void;
  purchase: (id: keyof Profile['upgrades']) => void;
};
const save = (profile: Profile) => { try { localStorage.setItem('poly-vortex-profile-v1', JSON.stringify(profile)); } catch { /* Storage can be unavailable in private browsing. */ } };
export const useGame = create<GameStore>((set, get) => ({
  ship: 'vector', activeShip: 'vector', adaptiveQuality: true, renderBudget: 0,
  selectShip: ship => { if (get().phase === 'menu' || get().phase === 'dead' || get().phase === 'won') set({ ship: shipId(ship) }); },
  droneHull: [],
  droneStatus: [],
  roverMoving: 0, roverArmed: 0, roverNextWave: ROVER_RULES.first, roverWaves: 0,
  charges: [], chargeAmmo: CHARGE_RULES.capacity, chargeCooldown: 0, chargeNotice: '', chargeNoticeTime: 0,
  runMode: 'expedition', activeMode: 'expedition', chapter: 1, sentinels: 0, sentinelIn: 180, service: null, dockDistance: 0, canExtract: false, dockStatus: 'offline',
  launcherStatus: 'searching', rocketPending: 0, rocketLock: null, rocketNotice: '', rocketNoticeKind: 'success', rocketNoticeTime: 0,
  navigation: [],
  encounter: 'insertion', encounterRemaining: 12, encounterRound: 1, combatPressure: 0,
  aimMode: 'assisted', reducedEffects: false,
  rocketAmmo: ROCKET_CAPACITY, rocketCapacity: ROCKET_CAPACITY, rocketCooldown: 0, rocketReady: false,
  targeting: 'auto', target: null,
  mission: null, missionsCompleted: 0, rescued: 0,
  phase: 'menu', difficulty: 'standard', loadout: 'pulse', sound: true, quality: 'high',
  time: 0, hp: 100, maxHp: 100, xp: 0, nextXp: 12, level: 1, kills: 0, score: 0, combo: 1, dash: 0,
  enemies: 0, fps: 60, weapons: { pulse: 1, glaive: 0, cryo: 0, tesla: 0 }, reward: null, rewardQueued: 0, profile: EMPTY_PROFILE, earned: 0, runId: 0,
  shield: 40, maxShield: 40, surge: 100, sector: 0, bossPhase: 0, peakCombo: 1, elites: 0, caches: 0, overdrive: 0, repair: 0, salvage: 0,
  announcement: '', announcementDetail: '', announcementTime: 0,
  setPhase: phase => {
    const current = get().phase;
    if (phase === 'paused' && current !== 'playing' || phase === 'playing' && current !== 'paused') return;
    set({ phase });
  },
  start: () => set(s => ({ phase: 'playing', activeShip: s.ship, runId: s.runId + 1, time: 0, earned: 0, reward: null, rewardQueued: 0, hp: FLIGHTFRAMES[s.ship].hull + s.profile.upgrades.armor * 15, maxHp: FLIGHTFRAMES[s.ship].hull + s.profile.upgrades.armor * 15 })),
  hydrate: () => {
    const prefersCalm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const settings = JSON.parse(localStorage.getItem('poly-vortex-settings-v1') || 'null');
      if (settings && typeof settings === 'object') set({
        ship: shipId(settings.ship),
        adaptiveQuality: typeof settings.adaptiveQuality === 'boolean' ? settings.adaptiveQuality : true,
        runMode: settings.runMode === 'classic' ? 'classic' : 'expedition',
        sound: typeof settings.sound === 'boolean' ? settings.sound : true,
        quality: settings.quality === 'performance' ? 'performance' : 'high',
        difficulty: settings.difficulty === 'overdrive' ? 'overdrive' : 'standard',
        loadout: ['pulse', 'glaive', 'cryo', 'tesla'].includes(settings.loadout) ? settings.loadout : 'pulse',
        aimMode: settings.aimMode === 'precision' ? 'precision' : 'assisted',
        reducedEffects: typeof settings.reducedEffects === 'boolean' ? settings.reducedEffects : prefersCalm,
      });
      else set({ reducedEffects: prefersCalm });
    } catch { set({ reducedEffects: prefersCalm }); /* Corrupt preferences do not affect the flight record. */ }
    try {
      const raw = JSON.parse(localStorage.getItem('poly-vortex-profile-v1') || 'null');
      if (!raw || typeof raw !== 'object') return;
      const n = (v: unknown, max = 1e9) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
      const recorded = Array.isArray(raw.achievements) ? raw.achievements.filter((id: unknown) => ACHIEVEMENTS.some(a => a.id === id)) as string[] : [];
      const achievements = [...new Set([...recorded, ...(n(raw.runs) > 0 ? ['first-run'] : []), ...(n(raw.runs) >= 10 ? ['veteran'] : []), ...(n(raw.wins) > 0 ? ['breaker'] : []), ...(n(raw.wins) >= 3 ? ['ace'] : []), ...(n(raw.totalKills) >= 250 ? ['hunter'] : [])])];
      set({ profile: { credits: n(raw.credits), best: n(raw.best), runs: n(raw.runs), wins: n(raw.wins), totalKills: n(raw.totalKills), achievements, upgrades: { armor: n(raw.upgrades?.armor, 5), reactor: n(raw.upgrades?.reactor, 5), thrusters: n(raw.upgrades?.thrusters, 5) } } });
    } catch { /* A corrupt save starts a fresh profile. */ }
  },
  saveRun: (score, kills, won, bonus = 0) => {
    const s = get(); if (s.phase === 'dead' || s.phase === 'won') return;
    const earned = Math.floor(kills / 3) + (won ? 100 : 10) + Math.max(0, Math.floor(bonus));
    const totalKills = s.profile.totalKills + kills, runs = s.profile.runs + 1, wins = s.profile.wins + Number(won);
    const unlocked = ['first-run', ...(totalKills >= 250 ? ['hunter'] : []), ...(won ? ['breaker'] : []), ...(s.peakCombo >= 5 ? ['chain'] : []), ...(s.level >= 10 ? ['evolution'] : []), ...(runs >= 10 ? ['veteran'] : []), ...(wins >= 3 ? ['ace'] : []), ...(s.sentinels >= 3 ? ['deep-run'] : []), ...(s.time >= 600 ? ['endurance'] : [])];
    const profile = { ...s.profile, credits: s.profile.credits + earned, best: Math.max(s.profile.best, score), runs, wins, totalKills, achievements: [...new Set([...s.profile.achievements, ...unlocked])] };
    save(profile); set({ profile, earned, phase: won ? 'won' : 'dead' });
  },
  purchase: id => {
    const p = get().profile; const level = p.upgrades[id]; const cost = 50 + level * 50;
    if (level >= 5 || p.credits < cost) return;
    const profile = { ...p, credits: p.credits - cost, upgrades: { ...p.upgrades, [id]: level + 1 } };
    save(profile); set({ profile });
  },
}));

useGame.subscribe((s, previous) => {
  if (s.ship === previous.ship && s.adaptiveQuality === previous.adaptiveQuality && s.runMode === previous.runMode && s.sound === previous.sound && s.quality === previous.quality && s.difficulty === previous.difficulty && s.loadout === previous.loadout && s.aimMode === previous.aimMode && s.reducedEffects === previous.reducedEffects) return;
  const keys = ['ship', 'adaptiveQuality', 'runMode', 'sound', 'quality', 'difficulty', 'loadout', 'aimMode', 'reducedEffects'] as const;
  const changed = Object.fromEntries(keys.filter(key => s[key] !== previous[key]).map(key => [key, s[key]]));
  try {
    let saved: Record<string, unknown> = {};
    try { const raw = JSON.parse(localStorage.getItem('poly-vortex-settings-v1') || 'null'); if (raw && typeof raw === 'object') saved = raw; } catch { /* Replace corrupt preferences with a valid snapshot. */ }
    localStorage.setItem('poly-vortex-settings-v1', JSON.stringify({ ship: s.ship, adaptiveQuality: s.adaptiveQuality, runMode: s.runMode, sound: s.sound, quality: s.quality, difficulty: s.difficulty, loadout: s.loadout, aimMode: s.aimMode, reducedEffects: s.reducedEffects, ...saved, ...changed }));
  } catch { /* Preferences are optional when storage is unavailable. */ }
});
