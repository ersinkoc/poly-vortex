export type ShipId = 'vector' | 'wraith' | 'aegis';
export const FLIGHTFRAMES = {
  vector: { name: 'Vector', code: 'MK.01', role: 'BALANCED INTERCEPTOR', color: '#bdff6f', hull: 100, shield: 40, speed: 1, damage: 1, description: 'Swept titanium wings, three ion engines and precision cannons. A balanced frame for every front.' },
  wraith: { name: 'Wraith', code: 'MK.02', role: 'FAST STRIKE FIGHTER', color: '#6ee7ff', hull: 85, shield: 30, speed: 1.18, damage: .95, description: 'A narrow racing fuselage and split swept wings. Faster evasion, lighter armor and a smaller shield reserve.' },
  aegis: { name: 'Aegis', code: 'MK.03', role: 'ARMORED GUNSHIP', color: '#ffbd71', hull: 125, shield: 60, speed: .85, damage: 1.05, description: 'A reinforced delta hull with armored nacelles. More hull, shields and firepower, with slower movement.' },
} as const;
export const SHIP_IDS = Object.keys(FLIGHTFRAMES) as ShipId[];
export const shipId = (value: unknown): ShipId => value === 'wraith' || value === 'aegis' ? value : 'vector';
/** Model-local nozzle coordinates, including each nacelle's rear outlet. */
export const FRAME_ENGINES: Record<ShipId, readonly (readonly [number, number, number])[]> = {
  vector: [[-.61,-.09,-1.243],[0,-.08,-1.3265],[.61,-.09,-1.243]],
  wraith: [[-.43,-.05,-1.1695],[.43,-.05,-1.1695]],
  aegis: [[-.82,-.05,-1.21],[-.36,-.04,-1.212],[.36,-.04,-1.212],[.82,-.05,-1.21]],
};
