export type BudgetLevel = 0 | 1 | 2;
export type Quality = 'high' | 'balanced' | 'performance' | 'low';
type RenderState = { quality: Quality; adaptiveQuality: boolean; renderBudget: BudgetLevel; resolutionScale?: number; shadows?: boolean; postProcessing?: boolean; benchmarkTier?: Quality | null };
const effectiveState = (s: RenderState): RenderState => s.benchmarkTier ? { ...s, benchmarkTier: null, quality: s.benchmarkTier, adaptiveQuality: false, resolutionScale: 1, shadows: true, postProcessing: s.benchmarkTier === 'high' } : s;
export const renderQuality = (state: RenderState) => { const s = effectiveState(state); return s.quality !== 'high' || s.adaptiveQuality && s.renderBudget === 2 ? 'performance' : 'high'; };
export const renderShadows = (state: RenderState) => { const s = effectiveState(state); return s.shadows !== false && renderQuality(s) === 'high' && (!s.adaptiveQuality || s.renderBudget === 0); };
export const renderPostProcessing = (state: RenderState) => { const s = effectiveState(state); return s.postProcessing !== false && s.quality !== 'low' && !(s.adaptiveQuality && s.renderBudget === 2); };
export function renderDpr(state: RenderState): [number, number] {
  const s = effectiveState(state);
  const base: [number, number] = s.quality === 'low' ? [.5, .65] : s.quality === 'performance' || s.quality === 'balanced' ? [1, 1] : !s.adaptiveQuality ? [1, 1.5] : s.renderBudget === 0 ? [1, 1.35] : s.renderBudget === 1 ? [1, 1] : [.75, .85];
  const scale = typeof s.resolutionScale === 'number' && Number.isFinite(s.resolutionScale) ? Math.min(1, Math.max(.5, s.resolutionScale)) : 1;
  return [Math.max(.35, base[0] * scale), Math.max(.35, base[1] * scale)];
}

/** Optional browser hints only; actual frame times remain authoritative. */
export function initialBudget(device: { hardwareConcurrency?: number; deviceMemory?: number } = {}): BudgetLevel {
  if ((device.hardwareConcurrency ?? Infinity) <= 4 || (device.deviceMemory ?? Infinity) <= 4) return 2;
  return 1;
}

export function graphicsPreferences(raw: Record<string, unknown>) {
  return {
    quality: (['high', 'balanced', 'performance', 'low'].includes(String(raw.quality)) ? raw.quality : 'high') as Quality,
    resolutionScale: typeof raw.resolutionScale === 'number' && Number.isFinite(raw.resolutionScale) ? Math.max(.5, Math.min(1, raw.resolutionScale)) : 1,
    shadows: typeof raw.shadows === 'boolean' ? raw.shadows : true,
    postProcessing: typeof raw.postProcessing === 'boolean' ? raw.postProcessing : true,
  };
}

/** Sustained foreground samples only. Hysteresis prevents quality flicker. */
export class AdaptiveBudget {
  level: BudgetLevel = 0;
  private elapsed = 0;
  private frames = 0;
  private low = 0;
  private stable = 0;
  private cooldown = 3;
  reset(level: BudgetLevel = 0) { this.level = level; this.elapsed = 0; this.frames = 0; this.low = 0; this.stable = 0; this.cooldown = 3; }
  sample(dt: number, eligible: boolean): BudgetLevel {
    if (!eligible || !Number.isFinite(dt) || dt <= 0 || dt > .25) { this.elapsed = 0; this.frames = 0; this.low = 0; this.stable = 0; this.cooldown = Math.max(this.cooldown, 3); return this.level; }
    this.cooldown = Math.max(0, this.cooldown - dt); this.elapsed += dt; this.frames++;
    if (this.elapsed < 1) return this.level;
    const seconds = this.elapsed, fps = this.frames / seconds; this.elapsed = 0; this.frames = 0;
    if (this.cooldown > 0) return this.level;
    this.low = fps < 46 ? this.low + seconds : 0;
    this.stable = fps >= 58 ? this.stable + seconds : 0;
    if (this.low >= 3 && this.level < 2) { this.level = (this.level + 1) as BudgetLevel; this.cooldown = 10; this.low = 0; this.stable = 0; }
    else if (this.stable >= 15 && this.level > 0) { this.level = (this.level - 1) as BudgetLevel; this.cooldown = 10; this.low = 0; this.stable = 0; }
    return this.level;
  }
}
