class Synth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  enabled = true;
  combo = 1;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain();
      this.master.gain.value = 0.2; this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (this.master && this.context) this.master.gain.setTargetAtTime(enabled ? 0.2 : 0, this.context.currentTime, 0.05); }
  tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3, end = frequency) {
    const c = this.context; if (!c || !this.master || !this.enabled) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(frequency, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(15, end), c.currentTime + duration);
    g.gain.setValueAtTime(volume, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + duration);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  shot() { this.tone(950, 0.085, 'triangle', 0.15, 220); }
  hit() { this.tone(160, 0.09, 'square', 0.12, 50); }
  explosion() { this.tone(90, 0.35, 'sawtooth', 0.45, 18); }
  dash() { this.tone(180, 0.2, 'sawtooth', 0.25, 1200); }
  pickup() { this.tone(1200, 0.08, 'sine', 0.08, 1600); }
  level() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.25), i * 80)); }
  startMusic() {
    this.stopMusic(); this.step = 0;
    const sequence = [55, 55, 82.41, 55, 65.41, 55, 73.42, 49];
    let accumulated = 0;
    this.music = setInterval(() => {
      accumulated += 0.05;
      const interval = 60 / (112 + Math.min(40, this.combo * 3)) / 2;
      if (accumulated < interval) return; accumulated = 0;
      this.tone(sequence[this.step % 8], 0.22, 'sawtooth', 0.23);
      if (this.step % 2 === 0) this.tone(130, 0.14, 'sine', 0.5, 28);
      if (this.step % 4 === 2) this.tone(350, 0.07, 'triangle', 0.1, 100);
      if (this.step % 8 === 7) this.tone(440, 0.3, 'triangle', 0.06, 880);
      this.step++;
    }, 50);
  }
  stopMusic() { if (this.music) clearInterval(this.music); this.music = null; }
}
export const audio = new Synth();
