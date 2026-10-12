'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { SHIELD_IMPACT, SHIELD_SURFACE } from '@/game/shield-impact';

const vertex = `varying vec3 vShieldPoint;
void main(){vShieldPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `uniform vec4 uHits[${SHIELD_IMPACT.capacity}]; uniform float uAges[${SHIELD_IMPACT.capacity}]; uniform float uCalm; varying vec3 vShieldPoint;
void main(){vec3 p=normalize(vShieldPoint),color=vec3(0.);float opacity=0.;
for(int i=0;i<${SHIELD_IMPACT.capacity};i++){
  float age=uAges[i];if(age<0.||age>=${SHIELD_IMPACT.life}||abs(uHits[i].w)<.001)continue;
  vec3 n=uHits[i].xyz;float angular=1.-dot(p,n);
  // Outside the struck cap there is no surface, rim, Fresnel or idle glow.
  if(angular>.2)continue;
  vec3 t=normalize(cross(vec3(0.,1.,0.),n)),b=cross(n,t);
  vec2 uv=vec2(dot(p,t),dot(p,b))*${SHIELD_IMPACT.cells}.;
  vec2 grid=vec2(1.,1.7320508),a=mod(uv,grid)-grid*.5,c=mod(uv-grid*.5,grid)-grid*.5;
  vec2 cell=dot(a,a)<dot(c,c)?a:c;
  float hex=max(abs(cell.x),dot(abs(cell),vec2(.5,.8660254))),aa=max(.01,fwidth(hex));
  float edge=smoothstep(.41-aa,.49,hex);
  float cellDistance=length(uv-cell)/${SHIELD_IMPACT.cells}.;
  float capMask=(1.-smoothstep(.28,.58,cellDistance))*(1.-smoothstep(.12,.2,angular));
  float fade=pow(clamp(1.-age/${SHIELD_IMPACT.life},0.,1.),1.5);
  float ring=1.-smoothstep(.025,.08,abs(length(uv)/${SHIELD_IMPACT.cells}.-(.04+age*.55)));
  float signal=capMask*fade*abs(uHits[i].w)*mix(1.,.65,uCalm);
  vec3 hue=uHits[i].w<0.?vec3(3.1,1.4,.25):vec3(.23,2.0,3.4);
  color+=hue*signal*(.45+edge*.9+ring*.25);
  opacity+=signal*(.085+edge*.72+ring*.12);
}
if(opacity<.008)discard;gl_FragColor=vec4(color,min(.92,opacity));
#include <colorspace_fragment>
}`;

export default function ImpactShield() {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uHits: { value: Array.from({ length: SHIELD_IMPACT.capacity }, () => new THREE.Vector4()) }, uAges: { value: new Float32Array(SHIELD_IMPACT.capacity).fill(-1) }, uCalm: { value: 0 } }), []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const state = useGame.getState(), p = engine.player;
    mesh.current.visible = state.phase !== 'menu' && engine.shieldHits.length > 0;
    mesh.current.position.set(p.x, 0.95 + Math.sin(clock.elapsedTime * 2.5) * 0.045, p.z); mesh.current.rotation.y = p.angle;
    uniforms.uAges.value.fill(-1); uniforms.uCalm.value = state.reducedEffects ? 1 : 0;
    engine.shieldHits.forEach((hit, i) => { uniforms.uHits.value[i].set(hit.x, hit.y, hit.z, hit.power * (hit.broken ? -1 : 1)); uniforms.uAges.value[i] = hit.age; });
  });
  return <mesh ref={mesh} visible={false} scale={[SHIELD_SURFACE.x, SHIELD_SURFACE.y, SHIELD_SURFACE.z]} frustumCulled={false}>
    <sphereGeometry args={[1, 32, 20]} />
    <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
  </mesh>;
}
