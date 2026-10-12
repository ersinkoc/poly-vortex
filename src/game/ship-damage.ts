import * as THREE from 'three';
import { visualNoise } from './visuals';

export const DAMAGE_LIMITS = { smoke: 24, sparks: 16 } as const;
export function hullDamage(hp: number, maxHp: number) {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - hp / maxHp));
}
export const smokeRate = (damage: number, high = true) => Math.max(0, damage - 0.4) / 0.6 * (high ? 14 : 5);
export const damageHeat = (damage: number) => Math.min(1, Math.max(0, (damage - 0.65) / 0.2));

export function buildDamageUniforms() { return { uHullDamage: { value: 0 }, uHullImpact: { value: 0 } }; }
const damageFunctions = `uniform float uHullDamage; uniform float uHullImpact; varying vec3 vHullPosition;
float pvHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pvNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(pvHash(i),pvHash(i+vec2(1.,0.)),f.x),mix(pvHash(i+vec2(0.,1.)),pvHash(i+vec2(1.,1.)),f.x),f.y);}
`;

/** A player-only PBR layer; the shared fleet textures and geometry stay intact. */
export function attachDamageMaterial(material: THREE.Material, uniforms: ReturnType<typeof buildDamageUniforms>) {
  material.customProgramCacheKey = () => 'poly-core-hull-damage-1';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vHullPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHullPosition=position;');
    shader.fragmentShader = damageFunctions + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      float pvGrain=pvNoise(vHullPosition.xz*8.);
      float pvA=length(vHullPosition.xz-vec2(.75,-.45)) + pvGrain*.17;
      float pvB=length(vHullPosition.xz-vec2(-.6,-.3)) + pvGrain*.16;
      float pvC=length(vHullPosition.xz-vec2(0.,.3)) + pvGrain*.12;
      float pvScar=max(1.-smoothstep(.06,.16+uHullDamage*.85,pvA),max((1.-smoothstep(.06,.2+uHullDamage*.75,pvB))*smoothstep(.18,.55,uHullDamage),(1.-smoothstep(.03,.15+uHullDamage*.7,pvC))*smoothstep(.45,.9,uHullDamage)))*smoothstep(.005,.1,uHullDamage);
      float pvCrack=(1.-smoothstep(.015,.07,abs(sin(vHullPosition.x*31.+sin(vHullPosition.z*19.)*2.+pvGrain*3.))))*pvScar;
      diffuseColor.rgb*=1.-uHullDamage*.4;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.035,.025,.019),pvScar*.9);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012,.016,.019),pvCrack*.75);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.96,pvScar);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor*=1.-pvScar*.9;')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      #ifdef USE_CLEARCOAT
      material.clearcoat*=1.-pvScar*.95;
      material.clearcoatRoughness=mix(material.clearcoatRoughness,.9,pvScar);
      #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float pvHeat=clamp((uHullDamage-.65)/.2,0.,1.);
      totalEmissiveRadiance+=vec3(2.7,.3,.035)*(pvCrack*pvHeat*2.3+pvScar*uHullImpact*.8);`);
  };
  material.needsUpdate = true;
}

type Point = { x: number; y: number; z: number };
export type DamageParticle = Point & { vx: number; vy: number; vz: number; age: number; life: number; size: number; spin: number };
const particle = (): DamageParticle => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0, size: 0, spin: 0 });

/** Fixed CPU/GPU budgets. Visual randomness never consumes the combat RNG. */
export class DamageTrail {
  smoke = Array.from({ length: DAMAGE_LIMITS.smoke }, particle);
  sparks = Array.from({ length: DAMAGE_LIMITS.sparks }, particle);
  private smokeClock = 0; private sparkClock = 0; private serial = 0;
  reset() {
    for (const p of [...this.smoke, ...this.sparks]) p.life = p.age = 0;
    this.smokeClock = this.sparkClock = this.serial = 0;
  }
  advance(dt: number, damage: number, origins: readonly Point[], high = true, calm = false) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    for (const pool of [this.smoke, this.sparks]) for (const p of pool) if (p.age < p.life) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (pool === this.sparks) p.vy -= dt * 6;
    }
    this.smokeClock += dt * smokeRate(damage, high);
    this.sparkClock += dt * damageHeat(damage) * (high ? 10 : 3) * (calm ? 0.25 : 1);
    while (this.smokeClock >= 1) { this.smokeClock--; this.emit(this.smoke, origins, damage, false); }
    while (this.sparkClock >= 1) { this.sparkClock--; this.emit(this.sparks, origins, damage, true); }
  }
  private emit(pool: DamageParticle[], origins: readonly Point[], damage: number, spark: boolean) {
    const p = pool.find(p => p.age >= p.life); if (!p || !origins.length) return;
    const seed = ++this.serial, origin = origins[seed % origins.length];
    p.x = origin.x; p.y = origin.y; p.z = origin.z; p.age = 0;
    p.life = spark ? 0.2 + visualNoise(seed, 8) * 0.18 : 1.35 + visualNoise(seed, 8) * 0.3;
    p.vx = (visualNoise(seed, 1) - 0.5) * (spark ? 4 : 0.5); p.vz = (visualNoise(seed, 2) - 0.5) * (spark ? 4 : 0.5);
    p.vy = spark ? 1 + visualNoise(seed, 3) * 2 : 0.6 + visualNoise(seed, 3) * 0.4;
    p.size = spark ? 0.065 : 0.28 + damage * 0.28; p.spin = visualNoise(seed, 4) * Math.PI * 2;
  }
}
