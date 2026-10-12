import * as THREE from 'three';

export const VISUAL_LIMITS = { blasts: 24, scorches: 48, puffs: 144, debris: 192, lights: 3, rubble: 324 } as const;
export type Blast = { id: number; x: number; z: number; size: number; age: number; color: string; energy: boolean };
export type Scorch = { x: number; z: number; size: number; age: number };
export const visualNoise = (a: number, b = 0) => {
  let n = Math.imul(a + 17, 374761393) ^ Math.imul(b + 73, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296;
};

/** CPU-generated RGBA sprites: transparent borders, no images or downloads. */
export function buildVfxTextures(size = 128) {
  const glow = new Uint8Array(size * size * 4), smoke = new Uint8Array(size * size * 4), scorch = new Uint8Array(size * size * 4);
  const noise = (x: number, y: number, cells: number) => {
    const gx = x / size * cells, gy = y / size * cells, ix = Math.floor(gx), iy = Math.floor(gy);
    const sx = gx - ix, sy = gy - iy, u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy);
    const a = visualNoise(ix, iy), b = visualNoise(ix + 1, iy), c = visualNoise(ix, iy + 1), d = visualNoise(ix + 1, iy + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, r = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    const edge = Math.max(0, 1 - r), grain = noise(x, y, 6) * 0.65 + noise(x, y, 15) * 0.35;
    glow.set([255, 255, 255, Math.round(edge ** 2.3 * 255)], i);
    smoke.set([255, 255, 255, Math.round(edge ** 0.65 * (0.3 + grain * 0.7) * 210)], i);
    const char = Math.max(0, 1 - r * (0.82 + grain * 0.45));
    scorch.set([255, 255, 255, Math.round(char ** 1.5 * (0.45 + grain * 0.55) * 210)], i);
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) { glow[i + 3] = smoke[i + 3] = scorch[i + 3] = 0; }
  }
  const texture = (pixels: Uint8Array) => { const t = new THREE.DataTexture(pixels, size, size); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  return { glow: texture(glow), smoke: texture(smoke), scorch: texture(scorch) };
}

export function rubbleAt(cx: number, cz: number, index: number) {
  const salt = index * 71, x = cx * 16 + visualNoise(cx * 37 + salt, cz) * 16, z = cz * 16 + visualNoise(cz * 53 + salt, cx) * 16;
  return { x, z, radius: 0.12 + visualNoise(cx + salt, cz + 9) * 0.32, height: 0.06 + visualNoise(cx + 23, cz + salt) * 0.24, angle: visualNoise(cx + salt, cz + 43) * Math.PI * 2 };
}
