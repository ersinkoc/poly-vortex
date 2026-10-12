import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SURFACES = ['hull', 'armor', 'metal', 'glass', 'signal', 'engine'] as const;
type Surface = typeof SURFACES[number];
type Vec = [number, number, number];
export type ShipModel = Record<Surface, THREE.BufferGeometry>;

// Parts are baked into six shared meshes per class, rather than multiplying
// the draw calls by the number of panels, bolts, cannons, or individual ships.
class ShipBuilder {
  private parts: Record<Surface, THREE.BufferGeometry[]> = { hull: [], armor: [], metal: [], glass: [], signal: [], engine: [] };
  add(surface: Surface, geometry: THREE.BufferGeometry, position: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0], scale: Vec = [1, 1, 1]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    this.parts[surface].push(g);
  }
  box(surface: Surface, size: Vec, position: Vec, rotation: Vec = [0, 0, 0], bevel = 0.025) {
    this.add(surface, bevel ? new RoundedBoxGeometry(...size, 1, bevel) : new THREE.BoxGeometry(...size), position, rotation);
  }
  cylinder(surface: Surface, top: number, bottom: number, length: number, position: Vec, rotation: Vec = [Math.PI / 2, 0, 0], segments = 12) {
    this.add(surface, new THREE.CylinderGeometry(top, bottom, length, segments), position, rotation);
  }
  ring(surface: Surface, radius: number, tube: number, position: Vec, rotation: Vec = [0, 0, 0], segments = 24) {
    this.add(surface, new THREE.TorusGeometry(radius, tube, 5, segments), position, rotation);
  }
  plate(surface: Surface, outline: [number, number][], thickness: number, y = 0, bevel = 0.018) {
    const shape = new THREE.Shape(); shape.moveTo(...outline[0]); for (const point of outline.slice(1)) shape.lineTo(...point); shape.closePath();
    this.add(surface, new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelSegments: 1, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 1 }), [0, y + thickness / 2, 0], [Math.PI / 2, 0, 0]);
  }
  pipe(surface: Surface, points: Vec[], radius = 0.018) {
    this.add(surface, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 12, radius, 5, false));
  }
  vents(position: Vec, width: number, count = 6, spacing = 0.07) {
    this.box('hull', [width + 0.06, 0.04, count * spacing + 0.04], position, [0, 0, 0], 0.01);
    for (let i = 0; i < count; i++) this.box('metal', [width, 0.026, 0.02], [position[0], position[1] + 0.03, position[2] + (i - (count - 1) / 2) * spacing], [0, 0, 0], 0);
  }
  bolts(points: Vec[]) {
    for (const position of points) this.cylinder('metal', 0.023, 0.023, 0.018, position, [0, 0, 0], 6);
  }
  thruster(x: number, y: number, z: number, radius: number) {
    this.cylinder('hull', radius * 0.9, radius, radius * 2.7, [x, y, z + radius * 0.3]);
    this.cylinder('metal', radius, radius * 1.06, radius * 0.35, [x, y, z - radius]);
    this.ring('metal', radius * 0.95, radius * 0.12, [x, y, z - radius * 1.2]);
    this.cylinder('engine', radius * 0.76, radius * 0.6, 0.025, [x, y, z - radius * 1.35]);
    this.add('engine', new THREE.ConeGeometry(radius * 0.52, radius * 2.6, 12), [x, y, z - radius * 2.3], [-Math.PI / 2, 0, 0]);
    for (let j = 0; j < 4; j++) {
      const a = j / 4 * Math.PI * 2;
      this.box('armor', [0.04, 0.04, radius * 1.7], [x + Math.cos(a) * radius, y + Math.sin(a) * radius, z + radius * 0.3], [0, 0, a], 0.005);
    }
  }
  gun(x: number, y: number, z: number, size = 1) {
    this.box('hull', [0.15 * size, 0.16 * size, 0.3 * size], [x, y, z], [0, 0, 0], 0.018);
    this.cylinder('metal', 0.044 * size, 0.056 * size, 0.55 * size, [x, y, z + 0.24 * size], [Math.PI / 2, 0, 0], 8);
    this.cylinder('hull', 0.069 * size, 0.063 * size, 0.11 * size, [x, y, z + 0.5 * size], [Math.PI / 2, 0, 0], 8);
    this.cylinder('signal', 0.038 * size, 0.038 * size, 0.015, [x, y, z + 0.56 * size], [Math.PI / 2, 0, 0], 8);
  }
  finish(): ShipModel {
    const result = {} as ShipModel;
    for (const surface of SURFACES) {
      const chunks = this.parts[surface];
      // Keep the same six-surface contract for every archetype.
      const merged = chunks.length ? mergeGeometries(chunks) : new THREE.BufferGeometry();
      if (!merged) throw new Error(`Could not merge ${surface} ship geometry`);
      chunks.forEach(g => g.dispose());
      merged.computeBoundingBox(); merged.computeBoundingSphere(); result[surface] = merged;
    }
    return result;
  }
}

