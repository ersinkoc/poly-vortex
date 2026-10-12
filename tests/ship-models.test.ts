import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { DRONE_FORMATION, DRONE_ORBIT } from '../src/game/orbital-drones';
import { buildEnemyShip, buildEscortDrone, buildGroundCharge, buildGroundRover, buildRoverWheels, buildPlayerShip, buildShadowTexture, buildShipMaterials, buildSurfaceTextures, SURFACES } from '../src/game/ship-models';

const factories = [buildPlayerShip, ...([0, 1, 2, 3] as const).map(kind => () => buildEnemyShip(kind)), buildEscortDrone, buildGroundCharge, buildGroundRover];
const names = ['poly-core', 'chaser', 'orbiter', 'goliath', 'sentinel', 'escort drone', 'ground charge', 'ground rover'];

describe('procedural fleet GPU resources', () => {
  test('the complete escort model fits inside the flight volume used for formation clearance', () => {
    const model = buildEscortDrone(); let radius = 0;
    try {
      for (const g of Object.values(model)) { const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) radius = Math.max(radius, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) * DRONE_ORBIT.scale); }
      expect(radius).toBeLessThanOrEqual(DRONE_FORMATION.bodyRadius); expect(DRONE_FORMATION.separation).toBeGreaterThan(radius * 2);
    } finally { Object.values(model).forEach(g => g.dispose()); }
  });
  test('rover tires and hubs have finite, shared geometry aligned with the axle', () => {
    const wheels = buildRoverWheels();
    try { for (const g of Object.values(wheels)) { g.computeBoundingBox(); expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true); expect(g.boundingSphere!.radius).toBeLessThan(0.4); expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeLessThan(0.22); expect(g.getAttribute('normal').count).toBe(g.getAttribute('position').count); } }
    finally { Object.values(wheels).forEach(g => g.dispose()); }
  });
  factories.forEach((build, i) => {
    test(`${names[i]} provides bounded, finite, complete instancing geometry`, () => {
      const model = build(); let triangles = 0;
      try {
        expect(Object.keys(model)).toEqual([...SURFACES]);
        for (const geometry of Object.values(model)) {
          const positions = geometry.getAttribute('position');
          expect(positions.count).toBeGreaterThan(0);
          expect(geometry.getAttribute('normal').count).toBe(positions.count);
          expect(geometry.getAttribute('uv').count).toBe(positions.count);
          expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
          expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
          triangles += positions.count / 3;
        }
        // Artist-facing budget: six draws per class and <7,500 triangles per ship.
        expect(triangles).toBeLessThan(7500);
      } finally { Object.values(model).forEach(g => g.dispose()); }
    });
  });
  test('surface textures use deterministic local data and correct color spaces', () => {
    const first = buildSurfaceTextures(32), second = buildSurfaceTextures(32);
    try {
      expect(first.paint.image.data).toEqual(second.paint.image.data);
      expect(first.paint.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(first.normal.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.roughness.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.normal.image.data?.length).toBe(32 * 32 * 4);
    } finally { [...Object.values(first), ...Object.values(second)].forEach(t => t.dispose()); }
  });
  test('PBR surfaces reuse texture resources across the fleet', () => {
    const textures = buildSurfaceTextures(16), player = buildShipMaterials('#bdff6f', true, textures), enemy = buildShipMaterials('#ff5774', false, textures);
    try {
      expect((player.hull as THREE.MeshStandardMaterial).normalMap).toBe((enemy.hull as THREE.MeshStandardMaterial).normalMap);
      expect((player.glass as THREE.MeshPhysicalMaterial).clearcoat).toBe(1);
      expect((enemy.signal as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(2.5);
    } finally { [...Object.values(player), ...Object.values(enemy)].forEach(m => m.dispose()); Object.values(textures).forEach(t => t.dispose()); }
  });
  test('contact shadow has a transparent edge and a soft opaque center', () => {
    const shadow = buildShadowTexture(64);
    try {
      expect(shadow.image.data?.[3]).toBe(0);
      expect(shadow.image.data?.[(32 * 64 + 32) * 4 + 3]).toBeGreaterThan(100);
    } finally { shadow.dispose(); }
  });
});
