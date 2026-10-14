import { clearTerrainPosition, terrainImpact } from './terrain';
export type MissionKind = 'rescue' | 'uplink' | 'hunt' | 'escort' | 'salvage' | 'sabotage';
export type MissionTarget = { id: number; x: number; z: number; progress: number; done: boolean; stage?: 'stranded' | 'following' | 'evacuated'; hp?: number; injured?: boolean };
export type Mission = { id: number; kind: MissionKind; title: string; description: string; status: 'active' | 'complete' | 'failed'; remaining: number; progress: number; goal: number; reward: number; targets: MissionTarget[]; startKills: number; evacuation?: { x: number; z: number; progress: number }; destination?: { x: number; z: number }; blocked?: string };
export type MissionEvent = 'started' | 'rescued' | 'complete' | 'failed' | 'secured';
export type MissionContext = { enemies: readonly { x: number; z: number; hp: number }[]; recentHit: boolean; hazards?: readonly { x: number; z: number; radius: number; detonated: boolean }[] };
export const RESCUE = { radius: 2.4, prepare: 2, wounded: 3, evacuation: 3, followSpeed: 3.6, threatRadius: 4, towRange: 10 } as const;
export const missionLabel = (m: Mission) => ({ rescue: 'RESCUE', uplink: 'UPLINK', hunt: 'ELIMINATE', escort: 'ESCORT', salvage: 'INTERCEPT', sabotage: 'SABOTAGE' })[m.kind];
export function missionGoal(m: Mission, player: { x: number; z: number }) {
  if (m.kind === 'rescue' && m.evacuation && m.targets.every(t => t.done || t.stage === 'following')) return { ...m.evacuation, label: 'EVACUATION ZONE' };
  const t = m.targets.filter(t => !t.done && t.stage !== 'following').sort((a,b) => Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
  return t ? { ...t, label: m.kind === 'rescue' ? 'STABILIZE PILOT' : m.kind === 'escort' ? 'PROTECT CONVOY' : m.kind === 'salvage' ? 'INTERCEPT SALVAGE' : m.kind === 'sabotage' ? 'DESTROY TRANSMITTER' : 'RESTORE RELAY' } : undefined;
}

export class MissionDirector {
  mission: Mission | null = null;
  completed = 0; rescued = 0;
  private delay = 8; private serial = 0;
  reset() { this.mission = null; this.completed = 0; this.rescued = 0; this.delay = 8; this.serial = 0; }
  hurtFriendly(a:{x:number;y?:number;z:number},b:{x:number;y?:number;z:number},damage:number){
    const m=this.mission;if(m?.status!=='active'||!['rescue','escort'].includes(m.kind)||m.kind==='rescue'&&!m.evacuation)return false;
    const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;let first:MissionTarget|undefined,best=Infinity;
    for(const t of m.targets){
      if(t.done||(t.hp??100)<=0)continue;
      const u=l2?Math.max(0,Math.min(1,((t.x-a.x)*dx+(t.z-a.z)*dz)/l2)):0;
      const y=(a.y??.7)+((b.y??.7)-(a.y??.7))*u;
      if(u<best&&y<1.7&&Math.hypot(a.x+dx*u-t.x,a.z+dz*u-t.z)<.4){first=t;best=u;}
    }
    if(!first)return false;first.hp=Math.max(0,(first.hp??100)-damage);if(first.stage!=='following')first.progress=0;return true;
  }
  damageTarget(a: { x: number; z: number }, b: { x: number; z: number }, damage: number) {
    const m = this.mission; if (m?.status !== 'active' || m.kind !== 'sabotage') return false;
    const t = m.targets[0], dx=b.x-a.x, dz=b.z-a.z, l2=dx*dx+dz*dz;
    const u=l2 ? Math.max(0,Math.min(1,((t.x-a.x)*dx+(t.z-a.z)*dz)/l2)) : 0;
    if (Math.hypot(a.x+dx*u-t.x,a.z+dz*u-t.z)>1.2) return false;
    t.hp = Math.max(0,(t.hp ?? 180)-damage); m.progress=180-t.hp; return true;
  }
  tick(dt: number, player: { x: number; z: number; vx?: number; vz?: number }, kills: number, random: () => number, context?: MissionContext): MissionEvent[] {
    const events: MissionEvent[] = [];
    if (!this.mission || this.mission.status !== 'active') {
      this.delay -= dt; if (this.delay > 0) return events;
      const kind = (['rescue', 'uplink', 'hunt', 'escort', 'salvage', 'sabotage'] as const)[this.serial % 6];
      const count = kind === 'rescue' ? 3 : kind === 'hunt' ? 0 : 1, heading = random() * Math.PI * 2;
      const targets: MissionTarget[] = Array.from({ length: count }, (_, i) => {
        const angle = heading + i * Math.PI * 2 / Math.max(1,count), radius = 9 + random() * 4;
        const t: MissionTarget = { id: i, x: player.x + Math.sin(angle)*radius, z: player.z + Math.cos(angle)*radius, progress: 0, done: false };
        if(kind==='rescue') Object.assign(t,{stage:'stranded',hp:i===1?65:100,injured:i===1});
        if(kind==='escort'||kind==='sabotage') t.hp=kind==='escort'?100:180;
        clearTerrainPosition(t,2); return t;
      });
      const destination={x:player.x-Math.sin(heading)*12,z:player.z-Math.cos(heading)*12}; clearTerrainPosition(destination,3);
      const titles={rescue:'RECOVER THE FLIGHT CREW',uplink:'RESTORE THE UPLINK',hunt:'BREAK THE BLOCKADE',escort:'CONVOY UNDER FIRE',salvage:'INTERCEPT THE SALVAGE RUNNER',sabotage:'SILENCE THE JAMMER'};
      const descriptions={rescue:'Clear threats. Stop beside pilots to stabilize them. Hold SHIFT for escort pace (light touch-stick input), lead the crew to the green zone and hold 3s.',uplink:'Hold the relay perimeter for 8s. Progress is retained.',hunt:'Eliminate 20 hostiles before the signal closes.',escort:'Stay within 6m of the convoy. Clear attackers and escort it to the marked destination.',salvage:'Catch the moving salvage runner and stay close for 1s before it escapes.',sabotage:'Shoot the transmitter. Destroying it awards salvage and disrupts local hostile locks.'};
      this.mission={id:++this.serial,kind,title:titles[kind],description:descriptions[kind],status:'active',remaining:kind==='rescue'?100:kind==='escort'?65:kind==='salvage'?35:45,progress:0,goal:kind==='rescue'?3:kind==='uplink'?8:kind==='hunt'?20:kind==='sabotage'?180:1,reward:kind==='rescue'?75:kind==='escort'?60:40,targets,startKills:kills,...(kind==='rescue'?{evacuation:{...destination,progress:0}}:{}),...(['escort','salvage'].includes(kind)?{destination}: {})};
      return ['started'];
    }
    const m=this.mission, step=Math.min(dt,m.remaining); m.remaining=Math.max(0,m.remaining-dt); m.blocked='';
    const threats=(point:{x:number;z:number},radius:number)=>(context?.enemies ?? []).some(e=>e.hp>0&&Math.hypot(e.x-point.x,e.z-point.z)<radius);
    const stopped=Math.hypot(player.vx ?? 0,player.vz ?? 0)<2;
    if(m.kind==='hunt') m.progress=Math.min(m.goal,Math.max(0,kills-m.startKills));
    else if(m.kind==='rescue'&&m.evacuation){
      let newlySecured=false;
      for(const t of m.targets){
        if(t.done)continue;
        const d=Math.hypot(player.x-t.x,player.z-t.z), dangerous=threats(t,RESCUE.threatRadius);
        const hazard=context?.hazards?.some(h=>h.detonated&&Math.hypot(h.x-t.x,h.z-t.z)<h.radius);
        t.hp=Math.max(0,(t.hp ?? 100)-step*(threats(t,1.5)?12:0)-step*(hazard?25:0));
        if(t.hp<=0){m.status='failed';m.blocked='CREW LOST';break;}
        if(t.stage==='following'){
          if(d>RESCUE.towRange){m.blocked='REGROUP WITH CREW';continue;}
          const travel=Math.min(Math.max(0,d-1.6-t.id*.45),step*(t.injured?2.8:RESCUE.followSpeed));
          const next={x:t.x+(player.x-t.x)/(d||1)*travel,z:t.z+(player.z-t.z)/(d||1)*travel};
          if(terrainImpact(t,next,.35)){
            const side=t.id%2?1:-1,dx=next.x-t.x,dz=next.z-t.z;next.x=t.x-dz*side;next.z=t.z+dx*side;
          }
          t.x=next.x;t.z=next.z;clearTerrainPosition(t,.5);
        }else{
          const required=t.injured?RESCUE.wounded:RESCUE.prepare, ready=d<RESCUE.radius&&stopped&&!dangerous&&!context?.recentHit;
          if(d<RESCUE.radius&&!ready)m.blocked=dangerous?'CLEAR PILOT PERIMETER':context?.recentHit?'WAIT FOR SAFE CONTACT':'STOP TO STABILIZE';
          t.progress=Math.max(0,Math.min(required,t.progress+(ready?step:-step*.5)));
          if(t.progress>=required-1e-8){t.stage='following';t.hp=Math.min(100,t.hp+25);newlySecured=true;events.push('secured');}
        }
      }
      const evac=m.evacuation, crew=m.targets.filter(t=>!t.done&&t.stage==='following');
      const ready=m.status!=='failed'&&!newlySecured&&crew.length>0&&Math.hypot(player.x-evac.x,player.z-evac.z)<3&&stopped&&!threats(evac,5)&&!context?.recentHit&&crew.every(t=>Math.hypot(t.x-evac.x,t.z-evac.z)<4.5);
      evac.progress=ready?Math.min(RESCUE.evacuation,evac.progress+step):0;
      if(evac.progress>=RESCUE.evacuation-1e-8){for(const t of crew){t.done=true;t.stage='evacuated';m.progress++;this.rescued++;events.push('rescued');}evac.progress=0;}
    }else if(m.kind==='escort'||m.kind==='salvage'){
      const t=m.targets[0], destination=m.destination!, d=Math.hypot(player.x-t.x,player.z-t.z), route=Math.hypot(destination.x-t.x,destination.z-t.z);
      if(m.kind==='escort'){
        const strike=context?.hazards?.some(h=>h.detonated&&Math.hypot(h.x-t.x,h.z-t.z)<h.radius);
        t.hp=Math.max(0,(t.hp ?? 100)-step*(threats(t,2.5)?9:0)-step*(strike?25:0)); if(t.hp<=0)m.status='failed';
        if(d<6&&!threats(t,3)){const travel=Math.min(route,step*2);t.x+=(destination.x-t.x)/(route||1)*travel;t.z+=(destination.z-t.z)/(route||1)*travel;clearTerrainPosition(t,.8);}
        else m.blocked=d>=6?'STAY WITH CONVOY':'CLEAR CONVOY PATH';
        m.progress=route<1?1:0;
      }else{
        const travel=Math.min(route,step*1.3);t.x+=(destination.x-t.x)/(route||1)*travel;t.z+=(destination.z-t.z)/(route||1)*travel;clearTerrainPosition(t,.8);
        t.progress=d<2.5?t.progress+step:0;m.progress=t.progress>=1?1:0;
        if(route<.5&&m.progress<1)m.status='failed';
      }
    }else if(m.kind==='sabotage') m.progress=180-(m.targets[0].hp ?? 180);
    else for(const t of m.targets){
      if(t.done)continue;const nearby=Math.hypot(player.x-t.x,player.z-t.z)<(m.kind==='rescue'?2.4:3.5),required=m.kind==='rescue'?1.5:8;
      t.progress=Math.min(required,Math.max(0,t.progress+(nearby?step:m.kind==='rescue'?-step*.75:0)));
      if(t.progress>=required-1e-8){t.done=true;t.progress=required;if(m.kind==='rescue'){m.progress++;this.rescued++;events.push('rescued');}}
      if(m.kind==='uplink')m.progress=t.progress;
    }
    if(m.status!=='failed'&&m.progress>=m.goal){m.status='complete';this.completed++;this.delay=10;events.push('complete');}
    else if(m.status==='failed'||m.remaining<=0){m.status='failed';this.delay=8;events.push('failed');}
    return events;
  }
  snapshot(): Mission | null { return this.mission ? { ...this.mission, targets: this.mission.targets.map(t=>({...t})),...(this.mission.evacuation?{evacuation:{...this.mission.evacuation}}:{}),...(this.mission.destination?{destination:{...this.mission.destination}}:{}) } : null; }
}
