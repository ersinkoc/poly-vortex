import { expect, test } from 'bun:test';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { claimRun, loadSave, saveProfile } from '../src/game/local-save';

test('flight completion preserves a newer profile purchase from another tab', () => {
  const before = useGame.getState(), oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  } });
  try {
    useGame.setState({ phase: 'playing', runKey: 'profile-proof', profile: structuredClone(EMPTY_PROFILE), saveStatus: 'saved' });
    expect(claimRun('profile-proof')).toBe('saved');
    const purchased = { ...structuredClone(EMPTY_PROFILE), credits: 80, runs: 5, achievements: ['first-run'], upgrades: { ...EMPTY_PROFILE.upgrades, armor: 1 } };
    expect(saveProfile(purchased)).toBe('saved');

    useGame.getState().saveRun(0, 0, false);
    expect(loadSave()?.profile).toMatchObject({ credits: 90, runs: 6, upgrades: { armor: 1 } });
    expect(loadSave()?.lastFlight?.achievements).not.toContain('first-run');
    expect(useGame.getState().profile.credits).toBe(90);
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
    useGame.setState(before);
  }
});

test('purchase uses the latest persisted balance and upgrades', () => {
  const before = useGame.getState(), oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  } });
  try {
    const stale = { ...structuredClone(EMPTY_PROFILE), credits: 100 };
    useGame.setState({ phase: 'menu', profile: stale });
    expect(claimRun('purchase-proof')).toBe('saved');
    expect(saveProfile(stale)).toBe('saved');
    expect(saveProfile({ ...stale, credits: 200, upgrades: { ...stale.upgrades, armor: 1 } })).toBe('saved');

    useGame.getState().purchase('reactor');
    expect(loadSave()?.profile).toMatchObject({ credits: 150, upgrades: { armor: 1, reactor: 1 } });
    expect(useGame.getState().profile.credits).toBe(150);
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
    useGame.setState(before);
  }
});
