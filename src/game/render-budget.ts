export type BudgetLevel = 0 | 1 | 2;
type RenderState = { quality: 'high' | 'performance'; adaptiveQuality: boolean; renderBudget: BudgetLevel };
export const renderQuality = (s: RenderState) => s.quality === 'performance' || s.adaptiveQuality && s.renderBudget === 2 ? 'performance' : 'high';
export const renderDpr = (s: RenderState): [number, number] => s.quality === 'performance' ? [1, 1] : !s.adaptiveQuality ? [1, 1.5] : s.renderBudget === 0 ? [1, 1.35] : s.renderBudget === 1 ? [1, 1] : [.75, .85];

/** Sustained foreground samples only. Hysteresis prevents quality flicker. */
export class AdaptiveBudget {
  level: BudgetLevel = 0;
  private elapsed = 0;
  private frames = 0;
  private low = 0;
  private stable = 0;
  private cooldown = 3;
  reset() { this.level = 0; this.elapsed = 0; this.frames = 0; this.low = 0; this.stable = 0; this.cooldown = 3; }
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
