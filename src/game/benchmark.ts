import type { BudgetLevel, Quality } from './render-budget';

export const BENCHMARK_VERSION = 2;
export const BENCHMARK_KEY = 'poly-vortex-benchmark-v1';
export const BENCHMARK_TIERS = ['high', 'performance', 'low'] as const;
export type BenchmarkTier = typeof BENCHMARK_TIERS[number];
export type DeviceCapabilities = {
  threads: number | null; memoryGB: number | null; maxTextureSize: number;
  maxSamples: number; viewport: string; pixelRatio: number;
};
export type TierMeasurement = { tier: BenchmarkTier; fps: number; p95Ms: number; frames: number };
export type BenchmarkReport = { version: number; signature: string; measuredAt: number; device: DeviceCapabilities; measurements: TierMeasurement[]; recommended: BenchmarkTier };
export type BenchmarkStatus = 'idle' | 'running' | 'complete' | 'cancelled' | 'failed';

export function deviceSignature(device: DeviceCapabilities) {
  return JSON.stringify([BENCHMARK_VERSION, device.threads, device.memoryGB, device.maxTextureSize, device.maxSamples, device.viewport, device.pixelRatio]);
}

/** Warm shader caches first; measure sustained frame times, including slow frames. */
export class BenchmarkWindow {
  private warmup = 0;
  private duration = 0;
  private samples: number[] = [];
  reset() { this.warmup = 0; this.duration = 0; this.samples = []; }
  sample(dt: number, eligible: boolean): boolean {
    if (!eligible) { this.reset(); return false; }
    if (!Number.isFinite(dt) || dt <= 0) return false;
    if (this.warmup < 1.5) { this.warmup += Math.min(dt, 1); return false; }
    this.duration += dt;
    this.samples.push(dt * 1000);
    // A few 1 Hz background callbacks cannot establish graphics capacity.
    return this.duration >= 3 - 1e-6 && this.samples.length >= 12 || this.duration >= 8;
  }
  result(tier: BenchmarkTier): TierMeasurement | null {
    if (this.duration < 3 - 1e-6 || this.samples.length < 12) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    return { tier, fps: Math.round(this.samples.length / this.duration), p95Ms: Math.round(sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] * 10) / 10, frames: this.samples.length };
  }
  get progress() { return Math.min(1, (Math.min(1.5, this.warmup) + this.duration) / 4.5); }
}

export function recommendTier(measurements: TierMeasurement[]): BenchmarkTier {
  return BENCHMARK_TIERS.find(tier => measurements.some(m => m.tier === tier && m.fps >= 55 && m.p95Ms <= 25)) ?? 'low';
}

export function recommendedSettings(tier: BenchmarkTier) {
  return { quality: (tier === 'low' ? 'low' : 'high') as Quality, renderBudget: (tier === 'high' ? 0 : 2) as BudgetLevel, resolutionScale: 1, shadows: true, postProcessing: true };
}

export function readBenchmark(text: string | null, signature: string, now = Date.now()): BenchmarkReport | null {
  try {
    const r = JSON.parse(text ?? 'null');
    if (!r || r.version !== BENCHMARK_VERSION || r.signature !== signature || !Number.isFinite(r.measuredAt) || r.measuredAt > now || now - r.measuredAt > 7 * 86400000 || !BENCHMARK_TIERS.includes(r.recommended) || !r.device || deviceSignature(r.device) !== signature || !Array.isArray(r.measurements) || r.measurements.length !== 3) return null;
    if (!BENCHMARK_TIERS.every(tier => r.measurements.filter((m: TierMeasurement) => m?.tier === tier && Number.isFinite(m.fps) && m.fps >= 0 && m.fps <= 1000 && Number.isFinite(m.p95Ms) && m.p95Ms > 0 && m.p95Ms <= 60000 && Number.isInteger(m.frames) && m.frames >= 12 && m.frames <= 10000).length === 1)) return null;
    if (recommendTier(r.measurements) !== r.recommended) return null;
    return r;
  } catch { return null; }
}
