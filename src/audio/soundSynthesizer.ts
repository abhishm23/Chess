/**
 * src/audio/soundSynthesizer.ts
 * Pure Web Audio API procedural sound synthesizer with zero external assets.
 * Exactly adheres to PROJECT.md § Architecture and Milestone 3 specifications.
 */

export class ChessSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.6; // Default volume 60%

  /**
   * Lazily initializes AudioContext on first user interaction to conform
   * to browser autoplay policies without generating console warnings.
   */
  public getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Defensive audio routing: connect oscillator through low-pass biquad filter
   * if supported by the environment, otherwise route directly to gain node.
   * This guarantees 100% crash resilience against headless Vitest/JSDOM mocks.
   */
  private connectAudioChain(
    ctx: AudioContext,
    osc: OscillatorNode,
    gain: GainNode,
    filterFreq?: number
  ): void {
    if (filterFreq && typeof ctx.createBiquadFilter === 'function') {
      try {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
        if (filter.Q) {
          filter.Q.setValueAtTime(1.4, ctx.currentTime);
        }
        osc.connect(filter);
        filter.connect(gain);
      } catch {
        osc.connect(gain);
      }
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);
  }

  /**
   * 1. Move Sound: Realistic wooden "thock"
   * Low-pass filtered damped sine pulse, rapid decay ~75ms.
   */
  public playMove(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.075; // 75ms
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + duration);

      const peakGain = 0.45 * this.volume;
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      this.connectAudioChain(ctx, osc, gain, 650);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Graceful fallback if Web Audio is restricted
    }
  }

  /**
   * 2. Capture Sound: Crisp wooden "snap" / impact
   * Percussive falling triangle pulse + transient snap, rapid decay ~55ms.
   */
  public playCapture(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.055; // 55ms
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + duration);

      const peakGain = 0.65 * this.volume;
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      this.connectAudioChain(ctx, osc, gain, 1200);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Graceful fallback
    }
  }

  /**
   * 3. Check Sound: Subtle resonant alert chime
   * Dual-frequency harmonic chime (A5 880Hz + E6 1320Hz), ~280ms decay.
   */
  public playCheck(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.28; // 280ms
      const frequencies = [880, 1320]; // Perfect fifth interval (A5, E6)

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const peakGain = (idx === 0 ? 0.22 : 0.14) * this.volume;
        // 8ms attack to eliminate click/pop
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        this.connectAudioChain(ctx, osc, gain);

        osc.start(now);
        osc.stop(now + duration);
      });
    } catch {
      // Graceful fallback
    }
  }

  /**
   * 4. Castling Sound: Rhythmic double-tap
   * Two quick move pulses spaced ~85ms apart (~160ms total).
   */
  public playCastle(): void {
    if (this.isMuted) return;
    this.playMove();
    setTimeout(() => {
      this.playMove();
    }, 85);
  }
}

export const soundSynthesizer = new ChessSoundSynthesizer();
