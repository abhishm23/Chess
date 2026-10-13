/**
 * test/audit/interactionAudit.test.tsx
 * Pointer/geometry, overlay-math and status-reporting audit. These checks cover
 * the interaction surfaces that are hardest to verify by inspection: drag-and-drop
 * coordinate mapping, SVG arrow geometry for every square pair, heatmap colour
 * ramps, history keyboard navigation and honest engine status reporting.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, renderHook } from '@testing-library/react';
import { Chess } from 'chess.js';

import App from '../../src/App';
import { Chessboard } from '../../src/components/Chessboard/Chessboard';
import { MoveHistory } from '../../src/components/Chessboard/MoveHistory';
import {
  squareToCoords,
  computeKnightLPath,
  computeStraightArrowPath,
  isKnightMove,
} from '../../src/components/Overlays/SvgOverlay';
import { getHeatmapColor } from '../../src/components/Overlays/HeatmapOverlay';
import { useChessGame } from '../../src/hooks/useChessGame';
import { SQUARES } from '../../src/rules/squareControl';
import type { Square } from '../../src/types/chess';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type MoveHandler = (from: string, to: string, promotion?: string) => boolean;
type MoveHandlerMock = ReturnType<typeof vi.fn<MoveHandler>>;


/** Mock an 800x800 board so pointer geometry can be exercised headlessly. */
function mockBoardRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 800,
    width: 800,
    height: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect);
}

describe('Audit: drag-and-drop coordinate mapping', () => {
  it('drops a dragged pawn on the geometrically correct target square', () => {
    const onMove: MoveHandlerMock = vi.fn<MoveHandler>(() => true);
    const { container } = render(<Chessboard fen={START_FEN} onMove={onMove} />);
    mockBoardRect(container.firstElementChild as HTMLElement);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    const e4 = container.querySelector('[data-square="e4"]') as HTMLElement;

    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 450, clientY: 550, pointerId: 1 });
    fireEvent.pointerUp(e4, { clientX: 450, clientY: 450, pointerId: 1 });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toBe('e2');
    expect(onMove.mock.calls[0][1]).toBe('e4');
  });

  it('ignores a drop on an illegal target square', () => {
    const onMove = vi.fn(() => true);
    const { container } = render(<Chessboard fen={START_FEN} onMove={onMove} />);
    mockBoardRect(container.firstElementChild as HTMLElement);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    const e5 = container.querySelector('[data-square="e5"]') as HTMLElement;

    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 450, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(e5, { clientX: 450, clientY: 350, pointerId: 1 });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('maps mirrored coordinates correctly when the board is flipped', () => {
    const onMove: MoveHandlerMock = vi.fn<MoveHandler>(() => true);
    const { container } = render(
      <Chessboard fen={START_FEN} orientation="black" onMove={onMove} />
    );
    mockBoardRect(container.firstElementChild as HTMLElement);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    const e4 = container.querySelector('[data-square="e4"]') as HTMLElement;

    // Black orientation: file e maps to column 3, rank 2 to row 1
    fireEvent.pointerDown(e2, { clientX: 350, clientY: 150, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 350, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(e4, { clientX: 350, clientY: 350, pointerId: 1 });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toBe('e2');
    expect(onMove.mock.calls[0][1]).toBe('e4');
  });

  it('never moves a piece while the board is locked (variation preview)', () => {
    const onMove = vi.fn(() => true);
    const { container } = render(
      <Chessboard fen={START_FEN} isInteractive={false} onMove={onMove} />
    );
    mockBoardRect(container.firstElementChild as HTMLElement);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    const e4 = container.querySelector('[data-square="e4"]') as HTMLElement;

    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 450, clientY: 550, pointerId: 1 });
    fireEvent.pointerUp(e4, { clientX: 450, clientY: 450, pointerId: 1 });
    fireEvent.click(e4);

    expect(onMove).not.toHaveBeenCalled();
    expect(e2.getAttribute('data-selected')).not.toBe('true');
  });
});

