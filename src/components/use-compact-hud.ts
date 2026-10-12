'use client';

import { useSyncExternalStore } from 'react';

export const COMPACT_HUD_QUERY = '(max-width: 900px), (max-height: 500px) and (pointer: coarse)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(COMPACT_HUD_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useCompactHUD() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT_HUD_QUERY).matches, () => false);
}
