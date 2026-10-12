'use client';

import { Crosshair, Keyboard, Package, Rocket, ShieldCheck } from 'lucide-react';
import { ROCKET_CAPACITY } from '@/game/supplies';
import { ROCKET_RULES } from '@/game/launcher';

export default function RocketGuide() {
  return <div className="rocket-guide">
    <div className="ordnance-summary"><Rocket size={30} /><div><strong>HELLION / MANUAL LAUNCH</strong><span>{ROCKET_CAPACITY} ROUNDS · {ROCKET_RULES.range}m LOCK · {ROCKET_RULES.cooldown}s CYCLE</span></div></div>
    <p className="panel-intro">Rockets fire only when you ask. Use them against heavy ships, elites, the Sentinel, or a tightly packed swarm.</p>
    <ol className="ordnance-steps">
      <li><Crosshair size={20} /><div><h3>1. Acquire a hostile</h3><p>Move the mouse toward an enemy. In Assisted mode, moving the cursor outside the arena enables automatic tracking. Press <kbd>F</kbd> to switch modes. Precision requires mouse aim; the last aim direction holds while the cursor is over the rocket panel.</p></div></li>
      <li><Keyboard size={20} /><div><h3>2. Press E — or tap the rocket panel</h3><p>The ship must face the locked hostile. If it is still turning, your command waits up to {ROCKET_RULES.intentWindow}s for that same target. Losing the lock cancels the command without spending a round.</p></div></li>
      <li><Rocket size={20} /><div><h3>3. Confirm the launch</h3><p>The rack loses one round, the launcher shows ROCKET AWAY, and a missile flies toward the hostile. A direct hit deals {ROCKET_RULES.damage} base damage with a {ROCKET_RULES.blastRadius}m blast. Wait {ROCKET_RULES.cooldown}s before the next shot.</p></div></li>
      <li><Package size={20} /><div><h3>4. Reload from a blue crate</h3><p>Fly into the blue rocket-rack crate to recover up to 3 rounds, one ground charge and 20 EMP charge. Rocket capacity stays at {ROCKET_CAPACITY}. Press B to plant a ground charge with a three-second countdown. Ordnance does not refill over time. Red first-aid cases repair your ship.</p></div></li>
    </ol>
    <div className="ordnance-safety"><ShieldCheck size={18} /><p>Rocks, ruins and unrescued pilots can block the firing lane. The launcher tells you why a shot cannot fire. Change position to clear the lane; blocked commands spend no ammunition.</p></div>
    <div className="panel-footnote">THIS BRIEFING PAUSES THE GAME. CLOSE IT AND RESUME WHEN READY.</div>
  </div>;
}