describe('Audit: overlay geometry invariants', () => {
  it('keeps every arrow path inside the viewBox and anchored on its target square', () => {
    for (const from of SQUARES as Square[]) {
      for (const to of SQUARES as Square[]) {
        if (from === to) continue;

        const p1 = squareToCoords(from, 'white');
        const p2 = squareToCoords(to, 'white');
        const path = isKnightMove(from, to)
          ? computeKnightLPath(p1, p2)
          : computeStraightArrowPath(p1, p2);

        expect(path.d).not.toMatch(/NaN|undefined/);

        const numbers = (path.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        expect(numbers.length).toBeGreaterThanOrEqual(4);
        for (const n of numbers) {
          expect(n).toBeGreaterThanOrEqual(-1);
          expect(n).toBeLessThanOrEqual(801);
        }

        // Arrowhead lands within 15px of the destination centre
        expect(Math.hypot(path.endX - p2.x, path.endY - p2.y)).toBeLessThan(15);
      }
    }
  });

  it('mirrors overlay coordinates when the board is flipped', () => {
    expect(squareToCoords('a1', 'white')).toEqual({ x: 50, y: 750 });
    expect(squareToCoords('a1', 'black')).toEqual({ x: 750, y: 50 });

    const a1h8White = computeStraightArrowPath(
      squareToCoords('a1', 'white'),
      squareToCoords('h8', 'white')
    );
    const a1h8Black = computeStraightArrowPath(
      squareToCoords('a1', 'black'),
      squareToCoords('h8', 'black')
    );
    expect(a1h8White.endX).toBeGreaterThan(a1h8White.endY);
    expect(a1h8Black.endX).toBeLessThan(a1h8Black.endY);
  });

  it('maps square-control differentials onto the documented colour ramp', () => {
    expect(getHeatmapColor(0, 0, 0)).toBe('transparent');
    expect(getHeatmapColor(0, 2, 1)).toContain('168, 85, 247');

    const readAlpha = (color: string) => Number((color.match(/,\s*([0-9.]+)\)$/) || [])[1]);

    for (let diff = 1; diff <= 10; diff++) {
      const color = getHeatmapColor(diff, diff, 0);
      expect(color.startsWith('rgba(59, 130, 246')).toBe(true);
      const alpha = readAlpha(color);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(0.38);
    }

    for (let diff = -1; diff >= -10; diff--) {
      const color = getHeatmapColor(diff, 0, Math.abs(diff));
      expect(color.startsWith('rgba(239, 68, 68')).toBe(true);
      const alpha = readAlpha(color);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(0.38);
    }

    // Equal magnitudes produce equal opacity on both sides of the ramp
    expect(readAlpha(getHeatmapColor(4, 4, 0))).toBeCloseTo(readAlpha(getHeatmapColor(-4, 0, 4)), 6);
  });
});

describe('Audit: history keyboard navigation', () => {
  it('clamps keyboard time-travel to the available plies', () => {
    const onJumpToPly = vi.fn();
    render(
      <MoveHistory history={['e4', 'e5', 'Nf3']} activePly={3} onJumpToPly={onJumpToPly} />
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onJumpToPly).toHaveBeenCalledWith(2);

    onJumpToPly.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onJumpToPly).toHaveBeenCalledWith(3);

    onJumpToPly.mockClear();
    fireEvent.keyDown(window, { key: 'Home' });
    expect(onJumpToPly).toHaveBeenCalledWith(0);

    onJumpToPly.mockClear();
    fireEvent.keyDown(window, { key: 'End' });
    expect(onJumpToPly).toHaveBeenCalledWith(3);
  });

  it('never hijacks arrow keys typed inside a text field', () => {
    const onJumpToPly = vi.fn();
    render(<MoveHistory history={['e4']} activePly={1} onJumpToPly={onJumpToPly} />);

    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onJumpToPly).not.toHaveBeenCalled();

    input.remove();
  });
});

describe('Audit: honest engine reporting & affordable search budgets', () => {
  const fenAfter = (moves: string[]) => {
    const chess = new Chess();
    for (const san of moves) chess.move(san);
    return chess.fen();
  };

  it('reports the engine core that is actually running', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));
    expect(result.current.engineStatus).toBe('dormant');

    act(() => { result.current.actions.setGameMode('smart'); });
    expect(result.current.engineStatus).toBe('minimax');

    act(() => { result.current.actions.setGameMode('expert'); });
    expect(result.current.engineStatus).toBe('minimax');

    act(() => { result.current.actions.setGameMode('normal'); });
    expect(result.current.engineStatus).toBe('dormant');
  });

  it('keeps Expert-mode analysis affordable when the WASM worker is unavailable', async () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'expert' }));
    const start = performance.now();

    await waitFor(
      () => expect(result.current.gameState.candidateMoves.length).toBeGreaterThan(0),
      { timeout: 20000 }
    );

    expect(result.current.engineStatus).toBe('minimax');
    // A depth-14 request against the pure-TS engine would take minutes; the
    // fallback budget must be used instead.
    expect(performance.now() - start).toBeLessThan(10000);
  }, 30000);

  it('clears a stale variation preview when the analysed line changes', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));
    act(() => { result.current.actions.makeMove('e2', 'e4'); });

    const variation = fenAfter(['e4', 'e5', 'Nf3']);
    act(() => { result.current.actions.previewVariationPly(variation); });
    expect(result.current.displayFen).toBe(variation);
    expect(result.current.isHistoricalPreview).toBe(true);

    act(() => { result.current.actions.selectCandidateMove('Nf3'); });

    expect(result.current.selectedCandidateSan).toBe('Nf3');
    expect(result.current.displayFen).toBe(result.current.liveFen);
    expect(result.current.isHistoricalPreview).toBe(false);
  });

  it('never advertises a Stockfish core while the fallback engine is analysing', async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: /Expert/i })[0]);

    await waitFor(
      () => expect(screen.getAllByText('Minimax Fallback').length).toBeGreaterThan(0),
      { timeout: 20000 }
    );
    expect(screen.queryAllByText('Stockfish WASM')).toHaveLength(0);
  }, 30000);
});


