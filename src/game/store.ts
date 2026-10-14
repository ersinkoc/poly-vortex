import type { EnemyWeapon } from './enemy-weapons';
import type { EnemyRole } from './battlefield';
import { create } from 'zustand';
import { EMPTY_PROFILE, WEAPONS, type Difficulty, type Phase, type Profile, type WeaponId } from './types';
import type { RewardRoll } from './reward-reel';
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
import { claimRun, newRunKey, readProfile, readSettings, savedFlightSummary, loadSave, saveProfile, saveSettings, type SaveSummary, type SavedFlight, type FlightResult, type SaveStatus, type LastAchievement } from './local-save';

type GameStore = {
  runKey: string; savedFlight: SaveSummary | null; lastFlight: FlightResult | null; saveStatus: SaveStatus; lastSavedAt: number;
  lastVictory: FlightResult | null; lastAchievement: LastAchievement | null;
  resumeFlight: (flight: SavedFlight) => void;
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
  targeting: 'aim' | 'auto'; target: { id: number; kind: 0 | 1 | 2 | 3; weapon?: EnemyWeapon; role?: EnemyRole; distance: number; hp: number; maxHp: number } | null;
  mission: Mission | null; missionsCompleted: number; rescued: number;
  phase: Phase; difficulty: Difficulty; loadout: WeaponId; sound: boolean; quality: 'high' | 'performance';
  time: number; hp: number; maxHp: number; xp: number; nextXp: number; level: number;
  kills: number; score: number; combo: number; dash: number; enemies: number; fps: number;
  weapons: Record<WeaponId, number>; reward: RewardRoll | null; rewardQueued: number; profile: Profile; earned: number; runId: number;
  shield: number; maxShield: number; surge: number; sector: number; bossPhase: number; peakCombo: number; elites: number; caches: number;
  barrier: number; barrierCooldown: number;
  overdrive: number; repair: number; salvage: number; announcement: string; announcementDetail: string; announcementTime: number;
  setPhase: (phase: Phase) => void; start: () => void; hydrate: () => void;
  saveRun: (score: number, kills: number, won: boolean, bonus?: number) => void;
  purchase: (id: keyof Profile['upgrades']) => void;
};
export const useGame = create<GameStore>((set, get) => ({
  runKey: '', savedFlight: null, lastFlight: null, saveStatus: 'saved', lastSavedAt: 0,
  lastVictory: null, lastAchievement: null,
  resumeFlight: flight => set(s => ({ runKey: flight.runKey, activeShip: flight.ship, phase: 'paused', runId: s.runId + 1, maxHp: Number((flight.payload.state.player as Record<string, unknown>).maxHp), runMode: flight.payload.state.runMode as RunMode, difficulty: flight.payload.state.overdrive ? 'overdrive' : 'standard', loadout: flight.payload.state.startingLoadout as WeaponId, savedFlight: null, earned: 0, saveStatus: 'saved' })),
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
  enemies: 0, fps: 60, weapons: { pulse: 1, glaive: 0, cryo: 0, tesla: 0, rail: 0, scatter: 0 }, reward: null, rewardQueued: 0, profile: EMPTY_PROFILE, earned: 0, runId: 0,
  shield: 40, maxShield: 40, surge: 100, sector: 0, bossPhase: 0, peakCombo: 1, elites: 0, caches: 0, overdrive: 0, repair: 0, salvage: 0,
  announcement: '', announcementDetail: '', announcementTime: 0,
  barrier: 0, barrierCooldown: 0,
  setPhase: phase => {
    const current = get().phase;
    if (phase === 'playing' && get().saveStatus === 'conflict') return;
    if (phase === 'paused' && current !== 'playing' || phase === 'playing' && current !== 'paused') return;
    set({ phase });
  },
  start: () => { const runKey = newRunKey(), saveStatus = claimRun(runKey); set(s => ({ runKey, saveStatus, savedFlight: null, phase: 'playing', activeShip: s.ship, runId: s.runId + 1, time: 0, earned: 0, reward: null, rewardQueued: 0, hp: FLIGHTFRAMES[s.ship].hull + s.profile.upgrades.armor * 15, maxHp: FLIGHTFRAMES[s.ship].hull + s.profile.upgrades.armor * 15 })); },
  hydrate: () => {
    const saved = loadSave(); set({ profile: readProfile(), savedFlight: savedFlightSummary(), lastFlight: saved?.lastFlight ?? null, lastVictory: saved?.lastVictory ?? null, lastAchievement: saved?.lastAchievement ?? null, lastSavedAt: saved?.updatedAt ?? 0 });
    const prefersCalm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const settings = readSettings();
      if (settings && typeof settings === 'object') set({
        ship: shipId(settings.ship),
        adaptiveQuality: typeof settings.adaptiveQuality === 'boolean' ? settings.adaptiveQuality : true,
        runMode: settings.runMode === 'classic' ? 'classic' : 'expedition',
        sound: typeof settings.sound === 'boolean' ? settings.sound : true,
        quality: settings.quality === 'performance' ? 'performance' : 'high',
        difficulty: settings.difficulty === 'overdrive' ? 'overdrive' : 'standard',
        loadout: typeof settings.loadout === 'string' && Object.hasOwn(WEAPONS, settings.loadout) ? settings.loadout as WeaponId : 'pulse',
        aimMode: settings.aimMode === 'precision' ? 'precision' : 'assisted',
        reducedEffects: typeof settings.reducedEffects === 'boolean' ? settings.reducedEffects : prefersCalm,
      });
      else set({ reducedEffects: prefersCalm });
    } catch { set({ reducedEffects: prefersCalm }); /* Corrupt preferences do not affect the flight record. */ }
  },
  saveRun: (score, kills, won, bonus = 0) => {
    const s = get(); if (s.phase === 'dead' || s.phase === 'won') return;
    const currentProfile = loadSave()?.profile ?? s.profile;
    const earned = Math.floor(kills / 3) + (won ? 100 : 10) + Math.max(0, Math.floor(bonus));
    const totalKills = currentProfile.totalKills + kills, runs = currentProfile.runs + 1, wins = currentProfile.wins + Number(won);
    const unlocked = ['first-run', ...(totalKills >= 250 ? ['hunter'] : []), ...(won ? ['breaker'] : []), ...(s.peakCombo >= 5 ? ['chain'] : []), ...(s.level >= 10 ? ['evolution'] : []), ...(runs >= 10 ? ['veteran'] : []), ...(wins >= 3 ? ['ace'] : []), ...(s.sentinels >= 3 ? ['deep-run'] : []), ...(s.time >= 600 ? ['endurance'] : [])];
    const profile = { ...currentProfile, credits: currentProfile.credits + earned, best: Math.max(currentProfile.best, score), runs, wins, totalKills, achievements: [...new Set([...currentProfile.achievements, ...unlocked])] };
    const result: FlightResult = { runKey: s.runKey, endedAt: Date.now(), won, score, kills, time: s.time, ship: s.activeShip, level: s.level, chapter: s.chapter, sentinels: s.sentinels, rescued: s.rescued, achievements: unlocked.filter(id => !currentProfile.achievements.includes(id)) };
    const saveStatus = saveProfile(profile, result);
    if (saveStatus === 'conflict') { set({ profile: readProfile(), earned: 0, phase: won ? 'won' : 'dead', saveStatus, savedFlight: savedFlightSummary() }); return; }
    const achievement = result.achievements.at(-1);
    set({ profile, earned, phase: won ? 'won' : 'dead', saveStatus, lastFlight: result, savedFlight: null, ...(won ? { lastVictory: result } : {}), ...(achievement ? { lastAchievement: { id: achievement, unlockedAt: result.endedAt, runKey: result.runKey } } : {}) });
  },
  purchase: id => {
    const p = loadSave()?.profile ?? get().profile; const level = p.upgrades[id]; const cost = 50 + level * 50;
    if (level >= 5 || p.credits < cost) return;
    const profile = { ...p, credits: p.credits - cost, upgrades: { ...p.upgrades, [id]: level + 1 } };
    const saveStatus = saveProfile(profile); set({ profile, saveStatus });
  },
}));

