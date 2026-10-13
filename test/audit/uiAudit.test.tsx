/**
 * test/audit/uiAudit.test.tsx
 * Rigorous end-to-end and interaction audit: variation scrubber wiring,
 * hook time-travel/undo semantics, promotion workflow, board interactivity
 * gating and the whole-application user journey.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, renderHook } from '@testing-library/react';
import { Chess } from 'chess.js';

import App from '../../src/App';
import { DominoExplorer } from '../../src/components/DominoExplorer/DominoExplorer';
import { Chessboard } from '../../src/components/Chessboard/Chessboard';
import { useChessGame } from '../../src/hooks/useChessGame';
import type { CandidateMoveEvaluation, DominoCausalStep } from '../../src/types/engine';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const CANDIDATES: CandidateMoveEvaluation[] = [
  {
    san: 'e4',
    from: 'e2',
    to: 'e4',
    centipawns: 30,
    winProbability: 53.6,
    deltaWinProbability: 0,
    classification: 'best',
    tacticalMotifs: [],
    pv: ['e4', 'e5', 'Nf3'],
  },
];

const CHAIN: DominoCausalStep[] = [
  { ply: 1, moveSan: 'e4', player: 'white', stage: 'cause', description: 'White plays e4.' },
  { ply: 2, moveSan: 'e5', player: 'black', stage: 'trigger', description: 'Black refutes with e5.' },
  { ply: 3, moveSan: 'Nf3', player: 'white', stage: 'crisis', description: 'White defends.' },
  { ply: 4, moveSan: 'Nc6', player: 'black', stage: 'consequence', description: 'Black holds.' },
];

describe('Audit: variation scrubber previews the analysable line', () => {
  it('previews the exact position reached after the selected variation step', () => {
    const onPreviewPly = vi.fn();
    render(
      <DominoExplorer
        activeMode="smart"
        candidateMoves={CANDIDATES}
        selectedCandidateSan="e4"
        onSelectCandidate={() => {}}
        activeDominoChain={CHAIN}
        activePreviewFen={null}
        onPreviewPly={onPreviewPly}
        baseFen={START_FEN}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'e5' }));

    const expected = new Chess(START_FEN);
    expected.move('e4');
    expected.move('e5');
    expect(onPreviewPly).toHaveBeenCalledWith(expected.fen());
  });

  it('previews the candidate move itself from the "First Step" control', () => {
    const onPreviewPly = vi.fn();
    render(
      <DominoExplorer
        activeMode="smart"
        candidateMoves={CANDIDATES}
        selectedCandidateSan="e4"
        onSelectCandidate={() => {}}
        activeDominoChain={CHAIN}
        activePreviewFen={null}
        onPreviewPly={onPreviewPly}
        baseFen={START_FEN}
      />
    );

    fireEvent.click(screen.getByLabelText('First Step'));

    const expected = new Chess(START_FEN);
    expected.move('e4');
    expect(onPreviewPly).toHaveBeenCalledWith(expected.fen());
  });

  it('returns to the live game when the active step is toggled off', () => {
    const onPreviewPly = vi.fn();
    const afterE4 = new Chess(START_FEN);
    afterE4.move('e4');

    render(
      <DominoExplorer
        activeMode="smart"
        candidateMoves={CANDIDATES}
        selectedCandidateSan="e4"
        onSelectCandidate={() => {}}
        activeDominoChain={CHAIN}
        activePreviewFen={afterE4.fen()}
        onPreviewPly={onPreviewPly}
        baseFen={START_FEN}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'e4' }));
    expect(onPreviewPly).toHaveBeenCalledWith(null);
    expect(onPreviewPly).not.toHaveBeenCalledWith(expect.stringContaining(' '));
  });

  it('never emits an empty FEN for a variation step', () => {
    const onPreviewPly = vi.fn();
    render(
      <DominoExplorer
        activeMode="expert"
        candidateMoves={CANDIDATES}
        selectedCandidateSan="e4"
        onSelectCandidate={() => {}}
        activeDominoChain={CHAIN}
        activePreviewFen={null}
        onPreviewPly={onPreviewPly}
        baseFen={START_FEN}
      />
    );

    fireEvent.click(screen.getByLabelText('Last Step'));
    expect(onPreviewPly).toHaveBeenCalled();
    const lastArg = onPreviewPly.mock.calls[onPreviewPly.mock.calls.length - 1][0];
    expect(typeof lastArg).toBe('string');
    expect(lastArg).not.toBe('');
    expect(lastArg).toContain(' ');
  });
});

describe('Audit: useChessGame state coordination', () => {
  const fenAfter = (moves: string[]) => {
    const chess = new Chess();
    for (const san of moves) chess.move(san);
    return chess.fen();
  };

  it('restores the exact historical FEN and returns to live on demand', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    act(() => { result.current.actions.makeMove('e2', 'e4'); });
    act(() => { result.current.actions.makeMove('e7', 'e5'); });
    act(() => { result.current.actions.makeMove('g1', 'f3'); });

    const liveFen = result.current.displayFen;

    act(() => { result.current.actions.jumpToHistoryPly(2); });
    expect(result.current.displayFen).toBe(fenAfter(['e4', 'e5']));
    expect(result.current.isHistoricalPreview).toBe(true);

    act(() => { result.current.actions.jumpToHistoryPly(3); });
    expect(result.current.displayFen).toBe(liveFen);
    expect(result.current.isHistoricalPreview).toBe(false);
  });

  it('undo rewinds history and keeps the live board authoritative', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));
    act(() => { result.current.actions.makeMove('e2', 'e4'); });
    act(() => { result.current.actions.makeMove('e7', 'e5'); });

    act(() => { result.current.undo(); });

    expect(result.current.gameState.history).toEqual(['e4']);
    expect(result.current.liveFen).toBe(fenAfter(['e4']));
    expect(result.current.displayFen).toBe(fenAfter(['e4']));
  });

  it('variation preview overrides the board and clears back to live', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));
    act(() => { result.current.actions.makeMove('e2', 'e4'); });

    const variation = fenAfter(['e4', 'e5', 'Nf3']);
    act(() => { result.current.actions.previewVariationPly(variation); });
    expect(result.current.displayFen).toBe(variation);
    expect(result.current.isHistoricalPreview).toBe(true);
    expect(result.current.liveFen).toBe(fenAfter(['e4']));

    act(() => { result.current.actions.previewVariationPly(null); });
    expect(result.current.displayFen).toBe(fenAfter(['e4']));
    expect(result.current.isHistoricalPreview).toBe(false);
  });

  it('switching modes mid-game preserves position, history and turn', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));
    act(() => { result.current.actions.makeMove('d2', 'd4'); });
    act(() => { result.current.actions.makeMove('d7', 'd5'); });

    const fen = result.current.liveFen;
    const history = [...result.current.gameState.history];

    act(() => { result.current.actions.setGameMode('expert'); });
    expect(result.current.gameState.activeMode).toBe('expert');
    expect(result.current.liveFen).toBe(fen);
    expect(result.current.gameState.history).toEqual(history);

    act(() => { result.current.actions.setGameMode('normal'); });
    act(() => { result.current.actions.setGameMode('smart'); });
    expect(result.current.liveFen).toBe(fen);
    expect(result.current.gameState.history).toEqual(history);
  });

  it('resetGame clears the board, history and time-travel cursor', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));
    act(() => { result.current.actions.makeMove('e2', 'e4'); });
    act(() => { result.current.actions.jumpToHistoryPly(1); });
    act(() => { result.current.actions.resetGame(); });

    expect(result.current.liveFen).toBe(START_FEN);
    expect(result.current.displayFen).toBe(START_FEN);
    expect(result.current.gameState.history).toEqual([]);
    expect(result.current.isHistoricalPreview).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('flipBoard swaps orientation without touching the position', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));
    act(() => { result.current.actions.makeMove('e2', 'e4'); });
    const fen = result.current.liveFen;

    act(() => { result.current.actions.flipBoard(); });
    expect(result.current.orientation).toBe('black');
    expect(result.current.liveFen).toBe(fen);

    act(() => { result.current.actions.flipBoard(); });
    expect(result.current.orientation).toBe('white');
    expect(result.current.liveFen).toBe(fen);
  });

  it('produces ranked candidate evaluations and a domino chain in Smart mode', async () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    await waitFor(
      () => expect(result.current.gameState.candidateMoves.length).toBeGreaterThan(0),
      { timeout: 20000 }
    );

    const candidates = result.current.gameState.candidateMoves;
    expect(candidates[0].classification).toBe('best');
    expect(candidates[0].pv.length).toBeGreaterThan(0);
    expect(candidates[0].winProbability).toBeGreaterThan(0);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].centipawns).toBeGreaterThanOrEqual(candidates[i].centipawns);
    }

    await waitFor(
      () => expect(result.current.gameState.activeDominoChain?.length).toBeGreaterThan(0),
      { timeout: 20000 }
    );
    expect(result.current.gameState.activeDominoChain![0].stage).toBe('cause');
  }, 30000);

  it('builds a bounded scenario tree in Expert mode', async () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'expert' }));

    await waitFor(
      () => expect(result.current.gameState.activeScenarioTree?.children.length).toBeGreaterThan(0),
      { timeout: 20000 }
    );

    const tree = result.current.gameState.activeScenarioTree!;
    for (const branch of tree.children) {
      expect(branch.ply).toBe(1);
      expect(branch.fen).not.toBe(tree.fen);
    }
    expect(result.current.showHeatmap).toBe(true);
  }, 30000);
});

describe('Audit: chessboard interaction gating & promotion', () => {
  it('blocks all input while a variation preview is displayed', () => {
    const onMove = vi.fn(() => true);
    const { container } = render(
      <Chessboard fen={START_FEN} isInteractive={false} onMove={onMove} />
    );

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    fireEvent.click(e2);
    expect(e2).not.toHaveAttribute('data-selected', 'true');

    fireEvent.click(container.querySelector('[data-square="e4"]') as HTMLElement);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('shows the return-to-live banner only while previewing a variation', () => {
    const onReturnToLive = vi.fn();
    const { rerender } = render(
      <Chessboard fen={START_FEN} isVariationPreview={false} onReturnToLive={onReturnToLive} />
    );
    expect(screen.queryByText(/PREVIEWING VARIATION/i)).toBeNull();

    rerender(<Chessboard fen={START_FEN} isVariationPreview onReturnToLive={onReturnToLive} />);
    fireEvent.click(screen.getByLabelText('Return to Live Game'));
    expect(onReturnToLive).toHaveBeenCalledTimes(1);
  });

  it('completes a pawn promotion with the chosen piece via click-to-move', () => {
    const onMove = vi.fn(() => true);
    const fen = '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1';
    const { container } = render(<Chessboard fen={fen} onMove={onMove} />);

    fireEvent.click(container.querySelector('[data-square="b7"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-square="b8"]') as HTMLElement);
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Promote to Rook/));
    expect(onMove).toHaveBeenCalledWith('b7', 'b8', 'r');
  });

  it('cancels promotion with Escape and leaves the position untouched', () => {
    const onMove = vi.fn(() => true);
    const fen = '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1';
    const { container } = render(<Chessboard fen={fen} onMove={onMove} />);

    fireEvent.click(container.querySelector('[data-square="b7"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-square="b8"]') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('supports promotion through the keyboard shortcut', () => {
    const onMove = vi.fn(() => true);
    const fen = '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1';
    const { container } = render(<Chessboard fen={fen} onMove={onMove} />);

    fireEvent.click(container.querySelector('[data-square="b7"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-square="b8"]') as HTMLElement);
    fireEvent.keyDown(window, { key: 'n' });

    expect(onMove).toHaveBeenCalledWith('b7', 'b8', 'n');
  });
});

describe('Audit: whole-application user journey', () => {
  it('renders a complete interactive board and plays a move end-to-end', () => {
    const { container } = render(<App />);

    // Two responsive layouts each mount a full board (64 squares per board)
    const squareCount = container.querySelectorAll('[data-square]').length;
    expect(squareCount % 64).toBe(0);
    expect(squareCount).toBeGreaterThanOrEqual(64);
    expect(container.querySelector('[data-square="a8"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-square="d2"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-square="d4"]') as HTMLElement);

    // Move recorded in the move list
    expect(screen.getAllByText('d4').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GAME MOVES \(MOVE LIST\)/i).length).toBeGreaterThan(0);

    // Live board state reflected in the collapsed "Board Setup Code" panel
    expect(screen.getAllByText(/3P4/).length).toBeGreaterThan(0);
  });

  it('undoes a move and flips the board orientation through the control bar', () => {
    const { container } = render(<App />);

    fireEvent.click(container.querySelector('[data-square="d2"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-square="d4"]') as HTMLElement);

    fireEvent.click(screen.getAllByLabelText('Undo Move')[0]);
    expect(screen.queryByText(/3P4/)).toBeNull();

    const firstSquareBefore = container.querySelectorAll('[data-square]')[0].getAttribute('data-square');
    fireEvent.click(screen.getAllByLabelText('Flip Board')[0]);
    const firstSquareAfter = container.querySelectorAll('[data-square]')[0].getAttribute('data-square');
    expect(firstSquareBefore).toBe('a8');
    expect(firstSquareAfter).toBe('h1');
  });

  it('switches into Expert mode and produces coach advice for the live position', async () => {
    const { container } = render(<App />);

    const expertButton = screen.getAllByRole('button', { name: /Expert/i })[0];
    fireEvent.click(expertButton);

    await waitFor(() => expect(screen.getAllByText(/GRANDMASTER COACH/).length).toBeGreaterThan(0), {
      timeout: 20000,
    });

    // Expert mode enables the square-control heatmap overlay
    await waitFor(
      () => expect(container.querySelectorAll('[data-testid^="heatmap-rect-"]').length).toBeGreaterThan(0),
      { timeout: 20000 }
    );

    // Coach advice text is rendered for the selected persona
    await waitFor(() => expect(screen.getAllByText(/Persona Advice/).length).toBeGreaterThan(0), {
      timeout: 20000,
    });
  }, 30000);

  it('never exposes raw jargon in the default beginner surface', () => {
    render(<App />);
    const text = document.body.textContent || '';
    expect(text).not.toMatch(/\bcentipawns?\b/i);
    expect(text).not.toMatch(/\bpl(y|ies)\b/i);
    expect(text).not.toMatch(/\bSAN\b/);
    expect(text).not.toMatch(/\bUCI\b/);
    expect(text).not.toMatch(/\bPeSTO\b/);
  });
});


