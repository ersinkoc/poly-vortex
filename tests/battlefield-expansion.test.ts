import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine, LIMITS } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { audio } from '../src/game/audio';
import { EMPTY_PROFILE } from '../src/game/types';
import { partPosition, districtAt, districtStructures } from '../src/game/battlefield';
import { clearTerrainPosition, terrainHeight, terrainProp } from '../src/game/terrain';
import { restoreCheckpoint, validateCheckpoint } from '../src/game/checkpoint';
import { MissionDirector, missionGoal, type Mission } from '../src/game/missions';

const previous=useGame.getState(), sound=audio.enabled;
let game:GameEngine;
beforeEach(()=>{audio.enabled=false;useGame.setState({phase:'playing',activeShip:'vector',runMode:'expedition',loadout:'pulse',difficulty:'standard',aimMode:'assisted',profile:structuredClone(EMPTY_PROFILE)});game=new GameEngine(812);game.reset();game.structures=[];game.weapons.pulse=0;game.player.invulnerable=10000;game.bossSpawned=true;game.roverBay.nextWave=10000;});
afterEach(()=>{useGame.setState(previous);audio.enabled=sound;});
const advance=(seconds:number)=>{for(let i=0;i<Math.round(seconds*60);i++)game.tick(1/60);};
const context={enemies:[],recentHit:false};

