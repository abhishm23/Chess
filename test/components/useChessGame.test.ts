/**
 * test/components/useChessGame.test.ts
 * Unit tests for useChessGame hook state coordination and actions.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChessGame } from '../../src/hooks/useChessGame';

describe('useChessGame Hook', () => {
  it('initializes with starting position and default Smart mode', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    expect(result.current.gameState.activeMode).toBe('smart');
    expect(result.current.gameState.fen).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    expect(result.current.gameState.turn).toBe('w');
    expect(result.current.gameState.history).toEqual([]);
    expect(result.current.orientation).toBe('white');
  });

  it('makes a legal move and updates state and history', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    let success = false;
    act(() => {
      success = result.current.actions.makeMove('e2', 'e4');
    });

    expect(success).toBe(true);
    expect(result.current.gameState.history).toEqual(['e4']);
    expect(result.current.gameState.turn).toBe('b');
    expect(result.current.lastMove).toEqual({ from: 'e2', to: 'e4' });
    expect(result.current.canUndo).toBe(true);
  });

  it('rejects illegal moves and preserves state', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    let success = false;
    act(() => {
      success = result.current.actions.makeMove('e2', 'e5'); // Illegal: pawn moving 3 squares
    });

    expect(success).toBe(false);
    expect(result.current.gameState.history).toEqual([]);
    expect(result.current.gameState.turn).toBe('w');
  });

  it('switches game modes seamlessly without mutating FEN or history', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    act(() => {
      result.current.actions.makeMove('e2', 'e4');
    });

    const fenBefore = result.current.gameState.fen;
    expect(result.current.gameState.history).toEqual(['e4']);

    // Switch to Expert
    act(() => {
      result.current.actions.setGameMode('expert');
    });

    expect(result.current.gameState.activeMode).toBe('expert');
    expect(result.current.gameState.fen).toBe(fenBefore);
    expect(result.current.gameState.history).toEqual(['e4']);
    expect(result.current.showHeatmap).toBe(true);

    // Switch to Normal
    act(() => {
      result.current.actions.setGameMode('normal');
    });

    expect(result.current.gameState.activeMode).toBe('normal');
    expect(result.current.gameState.fen).toBe(fenBefore);
    expect(result.current.showHeatmap).toBe(false);
  });

  it('previews hypothetical variation plies non-destructively and reverts on null', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    act(() => {
      result.current.actions.makeMove('e2', 'e4');
    });
    const liveFen = result.current.gameState.fen;

    const previewFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';

    // Enter preview
    act(() => {
      result.current.actions.previewVariationPly(previewFen);
    });

    expect(result.current.previewFen).toBe(previewFen);
    expect(result.current.gameState.fen).toBe(previewFen);
    expect(result.current.gameState.turn).toBe('b');

    // Toggling board flip preserves preview
    act(() => {
      result.current.actions.flipBoard();
    });
    expect(result.current.orientation).toBe('black');
    expect(result.current.gameState.fen).toBe(previewFen);

    // Exit preview: restores live state
    act(() => {
      result.current.actions.previewVariationPly(null);
    });
    expect(result.current.gameState.fen).toBe(liveFen);
    expect(result.current.orientation).toBe('black');
  });

  it('supports undoing moves and resetting the game', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    act(() => {
      result.current.actions.makeMove('e2', 'e4');
      result.current.actions.makeMove('e7', 'e5');
    });

    expect(result.current.gameState.history.length).toBe(2);

    // Undo move
    act(() => {
      result.current.undo();
    });
    expect(result.current.gameState.history).toEqual(['e4']);
    expect(result.current.gameState.turn).toBe('b');

    // Reset game
    act(() => {
      result.current.actions.resetGame();
    });
    expect(result.current.gameState.history).toEqual([]);
    expect(result.current.gameState.turn).toBe('w');
  });
});
