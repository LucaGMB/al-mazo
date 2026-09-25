// Sintetizador procedural con Web Audio: sin archivos MP3 ni dependencias.
// Cada efecto se arma con osciladores/ruido y envolventes cortas. El contexto
// se crea perezoso (nunca en SSR) y queda "desbloqueado" con el primer gesto
// del usuario, requisito de los navegadores para reproducir audio.

export type SoundName =
  | "playCard"
  | "drawCard"
  | "turnNotification"
  | "colorChosen"
  | "victory"
  | "alMazo"
  | "chat"
  | "reaction"
  | "error"
  | "forcedDraw";

const MUTE_KEY = "al-mazo:sound-muted";

type Listener = (muted: boolean) => void;

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  delay?: number;
  duration?: number;
  gain?: number;
  freqEnd?: number;
  attack?: number;
}

interface NoiseOptions {
  delay?: number;
  duration?: number;
  gain?: number;
  filter?: number;
  filterEnd?: number;
  q?: number;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window === "undefined") return;
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
  }

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
  }

  isMuted(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTE_KEY) === "1";
  }

  setMuted(muted: boolean): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    this.listeners.forEach((listener) => listener(muted));
  }

  toggleMuted(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  play(name: SoundName): void {
    if (this.isMuted()) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    try {
      switch (name) {
        case "playCard":
          // Chasquido seco + swoosh descendente.
          this.noise({ duration: 0.06, gain: 0.16, filter: 2600, filterEnd: 900 });
          this.tone({ freq: 920, freqEnd: 240, type: "triangle", duration: 0.12, gain: 0.08 });
          break;
        case "drawCard":
          // Roce de papel: ruido con filtro que sube suave.
          this.noise({ duration: 0.18, gain: 0.07, filter: 700, filterEnd: 1800, q: 0.6 });
          break;
        case "turnNotification":
          // Campana suave de dos notas.
          this.tone({ freq: 880, type: "sine", duration: 0.35, gain: 0.09 });
          this.tone({ freq: 1318.5, type: "sine", delay: 0.12, duration: 0.45, gain: 0.07 });
          break;
        case "colorChosen":
          // Acorde mayor (C-E-G) con triángulos.
          [523.25, 659.25, 783.99].forEach((freq, i) =>
            this.tone({ freq, type: "triangle", delay: i * 0.02, duration: 0.5, gain: 0.06 }),
          );
          break;
        case "victory":
          // Arpegio triunfal ascendente (C-E-G-C).
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
            this.tone({ freq, type: "triangle", delay: i * 0.12, duration: 0.4, gain: 0.09 }),
          );
          break;
        case "alMazo":
          // Fanfarria "brass" corta: triada ascendente con onda cuadrada.
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
            this.tone({ freq, type: "square", delay: i * 0.12, duration: 0.13, gain: 0.11 }),
          );
          break;
        case "chat":
          // Campanita de dos notas cortas y suaves.
          this.tone({ freq: 600, type: "sine", duration: 0.04, gain: 0.08 });
          this.tone({ freq: 900, type: "sine", delay: 0.04, duration: 0.06, gain: 0.08 });
          break;
        case "reaction":
          // Carillón alegre de dos notas ascendentes (D5 -> A5).
          this.tone({ freq: 587.33, type: "triangle", duration: 0.12, gain: 0.1 });
          this.tone({ freq: 880, type: "triangle", delay: 0.1, duration: 0.12, gain: 0.09 });
          break;
        case "error":
          // Zumbido grave, dos sierras levemente desafinadas.
          this.tone({ freq: 110, type: "sawtooth", duration: 0.3, gain: 0.12 });
          this.tone({ freq: 116, type: "sawtooth", duration: 0.3, gain: 0.08 });
          break;
        case "forcedDraw":
          // Dos golpes secos de cartas castigo + quejido grave descendente.
          this.noise({ duration: 0.08, gain: 0.15, filter: 1400, filterEnd: 400 });
          this.noise({ delay: 0.09, duration: 0.09, gain: 0.16, filter: 1400, filterEnd: 350 });
          this.tone({ freq: 220, freqEnd: 130, type: "sawtooth", delay: 0.05, duration: 0.28, gain: 0.08 });
          break;
      }
    } catch {
      // El audio nunca debe romper la partida.
    }
  }

  private tone({
    freq,
    type = "sine",
    delay = 0,
    duration = 0.15,
    gain = 0.12,
    freqEnd,
    attack = 0.005,
  }: ToneOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    }
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(attack, duration));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise({
    delay = 0,
    duration = 0.12,
    gain = 0.1,
    filter = 1200,
    filterEnd,
    q = 0.8,
  }: NoiseOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = "bandpass";
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(Math.max(50, filter), t0);
    if (filterEnd) {
      biquad.frequency.exponentialRampToValueAtTime(Math.max(50, filterEnd), t0 + duration);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(biquad).connect(env).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }
}

export const soundManager = new SoundManager();
