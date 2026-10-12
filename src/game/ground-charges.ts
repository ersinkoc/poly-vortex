export const CHARGE_RULES = { capacity: 3, activeLimit: 3, fuse: 3, cooldown: 1.2, radius: 5.5, damage: 600, reload: 1, minSpacing: 1.2 } as const;
export type GroundCharge = { id: number; x: number; z: number; age: number; stage: number; detonated: boolean };
export const chargeRemaining = (charge: GroundCharge) => Math.max(0, CHARGE_RULES.fuse - charge.age);
