import { AIM_HALF_ANGLE, PULSE_RANGE, angleDifference, friendlyInLine, selectTarget } from './targeting';
import { terrainImpact } from './terrain';
import type { Entity, Input, Phase } from './types';

export const ROCKET_RULES = { cooldown: 0.75, intentWindow: 0.85, damage: 130, blastRadius: 4.5, range: PULSE_RANGE } as const;
export type LauncherStatus = 'ready' | 'paused' | 'empty' | 'cycling' | 'busy' | 'aim' | 'range' | 'cover' | 'pilot' | 'aligning' | 'searching';
export type LauncherLock = { status: LauncherStatus; target: Entity | null; angle: number; alignment: number; start: { x: number; z: number } | null };
export const LAUNCHER_COPY: Record<LauncherStatus, { title: string; hint: string }> = {
  ready: { title: 'TARGET LOCKED', hint: 'Press E or tap to fire one rocket.' },
  paused: { title: 'LAUNCHER SUSPENDED', hint: 'Resume the protocol to launch.' },
  empty: { title: 'ROCKET RACK EMPTY', hint: 'Fly into a blue ammo crate: up to +3 rockets.' },
  cycling: { title: 'LAUNCHER CYCLING', hint: 'Wait for the next round to chamber.' },
  busy: { title: 'ROCKETS IN FLIGHT', hint: 'Wait for a launcher slot to clear.' },
  aim: { title: 'AIM REQUIRED', hint: 'Move the mouse into the arena. F enables assisted tracking.' },
  range: { title: 'HOSTILE OUT OF RANGE', hint: 'Close to within 23m of a hostile.' },
  cover: { title: 'FIRING LANE BLOCKED', hint: 'Move around the rock or ruin. Rockets cannot cross cover.' },
  pilot: { title: 'PILOT IN FIRING LANE', hint: 'Move sideways or rescue the pilot before firing.' },
  aligning: { title: 'ALIGNING LAUNCHER', hint: 'Press E or tap: hold this target while the ship turns.' },
  searching: { title: 'NO HOSTILE LOCK', hint: 'Aim at a hostile or press F for assisted tracking.' },
};

/** The HUD and launch command use exactly the same lane and readiness rules. */
export function inspectLauncher(args: { phase: Phase; ammo: number; cooldown: number; active: number; limit: number; player: { x: number; z: number; angle: number }; input: Input; mode: 'assisted' | 'precision'; lockedId: number; enemies: readonly Entity[]; allies: readonly { x: number; z: number }[] }): LauncherLock {
  const { player: p, input, enemies, allies } = args;
  const result = (status: LauncherStatus, target: Entity | null = null, angle = 0, alignment = 0, start: LauncherLock['start'] = null): LauncherLock => ({ status, target, angle, alignment, start });
  if (args.phase !== 'playing') return result('paused');
  if (args.ammo <= 0) return result('empty');
  if (args.cooldown > 0) return result('cycling');
  if (args.active >= args.limit) return result('busy');
  if (args.mode === 'precision' && !input.aiming || input.aiming && Math.hypot(input.aimX - p.x, input.aimZ - p.z) < Math.SQRT1_2) return result('aim');
  const target = selectTarget(enemies, p, input, args.lockedId, allies, ROCKET_RULES.range, args.mode);
  if (!target) {
    const aim = Math.atan2(input.aimX - p.x, input.aimZ - p.z);
    const candidates = enemies.filter(e => e.hp > 0 && (!input.aiming || Math.abs(angleDifference(Math.atan2(e.x - p.x, e.z - p.z), aim)) <= AIM_HALF_ANGLE));
    const nearest = candidates.reduce<Entity | null>((a, b) => !a || Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a, null);
    if (!nearest) return result('searching');
    if (Math.hypot(nearest.x - p.x, nearest.z - p.z) > ROCKET_RULES.range) return result('range');
    if (friendlyInLine(p, nearest, allies)) return result('pilot');
    return result('cover');
  }
  const d = Math.hypot(target.x - p.x, target.z - p.z), angle = Math.atan2(target.x - p.x, target.z - p.z);
  const lead = Math.min(0.9, Math.max(0.1, d - target.radius - 0.2));
  const start = { x: p.x + Math.sin(angle) * lead, z: p.z + Math.cos(angle) * lead };
  if (terrainImpact(p, start)) return result('cover');
  const error = Math.abs(angleDifference(angle, p.angle));
  return result(error > 0.5 ? 'aligning' : 'ready', target, angle, Math.max(0, 1 - error / Math.PI), start);
}
