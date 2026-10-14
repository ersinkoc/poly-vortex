import { expect, mock, test } from 'bun:test';
import * as React from 'react';
import { engine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { claimRun, loadSave } from '../src/game/local-save';

test('an unavailable autosave retry cannot take another tab\'s active flight', async () => {
  const before = useGame.getState(), priorRun = engine.runKey, priorHp = engine.player.hp;
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const events = new Map<string, () => void>(), data = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: true, addEventListener: (key: string, callback: () => void) => { events.set(key, callback); }, removeEventListener: (key: string) => { events.delete(key); } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } } });
  let cleanup: (() => void) | undefined;
  mock.module('react', () => ({ ...React, useEffect: (effect: () => void | (() => void)) => { cleanup = effect() ?? undefined; } }));
  try {
    const { default: RunPersistence } = await import('../src/components/run-persistence');
    engine.runKey = 'local-flight'; engine.player.hp = 100;
    RunPersistence();
    const release = () => { const event = events.get('visibilitychange'); if (!event) throw new Error('event gate missing'); event(); };

    expect(claimRun('other-flight', 'other-tab')).toBe('saved');
    useGame.setState({ phase: 'playing', runKey: 'local-flight', saveStatus: 'unavailable' });
    release();
    expect(loadSave()).toMatchObject({ currentRun: 'other-flight', ownerId: 'other-tab' });
    expect(useGame.getState()).toMatchObject({ phase: 'paused', saveStatus: 'conflict' });

    data.clear(); useGame.setState({ phase: 'playing', saveStatus: 'unavailable' });
    release();
    expect(loadSave()?.currentRun).toBe('local-flight');
    expect(loadSave()?.checkpoint).not.toBeNull();
    expect(useGame.getState().saveStatus).toBe('saved');

    expect(claimRun('local-flight', 'other-tab')).toBe('saved');
    useGame.setState({ phase: 'playing', saveStatus: 'unavailable' });
    release();
    expect(loadSave()).toMatchObject({ currentRun: 'local-flight', ownerId: 'other-tab' });
    expect(useGame.getState()).toMatchObject({ phase: 'paused', saveStatus: 'conflict' });
  } finally {
    cleanup?.();
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
    engine.runKey = priorRun; engine.player.hp = priorHp; useGame.setState(before);
  }
});
