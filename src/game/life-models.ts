import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ellipsoid = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 10, 6).scale(sx, sy, sz).translate(x, y, z);
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const merge = (parts: THREE.BufferGeometry[]) => {
  const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
  if (!geometry) throw new Error('Unable to build ambient actor geometry.'); return geometry;
};

export function buildLifeModels() {
  return {
    fox: merge([
      ellipsoid(0.2, 0, 0.29, 0, 0.85, 1, 1.65), ellipsoid(0.14, 0, 0.48, 0.28, 0.9, 1, 1.05),
      ellipsoid(0.09, 0, 0.43, 0.43, 0.7, 0.65, 1.5),
      new THREE.ConeGeometry(0.065, 0.22, 5).translate(-0.095, 0.66, 0.28), new THREE.ConeGeometry(0.065, 0.22, 5).translate(0.095, 0.66, 0.28),
      new THREE.CapsuleGeometry(0.065, 0.33, 3, 7).rotateX(-1.1).translate(0, 0.32, -0.43),
    ]),
    lizard: merge([
      ellipsoid(0.14, 0, 0.14, 0, 1.25, 0.7, 2.3), ellipsoid(0.11, 0, 0.18, 0.3, 1.2, 0.6, 1.4),
      new THREE.ConeGeometry(0.11, 0.6, 7).rotateX(-Math.PI / 2).translate(0, 0.12, -0.5),
      box(0.035, 0.09, 0.32, 0, 0.27, -0.01),
    ]),
    animalLeg: new THREE.CapsuleGeometry(0.035, 0.13, 3, 7).translate(0, -0.085, 0),
    eyes: merge([ellipsoid(0.018, -0.08, 0.48, 0.365), ellipsoid(0.018, 0.08, 0.48, 0.365), ellipsoid(0.035, 0, 0.425, 0.53)]),
    crew: merge([
      box(0.39, 0.45, 0.25, 0, 1.05, 0), box(0.33, 0.18, 0.23, 0, 0.75, 0),
      ellipsoid(0.18, 0, 1.43, 0, 1, 1.15, 1), box(0.23, 0.32, 0.16, 0, 1.08, -0.2),
      box(0.44, 0.07, 0.27, 0, 0.88, 0),
    ]),
    vest: merge([box(0.36, 0.32, 0.075, 0, 1.06, 0.16), box(0.08, 0.34, 0.29, -0.15, 1.09, 0.005), box(0.08, 0.34, 0.29, 0.15, 1.09, 0.005)]),
    visor: ellipsoid(0.14, 0, 1.46, 0.1, 1, 0.5, 0.75),
    arm: new THREE.CapsuleGeometry(0.065, 0.29, 3, 7).translate(0, -0.2, 0),
    leg: merge([new THREE.CapsuleGeometry(0.075, 0.43, 3, 7).translate(0, -0.28, 0), box(0.15, 0.1, 0.23, 0, -0.55, 0.055)]),
  };
}
