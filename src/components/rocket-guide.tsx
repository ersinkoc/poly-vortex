'use client';

import { Crosshair, Keyboard, Package, Rocket, ShieldCheck } from 'lucide-react';
import { ROCKET_CAPACITY } from '@/game/supplies';
import { ROCKET_RULES } from '@/game/launcher';

export default function RocketGuide() {
  return <div className="rocket-guide">
    <svg className="rocket-sequence" viewBox="0 0 360 100" role="img" aria-label="Lock a hostile, press E, missile impacts, collect a blue crate to reload"><rect width="360" height="100" rx="8" fill="#0b1921"/><path d="M30 26L40 52L30 46L20 52Z" fill="#bdff75"/><circle cx="83" cy="29" r="13" fill="none" stroke="#ff718b"/><path d="M66 29H100M83 12V46" stroke="#ff718b"/><rect x="128" y="21" width="32" height="32" rx="4" fill="#314434" stroke="#bdff75"/><text x="144" y="43" textAnchor="middle" fill="#bdff75" fontSize="19">E</text><path d="M181 40H225" stroke="#ffbe72" strokeWidth="4"/><circle cx="239" cy="37" r="17" fill="#ffbe7222" stroke="#ffbe72"/><rect x="299" y="21" width="35" height="33" rx="4" fill="#254d69" stroke="#8bd5ff"/><path d="M307 48V28M317 48V28M326 48V28" stroke="#8bd5ff" strokeWidth="3"/>{[['LOCK',55],['LAUNCH',144],['IMPACT',234],['+3 ROUNDS',317]].map(([label,x])=><text key={label} x={x} y="82" textAnchor="middle" fill="#b5cbc0" fontSize="9">{label}</text>)}</svg>
    <div className="ordnance-summary"><Rocket size={30} /><div><strong>HELLION / MANUAL LAUNCH</strong><span>{ROCKET_CAPACITY} ROUNDS · {ROCKET_RULES.range}m LOCK · {ROCKET_RULES.cooldown}s CYCLE</span></div></div>
    <p className="panel-intro">Rockets fire only when you ask. Use them against heavy ships, elites, the Sentinel, or a tightly packed swarm.</p>
    <ol className="ordnance-steps">
      <li><Crosshair size={20} /><div><h3>1. Lock a clear target</h3><p>Point at a hostile within {ROCKET_RULES.range}m. <kbd>F</kbd> switches assisted / precision aim.</p></div></li>
      <li><Keyboard size={20} /><div><h3>2. Press E or tap</h3><p>A turning ship queues that same target for up to {ROCKET_RULES.intentWindow}s. Losing lock cancels without spending ammunition.</p></div></li>
      <li><Rocket size={20} /><div><h3>3. Check the rack</h3><p>One shot spends one round. Next launch in {ROCKET_RULES.cooldown}s. Save heavy hits for the amber Sentinel reactor.</p></div></li>
      <li><Package size={20} /><div><h3>4. Collect blue crates</h3><p>Restore up to 3 rounds, one B charge and 20 EMP. Red cases repair. Ammunition never refills over time.</p></div></li>
    </ol>
    <div className="ordnance-safety"><ShieldCheck size={18} /><p>Rocks, ruins and unrescued pilots can block the firing lane. The launcher tells you why a shot cannot fire. Change position to clear the lane; blocked commands spend no ammunition.</p></div>
    <div className="panel-footnote">THIS BRIEFING PAUSES THE GAME. CLOSE IT AND RESUME WHEN READY.</div>
  </div>;
}