export function buildPlayerShip(): ShipModel {
  const b = new ShipBuilder();
  b.plate('hull', [[0, 1.7], [-0.29, 0.9], [-0.43, -0.8], [-0.24, -1.25], [0.24, -1.25], [0.43, -0.8], [0.29, 0.9]], 0.28);
  b.plate('armor', [[0, 1.55], [-0.18, 0.82], [-0.24, -0.62], [0, -0.95], [0.24, -0.62], [0.18, 0.82]], 0.09, 0.21);
  b.add('glass', new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.27, 0.28], [0, 0, 0], [0.25, 0.3, 0.67]);
  b.pipe('metal', [[0, 0.31, 0.95], [0, 0.52, 0.62], [0, 0.58, 0.27], [0, 0.48, -0.14], [0, 0.3, -0.4]], 0.014);
  for (const side of [-1, 1]) {
    b.plate('hull', [[side * 0.26, 0.64], [side * 1.52, -0.54], [side * 1.37, -0.99], [side * 0.27, -0.87]], 0.13, -0.06);
    b.plate('armor', [[side * 0.44, 0.28], [side * 1.37, -0.55], [side * 1.17, -0.8], [side * 0.43, -0.65]], 0.05, 0.035);
    b.plate('metal', [[side * 0.38, 0.5], [side * 1.5, -0.55], [side * 1.47, -0.64], [side * 0.4, 0.37]], 0.024, 0.02, 0.006);
    b.box('signal', [0.035, 0.025, 0.57], [side * 1.35, 0.045, -0.64], [0, side * 0.25, 0], 0.008);
    b.thruster(side * 0.61, -0.09, -1.0, 0.18);
    b.gun(side * 0.94, -0.05, -0.16, 0.8);
    b.vents([side * 0.55, 0.16, -0.37], 0.2, 6);
    b.box('armor', [0.08, 0.47, 0.49], [side * 0.64, 0.25, -1.03], [0.22, 0, side * -0.22], 0.017);
    b.box('metal', [0.095, 0.035, 0.53], [side * 0.31, 0.245, -0.67], [0, side * -0.08, 0], 0.008);
    b.bolts([[side * 0.39, 0.12, -0.74], [side * 0.73, 0.12, -0.58], [side * 1.14, 0.12, -0.66], [side * 0.32, 0.3, 0.95]]);
  }
  b.thruster(0, -0.08, -1.07, 0.19);
  b.box('metal', [0.12, 0.11, 0.38], [0, -0.09, 1.35], [0.07, 0, 0]);
  b.box('signal', [0.045, 0.035, 0.38], [0, 0.29, 1.08], [0, 0, 0], 0.006);
  b.box('signal', [0.11, 0.025, 0.045], [0, 0.325, -0.71], [0, 0, 0], 0.005);
  return b.finish();
}

function chaser(): ShipModel {
  const b = new ShipBuilder();
  b.plate('hull', [[0, 1.22], [-0.32, 0.36], [-0.37, -0.66], [0, -0.95], [0.37, -0.66], [0.32, 0.36]], 0.23);
  b.plate('armor', [[0, 1.05], [-0.2, 0.3], [-0.21, -0.53], [0.21, -0.53], [0.2, 0.3]], 0.07, 0.19);
  b.add('glass', new THREE.SphereGeometry(1, 12, 8), [0, 0.23, 0.25], [0, 0, 0], [0.2, 0.15, 0.38]);
  b.box('signal', [0.22, 0.06, 0.05], [0, 0.29, 0.62], [0, 0, 0], 0.01);
  for (const side of [-1, 1]) {
    b.plate('metal', [[side * 0.24, 0.2], [side * 0.92, -0.39], [side * 0.8, -0.84], [side * 0.35, -0.53]], 0.09);
    b.plate('armor', [[side * 0.37, 0.05], [side * 0.78, -0.4], [side * 0.72, -0.61], [side * 0.38, -0.45]], 0.07, 0.08);
    b.thruster(side * 0.37, -0.05, -0.7, 0.12);
    b.gun(side * 0.51, -0.05, 0.05, 0.55);
    b.vents([side * 0.34, 0.2, -0.4], 0.15, 4, 0.06);
    b.box('signal', [0.025, 0.035, 0.3], [side * 0.77, 0.12, -0.43], [0, side * 0.4, 0], 0.004);
    b.bolts([[side * 0.26, 0.27, -0.51], [side * 0.63, 0.18, -0.5]]);
  }
  return b.finish();
}

