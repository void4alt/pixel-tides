type Ambient = "waves" | "reef" | "snow" | "forest" | "deep";
type Weather = "sunny" | "cloudy" | "rainy" | "stormy" | "foggy";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private oceanSource: AudioBufferSourceNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private ambienceTimer: number | null = null;
  private birdTimer: number | null = null;
  private musicVolume = 0.45;
  private sfxVolume = 0.7;
  private ambient: Ambient = "waves";
  private weather: Weather = "sunny";
  private started = false;
  private noteIndex = 0;

  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume * 0.2;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume * 0.55;
    this.sfxGain.connect(this.master);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.17;
    this.ambientGain.connect(this.master);
    this.noiseBuffer = this.makeNoise(4);
    this.startOcean();
    this.startMusic();
    this.started = true;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.97 + white * 0.03;
      data[i] = last * 3;
    }
    return buffer;
  }

  private startOcean(): void {
    if (!this.ctx || !this.noiseBuffer || !this.ambientGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 680;
    filter.Q.value = 0.4;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.55;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 0.22;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    src.start();
    lfo.start();
    this.oceanSource = src;
  }

  private startRain(): void {
    if (!this.ctx || !this.noiseBuffer || !this.ambientGain || this.rainSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1700;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    src.start();
    gain.gain.exponentialRampToValueAtTime(this.weather === "stormy" ? 0.65 : 0.3, this.ctx.currentTime + 1.5);
    this.rainSource = src;
    (src as any).__rainGain = gain;
  }

  private stopRain(): void {
    if (!this.rainSource) return;
    const gain = (this.rainSource as any).__rainGain as GainNode | undefined;
    try {
      gain?.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + 0.7);
      this.rainSource.stop(this.ctx!.currentTime + 0.8);
    } catch {}
    this.rainSource = null;
  }

  private startMusic(): void {
    if (this.musicTimer !== null) return;
    const scale = [0, 3, 5, 7, 10, 12, 15, 12, 7, 5];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== "running") return;
      const base = this.ambient === "deep" ? 110 : this.ambient === "snow" ? 146.83 : 130.81;
      const semitone = scale[this.noteIndex % scale.length];
      this.noteIndex++;
      const freq = base * Math.pow(2, semitone / 12);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.ambient === "deep" ? "sine" : "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 1.3);
      if (this.noteIndex % 4 === 0) {
        const harm = this.ctx.createOscillator();
        const hg = this.ctx.createGain();
        harm.type = "sine";
        harm.frequency.value = freq * 2;
        hg.gain.setValueAtTime(0.0001, now);
        hg.gain.exponentialRampToValueAtTime(0.06, now + 0.1);
        hg.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
        harm.connect(hg);
        hg.connect(this.musicGain);
        harm.start(now);
        harm.stop(now + 1.6);
      }
    }, 920);
  }

  private startBirds(): void {
    if (this.birdTimer !== null) return;
    this.birdTimer = window.setInterval(() => {
      if (!this.ctx || !this.sfxGain) return;
      if (this.ambient === "snow" || this.ambient === "deep") return;
      if (Math.random() > (this.weather === "rainy" || this.weather === "stormy" ? 0.2 : 0.65)) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        const base = 1800 + Math.random() * 1200;
        osc.frequency.setValueAtTime(base, now + i * 0.11);
        osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + i * 0.11 + 0.05);
        osc.frequency.exponentialRampToValueAtTime(base * 0.9, now + i * 0.11 + 0.1);
        gain.gain.setValueAtTime(0.0001, now + i * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.1, now + i * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.11 + 0.12);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.14);
      }
    }, 7000);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume * 0.2;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume * 0.55;
  }

  setEnvironment(ambient: Ambient, weather: Weather): void {
    this.ambient = ambient;
    this.weather = weather;
    if (!this.ctx) return;
    const rainy = weather === "rainy" || weather === "stormy";
    if (rainy && !this.rainSource) this.startRain();
    if (!rainy && this.rainSource) this.stopRain();
    if (this.rainSource) {
      const gain = (this.rainSource as any).__rainGain as GainNode | undefined;
      if (gain) gain.gain.value = weather === "stormy" ? 0.65 : 0.3;
    }
    if (ambient === "deep") {
      if (this.ambientGain) this.ambientGain.gain.value = 0.12;
    } else if (ambient === "snow") {
      if (this.ambientGain) this.ambientGain.gain.value = 0.08;
    } else {
      if (this.ambientGain) this.ambientGain.gain.value = 0.17;
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  play(name: string): void {
    if (!this.ctx) return;
    switch (name) {
      case "cast":
        this.tone(420, 0.18, "triangle", 0.24, 1100);
        this.tone(900, 0.12, "sine", 0.12, 300, 0.16);
        break;
      case "splash":
        this.tone(220, 0.16, "sine", 0.2, 80);
        break;
      case "bite":
        this.tone(880, 0.09, "square", 0.24);
        this.tone(1320, 0.1, "square", 0.2, undefined, 0.11);
        this.tone(1760, 0.16, "triangle", 0.16, undefined, 0.22);
        break;
      case "reel":
        this.tone(240, 0.035, "square", 0.08, 320);
        break;
      case "hook":
        this.tone(520, 0.08, "square", 0.2, 780);
        break;
      case "catch":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.26, "triangle", 0.2, undefined, i * 0.09));
        break;
      case "perfect":
        [659, 880, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.34, "sine", 0.22, undefined, i * 0.07));
        break;
      case "fail":
        this.tone(300, 0.18, "sawtooth", 0.14, 120);
        break;
      case "click":
        this.tone(700, 0.045, "square", 0.09, 900);
        break;
      case "buy":
        this.tone(660, 0.1, "triangle", 0.16);
        this.tone(990, 0.16, "triangle", 0.14, undefined, 0.08);
        break;
      case "levelup":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, "square", 0.12, undefined, i * 0.1));
        break;
      case "error":
        this.tone(220, 0.14, "sawtooth", 0.12, 160);
        break;
      case "coin":
        this.tone(1200, 0.07, "square", 0.12, 1600);
        this.tone(1800, 0.1, "square", 0.08, undefined, 0.06);
        break;
      case "cook":
        this.tone(150, 0.12, "sawtooth", 0.12, 90);
        this.tone(340, 0.08, "triangle", 0.1, 240, 0.1);
        this.tone(560, 0.06, "sine", 0.08, 420, 0.2);
        break;
      case "eat":
        this.tone(180, 0.07, "square", 0.14, 120);
        this.tone(150, 0.08, "square", 0.12, 100, 0.12);
        this.tone(280, 0.1, "triangle", 0.1, 190, 0.24);
        break;
      case "legendary":
        [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.4, "triangle", 0.18, undefined, i * 0.08));
        [196, 262, 330].forEach((f, i) => this.tone(f, 0.6, "sine", 0.14, undefined, i * 0.16));
        break;
      case "fire":
        this.tone(90 + Math.random() * 50, 0.05, "sawtooth", 0.05, 60);
        if (Math.random() > 0.5) this.tone(240 + Math.random() * 120, 0.04, "square", 0.03, 180, 0.03);
        break;
    }
  }

  startAmbientBirds(): void {
    this.startBirds();
  }

  dispose(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    if (this.ambienceTimer !== null) clearInterval(this.ambienceTimer);
    if (this.birdTimer !== null) clearInterval(this.birdTimer);
    this.musicTimer = null;
    this.birdTimer = null;
    this.ambienceTimer = null;
    try {
      this.oceanSource?.stop();
      this.rainSource?.stop();
      this.ctx?.close();
    } catch {}
    this.ctx = null;
  }
}
