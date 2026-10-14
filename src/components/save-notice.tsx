'use client';
import { useGame } from '@/game/store';
export default function SaveNotice() {
  const status = useGame(s => s.saveStatus);
  if (status === 'saved') return null;
  return <div className="save-notice" role="status">{status === 'conflict' ? 'This flight is active in another tab. Open Command Center to continue here.' : status === 'invalid' ? 'Saved flight could not be resumed. Your core progress is safe; deploy a new flight.' : 'Local save unavailable. Keep this tab open; export a backup from Flight Log.'}</div>;
}
