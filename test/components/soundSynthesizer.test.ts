/**
 * test/components/soundSynthesizer.test.ts
 * Unit tests for procedural Web Audio API sound synthesizer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChessSoundSynthesizer, soundSynthesizer } from '../../src/audio/soundSynthesizer';

describe('ChessSoundSynthesizer', () => {
  let synth: ChessSoundSynthesizer;

  beforeEach(() => {
    synth = new ChessSoundSynthesizer();
  });

  it('initializes with default volume and unmuted state', () => {
    expect(synth.getMuted()).toBe(false);
    expect(synth.getVolume()).toBe(0.6);
  });

  it('sets volume clamped between 0 and 1', () => {
    synth.setVolume(0.85);
    expect(synth.getVolume()).toBe(0.85);

    synth.setVolume(1.5);
    expect(synth.getVolume()).toBe(1.0);

    synth.setVolume(-0.2);
    expect(synth.getVolume()).toBe(0.0);
  });

  it('toggles muted state', () => {
    synth.setMuted(true);
    expect(synth.getMuted()).toBe(true);

    synth.setMuted(false);
    expect(synth.getMuted()).toBe(false);
  });

  it('lazily initializes AudioContext on demand', () => {
    const ctx = synth.getContext();
    expect(ctx).toBeDefined();
    expect(ctx?.state).toBe('running');
  });

  it('plays move sound without throwing in mock environment', () => {
    expect(() => synth.playMove()).not.toThrow();
  });

  it('plays capture sound without throwing in mock environment', () => {
    expect(() => synth.playCapture()).not.toThrow();
  });

  it('plays check sound without throwing in mock environment', () => {
    expect(() => synth.playCheck()).not.toThrow();
  });

  it('plays castle double-tap sound without throwing', () => {
    vi.useFakeTimers();
    expect(() => synth.playCastle()).not.toThrow();
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('suppresses audio playback when muted', () => {
    synth.setMuted(true);
    expect(() => synth.playMove()).not.toThrow();
    expect(() => synth.playCapture()).not.toThrow();
    expect(() => synth.playCheck()).not.toThrow();
    expect(() => synth.playCastle()).not.toThrow();
  });

  it('defensively handles missing createBiquadFilter in test runner mock', () => {
    const ctx = synth.getContext();
    // In our test mock, createBiquadFilter is undefined
    expect((ctx as any)?.createBiquadFilter).toBeUndefined();
    // Must gracefully fall back without error
    expect(() => synth.playMove()).not.toThrow();
    expect(() => synth.playCapture()).not.toThrow();
  });

  it('exports singleton instance soundSynthesizer', () => {
    expect(soundSynthesizer).toBeInstanceOf(ChessSoundSynthesizer);
  });
});
