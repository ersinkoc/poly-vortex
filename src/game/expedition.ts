export type RunMode = 'expedition' | 'classic';
export const EXPEDITION = { combatDuration: 180, serviceDuration: 30, dockDuration: 3, dockRadius: 3.4 } as const;
export const DOCTRINES = [
  { name: 'BALANCED FRONT', detail: 'Mixed patrols. Find your rhythm.', heavy: 0.09, orbiter: 0.19, speed: 1, color: '#baff72' },
  { name: 'INTERCEPTOR PACK', detail: 'Fast gunships flank in packs. Dodge when the red lock appears.', heavy: 0.06, orbiter: 0.12, speed: 1.12, color: '#ffab65' },
  { name: 'ARTILLERY LINE', detail: 'More orbiters. Use stone cover against crossfire.', heavy: 0.08, orbiter: 0.38, speed: 1, color: '#bc92ff' },
  { name: 'ARMORED COLUMN', detail: 'More goliaths. Chain their death blasts.', heavy: 0.26, orbiter: 0.18, speed: 0.95, color: '#72dcff' },
] as const;
export type ServiceDock = { x: number; z: number; remaining: number; progress: number; serviced: boolean };
export type DockStatus = 'offline' | 'approach' | 'moving' | 'threats' | 'hit' | 'holding' | 'ready';
export const DOCK_COPY: Record<DockStatus, string> = { offline: 'BEACON OFFLINE', approach: 'FOLLOW THE GREEN SIGNAL', moving: 'RELEASE MOVEMENT TO DOCK', threats: 'CLEAR HOSTILES WITHIN 5m', hit: 'WAIT 4s WITHOUT DAMAGE', holding: 'HOLD POSITION FOR SERVICE', ready: 'READY TO EXTRACT OR CONTINUE' };
export function dockStatus(player: { x: number; z: number; vx: number; vz: number }, dock: ServiceDock | null, enemies: readonly { x: number; z: number; hp: number }[], shieldDelay: number): DockStatus {
  if (!dock || dock.remaining <= 0) return 'offline';
  if (Math.hypot(player.x - dock.x, player.z - dock.z) > EXPEDITION.dockRadius) return 'approach';
  if (enemies.some(e => e.hp > 0 && Math.hypot(e.x - dock.x, e.z - dock.z) < 5)) return 'threats';
  if (shieldDelay > 0) return 'hit';
  if (Math.hypot(player.vx, player.vz) >= 2) return 'moving';
  return dock.serviced ? 'ready' : 'holding';
}
/** Bounded escalation: long runs vary their fleet without unbounded speed or spawn rates. */
export const doctrineAt = (chapter: number) => DOCTRINES[(Math.max(1, Math.floor(chapter)) - 1) % DOCTRINES.length];
export const fleetScale = (chapter: number, elapsed: number) => ({
  health: 1 + Math.min(EXPEDITION.combatDuration, Math.max(0, elapsed)) / 240 + Math.log2(Math.max(1, chapter)) * 0.65,
  speed: Math.min(2.2, 1 + Math.min(EXPEDITION.combatDuration, Math.max(0, elapsed)) / 360 + Math.log2(Math.max(1, chapter)) * 0.12),
  pressure: Math.min(6.5, 1 + Math.min(EXPEDITION.combatDuration, Math.max(0, elapsed)) / 45 + Math.log2(Math.max(1, chapter)) * 0.3),
});