test('aimed damage removes a heavy weapon mount exactly once and disables its cannon',()=>{
  game.spawn(2,0,10);const e=game.enemies[0];
  for(const part of e.parts!.filter(p=>p.kind.endsWith('Gun'))){game.hitEnemy(e,part.hp+1,false,partPosition(e,part.kind,game.player));expect(part.hp).toBe(0);}
  expect(game.blasts).toHaveLength(2);const kills=game.kills;
  e.timer=0;advance(2);expect(e.cannon).toBeUndefined();expect(game.bolts.filter(b=>b.enemy)).toHaveLength(0);expect(game.kills).toBe(kills);
});
test('mouse aim guides a real pulse bolt into the chosen heavy module',()=>{
  game.spawn(2,0,10);const e=game.enemies[0],mount=partPosition(e,'leftGun',game.player);e.timer=100;game.weapons.pulse=1;game.input.aiming=true;game.input.aimX=mount.x;game.input.aimZ=mount.z;game.player.angle=Math.atan2(mount.x,mount.z);
  game.tick(1/60);expect(game.bolts[0].part).toBe('leftGun');advance(.5);
  expect(e.parts!.find(p=>p.kind==='leftGun')!.hp).toBe(0);expect(e.parts!.find(p=>p.kind==='rightGun')!.hp).toBeGreaterThan(0);
});
test('destroying a shield generator removes its protection from nearby ships',()=>{
  game.spawn(1,0,8,false,'shield');game.spawn(0,2,8);const [shield,enemy]=game.enemies;
  const hp=enemy.hp;game.hitEnemy(enemy,10);expect(hp-enemy.hp).toBeCloseTo(5.5);
  const generator=shield.parts!.find(p=>p.kind==='generator')!;game.hitEnemy(shield,generator.hp+1,false,partPosition(shield,'generator',game.player));
  const after=enemy.hp;game.hitEnemy(enemy,10);expect(after-enemy.hp).toBeCloseTo(10);
});
test('minelayers leave armed proximity mines and bombers mark three delayed strikes',()=>{
  game.spawn(1,0,9,false,'minelayer');game.enemies[0].specialTimer=0;game.tick(1/60);
  expect(game.hazards.some(h=>h.mine&&!h.detonated)).toBe(true);
  game.hazards=[];game.enemies=[];game.spawn(1,0,10,false,'bomber');game.enemies[0].specialTimer=0;game.tick(1/60);
  expect(game.hazards).toHaveLength(3);expect(game.hazards.every(h=>!h.detonated&&h.delay>=1.8)).toBe(true);
});
test('carrier launches capped escorts and a destroyed generator stops new launches',()=>{
  game.spawn(2,0,12,false,'carrier');const carrier=game.enemies[0];carrier.specialTimer=0;game.tick(1/60);
  expect(game.enemies.filter(e=>e.parent===carrier.id)).toHaveLength(2);
  for(let i=0;i<6;i++){carrier.specialTimer=0;game.tick(1/60);}
  expect(game.enemies.filter(e=>e.parent===carrier.id)).toHaveLength(6);
  carrier.parts!.find(p=>p.kind==='generator')!.hp=0;game.enemies=game.enemies.filter(e=>e===carrier);carrier.specialTimer=0;game.tick(1/60);expect(game.enemies).toHaveLength(1);
});
test('escort hunters acquire an elevated target sooner than ordinary gunships',()=>{
  game.weapons.glaive=1;game.droneRack.install(1);game.droneFormation.reset(game.player,2);
  game.spawn(0,0,8,false,'hunter');const hunter=game.enemies[0];hunter.age=1.6;hunter.timer=0;game.tick(1/60);
  expect(hunter.ranged?.aimY).toBeGreaterThan(2);
});
test('evolved rail releases three finite fragments with independent hit lists',()=>{
  game.weapons.rail=6;game.spawn(2,0,8);const e=game.enemies[0];e.hp=e.maxHp=10000;e.timer=100;
  game.bolts.push({x:0,z:8,vx:0,vz:32,age:0,enemy:false,target:0,damage:20,playerWeapon:'rail',pierce:3,hits:[],range:27});game.tick(1/60);
  const fragments=game.bolts.filter(b=>b.split&&b.range===10);expect(fragments).toHaveLength(3);
  expect(new Set(fragments.map(b=>b.vx.toFixed(3))).size).toBe(3);expect(fragments.every(b=>b.hits?.includes(e.id))).toBe(true);expect(fragments[0].hits).not.toBe(fragments[1].hits);
  expect(game.bolts.length).toBeLessThanOrEqual(LIMITS.bolts);
});
test('evolved cryo slows real hostile projectile travel without changing velocity',()=>{
  game.weapons.cryo=6;game.vortices=[{x:3,z:0,radius:4,life:3}];game.bolts=[{x:3,z:0,vx:10,vz:0,age:0,enemy:true,target:0,damage:1}];
  game.tick(1/60);expect(game.bolts[0].x).toBeCloseTo(3+10/60*.35);expect(game.bolts[0].vx).toBe(10);
});
test('pulse and escort evolutions change real fired rounds at level six',()=>{
  game.spawn(0,0,8);game.enemies[0].timer=100;game.weapons.pulse=6;game.tick(1/60);expect(game.bolts[0].pierce).toBe(2);
  game.bolts=[];game.weapons.pulse=0;game.weapons.glaive=6;game.droneRack.install(6);advance(.25);
  const shot=game.bolts.find(b=>b.drone!==undefined);expect(shot?.damage).toBeCloseTo(26.25);
});
test('Tesla evolution restores four battery through the actual discharge path',()=>{
  const run=(level:number)=>{
    game=new GameEngine(812);game.reset();game.bossSpawned=true;game.structures=[];game.roverBay.nextWave=10000;game.player.invulnerable=10000;
    game.weapons.pulse=0;game.weapons.tesla=level;game.weapons.glaive=1;game.droneRack.install(1);game.droneRack.units[0].battery=50;
    game.spawn(1,0,8);game.enemies[0].hp=game.enemies[0].maxHp=1e9;game.enemies[0].timer=100;
    advance(1.05);return game.droneRack.units[0].battery;
  };
  const control=run(5),charged=run(6);expect(charged-control).toBeCloseTo(4);
});
test('evolved scatter rebounds once from real stone cover',()=>{
  let rock;for(let x=1;x<8&&!rock;x++)for(let z=1;z<8;z++){const p=terrainProp(x,z);if(p&&terrainHeight(p.x,p.z)+p.height>.8){rock=p;break;}}
  expect(rock).toBeDefined();game.weapons.scatter=6;game.player.x=rock!.x-5;game.player.z=rock!.z;
  game.bolts=[{x:rock!.x-rock!.radius-.02,z:rock!.z,vx:20,vz:0,age:0,enemy:false,target:0,damage:10,playerWeapon:'scatter',range:11}];game.tick(1/60);
  expect(game.bolts[0].bounce).toBe(1);expect(game.bolts[0].vx).toBe(-20);expect(game.bolts[0].damage).toBe(8);
});
test('fuel depots damage nearby hostiles and destroyed cover no longer intercepts rounds',()=>{
  game.structures=[{id:1,x:0,z:8,hp:45,kind:'fuel',radius:.65}];game.spawn(0,1,8);game.hitStructure(game.structures[0],50);
  expect(game.structures[0].hp).toBe(0);expect(game.kills).toBe(1);
  game.structures=[{id:2,x:0,z:3,hp:100,kind:'cover',radius:1.1}];game.bolts=[{x:0,z:1.8,vx:0,vz:20,age:0,enemy:false,target:0,damage:20}];game.tick(1/60);
  expect(game.structures[0].hp).toBe(80);expect(game.bolts).toHaveLength(0);
});
test('heavy ships slide around barricades without losing their firing band or clipping cover',()=>{
  game.structures=districtStructures(0,0,1);game.spawn(2,0,3);const e=game.enemies[0];e.timer=100;advance(12);
  expect(Math.hypot(e.x,e.z)).toBeGreaterThanOrEqual(9);
  for(const s of game.structures)if(s.hp>0)expect(Math.hypot(e.x-s.x,e.z-s.z)).toBeGreaterThanOrEqual(s.radius+e.radius-1e-6);
});
test('Wraith dash breaks locks while Aegis and Bastion deploy their unique systems',()=>{
  useGame.setState({activeShip:'wraith'});game.reset();game.spawn(0,0,8);const e=game.enemies[0];e.ranged={remaining:.2,aimX:0,aimY:.95,aimZ:0,rounds:2};game.input.dash=true;game.tick(1/60);
  expect(e.ranged).toBeUndefined();expect(e.jammed).toBeGreaterThan(e.age+2);
  useGame.setState({activeShip:'aegis'});game.reset();game.activateBarrier();expect(game.barrier).toBe(5);
  useGame.setState({activeShip:'bastion'});game.reset();expect(game.weapons.glaive).toBe(1);expect(game.droneRack.capacity).toBe(2);
});
test('Nova danger charge increases actual damage and decays when flying clear',()=>{
  useGame.setState({activeShip:'nova'});game.reset();game.structures=[];game.spawn(0,0,3);game.weapons.pulse=0;game.player.invulnerable=1000;
  game.frameCharge=2;const e=game.enemies[0],hp=e.hp;game.hitEnemy(e,1);expect(hp-e.hp).toBeCloseTo(1.3);
  game.enemies=[];game.bossSpawned=true;game.tick(1/60);expect(game.frameCharge).toBeLessThan(2);
});
test('new tactical state round trips; old saves resume and malformed modules are rejected',()=>{
  game.spawn(2,0,12,false,'carrier');game.enemies[0].parts![0].hp=0;game.structures=districtStructures(0,0,1);game.frameCharge=2;
  const snapshot=game.checkpoint(), restored=new GameEngine(2);expect(restoreCheckpoint(restored,snapshot)).toBe(true);expect(restored.enemies).toEqual(game.enemies);expect(restored.structures).toEqual(game.structures);
  const old=structuredClone(snapshot);delete old.state.structures;delete old.state.frameCharge;delete old.state.district;
  expect(restoreCheckpoint(restored,old)).toBe(true);expect(restored.structures).toEqual([]);expect(restored.frameCharge).toBe(0);
  const bad=structuredClone(snapshot);(bad.state.enemies as any[])[0].role='invalid';expect(validateCheckpoint(bad,game)).toBe(false);
  (bad.state.enemies as any[])[0].role='carrier';(bad.state.enemies as any[])[0].parts[1].kind='leftGun';expect(validateCheckpoint(bad,game)).toBe(false);
});
test('district transitions remain continuous, distinct and deterministic',()=>{
  expect(new Set([0,64,128,192].map(x=>districtAt(x,0))).size).toBe(4);
  for(const x of [-64,0,64,128])for(const z of [-64,0,64])expect(Math.abs(terrainHeight(x-.001,z)-terrainHeight(x+.001,z))).toBeLessThan(.01);
  expect(districtStructures(0,0,1)).toEqual(districtStructures(0,0,1));
});

