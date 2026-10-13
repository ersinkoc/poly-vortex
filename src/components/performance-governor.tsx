'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdaptiveBudget } from '@/game/render-budget';
import { useGame } from '@/game/store';

export default function PerformanceGovernor() {
  const adaptive = useGame(s => s.adaptiveQuality), quality = useGame(s => s.quality);
  const budget = useMemo(() => new AdaptiveBudget(), []);
  useEffect(() => { budget.reset(); useGame.setState({ renderBudget: 0 }); }, [budget, adaptive, quality]);
  useFrame((_, dt) => {
    if (!adaptive || quality !== 'high') return;
    const state = useGame.getState();
    const level = budget.sample(dt, !document.hidden && (state.phase === 'playing' || state.phase === 'menu'));
    if (level !== state.renderBudget) useGame.setState({ renderBudget: level });
  });
  return null;
}
