'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildTerrainTextures, TERRAIN_CELL, terrainHeight, terrainProp } from '@/game/terrain';
import { engine } from '@/game/engine';
import { useGame } from '@/game/store';
import { SECTORS } from '@/game/progression';
import { rubbleAt, VISUAL_LIMITS } from '@/game/visuals';

const pose = new THREE.Object3D();
export default function Terrain() {
  const floor = useRef<THREE.Mesh>(null), rocks = useRef<THREE.InstancedMesh>(null), ruins = useRef<THREE.InstancedMesh>(null), seams = useRef<THREE.InstancedMesh>(null);
  const rubble = useRef<THREE.InstancedMesh>(null);
  const quality = useGame(s => s.quality);
  useEffect(() => { cell.current = ''; }, [quality]);
  const cell = useRef('');
  const assets = useMemo(() => {
    const textures = buildTerrainTextures(); Object.values(textures).forEach(t => t.repeat.set(16, 16));
    const geometry = new THREE.PlaneGeometry(128, 128, 128, 128).rotateX(-Math.PI / 2);
    (geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    const uniforms = { uTerrainTime: { value: 0 }, uTerrainPulse: { value: new THREE.Vector3(0, 0, -100) }, uTerrainCenter: { value: new THREE.Vector2() }, uTerrainTint: { value: new THREE.Color(SECTORS[0].color) } };
    const material = new THREE.MeshStandardMaterial({ map: textures.map, normalMap: textures.normal, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: textures.roughness, color: '#83867e', roughness: 0.94, metalness: 0.12 });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vTerrainWorld; uniform float uTerrainTime; uniform vec3 uTerrainPulse; uniform vec2 uTerrainCenter; uniform vec3 uTerrainTint;
        float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);float b=fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453);float c=fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453);float d=fract(sin(dot(i+1.,vec2(127.1,311.7)))*43758.5453);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
      `).replace('#include <color_fragment>', `#include <color_fragment>
        float weather=groundNoise(vTerrainWorld.xz*.14); diffuseColor.rgb*=mix(vec3(.45,.58,.67),vec3(1.12,1.04,.87),weather);
      `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=mix(.3,roughnessFactor,smoothstep(.15,.6,groundNoise(vTerrainWorld.xz*.18+23.)));
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 p=vTerrainWorld.xz; vec2 grid=abs(fract(p/2.-.5)-.5)/max(fwidth(p/2.),vec2(.0001));
        float line=1.-min(min(grid.x,grid.y),1.); float fade=exp(-length(p-uTerrainCenter)*.045);
        float elapsed=max(0.,uTerrainTime-uTerrainPulse.z);
        float wave=exp(-pow(length(p-uTerrainPulse.xy)-elapsed*12.,2.)*.7)*exp(-elapsed*1.4);
        totalEmissiveRadiance+=uTerrainTint*line*fade*(.08+wave*.45);`);
    };
    const rock = new THREE.IcosahedronGeometry(1, 2), points = rock.attributes.position;
    for (let i = 0; i < points.count; i++) { const x = points.getX(i), y = points.getY(i), z = points.getZ(i); const scale = 0.9 + Math.sin(x * 17 + y * 11 + z * 9) * 0.12; points.setXYZ(i, x * scale, y * scale, z * scale); }
    rock.computeVertexNormals();
    const wall = new THREE.Shape(); wall.moveTo(-0.7, -1); wall.lineTo(0.7, -1); wall.lineTo(0.7, 0.15); wall.lineTo(0.4, 0.45); wall.lineTo(0.1, 0.08); wall.lineTo(-0.1, 0.5); wall.lineTo(-0.3, 1); wall.lineTo(-0.7, 0.8); wall.closePath();
    const wallParts = [new THREE.ExtrudeGeometry(wall, { depth: 0.55, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1, steps: 1 }).translate(0, 0, -0.28), new THREE.BoxGeometry(1.75, 0.18, 1.4).translate(0, -0.92, 0), new THREE.BoxGeometry(0.13, 1.1, 0.13).rotateZ(-0.2).translate(0.65, -0.5, 0.45)];
    const parts = wallParts.map(g => g.index ? g.toNonIndexed() : g); const ruin = mergeGeometries(parts); [...new Set([...wallParts, ...parts])].forEach(g => g.dispose());
    if (!ruin) throw new Error('Unable to create terrain ruins.');
    return { textures, geometry, material, uniforms, rock, ruin };
  }, []);
  useEffect(() => () => { Object.values(assets.textures).forEach(t => t.dispose()); assets.geometry.dispose(); assets.material.dispose(); assets.rock.dispose(); assets.ruin.dispose(); }, [assets]);
  useFrame(({ clock }) => {
    const active = useGame.getState().phase !== 'menu'; const px = active ? engine.player.x : 0, pz = active ? engine.player.z : 0;
    const cx = Math.floor(px / TERRAIN_CELL), cz = Math.floor(pz / TERRAIN_CELL), key = `${cx},${cz}`;
    assets.uniforms.uTerrainTime.value = active ? engine.time : clock.elapsedTime; assets.uniforms.uTerrainCenter.value.set(px, pz); assets.uniforms.uTerrainTint.value.set(SECTORS[active ? engine.sector : 0].color);
    assets.uniforms.uTerrainPulse.value.set(active ? engine.pulse.x : 0, active ? engine.pulse.z : 0, active ? engine.pulse.time : Math.floor(clock.elapsedTime / 5) * 5);
    if (cell.current === key || !floor.current || !rocks.current || !ruins.current || !seams.current) return;
    cell.current = key; const ox = cx * TERRAIN_CELL, oz = cz * TERRAIN_CELL;
    floor.current.position.set(ox, 0, oz); const vertices = assets.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) vertices.setY(i, terrainHeight(vertices.getX(i) + ox, vertices.getZ(i) + oz));
    vertices.needsUpdate = true; assets.geometry.computeVertexNormals(); assets.geometry.computeBoundingSphere();
    let r = 0, b = 0, chips = 0;
    for (let ix = cx - 4; ix <= cx + 4; ix++) for (let iz = cz - 4; iz <= cz + 4; iz++) {
      const prop = terrainProp(ix, iz); if (!prop) continue;
      pose.position.set(prop.x, terrainHeight(prop.x, prop.z) + prop.height * 0.5, prop.z); pose.rotation.set(0.08, prop.angle, prop.ruin ? -0.14 : 0.1); pose.scale.set(prop.radius, prop.height * 0.5, prop.radius * 0.85); pose.updateMatrix();
      if (prop.ruin) { ruins.current.setMatrixAt(b, pose.matrix); seams.current.setMatrixAt(b++, pose.matrix); } else rocks.current.setMatrixAt(r++, pose.matrix);
    }
    if (rubble.current) {
      for (let ix = cx - 4; ix <= cx + 4; ix++) for (let iz = cz - 4; iz <= cz + 4; iz++) for (let j = 0; j < 4; j++) {
        const chip = rubbleAt(ix, iz, j); if (Math.hypot(chip.x, chip.z) < 3) continue;
        pose.position.set(chip.x, terrainHeight(chip.x, chip.z) + chip.height * 0.4, chip.z); pose.rotation.set(0.3, chip.angle, 0.2); pose.scale.set(chip.radius, chip.height, chip.radius * 0.7); pose.updateMatrix(); rubble.current.setMatrixAt(chips++, pose.matrix);
      }
      rubble.current.count = chips; rubble.current.instanceMatrix.needsUpdate = true;
    }
    rocks.current.count = r; ruins.current.count = seams.current.count = b;
    for (const mesh of [rocks.current, ruins.current, seams.current]) mesh.instanceMatrix.needsUpdate = true;
  });
  return <>
    <mesh ref={floor} geometry={assets.geometry} material={assets.material} frustumCulled={false} receiveShadow />
    <instancedMesh ref={rocks} args={[assets.rock, undefined, 81]} frustumCulled={false} castShadow receiveShadow><meshStandardMaterial map={assets.textures.map} normalMap={assets.textures.normal} normalScale={[0.65, 0.65]} roughness={0.9} color="#92948c" /></instancedMesh>
    <instancedMesh ref={ruins} args={[assets.ruin, undefined, 81]} frustumCulled={false} castShadow receiveShadow><meshStandardMaterial map={assets.textures.map} normalMap={assets.textures.normal} color="#80918f" roughness={0.78} metalness={0.25} /></instancedMesh>
    {quality === 'high' && <instancedMesh ref={rubble} args={[undefined, undefined, VISUAL_LIMITS.rubble]} count={0} frustumCulled={false} receiveShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#77786d" roughness={0.95} /></instancedMesh>}
    <instancedMesh ref={seams} args={[assets.ruin, undefined, 81]} frustumCulled={false}><meshBasicMaterial color="#315356" wireframe transparent opacity={0.18} /></instancedMesh>
  </>;
}
