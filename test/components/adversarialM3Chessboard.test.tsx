/**
 * test/components/adversarialM3Chessboard.test.tsx
 * Adversarial stress tests for Milestone 3 Chessboard subsystem
 * and procedural Web Audio synthesizer.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Chessboard } from '../../src/components/Chessboard/Chessboard';
import { PromotionModal } from '../../src/components/Chessboard/PromotionModal';
import { ChessSoundSynthesizer } from '../../src/audio/soundSynthesizer';

describe('Adversarial SoundSynthesizer Stress Tests', () => {
  let synth: ChessSoundSynthesizer;

  beforeEach(() => {
    synth = new ChessSoundSynthesizer();
  });

  it('handles rapid consecutive sound triggers without unhandled exceptions', () => {
    expect(() => {
      for (let i = 0; i < 50; i++) {
        synth.playMove();
        synth.playCapture();
        synth.playCheck();
        synth.playCastle();
      }
    }).not.toThrow();
  });

  it('handles abnormal volume parameters including non-finite values safely', () => {
    // Normal clamping
    synth.setVolume(2.5);
    expect(synth.getVolume()).toBe(1.0);

    synth.setVolume(-5.0);
    expect(synth.getVolume()).toBe(0.0);

    // NaN input
    synth.setVolume(NaN);
    // Even if volume becomes NaN or undefined, play methods must not crash
    expect(() => synth.playMove()).not.toThrow();
    expect(() => synth.playCapture()).not.toThrow();
    expect(() => synth.playCheck()).not.toThrow();
  });

  it('correctly suppresses the second pulse of playCastle if muted immediately after invocation', () => {
    vi.useFakeTimers();
    const playMoveSpy = vi.spyOn(synth, 'playMove');

    synth.playCastle();
    expect(playMoveSpy).toHaveBeenCalledTimes(1);

    // Mute immediately before the 85ms timer executes
    synth.setMuted(true);
    vi.advanceTimersByTime(100);

    // playMove was called initially, and the timer fired playMove which exited early due to isMuted
    expect(playMoveSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('gracefully handles complete Web Audio API failure/throwing', () => {
    const ctx = synth.getContext();
    if (ctx) {
      // Intentionally break createOscillator to throw
      const originalCreateOsc = ctx.createOscillator;
      ctx.createOscillator = () => {
        throw new Error('Web Audio hardware failure');
      };

      expect(() => synth.playMove()).not.toThrow();
      expect(() => synth.playCapture()).not.toThrow();
      expect(() => synth.playCheck()).not.toThrow();

      // Restore
      ctx.createOscillator = originalCreateOsc;
    }
  });
});

describe('Adversarial Chessboard Interaction & Edge Cases', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('prevents selecting or moving opponent pieces when it is White turn', () => {
    const onMove = vi.fn();
    const { container } = render(<Chessboard fen={startFen} onMove={onMove} />);

    // e7 is Black pawn, but it is White's turn
    const e7 = container.querySelector('[data-square="e7"]');
    expect(e7).toBeInTheDocument();

    fireEvent.click(e7!);
    expect(e7).not.toHaveAttribute('data-selected', 'true');

    // Attempt to click e5
    const e5 = container.querySelector('[data-square="e5"]');
    fireEvent.click(e5!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('rejects illegal moves and unselects target gracefully', () => {
    const onMove = vi.fn();
    const { container } = render(<Chessboard fen={startFen} onMove={onMove} />);

    // Click e2 (pawn) then a5 (illegal destination)
    const e2 = container.querySelector('[data-square="e2"]');
    const a5 = container.querySelector('[data-square="a5"]');

    fireEvent.click(e2!);
    expect(e2).toHaveAttribute('data-selected', 'true');

    fireEvent.click(a5!);
    expect(onMove).not.toHaveBeenCalled();
    expect(e2).not.toHaveAttribute('data-selected', 'true');
  });

  it('respects isInteractive=false and ignores all clicks and drags', () => {
    const onMove = vi.fn();
    const { container } = render(
      <Chessboard fen={startFen} isInteractive={false} onMove={onMove} />
    );

    const e2 = container.querySelector('[data-square="e2"]');
    fireEvent.click(e2!);
    expect(e2).not.toHaveAttribute('data-selected', 'true');

    const e4 = container.querySelector('[data-square="e4"]');
    fireEvent.click(e4!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('handles Black pawn promotion correctly when Black reaches rank 1', () => {
    // Black pawn on d2, Black to move, can promote to d1
    const blackPromoFen = '8/8/8/8/8/8/3p4/k3K3 b - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(
      <Chessboard fen={blackPromoFen} orientation="black" onMove={onMove} />
    );

    const d2 = container.querySelector('[data-square="d2"]');
    const d1 = container.querySelector('[data-square="d1"]');

    fireEvent.click(d2!);
    expect(d2).toHaveAttribute('data-selected', 'true');

    fireEvent.click(d1!);

    // Promotion modal must appear with Black pieces
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Select Queen via hotkey 'q'
    fireEvent.keyDown(window, { key: 'q' });
    expect(onMove).toHaveBeenCalledWith('d2', 'd1', 'q');
  });

  it('supports promotion modal cancellation without executing moves', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn();
    const { container } = render(<Chessboard fen={promoFen} onMove={onMove} />);

    const e7 = container.querySelector('[data-square="e7"]');
    const e8 = container.querySelector('[data-square="e8"]');

    fireEvent.click(e7!);
    fireEvent.click(e8!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Press Escape to cancel
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('supports click-to-move across flipped Black orientation', () => {
    // White to move, but board is oriented from Black's perspective
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(
      <Chessboard fen={startFen} orientation="black" onMove={onMove} />
    );

    const d2 = container.querySelector('[data-square="d2"]');
    const d4 = container.querySelector('[data-square="d4"]');

    fireEvent.click(d2!);
    expect(d2).toHaveAttribute('data-selected', 'true');

    fireEvent.click(d4!);
    expect(onMove).toHaveBeenCalledWith('d2', 'd4', undefined);
  });

  it('highlights the King in check', () => {
    // White King on e1 is in check from Black Queen on d1; Black King on e8
    const checkFen = '4k3/8/8/8/8/8/8/3qK3 w - - 0 1';
    const { container } = render(<Chessboard fen={checkFen} />);

    const e1 = container.querySelector('[data-square="e1"]');
    // Inside e1, the check pulse indicator should be present
    const checkIndicator = e1?.querySelector('.bg-red-600\\/35');
    expect(checkIndicator).toBeInTheDocument();
  });
});
