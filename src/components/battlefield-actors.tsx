'use client';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine, LIMITS } from '@/game/engine';
import { aimedPart, ENEMY_ROLES, livePart, partPosition } from '@/game/battlefield';
import { terrainHeight } from '@/game/terrain';
import { useGame } from '@/game/store';

/** Fixed instanced batches: new content never adds per-enemy lights or meshes. */
export default function BattlefieldActors() {
  const modules = useRef<THREE.InstancedMesh>(null), shields = useRef<THREE.InstancedMesh>(null), roles = useRef<THREE.InstancedMesh>(null), structures = useRef<THREE.InstancedMesh>(null), tanks = useRef<THREE.InstancedMesh>(null), payloads = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => ({ pose: new THREE.Object3D(), color: new THREE.Color() }), []);
  useFrame(() => {
    const { pose, color } = scratch, active = useGame.getState().phase !== 'menu';
    let parts = 0, shield = 0, role = 0, props = 0, fuel = 0, payload = 0;
    if (active) for (const e of engine.enemies) {
      if (e.hp <= 0) continue;
      const yaw = Math.atan2(engine.player.x-e.x, engine.player.z-e.z);
      const focused = aimedPart(e,engine.input,engine.player)?.part;
      for (const part of e.parts ?? []) {
        if (part.hp <= 0 || !modules.current) continue;
        const position = partPosition(e, part.kind, engine.player);
        pose.position.set(position.x,position.y,position.z); pose.rotation.set(0,yaw,0);
        const gun = part.kind === 'leftGun' || part.kind === 'rightGun';
        pose.scale.set(e.radius*(gun?.24:.38),e.radius*.22,e.radius*(gun?.65:.38)); pose.updateMatrix();
        modules.current.setMatrixAt(parts,pose.matrix); color.set(focused===part?'#bdff75':part.hp/part.maxHp<.35?'#ff7357':part.kind==='generator'?'#72deff':'#b1bcc5'); modules.current.setColorAt(parts++,color);
      }
      if (e.role && roles.current) {
        pose.position.set(e.x,e.radius*.75+1,e.z);pose.rotation.set(-Math.PI/2,0,engine.time*.3);pose.scale.setScalar(e.radius*1.2);pose.updateMatrix();
        roles.current.setMatrixAt(role,pose.matrix);roles.current.setColorAt(role++,color.set(ENEMY_ROLES[e.role].color));
        if(payloads.current){
          pose.position.set(e.x,e.radius*.75+.65,e.z);pose.rotation.set(0,yaw,0);
          pose.scale.set(e.radius*(e.role==='bomber'?2.3:e.role==='carrier'?1.3:.65),e.radius*(e.role==='shield'?.8:.35),e.radius*(e.role==='carrier'?1.8:e.role==='hunter'?1.2:.55));pose.updateMatrix();
          payloads.current.setMatrixAt(payload,pose.matrix);payloads.current.setColorAt(payload++,color.set(ENEMY_ROLES[e.role].color));
        }
      }
      if (e.role==='shield' && livePart(e,'generator') && shields.current && shield<6) {
        pose.position.set(e.x,.3,e.z);pose.rotation.set(0,0,0);pose.scale.set(5,2.5,5);pose.updateMatrix();shields.current.setMatrixAt(shield++,pose.matrix);
      }
    }
    if (active && structures.current && tanks.current) for (const s of engine.structures) {
      if (s.hp <= 0 || Math.hypot(s.x-engine.player.x,s.z-engine.player.z)>35) continue;
      pose.position.set(s.x,terrainHeight(s.x,s.z)+.7,s.z);pose.rotation.set(0,s.id*.37,0);pose.scale.set(s.radius*1.7,1.4,s.kind==='fuel'?s.radius*1.7:.6);pose.updateMatrix();
      if(s.kind==='fuel'){tanks.current.setMatrixAt(fuel++,pose.matrix);}else{structures.current.setMatrixAt(props,pose.matrix);structures.current.setColorAt(props++,color.set('#607d8a'));}
    }
    for(const [mesh,count] of [[modules.current,parts],[shields.current,shield],[roles.current,role],[structures.current,props],[tanks.current,fuel],[payloads.current,payload]] as const){if(!mesh)continue;mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  });
  return <>
    <instancedMesh ref={modules} args={[undefined,undefined,LIMITS.enemies*4]} count={0} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial metalness={.75} roughness={.45}/></instancedMesh>
    <instancedMesh ref={shields} args={[undefined,undefined,6]} count={0} frustumCulled={false}><octahedronGeometry args={[1,1]}/><meshBasicMaterial color="#75dfff" wireframe transparent opacity={.14} depthWrite={false} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={roles} args={[undefined,undefined,LIMITS.enemies]} count={0} frustumCulled={false}><ringGeometry args={[.8,1,5]}/><meshBasicMaterial side={THREE.DoubleSide} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={structures} args={[undefined,undefined,8]} count={0} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial metalness={.5} roughness={.7}/></instancedMesh>
    <instancedMesh ref={tanks} args={[undefined,undefined,8]} count={0} frustumCulled={false}><cylinderGeometry args={[.45,.5,1,8]}/><meshStandardMaterial color="#b8874e" metalness={.7} roughness={.4}/></instancedMesh>
    <instancedMesh ref={payloads} args={[undefined,undefined,LIMITS.enemies]} count={0} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial metalness={.65} roughness={.55}/></instancedMesh>
  </>;
}
