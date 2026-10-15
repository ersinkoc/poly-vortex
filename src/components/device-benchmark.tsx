'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/game/store';
import { BENCHMARK_KEY, BENCHMARK_TIERS, BENCHMARK_VERSION, BenchmarkWindow, deviceSignature, readBenchmark, recommendTier, recommendedSettings, type DeviceCapabilities, type TierMeasurement } from '@/game/benchmark';

/** Runs inside the real arena renderer, with a bounded synthetic draw/geometry load.
 * Preferences and the flight simulation are never changed by intermediate tiers. */
export default function DeviceBenchmark() {
  const { gl, size, invalidate } = useThree();
  const ready = useGame(s => s.graphicsHydrated), status = useGame(s => s.benchmarkStatus), request = useGame(s => s.benchmarkRequest);
  const stage = useGame(s => s.benchmarkTier);
  const initialized = useRef(false), active = useRef(false), tierIndex = useRef(0);
  const sample = useMemo(() => new BenchmarkWindow(), []), results = useRef<TierMeasurement[]>([]);
  const device = useRef<DeviceCapabilities | null>(null), contextLost = useRef(false), foregroundTime = useRef(0);
  const assets = useMemo(() => ({ geometry: new THREE.SphereGeometry(.38, 32, 16), material: new THREE.MeshStandardMaterial({ color: '#9fafbd', roughness: .45, metalness: .65 }) }), []);
  useEffect(() => () => { assets.geometry.dispose(); assets.material.dispose(); }, [assets]);

  useEffect(() => {
    const lost = () => { contextLost.current = true; active.current = false; useGame.setState({ benchmarkStatus: 'failed', benchmarkTier: null }); };
    const restored = () => { contextLost.current = false; };
    const visibility = () => sample.reset();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', visibility); window.addEventListener('focus', visibility);
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', visibility); window.removeEventListener('focus', visibility); gl.domElement.removeEventListener('webglcontextlost', lost); gl.domElement.removeEventListener('webglcontextrestored', restored); };
  }, [gl, sample]);

  useEffect(() => {
    if (!ready || contextLost.current) return;
    if (initialized.current && request === 0) return;
    initialized.current = true;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const context = gl.getContext() as WebGL2RenderingContext;
    const capabilities: DeviceCapabilities = {
      threads: nav.hardwareConcurrency || null, memoryGB: nav.deviceMemory ?? null,
      maxTextureSize: gl.capabilities.maxTextureSize, maxSamples: context.getParameter(context.MAX_SAMPLES),
      viewport: `${size.width}×${size.height}`, pixelRatio: window.devicePixelRatio || 1,
    };
    device.current = capabilities;
    useGame.setState({ benchmarkDevice: capabilities });
    const signature = deviceSignature(capabilities);
    let cached = null;
    try { cached = readBenchmark(localStorage.getItem(BENCHMARK_KEY), signature); } catch { /* Storage is optional. */ }
    if (request === 0 && cached) {
      // Loading a report must retain the user's saved resolution/effect overrides.
      useGame.setState({ benchmarkReport: cached, benchmarkCached: true, benchmarkStatus: 'complete', ...(useGame.getState().adaptiveQuality ? { renderBudget: recommendedSettings(cached.recommended).renderBudget } : {}) });
      return;
    }
    if (useGame.getState().phase !== 'menu') return;
    results.current = []; tierIndex.current = 0; foregroundTime.current = 0; sample.reset(); active.current = true;
    useGame.setState({ benchmarkStatus: 'running', benchmarkTier: 'high', benchmarkProgress: 0, benchmarkCached: false });
    invalidate();
    // A resize invalidates the cache signature, but must not continually restart a run.
    // The current viewport is checked again before accepting the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, request, gl, sample, invalidate]);

  useFrame((_, dt) => {
    if (!active.current) return;
    const state = useGame.getState();
    if (state.benchmarkStatus !== 'running') { active.current = false; return; }
    if (state.phase !== 'menu' || device.current?.viewport !== `${size.width}×${size.height}` || device.current.pixelRatio !== (window.devicePixelRatio || 1)) {
      active.current = false; useGame.setState({ benchmarkStatus: 'cancelled', benchmarkTier: null }); return;
    }
    const eligible = !document.hidden && document.hasFocus();
    if (state.benchmarkWaiting === eligible) useGame.setState({ benchmarkWaiting: !eligible });
    if (eligible) foregroundTime.current += Math.min(dt, 5);
    if (foregroundTime.current > 45) { active.current = false; useGame.setState({ benchmarkStatus: 'failed', benchmarkTier: null }); return; }
    const done = sample.sample(dt, eligible);
    const progress = Math.floor((tierIndex.current + sample.progress) / BENCHMARK_TIERS.length * 100);
    if (progress !== state.benchmarkProgress) useGame.setState({ benchmarkProgress: progress });
    if (!done) return;
    const measurement = sample.result(BENCHMARK_TIERS[tierIndex.current]);
    if (!measurement) { active.current = false; useGame.setState({ benchmarkStatus: 'failed', benchmarkTier: null }); return; }
    results.current.push(measurement);
    if (++tierIndex.current < BENCHMARK_TIERS.length) {
      sample.reset(); useGame.setState({ benchmarkTier: BENCHMARK_TIERS[tierIndex.current] }); return;
    }
    active.current = false;
    const report = { version: BENCHMARK_VERSION, signature: deviceSignature(device.current!), measuredAt: Date.now(), device: device.current!, measurements: results.current, recommended: recommendTier(results.current) };
    try { localStorage.setItem(BENCHMARK_KEY, JSON.stringify(report)); } catch { /* Results remain available without storage. */ }
    useGame.setState({ benchmarkStatus: 'complete', benchmarkTier: null, benchmarkReport: report, benchmarkProgress: 100, ...(state.adaptiveQuality ? recommendedSettings(report.recommended) : {}) });
  });

  if (status !== 'running') return null;
  return <group>{Array.from({ length: 64 }, (_, i) => <mesh key={i} geometry={assets.geometry} material={assets.material} castShadow={stage === 'high'} receiveShadow position={[(i % 8 - 3.5) * 1.4, .8 + (i % 3) * .45, (Math.floor(i / 8) - 3.5) * 1.4]} />)}</group>;
}
