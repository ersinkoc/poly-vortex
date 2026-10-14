'use client';
import { Play } from 'lucide-react';
import { useGame } from '@/game/store';
import { FLIGHTFRAMES } from '@/game/flightframes';
export default function SavedFlightCard({ resume }: { resume?: () => void }) {
  const saved = useGame(s => s.savedFlight);
  if (!saved || !resume) return null;
  const time = `${Math.floor(saved.time / 60).toString().padStart(2, '0')}:${Math.floor(saved.time % 60).toString().padStart(2, '0')}`;
  return <button className="saved-flight-button" onClick={resume} aria-label="Continue saved flight"><Play size={20}/><span><strong>CONTINUE FLIGHT</strong><small>{FLIGHTFRAMES[saved.ship].name} · LV {saved.level} · FRONT {saved.chapter} · {time}</small></span><span className="saved-flight-local">LOCAL</span></button>;
}
