'use client';

import BenchmarkResults from './benchmark-results';
import { recommendedSettings } from '@/game/benchmark';
import { useGame } from '@/game/store';
import { initialBudget, type Quality } from '@/game/render-budget';

const presets: { id: Quality | 'auto'; label: string; detail: string }[] = [
  { id: 'auto', label: 'AUTO', detail: 'Adapts resolution, shadows and effects to measured frame times.' },
  { id: 'high', label: 'HIGH', detail: 'Full detail, shadows and enhanced resolution for powerful GPUs.' },
  { id: 'balanced', label: 'BALANCED', detail: 'Native resolution, fewer decorative details and no dynamic shadows.' },
  { id: 'performance', label: 'PERFORMANCE', detail: 'Native resolution, light detail and no post-processing.' },
  { id: 'low', label: 'LOW', detail: 'Reduced resolution and no post-processing for older or integrated GPUs.' },
];

export default function GraphicsSettings() {
  const quality = useGame(s => s.quality), adaptive = useGame(s => s.adaptiveQuality), budget = useGame(s => s.renderBudget);
  const scale = useGame(s => s.resolutionScale), shadows = useGame(s => s.shadows), effects = useGame(s => s.postProcessing);
  const fps = useGame(s => s.fps);
  const benchmarking = useGame(s => s.benchmarkStatus === 'running');
  const report = useGame(s => s.benchmarkReport);
  const selected = adaptive ? 'auto' : quality;
  const choose = (id: Quality | 'auto') => useGame.setState({
    adaptiveQuality: id === 'auto', quality: id === 'auto' ? 'high' : id,
    renderBudget: id === 'auto' ? initialBudget(navigator) : 0,
    resolutionScale: 1, shadows: id === 'auto' || id === 'high',
    postProcessing: id === 'auto' || id === 'high' || id === 'balanced',
    ...(id === 'auto' && report ? recommendedSettings(report.recommended) : {}),
  });
  return <section className="graphics-settings" aria-label="Graphics settings">
    <div className="setting-label">GRAPHICS & PERFORMANCE</div>
    <p className="panel-intro">Changes apply immediately and are saved on this device. Start with AUTO; try LOW if combat still stutters. Requires WebGL 2 and hardware acceleration.</p>
    <BenchmarkResults />
    <fieldset className="graphics-controls" disabled={benchmarking}><legend className="setting-label">MANUAL GRAPHICS CONTROLS</legend>
    <div className="graphics-presets">{presets.map(p => <button key={p.id} aria-pressed={selected === p.id} className={selected === p.id ? 'active' : ''} onClick={() => choose(p.id)}><strong>{p.label}</strong><span>{p.detail}</span></button>)}</div>
    <p className="graphics-status" role="status">{adaptive ? `AUTO · ${['HIGH', 'BALANCED', 'LIGHT'][budget]}` : quality.toUpperCase()} · Last measured: {fps} FPS</p>
    <div className="setting-row"><div><h3><label htmlFor="render-scale">Resolution scale · {Math.round(scale * 100)}%</label></h3><p>Lower this to reduce GPU load. The interface stays sharp. AUTO can lower the 3D resolution further.</p></div><input id="render-scale" type="range" min="50" max="100" step="5" value={Math.round(scale * 100)} onChange={e => useGame.setState({ resolutionScale: Number(e.target.value) / 100 })} /></div>
    <div className="setting-row"><div><h3>Dynamic shadows</h3><p>Available at HIGH detail. AUTO switches shadows off under load.</p></div><button className={`toggle ${shadows ? 'active' : ''}`} role="switch" aria-checked={shadows} aria-label="Dynamic shadows" onClick={() => useGame.setState({ shadows: !shadows })}><span /></button></div>
    <div className="setting-row"><div><h3>Post-processing</h3><p>Bloom, lens effects and vignette. LOW and automatic LIGHT always bypass these effects. Combat warnings stay visible.</p></div><button className={`toggle ${effects ? 'active' : ''}`} role="switch" aria-checked={effects} aria-label="Post-processing" onClick={() => useGame.setState({ postProcessing: !effects })}><span /></button></div>
    </fieldset>
  </section>;
}
