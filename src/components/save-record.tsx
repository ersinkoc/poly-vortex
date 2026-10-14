'use client';
import { Download } from 'lucide-react';
import { useGame } from '@/game/store';
import { exportLocalSave, LOCAL_WRITER_ID } from '@/game/local-save';
import { FLIGHTFRAMES } from '@/game/flightframes';
import { ACHIEVEMENTS } from '@/game/progression';
import { engine } from '@/game/engine';
import type { SaveDocument } from '@/game/local-save';
export default function SaveRecord() {
  const last = useGame(s => s.lastFlight), savedAt = useGame(s => s.lastSavedAt);
  const victory = useGame(s => s.lastVictory), achievement = useGame(s => s.lastAchievement);
  const download = () => {
    const state = useGame.getState(), backup = JSON.parse(exportLocalSave()) as SaveDocument;
    if (state.saveStatus !== 'conflict') {
      backup.profile = state.profile; backup.lastFlight = state.lastFlight; backup.lastVictory = state.lastVictory; backup.lastAchievement = state.lastAchievement;
      if (['playing', 'paused'].includes(state.phase) && engine.runKey === state.runKey && engine.player.hp > 0) { backup.currentRun = state.runKey; backup.ownerId = LOCAL_WRITER_ID; backup.checkpoint = { runKey: state.runKey, ship: engine.ship, time: engine.time, level: engine.level, chapter: engine.chapter, savedAt: Date.now(), payload: engine.checkpoint() }; }
      else if (state.lastFlight?.runKey === backup.currentRun) { backup.checkpoint = null; backup.currentRun = null; backup.ownerId = null; }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = `poly-vortex-save-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="save-record"><header><span>LOCAL FLIGHT RECORD</span><button onClick={download}><Download size={15}/> EXPORT BACKUP</button></header>
    {last ? <p>{last.won ? 'EXTRACTED' : 'LAST FLIGHT'} · {FLIGHTFRAMES[last.ship].name} · Front {last.chapter} · LV {last.level}<br/>{Math.floor(last.time / 60)}m {Math.floor(last.time % 60)}s · {last.score.toLocaleString('en-US')} score · {last.rescued} rescued</p> : <p>Core upgrades and flight checkpoints stay on this browser.</p>}
    {victory && !last?.won && <small>Last extraction: Front {victory.chapter} · {Math.floor(victory.time / 60)}m · {victory.score.toLocaleString('en-US')} score</small>}
    {achievement && <small>Last unlocked: {ACHIEVEMENTS.find(a => a.id === achievement.id)?.name}</small>}
    {savedAt > 0 && <small>Saved {new Date(savedAt).toLocaleString()}</small>}
  </section>;
}