function orbiter(): ShipModel {
  const b = new ShipBuilder();
  b.cylinder('hull', 0.6, 0.8, 0.28, [0, 0, 0], [0, 0, 0], 24);
  b.ring('metal', 0.77, 0.055, [0, 0.02, 0], [Math.PI / 2, 0, 0], 32);
  b.cylinder('metal', 0.27, 0.48, 0.25, [0, 0.24, 0], [0, 0, 0], 16);
  b.add('glass', new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.34, 0], [0, 0, 0], [0.3, 0.16, 0.3]);
  b.ring('signal', 0.36, 0.018, [0, 0.3, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
    b.box('armor', [0.37, 0.13, 0.34], [x * 0.61, 0.15, z * 0.61], [0, a, 0.08], 0.04);
    b.box('signal', [0.17, 0.024, 0.028], [x * 0.8, 0.05, z * 0.8], [0, a, 0], 0.005);
    b.cylinder('hull', 0.09, 0.12, 0.13, [x * 0.71, -0.22, z * 0.71], [0, 0, 0], 8);
    b.cylinder('engine', 0.075, 0.075, 0.018, [x * 0.71, -0.29, z * 0.71], [0, 0, 0], 8);
    b.bolts([[x * 0.66, 0.24, z * 0.66]]);
  }
  for (const side of [-1, 1]) b.gun(side * 0.88, 0.05, 0.16, 0.8);
  b.cylinder('metal', 0.018, 0.025, 0.37, [0.12, 0.57, -0.08], [0, 0, -0.12], 6);
  b.add('signal', new THREE.SphereGeometry(0.04, 8, 6), [0.14, 0.77, -0.08]);
  return b.finish();
}

function goliath(): ShipModel {
  const b = new ShipBuilder();
  b.box('hull', [1.15, 0.43, 1.48], [0, 0, -0.02], [0, 0, 0], 0.1);
  b.plate('armor', [[-0.42, 0.82], [-0.55, 0.4], [-0.47, -0.6], [0.47, -0.6], [0.55, 0.4], [0.42, 0.82]], 0.13, 0.3);
  b.box('glass', [0.65, 0.13, 0.06], [0, 0.2, 0.755], [0.2, 0, 0], 0.035);
  b.box('signal', [0.46, 0.025, 0.026], [0, 0.27, 0.79], [0, 0, 0], 0.006);
  b.cylinder('metal', 0.34, 0.43, 0.15, [0, 0.48, -0.1], [0, 0, 0], 16);
  b.box('armor', [0.48, 0.23, 0.48], [0, 0.63, -0.1], [0, 0, 0], 0.065);
  b.gun(-0.14, 0.65, 0.13, 1.3); b.gun(0.14, 0.65, 0.13, 1.3);
  for (const side of [-1, 1]) {
    b.box('hull', [0.39, 0.42, 1.32], [side * 0.76, -0.09, -0.08], [0, 0, side * -0.05], 0.08);
    for (let i = 0; i < 4; i++) b.box('armor', [0.42, 0.14, 0.26], [side * 0.76, 0.2, 0.43 - i * 0.3], [0.08, 0, side * -0.13], 0.028);
    b.thruster(side * 0.74, -0.03, -0.76, 0.2);
    b.thruster(side * 0.32, -0.13, -0.76, 0.14);
    b.vents([side * 0.35, 0.4, -0.32], 0.16, 7, 0.07);
    b.box('signal', [0.025, 0.045, 0.68], [side * 0.96, 0.07, -0.18], [0, 0, 0], 0.009);
    b.cylinder('metal', 0.032, 0.032, 0.64, [side * 0.57, -0.13, 0.15], [Math.PI / 2, 0, 0], 8);
    b.bolts([[side * 0.42, 0.44, 0.46], [side * 0.42, 0.44, -0.56], [side * 0.82, 0.3, 0.38], [side * 0.82, 0.3, -0.5]]);
  }
  return b.finish();
}

