'use client';
import { useEffect } from 'react';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { loadSave, saveCheckpoint, savedFlightSummary, readProfile, claimRun, SAVE_KEY, LOCAL_WRITER_ID } from '@/game/local-save';

/** Serialize off the render loop, with synchronous final flushes on pause and exit. */
export default function RunPersistence() {
  useEffect(() => {
    let idle: number | ReturnType<typeof setTimeout> | null = null;
    const cancel = () => { if (idle === null) return; if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle as number); else clearTimeout(idle); idle = null; };
    const flush = () => {
      idle = null; const state = useGame.getState();
      if (!state.runKey || engine.runKey !== state.runKey || !['playing', 'paused'].includes(state.phase) || engine.player.hp <= 0) return;
      try {
        if (state.saveStatus === 'unavailable' && loadSave()?.currentRun !== state.runKey) {
          const status = claimRun(state.runKey); if (status !== 'saved') { useGame.setState({ saveStatus: status }); return; }
        }
        const savedAt = Date.now();
        const status = saveCheckpoint({ runKey: state.runKey, savedAt, ship: engine.ship, time: engine.time, level: engine.level, chapter: engine.chapter, payload: engine.checkpoint() });
        useGame.setState({ saveStatus: status, ...(status === 'saved' ? { lastSavedAt: savedAt } : {}) });
      } catch { useGame.setState({ saveStatus: 'unavailable' }); }
    };
    const schedule = () => { if (idle !== null) return; idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(flush, { timeout: 750 }) : setTimeout(flush, 0); };
    const finalFlush = () => { cancel(); flush(); };
    const changed = useGame.subscribe((state, previous) => {
      if (state.phase === 'menu' && previous.phase !== 'menu') useGame.setState({ savedFlight: savedFlightSummary(), ...(state.saveStatus === 'conflict' ? { saveStatus: 'saved' as const } : {}) });
      if (state.phase === 'paused' && previous.phase === 'playing') finalFlush();
      else if (state.runId !== previous.runId || state.level !== previous.level || state.missionsCompleted !== previous.missionsCompleted || state.rescued !== previous.rescued) schedule();
    });
    const visibility = () => { if (document.hidden) finalFlush(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== SAVE_KEY) return;
      const state = useGame.getState(), document = loadSave();
      useGame.setState({ profile: readProfile(), lastFlight: document?.lastFlight ?? null, ...(state.phase === 'menu' ? { savedFlight: savedFlightSummary() } : {}) });
      if (document && state.runKey && (document.currentRun !== state.runKey || document.ownerId !== LOCAL_WRITER_ID) && ['playing', 'paused'].includes(state.phase)) { useGame.setState({ phase: 'paused', saveStatus: 'conflict' }); }
    };
    const interval = setInterval(() => { if (useGame.getState().phase === 'playing') schedule(); }, 2000);
    window.addEventListener('pagehide', finalFlush); document.addEventListener('visibilitychange', visibility); window.addEventListener('storage', storage);
    return () => { finalFlush(); changed(); clearInterval(interval); window.removeEventListener('pagehide', finalFlush); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('storage', storage); };
  }, []);
  return null;
}
