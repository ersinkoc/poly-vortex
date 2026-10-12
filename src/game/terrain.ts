import * as THREE from 'three';

export const TERRAIN_CELL = 16;
export type TerrainProp = { x: number; z: number; radius: number; height: number; angle: number; ruin: boolean };
const hash = (x: number, z: number, salt = 0) => {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ salt; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296;
};
export function terrainHeight(x: number, z: number) {
  const cx = Math.floor(x / TERRAIN_CELL), cz = Math.floor(z / TERRAIN_CELL);
  const dx = x - (cx * TERRAIN_CELL + 4 + hash(cx, cz, 91) * 8), dz = z - (cz * TERRAIN_CELL + 4 + hash(cx, cz, 17) * 8);
  const r = Math.hypot(dx, dz), crater = Math.max(0, 1 - r / 3.8);
  return -0.16 - 0.12 * (Math.sin(x * 0.22) * Math.cos(z * 0.19) + 1) - crater ** 2 * 1.4 - Math.sin(x * 1.1 + z * 0.7) ** 2 * 0.04;
}
export function terrainProp(cx: number, cz: number): TerrainProp | null {
  const x = cx * TERRAIN_CELL + 3 + hash(cx, cz, 3) * 10, z = cz * TERRAIN_CELL + 3 + hash(cx, cz, 11) * 10;
  if (Math.hypot(x, z) < 9 || hash(cx, cz, 55) < 0.17) return null;
  return { x, z, radius: 1.1 + hash(cx, cz, 23) * 1.4, height: 0.8 + hash(cx, cz, 47) * 2.1, angle: hash(cx, cz, 37) * Math.PI * 2, ruin: hash(cx, cz, 93) > 0.68 };
}
export function clearTerrainPosition(body: { x: number; z: number }, radius: number) {
  const cx = Math.floor(body.x / TERRAIN_CELL), cz = Math.floor(body.z / TERRAIN_CELL);
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
    const prop = terrainProp(ix, iz); if (!prop) continue;
    const dx = body.x - prop.x, dz = body.z - prop.z, r = radius + prop.radius, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { const d = Math.sqrt(d2); body.x = prop.x + (d > 1e-6 ? dx / d : 1) * r; body.z = prop.z + (d > 1e-6 ? dz / d : 0) * r; }
  }
}
export function terrainImpact(a: { x: number; z: number }, b: { x: number; z: number }, padding = 0.08): { x: number; z: number } | null {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz; let first = Infinity;
  for (let cx = Math.floor((Math.min(a.x, b.x) - 3) / TERRAIN_CELL); cx <= Math.floor((Math.max(a.x, b.x) + 3) / TERRAIN_CELL); cx++) for (let cz = Math.floor((Math.min(a.z, b.z) - 3) / TERRAIN_CELL); cz <= Math.floor((Math.max(a.z, b.z) + 3) / TERRAIN_CELL); cz++) {
    const prop = terrainProp(cx, cz); if (!prop || terrainHeight(prop.x, prop.z) + prop.height < 0.7) continue;
    const ox = a.x - prop.x, oz = a.z - prop.z, radius = prop.radius + padding, c = ox * ox + oz * oz - radius * radius;
    if (c <= 0) { first = 0; continue; } if (length2 < 1e-8) continue;
    const dot = ox * dx + oz * dz, discriminant = dot * dot - length2 * c; if (discriminant < 0) continue;
    const t = (-dot - Math.sqrt(discriminant)) / length2; if (t >= 0 && t <= 1 && t < first) first = t;
  }
  return Number.isFinite(first) ? { x: a.x + dx * first, z: a.z + dz * first } : null;
}
export function buildTerrainTextures(size = 256) {
  const albedo = new Uint8Array(size * size * 4), normals = new Uint8Array(size * size * 4), roughness = new Uint8Array(size * size * 4);
  const sample = (x: number, z: number) => {
    x = (x + size) % size; z = (z + size) % size;
    const smooth = (cells: number, salt: number) => {
      const gx = x / size * cells, gz = z / size * cells, ix = Math.floor(gx), iz = Math.floor(gz);
      const u = (gx - ix) ** 2 * (3 - 2 * (gx - ix)), v = (gz - iz) ** 2 * (3 - 2 * (gz - iz));
      const a = hash(ix % cells, iz % cells, salt), b = hash((ix + 1) % cells, iz % cells, salt), c = hash(ix % cells, (iz + 1) % cells, salt), d = hash((ix + 1) % cells, (iz + 1) % cells, salt);
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    };
    return smooth(8, 71) * 0.5 + smooth(32, 31) * 0.3 + hash(x, z, 19) * 0.2;
  };
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const i = (z * size + x) * 4, v = sample(x, z);
    const crack = Math.abs(Math.sin(x / size * Math.PI * 6 + Math.sin(z / size * Math.PI * 2) * 2)) < 0.025;
    const mineral = hash(x, z, 29) > 0.992, value = crack ? 32 : mineral ? 162 : 70 + v * 86;
    albedo.set([value, value * 0.93, value * 0.81, 255], i);
    normals.set([128 + (sample(x - 1, z) - sample(x + 1, z)) * 145, 128 + (sample(x, z - 1) - sample(x, z + 1)) * 145, 240, 255], i);
    roughness.set([175 + v * 65, 175 + v * 65, 175 + v * 65, 255], i);
  }
  const texture = (data: Uint8Array) => { const t = new THREE.DataTexture(data, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  const map = texture(albedo); map.colorSpace = THREE.SRGBColorSpace; return { map, normal: texture(normals), roughness: texture(roughness) };
}
