'use client';

import { useEffect } from 'react';
import { shipId } from '@/game/flightframes';
import { useGame } from '@/game/store';

export function useShipSync() {
  useEffect(() => {
    const sync = () => {
      const s = useGame.getState(); if (s.phase === 'playing' || s.phase === 'paused') return;
      try {
        const raw = JSON.parse(localStorage.getItem('poly-vortex-settings-v1') || 'null');
        if (raw && typeof raw === 'object' && ['vector', 'wraith', 'aegis'].includes(raw.ship)) { const ship = shipId(raw.ship); if (ship !== s.ship) s.selectShip(ship); }
      } catch { /* Ignore corrupt or unavailable preferences. */ }
    };
    const storage = (e: StorageEvent) => { if (e.key === 'poly-vortex-settings-v1') sync(); };
    window.addEventListener('storage', storage); window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('focus', sync); };
  }, []);
}