function rescue(){const d=new MissionDirector();d.tick(8,{x:0,z:0},0,()=>.5);return d;}
test('rescue preparation is interrupted by movement, danger and fresh hits',()=>{
  const d=rescue(),t=d.mission!.targets[0];d.tick(1,{...t,vx:3},0,()=>.5,context);expect(t.progress).toBe(0);
  d.tick(1,t,0,()=>.5,{enemies:[{...t,hp:10}],recentHit:false});expect(t.progress).toBe(0);expect(d.mission!.blocked).toBe('CLEAR PILOT PERIMETER');
  d.tick(1,t,0,()=>.5,{enemies:[],recentHit:true});expect(t.progress).toBe(0);
  expect(d.tick(2,t,0,()=>.5,context)).toEqual(['secured']);expect(t.done).toBe(false);expect(d.rescued).toBe(0);
});
test('crew follows at bounded speed, does not teleport after a dash, and evacuates only in safety',()=>{
  const d=rescue(),m=d.mission!,t=m.targets[0];d.tick(2,t,0,()=>.5,context);const start={x:t.x,z:t.z};
  d.tick(1,{x:t.x+7,z:t.z},0,()=>.5,context);expect(Math.hypot(t.x-start.x,t.z-start.z)).toBeLessThanOrEqual(3.61);
  const before={x:t.x,z:t.z};d.tick(1,{x:t.x+20,z:t.z},0,()=>.5,context);expect(t.x).toBe(before.x);expect(m.blocked).toBe('REGROUP WITH CREW');
  for(const pilot of m.targets){pilot.stage='following';pilot.x=m.evacuation!.x;pilot.z=m.evacuation!.z;}
  const zone=m.evacuation!;expect(missionGoal(m,zone)?.label).toBe('EVACUATION ZONE');
  d.tick(2,zone,0,()=>.5,context);expect(d.rescued).toBe(0);d.tick(.1,zone,0,()=>.5,{enemies:[{...zone,hp:1}],recentHit:false});expect(zone.progress).toBe(0);
  expect(d.tick(3,zone,0,()=>.5,context)).toEqual(['rescued','rescued','rescued','complete']);expect(d.rescued).toBe(3);
});
test('escort pace lets keyboard pilots travel at the wounded crews walking speed',()=>{
  game.input.keys.add('KeyD');game.input.keys.add('ShiftLeft');advance(1);
  expect(game.player.vx).toBeGreaterThan(2.5);expect(game.player.vx).toBeLessThanOrEqual(2.6);
  game.input.keys.delete('ShiftLeft');advance(1);expect(game.player.vx).toBeGreaterThan(7);
});
test('a complete rescue can be flown at escort pace without teleporting crew or exceeding the deadline',()=>{
  const d=rescue(),m=d.mission!,player={x:0,z:0,vx:0,vz:0};
  const walk=(destination:{x:number;z:number})=>{
    let ticks=0;
    while(Math.hypot(player.x-destination.x,player.z-destination.z)>1&&m.status==='active'&&ticks++<2000){
      const dx=destination.x-player.x,dz=destination.z-player.z,dist=Math.hypot(dx,dz);
      player.vx=dx/dist*2.4;player.vz=dz/dist*2.4;player.x+=player.vx/60;player.z+=player.vz/60;clearTerrainPosition(player,.7);d.tick(1/60,player,0,()=>.5,context);
    }
    player.vx=player.vz=0;expect(ticks).toBeLessThan(2000);
  };
  for(const pilot of m.targets){
    walk({x:0,z:0});walk({...pilot});
    for(let i=0;i<(pilot.injured?182:122);i++)d.tick(1/60,player,0,()=>.5,context);
    expect(pilot.stage).toBe('following');walk({x:0,z:0});walk(m.evacuation!);
    for(let i=0;i<400&&!pilot.done&&m.status==='active';i++)d.tick(1/60,player,0,()=>.5,context);
    expect(pilot.done).toBe(true);
  }
  expect(m.status).toBe('complete');expect(m.remaining).toBeGreaterThan(0);expect(d.rescued).toBe(3);
});
test('crew losses and exact deadlines prevent false evacuation rewards',()=>{
  const d=rescue(),m=d.mission!;for(const t of m.targets){t.stage='following';t.x=m.evacuation!.x;t.z=m.evacuation!.z;}
  m.remaining=2.9;expect(d.tick(10,m.evacuation!,0,()=>.5,context)).toEqual(['failed']);expect(d.rescued).toBe(0);
  const wounded=rescue(),pilot=wounded.mission!.targets[0];pilot.hp=1;expect(wounded.tick(1,pilot,0,()=>.5,{enemies:[{...pilot,hp:1}],recentHit:false})).toEqual(['failed']);expect(wounded.rescued).toBe(0);
});
test('rescue state persists, freezes during duels/service, and rejects empty opportunity targets',()=>{
  game.missions=rescue();const t=game.missions.mission!.targets[0];game.missions.tick(2,t,0,()=>.5,context);
  const before=game.missions.snapshot();advance(1);expect(game.missions.snapshot()).toEqual(before);
  const snapshot=game.checkpoint(),restored=new GameEngine(3);expect(restoreCheckpoint(restored,snapshot)).toBe(true);expect(restored.missions.snapshot()).toEqual(before);
  game.bossSpawned=false;game.service={x:100,z:100,progress:0,remaining:30,serviced:false};advance(1);expect(game.missions.snapshot()).toEqual(before);
  const bad=structuredClone(snapshot);(bad.systems.missions.mission as any).kind='escort';(bad.systems.missions.mission as any).destination={x:0,z:0};(bad.systems.missions.mission as any).targets=[];expect(validateCheckpoint(bad,game)).toBe(false);
});
test('enemy fire wounds real rescue crew while player IFF leaves them unharmed',()=>{
  const d=rescue();game.missions=d;game.bossSpawned=false;const t=d.mission!.targets[0];t.x=0;t.z=5;
  game.bolts=[{x:-1,z:5,vx:60,vz:0,enemy:true,age:0,target:0,damage:14}];game.tick(1/60);expect(t.hp).toBe(86);
  game.bolts=[{x:-1,z:5,vx:60,vz:0,enemy:false,age:0,target:0,damage:14}];game.tick(1/60);expect(t.hp).toBe(86);expect(game.player.hp).toBe(100);
});
function opportunity(kind:'escort'|'salvage'|'sabotage'):Mission {return {id:1,kind,title:'TEST',description:'',status:'active',remaining:45,progress:0,goal:kind==='sabotage'?180:1,reward:40,targets:[{id:0,x:0,z:0,hp:kind==='sabotage'?180:100,progress:0,done:false}],startKills:0,...(kind==='sabotage'?{}:{destination:{x:0,z:8}})};}
test('convoy waits for protection, salvage must be intercepted, and sabotage requires real damage',()=>{
  const d=new MissionDirector();d.mission=opportunity('escort');d.tick(1,{x:20,z:0},0,()=>.5,context);expect(d.mission.targets[0].z).toBe(0);
  for(let i=0;i<6;i++){d.tick(1,{...d.mission.targets[0]},0,()=>.5,context);if(d.mission.status==='complete')break;}expect(d.mission.status).toBe('complete');
  d.mission=opportunity('salvage');expect(d.tick(1,{x:0,z:0},0,()=>.5,context)).toEqual(['complete']);
  d.mission=opportunity('sabotage');d.tick(1,{x:0,z:0},0,()=>.5,context);expect(d.mission.status).toBe('active');expect(d.damageTarget({x:0,z:-2},{x:0,z:2},180)).toBe(true);expect(d.tick(1,{x:0,z:0},0,()=>.5,context)).toEqual(['complete']);
});
test('convoy hull takes hostile fire and cannot complete after destruction',()=>{
  const d=new MissionDirector();d.mission=opportunity('escort');
  expect(d.hurtFriendly({x:-2,z:0},{x:2,z:0},100)).toBe(true);
  expect(d.tick(1,{x:0,z:0},0,()=>.5,context)).toEqual(['failed']);expect(d.completed).toBe(0);
});
test('engine auto-fire can destroy a transmitter without an enemy target or fake kill rewards',()=>{
  game.bossSpawned=false;game.weapons.pulse=6;game.missions.mission=opportunity('sabotage');game.missions.mission.targets[0].z=5;
  for(let i=0;i<180&&game.missions.mission.status==='active';i++){game.enemies=[];game.tick(1/60);}
  expect(game.missions.mission.status).toBe('complete');expect(game.kills).toBe(0);expect(game.salvage).toBe(40);
});
test('directly aiming at a transmitter keeps the objective ahead of nearby hostile targets',()=>{
  game.missions.mission=opportunity('sabotage');game.missions.mission.targets[0].z=5;game.spawn(0,0,8);game.weapons.pulse=1;
  game.input.aiming=true;game.input.aimX=0;game.input.aimZ=5;game.tick(1/60);
  expect(game.bolts[0].target).toBe(-game.missions.mission.id);
});
test('Precision does not automatically fire at a transmitter when the cursor is outside the arena',()=>{
  useGame.setState({aimMode:'precision'});game.missions.mission=opportunity('sabotage');game.missions.mission.targets[0].z=5;game.weapons.pulse=1;game.tick(1/60);
  expect(game.bolts).toHaveLength(0);
});
