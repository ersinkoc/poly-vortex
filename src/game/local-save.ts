import { EMPTY_PROFILE, type Profile } from './types';
import { ACHIEVEMENTS } from './progression';
import type { EngineCheckpoint, JsonObject } from './checkpoint';
import { SHIP_IDS, type ShipId } from './flightframes';

export const SAVE_KEY = 'poly-vortex-save-v2', SAVE_BACKUP_KEY = 'poly-vortex-save-v2-backup';
export const SAVE_LIMIT = 512_000;
export type FlightResult = { runKey: string; endedAt: number; won: boolean; score: number; kills: number; time: number; ship: ShipId; level: number; chapter: number; sentinels: number; rescued: number; achievements: string[] };
export type SavedFlight = { runKey: string; savedAt: number; ship: ShipId; time: number; level: number; chapter: number; payload: EngineCheckpoint };
export type LastAchievement = { id: string; unlockedAt: number; runKey: string };
export type SaveDocument = { schema: 2; deviceId: string; revision: number; updatedAt: number; currentRun: string | null; ownerId: string | null; profile: Profile; settings: Record<string, unknown>; lastFlight: FlightResult | null; lastVictory: FlightResult | null; lastAchievement: LastAchievement | null; checkpoint: SavedFlight | null };
export type SaveStatus = 'saved' | 'unavailable' | 'conflict' | 'invalid';
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const n = (v: unknown, max = 1e9) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
export const newRunKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const LOCAL_WRITER_ID = newRunKey();
export function normalizeProfile(raw: unknown): Profile {
  const r = plain(raw) ? raw : {}, upgrades = plain(r.upgrades) ? r.upgrades : {};
  const recorded = Array.isArray(r.achievements) ? r.achievements.filter((id): id is string => typeof id === 'string' && ACHIEVEMENTS.some(a => a.id === id)) : [];
  const achievements = [...new Set([...recorded, ...(n(r.runs) > 0 ? ['first-run'] : []), ...(n(r.runs) >= 10 ? ['veteran'] : []), ...(n(r.wins) > 0 ? ['breaker'] : []), ...(n(r.wins) >= 3 ? ['ace'] : []), ...(n(r.totalKills) >= 250 ? ['hunter'] : [])])];
  return { credits: n(r.credits), best: n(r.best), runs: n(r.runs), wins: n(r.wins), totalKills: n(r.totalKills), achievements, upgrades: { armor: n(upgrades.armor, 5), reactor: n(upgrades.reactor, 5), thrusters: n(upgrades.thrusters, 5) } };
}
function legacy(key: string): unknown { try { return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown; } catch { return null; } }
function checksum(text: string) { let hash = 2166136261; for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619); return (hash >>> 0).toString(16); }
function validResult(v: unknown) {
  return plain(v) && typeof v.runKey === 'string' && typeof v.won === 'boolean' && SHIP_IDS.includes(v.ship as ShipId) && Array.isArray(v.achievements) && v.achievements.every(id => typeof id === 'string' && ACHIEVEMENTS.some(a => a.id === id)) && ['time', 'score', 'kills', 'level', 'chapter', 'sentinels', 'rescued', 'endedAt'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]));
}
export function encodeSave(document: SaveDocument) { const data = JSON.stringify(document); if (data.length > SAVE_LIMIT) throw new Error('Save is too large'); return JSON.stringify({ data, checksum: checksum(data) }); }
export function decodeSave(text: string | null): SaveDocument | null {
  try {
    if (!text || text.length > SAVE_LIMIT * 2 + 4096) return null;
    const envelope: unknown = JSON.parse(text);
    if (!plain(envelope) || typeof envelope.data !== 'string' || envelope.data.length > SAVE_LIMIT || checksum(envelope.data) !== envelope.checksum) return null;
    const doc: unknown = JSON.parse(envelope.data);
    if (!plain(doc) || doc.schema !== 2 || typeof doc.deviceId !== 'string' || typeof doc.revision !== 'number' || !Number.isSafeInteger(doc.revision) || doc.revision < 0 || doc.revision >= Number.MAX_SAFE_INTEGER || !Number.isFinite(doc.updatedAt) || !plain(doc.profile) || !plain(doc.settings) || doc.currentRun !== null && typeof doc.currentRun !== 'string' || doc.ownerId !== null && typeof doc.ownerId !== 'string') return null;
    if (doc.checkpoint !== null && (!plain(doc.checkpoint) || typeof doc.checkpoint.runKey !== 'string' || doc.checkpoint.runKey !== doc.currentRun || !plain(doc.checkpoint.payload) || doc.checkpoint.payload.schema !== 1 || !plain(doc.checkpoint.payload.state) || !plain(doc.checkpoint.payload.systems) || !SHIP_IDS.includes(doc.checkpoint.ship as ShipId) || !['time', 'level', 'chapter', 'savedAt'].every(k => typeof (doc.checkpoint as Record<string, unknown>)[k] === 'number' && Number.isFinite((doc.checkpoint as Record<string, unknown>)[k])))) return null;
    if (doc.lastFlight !== null && !validResult(doc.lastFlight)) return null;
    if (doc.lastVictory !== null && (!validResult(doc.lastVictory) || (doc.lastVictory as Record<string, unknown>).won !== true)) return null;
    if (doc.lastAchievement !== null && (!plain(doc.lastAchievement) || typeof doc.lastAchievement.runKey !== 'string' || !Number.isFinite(doc.lastAchievement.unlockedAt) || !ACHIEVEMENTS.some(a => a.id === (doc.lastAchievement as Record<string, unknown>).id))) return null;
    // The engine applies its stricter shape/bounds validator before resuming.
    return { ...doc, profile: normalizeProfile(doc.profile) } as SaveDocument;
  } catch { return null; }
}
export function loadSave(): SaveDocument | null {
  try { return decodeSave(localStorage.getItem(SAVE_KEY)) ?? decodeSave(localStorage.getItem(SAVE_BACKUP_KEY)); } catch { return null; }
}
export function readProfile() { return loadSave()?.profile ?? normalizeProfile(legacy('poly-vortex-profile-v1')); }
export function readSettings() { const old = legacy('poly-vortex-settings-v1'); return { ...(plain(old) ? old : {}), ...(loadSave()?.settings ?? {}) }; }
function baseSave(): SaveDocument {
  return loadSave() ?? { schema: 2, deviceId: newRunKey(), revision: 0, updatedAt: Date.now(), currentRun: null, ownerId: null, profile: normalizeProfile(legacy('poly-vortex-profile-v1') ?? EMPTY_PROFILE), settings: readSettings(), lastFlight: null, lastVictory: null, lastAchievement: null, checkpoint: null };
}
function writeSave(doc: SaveDocument): SaveStatus {
  try {
    const existing = localStorage.getItem(SAVE_KEY);
    if (existing) try { const outer = JSON.parse(existing); if (typeof outer?.schema === 'number' && outer.schema > 2) return 'unavailable'; const data = typeof outer.data === 'string' ? JSON.parse(outer.data) : outer; if (typeof data.schema === 'number' && data.schema > 2) return 'unavailable'; } catch { /* Corrupt data can be replaced using the recovered backup. */ }
    const next = { ...doc, revision: doc.revision + 1, updatedAt: Date.now() }, text = encodeSave(next);
    localStorage.setItem(SAVE_KEY, text);
    // Mirror the latest committed document, so recovery cannot resurrect a finished flight.
    try { localStorage.setItem(SAVE_BACKUP_KEY, text); } catch { /* A committed primary remains usable. */ }
    return 'saved';
  } catch { return 'unavailable'; }
}
export function claimRun(runKey: string, ownerId = LOCAL_WRITER_ID): SaveStatus { return writeSave({ ...baseSave(), currentRun: runKey, ownerId, checkpoint: null }); }
export function claimResume(runKey: string, ownerId = LOCAL_WRITER_ID): SaveStatus { const doc = loadSave(); if (!doc || !doc.checkpoint || doc.currentRun !== runKey) return 'conflict'; return writeSave({ ...doc, ownerId }); }
export function saveCheckpoint(flight: SavedFlight, ownerId = LOCAL_WRITER_ID): SaveStatus {
  const doc = loadSave(); if (!doc) return 'unavailable';
  if (doc.currentRun !== flight.runKey || doc.ownerId !== ownerId) return 'conflict';
  return writeSave({ ...doc, checkpoint: flight });
}
export function saveProfile(profile: Profile, result?: FlightResult): SaveStatus {
  if (result?.runKey && !loadSave()) return 'unavailable';
  const doc = baseSave();
  if (result?.runKey && (doc.currentRun !== result.runKey || doc.ownerId !== LOCAL_WRITER_ID)) return 'conflict';
  const achievement = result?.achievements.at(-1);
  const status = writeSave({ ...doc, profile, ...(result ? { lastFlight: result, ...(result.won ? { lastVictory: result } : {}), ...(achievement ? { lastAchievement: { id: achievement, unlockedAt: result.endedAt, runKey: result.runKey } } : {}), checkpoint: null, currentRun: null, ownerId: null } : {}) });
  // Keep the older profile available to versions already open in another tab.
  if (status === 'saved') try { localStorage.setItem('poly-vortex-profile-v1', JSON.stringify(profile)); } catch { /* v2 is authoritative. */ }
  return status;
}
export function saveSettings(settings: Record<string, unknown>): SaveStatus { const doc = loadSave(); return doc ? writeSave({ ...doc, settings }) : 'saved'; }
export function savedFlightSummary() { const flight = loadSave()?.checkpoint; if (!flight) return null; const { payload: _, ...summary } = flight; return summary; }
export function exportLocalSave(): string { return JSON.stringify(loadSave() ?? baseSave(), null, 2); }
export type SaveSummary = Omit<SavedFlight, 'payload'>;
export type CloudPayload = { schema: 2; profile: Profile; settings: Record<string, unknown>; lastFlight: FlightResult | null; checkpoint: SavedFlight | null; metadata: JsonObject };