useGame.subscribe((s, previous) => {
  if (s.ship === previous.ship && s.adaptiveQuality === previous.adaptiveQuality && s.runMode === previous.runMode && s.sound === previous.sound && s.quality === previous.quality && s.difficulty === previous.difficulty && s.loadout === previous.loadout && s.aimMode === previous.aimMode && s.reducedEffects === previous.reducedEffects) return;
  const keys = ['ship', 'adaptiveQuality', 'runMode', 'sound', 'quality', 'difficulty', 'loadout', 'aimMode', 'reducedEffects'] as const;
  const changed = Object.fromEntries(keys.filter(key => s[key] !== previous[key]).map(key => [key, s[key]]));
  try {
    let saved: Record<string, unknown> = {};
    try { const raw = JSON.parse(localStorage.getItem('poly-vortex-settings-v1') || 'null'); if (raw && typeof raw === 'object') saved = raw; } catch { /* Replace corrupt preferences with a valid snapshot. */ }
    const settings = { ship: s.ship, adaptiveQuality: s.adaptiveQuality, runMode: s.runMode, sound: s.sound, quality: s.quality, difficulty: s.difficulty, loadout: s.loadout, aimMode: s.aimMode, reducedEffects: s.reducedEffects, ...saved, ...(loadSave()?.settings ?? {}), ...changed };
    localStorage.setItem('poly-vortex-settings-v1', JSON.stringify(settings)); saveSettings(settings);
  } catch { /* Preferences are optional when storage is unavailable. */ }
});
