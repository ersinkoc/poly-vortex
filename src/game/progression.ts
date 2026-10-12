export const SECTORS = [
  { name: 'VECTOR DRIFT', color: '#baff72', event: 'CALM BEFORE THE SWARM', description: 'Build your core. Collect prisms. Keep moving.' },
  { name: 'ION FRONT', color: '#72dcff', event: 'ION STORM DETECTED', description: 'Watch for charged circles. Leave before impact.' },
  { name: 'GRAVITY RIFT', color: '#bc92ff', event: 'ELITE FLEET INBOUND', description: 'Gold signatures carry rare salvage.' },
  { name: 'CRITICAL MASS', color: '#ffad65', event: 'REACTOR INSTABILITY', description: 'The final swarm. Prepare for the Sentinel.' },
  { name: 'SENTINEL DOMAIN', color: '#ff587c', event: 'VORTEX SENTINEL AWAKENED', description: 'Three combat phases. One chance to extract.' },
] as const;
export const sectorAt = (time: number) => Math.min(4, Math.max(0, Math.floor(time / 45)));
export const ACHIEVEMENTS = [
  { id: 'first-run', name: 'First contact', description: 'Complete your first deployment.' },
  { id: 'hunter', name: 'Swarm hunter', description: 'Eliminate 250 hostiles across all runs.' },
  { id: 'breaker', name: 'Protocol breaker', description: 'Destroy a Vortex Sentinel and extract.' },
  { id: 'chain', name: 'Unbroken signal', description: 'Reach a ×5 chain multiplier.' },
  { id: 'evolution', name: 'Beyond the blueprint', description: 'Reach core level 10 in one run.' },
  { id: 'veteran', name: 'Veteran core', description: 'Complete 10 deployments.' },
  { id: 'ace', name: 'Vortex ace', description: 'Extract successfully three times.' },
] as const;