function sentinel(): ShipModel {
  const b = new ShipBuilder();
  b.add('hull', new THREE.SphereGeometry(0.58, 20, 12), [0, 0.2, 0], [0, 0, 0], [1, 0.9, 1]);
  b.add('glass', new THREE.SphereGeometry(0.42, 16, 10), [0, 0.25, 0]);
  b.ring('metal', 0.91, 0.085, [0, 0.05, 0], [Math.PI / 2, 0, 0], 40);
  b.ring('signal', 0.83, 0.023, [0, 0.12, 0], [Math.PI / 2, 0, 0], 40);
  b.ring('metal', 0.46, 0.048, [0, 0.52, 0], [Math.PI / 2, 0, 0]);
  b.cylinder('signal', 0.17, 0.17, 0.06, [0, 0.72, 0], [0, 0, 0], 16);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
    b.box('hull', [0.25, 0.2, 0.7], [x * 0.71, 0.1, z * 0.71], [0, a, 0], 0.05);
    b.box('armor', [0.39, 0.18, 0.47], [x * 0.76, 0.26, z * 0.76], [0.17, a, 0], 0.04);
    b.box('armor', [0.25, 0.33, 0.28], [x * 0.44, 0.57, z * 0.44], [0.25, a, 0], 0.045);
    b.box('signal', [0.1, 0.028, 0.22], [x * 0.87, 0.38, z * 0.87], [0.17, a, 0], 0.006);
    b.cylinder('metal', 0.12, 0.15, 0.15, [x * 0.84, -0.12, z * 0.84], [0, 0, 0]);
    b.cylinder('engine', 0.092, 0.092, 0.025, [x * 0.84, -0.205, z * 0.84], [0, 0, 0]);
    b.bolts([[x * 0.78, 0.4, z * 0.78]]);
  }
  for (const side of [-1, 1]) {
    b.gun(side * 0.83, 0.23, 0.47, 1.0);
    b.gun(side * 0.4, 0.27, 0.89, 0.9);
    b.cylinder('metal', 0.025, 0.04, 0.43, [side * 0.28, 0.83, -0.21], [0, 0, side * 0.25], 8);
  }
  return b.finish();
}

export function buildEnemyShip(kind: 0 | 1 | 2 | 3): ShipModel {
  return [chaser, orbiter, goliath, sentinel][kind]();
}

export function buildSurfaceTextures(size = 128) {
  const rough = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4), paint = new Uint8Array(size * size * 4);
  let seed = 7919;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const seam = x % 32 < 1 || y % 64 < 1;
    const scratch = x % 23 === 0 && y % 41 > 7 && y % 41 < 25;
    const brushed = Math.sin(x * 2.1) * 5 + noise() * 13;
    const value = seam ? 70 : scratch ? 185 : 225 + brushed;
    paint[i] = paint[i + 1] = paint[i + 2] = value; paint[i + 3] = 255;
    rough[i] = rough[i + 1] = rough[i + 2] = seam ? 245 : 105 + brushed * 2; rough[i + 3] = 255;
    normal[i] = seam ? 102 : 128 + noise() * 7 - 3; normal[i + 1] = scratch ? 146 : 128; normal[i + 2] = 253; normal[i + 3] = 255;
  }
  const texture = (data: Uint8Array, srgb = false) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { paint: texture(paint, true), roughness: texture(rough), normal: texture(normal) };
}

export function buildShipMaterials(accent: string, player: boolean, textures: ReturnType<typeof buildSurfaceTextures>): Record<Surface, THREE.Material> {
  const shared = { map: textures.paint, roughnessMap: textures.roughness, normalMap: textures.normal, normalScale: new THREE.Vector2(0.12, 0.12), envMapIntensity: 1.15 };
  return {
    hull: new THREE.MeshStandardMaterial({ ...shared, color: '#27313c', metalness: 0.82, roughness: 0.68 }),
    armor: new THREE.MeshPhysicalMaterial({ ...shared, color: player ? '#9da9af' : '#64717a', metalness: 0.56, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.28 }),
    metal: new THREE.MeshStandardMaterial({ ...shared, color: '#c1cbd0', metalness: 0.94, roughness: 0.37 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#102b38', metalness: 0.28, roughness: 0.075, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 2.5 }),
    signal: new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 3.1, roughness: 0.35, metalness: 0.25 }),
    engine: new THREE.MeshBasicMaterial({ color: new THREE.Color(player ? '#8adfff' : accent).multiplyScalar(3.4), toneMapped: false }),
  };
}

export function buildShadowTexture(size = 64) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    pixels[(y * size + x) * 4 + 3] = Math.round(Math.max(0, 1 - r) ** 1.7 * 155);
  }
  const t = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
