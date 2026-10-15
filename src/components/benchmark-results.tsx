'use client';

import { useGame } from '@/game/store';
import { recommendedSettings } from '@/game/benchmark';

export default function BenchmarkResults() {
  const status = useGame(s => s.benchmarkStatus), report = useGame(s => s.benchmarkReport), progress = useGame(s => s.benchmarkProgress), cached = useGame(s => s.benchmarkCached);
  const phase = useGame(s => s.phase);
  const waiting = useGame(s => s.benchmarkWaiting);
  const device = useGame(s => s.benchmarkDevice);
  const capabilities = device ?? report?.device;
  return <div className="benchmark-results">
    <h3>Device benchmark</h3>
    <p>Three short tests use the real arena plus a fixed graphics load. Results estimate a starting setting; heavy combat may require lower detail. Manual graphics choices are preserved.</p>
    {status === 'running' ? <p role="status">{waiting ? 'Focus the game tab to continue' : 'Testing'} · {progress}%</p> : status === 'failed' ? <p role="status">Not enough reliable foreground frames to finish the test. Keep the game window visible and focused, then retry. Your graphics settings were restored.</p> : status === 'cancelled' ? <p role="status">Test cancelled. Your graphics settings were restored.</p> : null}
    {capabilities && <dl className="benchmark-device"><div><dt>WebGL</dt><dd>2</dd></div><div><dt>Logical CPU cores</dt><dd>{capabilities.threads ?? 'Not reported'}</dd></div><div><dt>Approx. RAM</dt><dd>{capabilities.memoryGB ? `${capabilities.memoryGB} GB` : 'Not reported'}</dd></div><div><dt>Max texture / MSAA</dt><dd>{capabilities.maxTextureSize}px / {capabilities.maxSamples}×</dd></div><div><dt>Test viewport / density</dt><dd>{capabilities.viewport} / {capabilities.pixelRatio.toFixed(2)}×</dd></div></dl>}
    {report && <>
      <p><strong>Recommended: {report.recommended.toUpperCase()}</strong> · {cached ? 'Saved result' : 'Measured on this device'} · {new Date(report.measuredAt).toLocaleString()}</p>

      <table><caption>Measured graphics capacity</caption><thead><tr><th scope="col">Quality</th><th scope="col">Average FPS</th><th scope="col">95% frame time</th></tr></thead><tbody>{report.measurements.map(m => <tr key={m.tier}><th scope="row">{m.tier.toUpperCase()}</th><td>{m.fps}</td><td>{m.p95Ms} ms</td></tr>)}</tbody></table>
      <p>Lower frame time is better. CPU and RAM values are browser estimates; they do not determine the recommendation. Results stay on this device and expire after seven days or a viewport/capability change.</p>
      <button className="secondary-button" disabled={status === 'running'} onClick={() => useGame.setState({ adaptiveQuality: true, ...recommendedSettings(report.recommended) })}>APPLY RECOMMENDATION</button>
    </>}
    <button className="secondary-button" disabled={phase !== 'menu' || status === 'running'} onClick={() => useGame.setState(s => ({ benchmarkRequest: s.benchmarkRequest + 1, benchmarkStatus: 'idle' }))}>{report ? 'RUN BENCHMARK AGAIN' : 'RUN DEVICE BENCHMARK'}</button>
    {phase !== 'menu' && <p>Run the test from the command center so your flight stays paused.</p>}
  </div>;
}
