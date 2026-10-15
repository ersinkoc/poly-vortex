import { expect, test } from 'bun:test';
import { BenchmarkWindow, BENCHMARK_VERSION, deviceSignature, readBenchmark, recommendTier, recommendedSettings, type DeviceCapabilities, type TierMeasurement } from '../src/game/benchmark';
import { renderDpr, renderShadows, renderPostProcessing } from '../src/game/render-budget';

const device: DeviceCapabilities = { threads: 8, memoryGB: null, maxTextureSize: 16384, maxSamples: 4, viewport: '1280×720', pixelRatio: 1 };
const measurements: TierMeasurement[] = [{ tier: 'high', fps: 32, p95Ms: 40, frames: 96 }, { tier: 'performance', fps: 60, p95Ms: 18, frames: 180 }, { tier: 'low', fps: 60, p95Ms: 17, frames: 180 }];

test('calibration excludes shader warmup and reports the measured average and slow frames', () => {
  const window = new BenchmarkWindow();
  for (let i = 0; i < 2; i++) expect(window.sample(.8, true)).toBe(false);
  for (let i = 0; i < 60; i++) window.sample(1 / 20, true);
  expect(window.result('high')).toEqual({ tier: 'high', fps: 20, p95Ms: 50, frames: 60 });
  expect(window.progress).toBeCloseTo(1);
});

test('a hidden tab resets the current measurement, and slow foreground frames are counted', () => {
  const window = new BenchmarkWindow();
  window.sample(1, true); window.sample(1, true); window.sample(.1, true);
  window.sample(30, false); expect(window.progress).toBe(0); expect(window.result('high')).toBeNull();
  window.sample(NaN, true); window.sample(-1, true);
  window.sample(1, true); window.sample(1, true);
  for (let i = 0; i < 12; i++) window.sample(.5, true);
  expect(window.result('low')).toEqual({ tier: 'low', fps: 2, p95Ms: 500, frames: 12 });
});

test('timer-throttled one-Hz callbacks cannot produce a misleading device recommendation', () => {
  const window = new BenchmarkWindow(); window.sample(1, true); window.sample(1, true);
  for (let i = 0; i < 8; i++) window.sample(1, true);
  expect(window.result('high')).toBeNull();
});

test('recommendation requires both sustained FPS and acceptable slow frames, independent of CPU hints', () => {
  expect(recommendTier(measurements)).toBe('performance');
  expect(recommendTier([{ tier: 'high', fps: 60, p95Ms: 40, frames: 180 }, ...measurements.slice(1)])).toBe('performance');
  expect(recommendTier([{ tier: 'high', fps: 60, p95Ms: 17, frames: 180 }, ...measurements.slice(1)])).toBe('high');
  expect(recommendTier(measurements.map(m => ({ ...m, fps: 20 })))).toBe('low');
  const settings = { ...recommendedSettings('performance'), adaptiveQuality: true };
  expect(renderPostProcessing(settings)).toBe(false); expect(renderShadows(settings)).toBe(false);
  expect(renderDpr(settings)[1]).toBeLessThanOrEqual(1);
});

test('test stages override graphics transiently and restore the exact manual values after cancellation', () => {
  const manual = { quality: 'low', adaptiveQuality: false, renderBudget: 2, resolutionScale: .5, shadows: false, postProcessing: false } as const;
  const stage = { ...manual, benchmarkTier: 'high' } as const;
  expect(renderShadows(stage)).toBe(true); expect(renderPostProcessing(stage)).toBe(true); expect(renderDpr(stage)).toEqual([1, 1.5]);
  expect(renderDpr({ ...stage, benchmarkTier: null })).toEqual([.35, .35]);
  expect(manual).toMatchObject({ quality: 'low', shadows: false, resolutionScale: .5 });
});

test('cached measurements require matching capability/viewport, age, version and complete valid tiers', () => {
  const now = 1_800_000_000_000, signature = deviceSignature(device);
  const report = { version: BENCHMARK_VERSION, signature, device, measuredAt: now, recommended: 'performance' as const, measurements };
  expect(readBenchmark(JSON.stringify(report), signature, now)).toEqual(report);
  expect(readBenchmark(JSON.stringify(report), deviceSignature({ ...device, pixelRatio: 2 }), now)).toBeNull();
  expect(readBenchmark(JSON.stringify(report), signature, now + 8 * 86400000)).toBeNull();
  expect(readBenchmark(JSON.stringify(report), signature, now - 1)).toBeNull();
  expect(readBenchmark('{broken', signature, now)).toBeNull();
  for (const patch of [{ version: 0 }, { measurements: measurements.slice(1) }, { measurements: [measurements[0], measurements[0], measurements[2]] }, { recommended: 'high' }, { measurements: measurements.map(m => ({ ...m, fps: null })) }]) {
    expect(readBenchmark(JSON.stringify({ ...report, ...patch }), signature, now)).toBeNull();
  }
});
