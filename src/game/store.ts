import { create } from 'zustand';
import { EMPTY_PROFILE, type Difficulty, type Phase, type Profile, type Upgrade, type WeaponId } from './types';

type GameStore = {
  phase: Phase; difficulty: Difficulty; loadout: WeaponId; sound: boolean; quality: 'high' | 'performance';
  time: number; hp: number; maxHp: number; xp: number; nextXp: number; level: number;
  kills: number; score: number; combo: number; dash: number; enemies: number; fps: number;
  weapons: Record<WeaponId, number>; choices: Upgrade[]; profile: Profile; earned: number; runId: number;
  setPhase: (phase: Phase) => void; start: () => void; hydrate: () => void;
  saveRun: (score: number, kills: number, won: boolean) => void;
  purchase: (id: keyof Profile['upgrades']) => void;
};
const save = (profile: Profile) => { try { localStorage.setItem('poly-vortex-profile-v1', JSON.stringify(profile)); } catch { /* Storage can be unavailable in private browsing. */ } };
export const useGame = create<GameStore>((set, get) => ({
  phase: 'menu', difficulty: 'standard', loadout: 'pulse', sound: true, quality: 'high',
  time: 0, hp: 100, maxHp: 100, xp: 0, nextXp: 12, level: 1, kills: 0, score: 0, combo: 1, dash: 0,
  enemies: 0, fps: 60, weapons: { pulse: 1, glaive: 0, cryo: 0, tesla: 0 }, choices: [], profile: EMPTY_PROFILE, earned: 0, runId: 0,
  setPhase: phase => set({ phase }),
  start: () => set(s => ({ phase: 'playing', runId: s.runId + 1, time: 0, earned: 0, choices: [], hp: 100 + s.profile.upgrades.armor * 15, maxHp: 100 + s.profile.upgrades.armor * 15 })),
  hydrate: () => {
    try {
      const raw = JSON.parse(localStorage.getItem('poly-vortex-profile-v1') || 'null');
      if (!raw || typeof raw !== 'object') return;
      const n = (v: unknown, max = 1e9) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
      set({ profile: { credits: n(raw.credits), best: n(raw.best), runs: n(raw.runs), wins: n(raw.wins), upgrades: { armor: n(raw.upgrades?.armor, 5), reactor: n(raw.upgrades?.reactor, 5), thrusters: n(raw.upgrades?.thrusters, 5) } } });
    } catch { /* A corrupt save starts a fresh profile. */ }
  },
  saveRun: (score, kills, won) => {
    const s = get(); if (s.phase === 'dead' || s.phase === 'won') return;
    const earned = Math.floor(kills / 3) + (won ? 100 : 10);
    const profile = { ...s.profile, credits: s.profile.credits + earned, best: Math.max(s.profile.best, score), runs: s.profile.runs + 1, wins: s.profile.wins + Number(won) };
    save(profile); set({ profile, earned, phase: won ? 'won' : 'dead' });
  },
  purchase: id => {
    const p = get().profile; const level = p.upgrades[id]; const cost = 50 + level * 50;
    if (level >= 5 || p.credits < cost) return;
    const profile = { ...p, credits: p.credits - cost, upgrades: { ...p.upgrades, [id]: level + 1 } };
    save(profile); set({ profile });
  },
}));
