import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameEngine } from '../src/game/engine';
import { useGame } from '../src/game/store';
import { EMPTY_PROFILE } from '../src/game/types';
import { FLIGHTFRAMES, SHIP_IDS, shipId } from '../src/game/flightframes';
import { buildPlayerShip, SURFACES } from '../src/game/ship-models';
import { audio } from '../src/game/audio';

const previous = useGame.getState(), sound = audio.enabled;
beforeEach(() => { audio.enabled = false; useGame.setState({phase:'menu',ship:'vector',activeShip:'vector',runMode:'expedition',difficulty:'standard',loadout:'pulse',profile:structuredClone(EMPTY_PROFILE),maxHp:100}); });
afterEach(() => { useGame.setState(previous); audio.enabled = sound; });

test('each selected frame actually deploys its hull, shields, speed and firepower with permanent upgrades', () => {
  for (const id of SHIP_IDS) {
    useGame.setState({phase:'menu',profile:{...structuredClone(EMPTY_PROFILE),upgrades:{armor:2,reactor:2,thrusters:2}}});
    useGame.getState().selectShip(id); useGame.getState().start(); const g = new GameEngine(4); g.reset(); const f = FLIGHTFRAMES[id];
    expect(g.ship).toBe(id); expect(g.player.hp).toBe(f.hull+30); expect(g.player.maxHp).toBe(f.hull+30); expect(g.shield).toBe(f.shield); expect(g.maxShield).toBe(f.shield);
    expect(g.speed).toBeCloseTo(f.speed*1.12,8); expect(g.damage).toBeCloseTo(f.damage*1.16,8); expect(g.weapons.pulse).toBe(1);
  }
});
test('a live or paused deployment cannot change flightframes, and its active frame remains a snapshot', () => {
  useGame.getState().selectShip('wraith');useGame.getState().start();const g=new GameEngine(5);g.reset();
  useGame.getState().selectShip('aegis');expect(useGame.getState().ship).toBe('wraith');expect(g.ship).toBe('wraith');
  useGame.getState().setPhase('paused');useGame.getState().selectShip('vector');expect(useGame.getState().activeShip).toBe('wraith');
  useGame.setState({phase:'dead'});useGame.getState().selectShip('aegis');expect(useGame.getState().ship).toBe('aegis');expect(useGame.getState().activeShip).toBe('wraith');
});
test('unknown saved frames fall back safely and the default frame keeps the original balance', () => {
  expect(shipId('enemy')).toBe('vector'); expect(shipId(null)).toBe('vector');expect(shipId('wraith')).toBe('wraith');
  useGame.getState().start();const g=new GameEngine(1);g.reset();expect([g.player.hp,g.shield,g.speed,g.damage]).toEqual([100,40,1,1]);
});
test('preferences from another tab survive unrelated setting changes and selected frames hydrate correctly', () => {
  useGame.setState({sound:true,quality:'high'});
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), memory=new Map<string,string>();
  memory.set('poly-vortex-settings-v1',JSON.stringify({ship:'wraith',quality:'performance',sound:true,adaptiveQuality:false}));
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value)}});
  try {
    useGame.setState({sound:false});let saved=JSON.parse(memory.get('poly-vortex-settings-v1')!);expect(saved.ship).toBe('wraith');expect(saved.quality).toBe('performance');expect(saved.sound).toBe(false);
    useGame.getState().selectShip('aegis');saved=JSON.parse(memory.get('poly-vortex-settings-v1')!);expect(saved.ship).toBe('aegis');expect(saved.quality).toBe('performance');
    useGame.setState({ship:'vector'});memory.set('poly-vortex-settings-v1',JSON.stringify(saved));useGame.getState().hydrate();expect(useGame.getState().ship).toBe('aegis');expect(useGame.getState().adaptiveQuality).toBe(false);
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage')}
});
test('all five frames have distinct complete finite procedural geometry within the existing docking/flight scale', () => {
  const signatures = new Set<string>();
  for(const id of SHIP_IDS){const model=buildPlayerShip(id);try{
    expect(Object.keys(model)).toEqual([...SURFACES]);let triangles=0;
    for(const g of Object.values(model)){const p=g.getAttribute('position');expect(p.count).toBeGreaterThan(0);expect(Array.from(p.array).every(Number.isFinite)).toBe(true);triangles+=p.count/3;}
    expect(triangles).toBeLessThan(30000); signatures.add(JSON.stringify(Array.from(model.hull.getAttribute('position').array).slice(0,30)));
  }finally{Object.values(model).forEach(g=>g.dispose())}}
  expect(signatures.size).toBe(SHIP_IDS.length);
});
