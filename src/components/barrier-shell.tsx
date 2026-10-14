'use client';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '@/game/engine';
import { BARRIER } from '@/game/barrier';
import { useGame } from '@/game/store';
import { playerFlightPose } from '@/game/player-pose';
const vertex = `varying vec3 vPoint;varying vec3 vNormal;varying vec3 vView;
void main(){vPoint=position;vNormal=normalize(normalMatrix*normal);vec4 v=modelViewMatrix*vec4(position,1.);vView=-v.xyz;gl_Position=projectionMatrix*v;}`;
const fragment = `varying vec3 vPoint;varying vec3 vNormal;varying vec3 vView;uniform float uTime;uniform float uStrength;
void main(){vec3 n=normalize(vPoint);vec2 uv=vec2(atan(n.z,n.x)*3.82,asin(n.y)*5.);
vec2 grid=vec2(1.,1.73205),a=mod(uv,grid)-grid*.5,b=mod(uv-grid*.5,grid)-grid*.5;
vec2 cell=dot(a,a)<dot(b,b)?a:b;float h=max(abs(cell.x),dot(abs(cell),vec2(.5,.8660254)));
float edge=smoothstep(.43-fwidth(h),.49,h),rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.);
float scan=pow(max(0.,cos(n.y*8.-uTime*3.)),20.);float alpha=(.045+edge*.2+rim*.4+scan*.06)*uStrength;
gl_FragColor=vec4((vec3(.22,1.6,2.7)*(.4+edge+rim)+vec3(1.4,1.1,.4)*scan)*uStrength,alpha);}`;
export default function BarrierShell() {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: 0 } }), []);
  useFrame(() => {
    if (!mesh.current) return; const state = useGame.getState(), p = playerFlightPose(engine.time, engine.player);
    mesh.current.visible = (state.phase === 'playing' || state.phase === 'paused') && engine.barrier > 0;
    mesh.current.position.set(p.x, p.y, p.z); mesh.current.rotation.y = engine.player.angle;
    uniforms.uTime.value = state.reducedEffects ? 0 : engine.time;
    uniforms.uStrength.value = Math.min(1, engine.barrier / 0.4, (BARRIER.duration - engine.barrier) / 0.1 + 0.3);
  });
  return <mesh ref={mesh} scale={[2.05, 1.15, 2.25]} visible={false} frustumCulled={false}><sphereGeometry args={[1, 32, 20]}/><shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>;
}
