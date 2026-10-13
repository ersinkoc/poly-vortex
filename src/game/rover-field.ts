import * as THREE from 'three';
import { ROVER_RULES } from './ground-rovers';
import { terrainHeight } from './terrain';

const SEGMENTS = 28, SIDE = SEGMENTS + 1, VERTICES = SIDE * SIDE;
export function buildRoverField() {
  const positions = new Float32Array(ROVER_RULES.capacity * VERTICES * 3), coords = new Float32Array(ROVER_RULES.capacity * VERTICES * 2), slots = new Float32Array(ROVER_RULES.capacity * VERTICES), indices: number[] = [];
  for (let slot = 0; slot < ROVER_RULES.capacity; slot++) {
    const base = slot * VERTICES;
    for (let z = 0; z < SIDE; z++) for (let x = 0; x < SIDE; x++) {
      const i = base + z * SIDE + x;
      coords[i * 2] = (x / SEGMENTS * 2 - 1) * ROVER_RULES.blastRadius;
      coords[i * 2 + 1] = (z / SEGMENTS * 2 - 1) * ROVER_RULES.blastRadius; slots[i] = slot;
      if (x < SEGMENTS && z < SEGMENTS) indices.push(i, i + SIDE, i + 1, i + 1, i + SIDE, i + SIDE + 1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('fieldCoord', new THREE.BufferAttribute(coords, 2)); g.setAttribute('fieldSlot', new THREE.BufferAttribute(slots, 1)); g.setIndex(indices); return g;
}
export function placeRoverField(g: THREE.BufferGeometry, slot: number, x: number, z: number) {
  const positions = g.getAttribute('position'), coords = g.getAttribute('fieldCoord');
  for (let i = slot * VERTICES; i < (slot + 1) * VERTICES; i++) {
    const px = x + coords.getX(i), pz = z + coords.getY(i);
    positions.setXYZ(i, px, terrainHeight(px, pz) + 0.065, pz);
  }
  positions.needsUpdate = true;
}
export function buildRoverFieldMaterial() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uData: { value: Array.from({ length: ROVER_RULES.capacity }, () => new THREE.Vector4()) }, uReduced: { value: 0 } },
    vertexShader: `attribute vec2 fieldCoord; attribute float fieldSlot; uniform vec4 uData[${ROVER_RULES.capacity}]; varying vec2 vCoord; varying vec4 vData;
      void main() { vCoord = fieldCoord; vData = uData[int(fieldSlot)]; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vCoord; varying vec4 vData; uniform float uReduced;
      float band(float d, float width) { return 1. - smoothstep(width, width + .018, abs(d)); }
      void main() {
        float r = length(vCoord); if (vData.y < .5 || r > ${ROVER_RULES.blastRadius}) discard;
        float primed = step(1.5, vData.y);
        vec3 cyan = vec3(.18, 1.35, 1.08), amber = vec3(2., .95, .21), red = vec3(2.9, .2, .1);
        vec3 tint = mix(mix(cyan, amber, vData.w), red, primed);
        vec2 p = vCoord / .55, s = vec2(1.73205, 1.);
        vec2 a = mod(p, s) - s * .5, b = mod(p - s * .5, s) - s * .5;
        vec2 cell = dot(a,a) < dot(b,b) ? a : b;
        float hex = max(dot(abs(cell), vec2(.866025, .5)), abs(cell.y));
        float grid = band(hex - .5, .014) * .17;
        float angle = atan(vCoord.x, vCoord.y), behind = mod(vData.x - angle + 6.283185, 6.283185);
        float beam = (1. - smoothstep(.02, .55, behind)) * .22 * (1. - uReduced);
        float outer = band(r - ${ROVER_RULES.blastRadius - 0.04}, .018) * .38 * step(.38, fract(angle * 8. / 6.283185));
        float trigger = band(r - ${ROVER_RULES.triggerRadius}, .027) * .65;
        float arc = band(r - .58, .035) * step(mod(angle + 6.283185, 6.283185) / 6.283185, vData.z);
        float cross = max(band(vCoord.x, .014), band(vCoord.y, .014)) * .06;
        float fill = (.015 + beam + grid + cross) * smoothstep(.35, .9, r);
        float alpha = min(.8, fill + outer + trigger + arc * .7);
        gl_FragColor = vec4(tint, alpha);
      }` });
}
