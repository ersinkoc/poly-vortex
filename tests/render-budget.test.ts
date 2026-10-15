import { expect, test } from 'bun:test';
import { AdaptiveBudget, graphicsPreferences, initialBudget, renderDpr, renderQuality, renderPostProcessing, renderShadows } from '../src/game/render-budget';

function advance(b:AdaptiveBudget,fps:number,seconds:number,eligible=true){for(let i=0;i<fps*seconds;i++)b.sample(1/fps,eligible)}
test('sustained slow combat drops resolution before expensive detail, with a cooldown between changes',()=>{
  const b=new AdaptiveBudget();advance(b,30,7);expect(b.level).toBe(1);advance(b,30,5);expect(b.level).toBe(1);advance(b,30,9);expect(b.level).toBe(2);
  expect(renderQuality({quality:'high',adaptiveQuality:true,renderBudget:1})).toBe('high');expect(renderQuality({quality:'high',adaptiveQuality:true,renderBudget:2})).toBe('performance');
});
test('a short hitch or a hidden/paused tab cannot degrade visual quality',()=>{
  const b=new AdaptiveBudget();advance(b,60,4);advance(b,30,1);advance(b,60,10);expect(b.level).toBe(0);
  advance(b,10,30,false);for(let i=0;i<30;i++)b.sample(1,true);b.sample(NaN,true);expect(b.level).toBe(0);
});
test('long stable recovery restores one tier at a time and reset starts a fresh warmup',()=>{
  const b=new AdaptiveBudget();advance(b,30,25);expect(b.level).toBe(2);advance(b,60,12);expect(b.level).toBe(2);advance(b,60,15);expect(b.level).toBe(1);advance(b,60,30);expect(b.level).toBe(0);
  advance(b,30,7);expect(b.level).toBe(1);b.reset();advance(b,30,2);expect(b.level).toBe(0);
});
test('manual preferences override the governor and automatic modes have bounded pixel density',()=>{
  expect(renderQuality({quality:'high',adaptiveQuality:false,renderBudget:2})).toBe('high');expect(renderDpr({quality:'high',adaptiveQuality:false,renderBudget:2})).toEqual([1,1.5]);
  expect(renderDpr({quality:'high',adaptiveQuality:true,renderBudget:0})).toEqual([1,1.35]);expect(renderDpr({quality:'high',adaptiveQuality:true,renderBudget:2})).toEqual([.75,.85]);
  expect(renderQuality({quality:'performance',adaptiveQuality:true,renderBudget:0})).toBe('performance');
});

test('low-end mode bypasses expensive effects and scales the drawing buffer without removing combat signals', () => {
  const low = { quality: 'low', adaptiveQuality: false, renderBudget: 0, resolutionScale: .5 } as const;
  expect(renderQuality(low)).toBe('performance');
  expect(renderShadows(low)).toBe(false);
  expect(renderPostProcessing(low)).toBe(false);
  expect(renderDpr(low)).toEqual([.35, .35]);
  const high = { ...low, quality: 'high', resolutionScale: 1 } as const;
  expect(renderShadows(high)).toBe(true);
  expect(renderPostProcessing(high)).toBe(true);
  expect(renderShadows({ ...high, shadows: false })).toBe(false);
  expect(renderPostProcessing({ ...high, postProcessing: false })).toBe(false);
  expect(renderShadows({ ...high, adaptiveQuality: true, renderBudget: 1 })).toBe(false);
  expect(renderPostProcessing({ ...high, adaptiveQuality: true, renderBudget: 2 })).toBe(false);
});

test('optional device hints start conservatively and measured stable performance can recover', () => {
  expect(initialBudget({ hardwareConcurrency: 2 })).toBe(2);
  expect(initialBudget({ hardwareConcurrency: 16, deviceMemory: 4 })).toBe(2);
  expect(initialBudget({ hardwareConcurrency: 16, deviceMemory: 16 })).toBe(1);
  expect(initialBudget()).toBe(1);
  const budget = new AdaptiveBudget(); budget.reset(initialBudget({ hardwareConcurrency: 2 }));
  advance(budget, 60, 50);
  expect(budget.level).toBe(0);
});

test('older or corrupt graphics preferences receive finite bounded defaults', () => {
  expect(graphicsPreferences({ quality: 'performance' })).toEqual({ quality: 'performance', resolutionScale: 1, shadows: true, postProcessing: true });
  expect(graphicsPreferences({ quality: 'invalid', resolutionScale: NaN, shadows: 'false', postProcessing: null })).toEqual({ quality: 'high', resolutionScale: 1, shadows: true, postProcessing: true });
  expect(graphicsPreferences({ quality: 'low', resolutionScale: -20, shadows: false, postProcessing: false })).toEqual({ quality: 'low', resolutionScale: .5, shadows: false, postProcessing: false });
  expect(renderDpr({ quality: 'high', adaptiveQuality: false, renderBudget: 0, resolutionScale: Infinity })).toEqual([1, 1.5]);
});
