'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdaptiveBudget, initialBudget } from '@/game/render-budget';
import { recommendedSettings } from '@/game/benchmark';
import { useGame } from '@/game/store';

export default function PerformanceGovernor() {
  const adaptive = useGame(s => s.adaptiveQuality), quality = useGame(s => s.quality);
  const report = useGame(s => s.benchmarkReport);
  const budget = useMemo(() => new AdaptiveBudget(), []);
  useEffect(() => { const level = adaptive ? report ? recommendedSettings(report.recommended).renderBudget : initialBudget(navigator) : 0; budget.reset(level); useGame.setState({ renderBudget: level }); }, [budget, adaptive, quality, report]);
  useFrame((_, dt) => {
    if (!adaptive || quality !== 'high') return;
    const state = useGame.getState();
    if (state.benchmarkStatus === 'running') return;
    const level = budget.sample(dt, !document.hidden && (state.phase === 'playing' || state.phase === 'menu'));
    if (level !== state.renderBudget) useGame.setState({ renderBudget: level });
  });
  return null;
}
