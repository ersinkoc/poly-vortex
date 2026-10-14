export type ShipId = 'vector' | 'wraith' | 'aegis' | 'nova' | 'bastion';
export const FLIGHTFRAMES = {
  vector: { name: 'Vector', code: 'MK.01', role: 'BALANCED INTERCEPTOR', color: '#bdff6f', hull: 100, shield: 40, speed: 1, damage: 1, portrait: '/ships/vector.jpg', description: 'Swept titanium wings, three ion engines and precision cannons. A balanced frame for every front.' },
  wraith: { name: 'Wraith', code: 'MK.02', role: 'FAST STRIKE FIGHTER', color: '#6ee7ff', hull: 85, shield: 30, speed: 1.18, damage: .95, portrait: '/ships/wraith.jpg', description: 'A narrow racing fuselage and split swept wings. Faster evasion, lighter armor and a smaller shield reserve.' },
  aegis: { name: 'Aegis', code: 'MK.03', role: 'ARMORED GUNSHIP', color: '#ffbd71', hull: 125, shield: 60, speed: .85, damage: 1.05, portrait: '/ships/aegis.jpg', description: 'A reinforced delta hull with armored nacelles. More hull, shields and firepower, with slower movement.' },
  nova: { name: 'Nova', code: 'MK.04', role: 'GLASS-CANNON STRIKER', color: '#ff85c9', hull: 72, shield: 26, speed: 1.23, damage: 1.25, portrait: '/ships/nova.svg', description: 'A needle-nose twin-boom fighter. High damage and quick dodges reward precise flying, but its defenses are thin.' },
  bastion: { name: 'Bastion', code: 'MK.05', role: 'FORTRESS CARRIER', color: '#8bb9ff', hull: 155, shield: 82, speed: .72, damage: .94, portrait: '/ships/bastion.svg', description: 'A broad armored carrier with six drive outlets. Its massive hull and shield hold a line at the cost of mobility.' },
} as const;
export const SHIP_IDS = Object.keys(FLIGHTFRAMES) as ShipId[];
export const shipId = (value: unknown): ShipId => typeof value === 'string' && Object.hasOwn(FLIGHTFRAMES, value) ? value as ShipId : 'vector';
/** Model-local nozzle coordinates, including each nacelle's rear outlet. */
export const FRAME_ENGINES: Record<ShipId, readonly (readonly [number, number, number])[]> = {
  vector: [[-.61,-.09,-1.243],[0,-.08,-1.3265],[.61,-.09,-1.243]],
  wraith: [[-.43,-.05,-1.1695],[.43,-.05,-1.1695]],
  aegis: [[-.82,-.05,-1.21],[-.36,-.04,-1.212],[.36,-.04,-1.212],[.82,-.05,-1.21]],
  nova: [[-.95,-.06,-1.3],[.95,-.06,-1.3]],
  bastion: [[-1.04,-.08,-1.28],[-.62,-.08,-1.35],[-.2,-.08,-1.38],[.2,-.08,-1.38],[.62,-.08,-1.35],[1.04,-.08,-1.28]],
};
