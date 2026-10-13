import * as THREE from 'three';

export const VISUAL_LIMITS = { blasts: 24, scorches: 48, puffs: 144, debris: 192, lights: 3, rubble: 324 } as const;
export const DESTRUCTION = { life: 6, fireLife: 2.8, smokeLife: 6, debrisCount: 8 } as const;
export type Blast = { id: number; x: number; y?: number; z: number; size: number; age: number; color: string; energy: boolean };
export type Scorch = { x: number; z: number; size: number; age: number };
export const visualNoise = (a: number, b = 0) => {
  let n = Math.imul(a + 17, 374761393) ^ Math.imul(b + 73, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296;
};

/** Seamless multi-channel density field, shared by all fire and smoke volumes. */
export function buildVolumeNoise(size = 128) {
  const pixels = new Uint8Array(size * size * 4);
  const sample = (x: number, y: number, cells: number, salt: number) => {
    const gx = x / size * cells, gy = y / size * cells, ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const value = (dx: number, dy: number) => visualNoise((ix + dx) % cells + salt, (iy + dy) % cells + salt * 13);
    return (value(0, 0) * (1 - u) + value(1, 0) * u) * (1 - v) + (value(0, 1) * (1 - u) + value(1, 1) * u) * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round((sample(x, y, 8, c * 31) * 0.7 + sample(x, y, 16, c * 31 + 7) * 0.3) * 255);
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
}

/** Deterministic ballistic panels: settle on terrain after one damped bounce. */
export function wreckFragment(b: Blast, index: number, ground: (x: number, z: number) => number) {
  const seed = b.id * 17, angle = index * 2.399 + visualNoise(seed, index + 50) * 2;
  const size = Math.min(2.4, b.size) * (0.08 + visualNoise(seed, index + 80) * 0.12);
  const clearance = Math.max(0.09, size * (index % 3 ? 0.12 : 0.7) / 2);
  const speed = (1.5 + visualNoise(seed, index + 60) * 3) * Math.sqrt(b.size), lift = 2 + visualNoise(seed, index + 70) * 4;
  const startY = b.y ?? ground(b.x, b.z) + 0.7, localGround = ground(b.x, b.z) + clearance;
  const fallTime = (lift + Math.sqrt(lift * lift + 19.6 * Math.max(0, startY - localGround))) / 9.8;
  const after = Math.max(0, b.age - fallTime), bounceTime = Math.min(after, 0.4), travel = Math.min(b.age, fallTime) + Math.min(after, 0.6) * 0.28;
  const x = b.x + Math.cos(angle) * travel * speed, z = b.z + Math.sin(angle) * travel * speed;
  const floor = ground(x, z) + clearance;
  const y = b.age < fallTime ? Math.max(floor, startY + lift * b.age - 4.9 * b.age * b.age) : floor + Math.max(0, bounceTime * (0.4 - bounceTime) * 5);
  const fade = Math.min(1, Math.max(0, DESTRUCTION.life - b.age));
  return { x, y, z, angle, spin: Math.min(b.age, fallTime + 0.4), settle: Math.min(1, after / 0.4), fade, size };
}

/** CPU-generated RGBA sprites: transparent borders, no images or downloads. */
export function buildVfxTextures(size = 128) {
  const fire = new Uint8Array(size * size * 4);
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
    fire.set([255, 255, 255, Math.round(edge ** 1.2 * (0.35 + grain * 0.65) * 255)], i);
    smoke.set([255, 255, 255, Math.round(edge ** 0.65 * (0.3 + grain * 0.7) * 210)], i);
    const char = Math.max(0, 1 - r * (0.82 + grain * 0.45));
    scorch.set([255, 255, 255, Math.round(char ** 1.5 * (0.45 + grain * 0.55) * 210)], i);
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) { fire[i + 3] = glow[i + 3] = smoke[i + 3] = scorch[i + 3] = 0; }
  }
  const texture = (pixels: Uint8Array) => { const t = new THREE.DataTexture(pixels, size, size); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  return { volume: buildVolumeNoise(size), fire: texture(fire), glow: texture(glow), smoke: texture(smoke), scorch: texture(scorch) };
}

export function rubbleAt(cx: number, cz: number, index: number) {
  const salt = index * 71, x = cx * 16 + visualNoise(cx * 37 + salt, cz) * 16, z = cz * 16 + visualNoise(cz * 53 + salt, cx) * 16;
  return { x, z, radius: 0.12 + visualNoise(cx + salt, cz + 9) * 0.32, height: 0.06 + visualNoise(cx + 23, cz + salt) * 0.24, angle: visualNoise(cx + salt, cz + 43) * Math.PI * 2 };
}
