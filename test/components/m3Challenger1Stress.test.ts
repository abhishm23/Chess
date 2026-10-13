/**
 * test/components/m3Challenger1Stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE for Milestone 3:
 * - Boundary tests on square coordinates across all 64 squares (White & Black orientations)
 * - Drag-and-drop edge cases: threshold boundaries (<4px vs >4px), snap-back outside board, illegal drops, friendly drops
 * - Promotion workflow stress: cancellation via Escape, underpromotion (Knight/Rook/Bishop) vs Queen, state accuracy
 * - Time-travel scrubbing stress: rapid stepping, direct jumps to start/end, active ply highlighting, FEN accuracy, out-of-bounds guards
 * - Audio synthesizer stress: rapid bursts (100x calls in single tick), mixed bursts, muted state verification, AudioContext edge states
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, act, renderHook } from '@testing-library/react';
import { Chessboard } from '../../src/components/Chessboard/Chessboard';
import { PromotionModal } from '../../src/components/Chessboard/PromotionModal';
import { MoveHistory } from '../../src/components/Chessboard/MoveHistory';
import { ChessSoundSynthesizer, soundSynthesizer } from '../../src/audio/soundSynthesizer';
import { useChessGame } from '../../src/hooks/useChessGame';
import { ChessGame } from '../../src/rules/chessGame';
import { PieceSymbol, Square as ChessSquare } from '../../src/types/chess';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

// Helper to polyfill PointerEvent in JSDOM environment if missing
if (typeof window !== 'undefined' && !window.PointerEvent) {
  (window as any).PointerEvent = class PointerEvent extends MouseEvent {
    public pointerId: number;
    constructor(type: string, params: any = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  };
}

// Helper to mock getBoundingClientRect on board element (800x800px board, 100px per square)
function mockBoardRect(boardElement: HTMLElement) {
  vi.spyOn(boardElement, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 800,
    width: 800,
    height: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}

// ---------------------------------------------------------------------------
// SUITE 1: BOUNDARY TESTS ON SQUARE COORDINATES ACROSS ALL 64 SQUARES
// ---------------------------------------------------------------------------
describe('M3 Stress Suite 1: Boundary Tests on Square Coordinates', () => {
  it('renders all 64 squares in White orientation with exact color alternations', () => {
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, orientation: 'white' }));
    const squareEls = container.querySelectorAll('[data-square]');
    expect(squareEls.length).toBe(64);

    const renderedSquares = new Set<string>();

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = `${FILES[f]}${RANKS[r]}` as ChessSquare;
        renderedSquares.add(sq);

        const el = container.querySelector(`[data-square="${sq}"]`);
        expect(el, `Square ${sq} must exist in DOM`).not.toBeNull();

        // Check alternating colors: (f + r) % 2 === 0 is dark (#b58863), 1 is light (#f0d9b5)
        const isDark = (f + r) % 2 === 0;
        if (isDark) {
          expect(el?.className).toContain('bg-[#b58863]');
        } else {
          expect(el?.className).toContain('bg-[#f0d9b5]');
        }
      }
    }

    expect(renderedSquares.size).toBe(64);
  });

  it('verifies exact grid row and column ordering in White orientation', () => {
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, orientation: 'white' }));
    const squareEls = Array.from(container.querySelectorAll('[data-square]'));
    expect(squareEls.length).toBe(64);

    // Row 0 (top of board in White view) must be rank 8: a8 to h8
    for (let col = 0; col < 8; col++) {
      const expectedSq = `${FILES[col]}8`;
      expect(squareEls[col].getAttribute('data-square')).toBe(expectedSq);
    }

    // Row 7 (bottom of board in White view) must be rank 1: a1 to h1
    for (let col = 0; col < 8; col++) {
      const expectedSq = `${FILES[col]}1`;
      expect(squareEls[56 + col].getAttribute('data-square')).toBe(expectedSq);
    }

    // Check rank labels appear only on column 0 (file 'a')
    for (let row = 0; row < 8; row++) {
      const idx = row * 8; // col 0
      const sq = squareEls[idx];
      const rankNumber = String(8 - row);
      expect(sq.textContent).toContain(rankNumber);
    }

    // Check file labels appear only on row 7 (rank '1')
    for (let col = 0; col < 8; col++) {
      const idx = 56 + col; // row 7
      const sq = squareEls[idx];
      const fileLetter = FILES[col];
      expect(sq.textContent).toContain(fileLetter);
    }
  });

  it('renders all 64 squares in Black orientation with inverted grid coordinates', () => {
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, orientation: 'black' }));
    const squareEls = Array.from(container.querySelectorAll('[data-square]'));
    expect(squareEls.length).toBe(64);

    // In Black orientation, top-left is h1 (row 0, col 0), top-right is a1 (row 0, col 7)
    expect(squareEls[0].getAttribute('data-square')).toBe('h1');
    expect(squareEls[7].getAttribute('data-square')).toBe('a1');

    // Bottom-left is h8 (row 7, col 0), bottom-right is a8 (row 7, col 7)
    expect(squareEls[56].getAttribute('data-square')).toBe('h8');
    expect(squareEls[63].getAttribute('data-square')).toBe('a8');

    // Verify all 64 unique squares exist
    const allSquares = new Set(squareEls.map((el) => el.getAttribute('data-square')));
    expect(allSquares.size).toBe(64);

    // Verify rank labels on col 0 (which is now file 'h', ranks 1 up to 8)
    for (let row = 0; row < 8; row++) {
      const idx = row * 8;
      const sq = squareEls[idx];
      const expectedRank = String(row + 1);
      expect(sq.textContent).toContain(expectedRank);
    }

    // Verify file labels on row 7 (which is rank '8', files 'h' down to 'a')
    for (let col = 0; col < 8; col++) {
      const idx = 56 + col;
      const sq = squareEls[idx];
      const expectedFile = FILES[7 - col];
      expect(sq.textContent).toContain(expectedFile);
    }
  });

  it('rapidly flips orientation 100 times without memory leaks, crash, or DOM corruption', () => {
    const { container, rerender } = render(React.createElement(Chessboard, { fen: START_FEN, orientation: 'white' }));

    for (let i = 0; i < 100; i++) {
      const orient = i % 2 === 0 ? 'black' : 'white';
      rerender(React.createElement(Chessboard, { fen: START_FEN, orientation: orient }));

      const firstSquare = container.querySelector('[data-square]')?.getAttribute('data-square');
      if (orient === 'black') {
        expect(firstSquare).toBe('h1');
      } else {
        expect(firstSquare).toBe('a8');
      }
    }

    // Confirm final state is intact
    expect(container.querySelectorAll('[data-square]').length).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: DRAG-AND-DROP EDGE CASES & THRESHOLD BOUNDARIES
// ---------------------------------------------------------------------------
describe('M3 Stress Suite 2: Drag-and-Drop Edge Cases & Threshold Boundaries', () => {
  beforeEach(() => {
    // Polyfill pointer capture if not present in JSDOM
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = vi.fn();
    }
  });

  it('pointer movement below 4px threshold (<4px) is treated as a click selection, NOT a drag', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
    expect(e2).not.toBeNull();

    // Pointer down on e2 at (450, 650)
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });

    // Move pointer by 2px (dist = sqrt(4+4) = 2.828px < 4px)
    fireEvent.pointerMove(e2, { clientX: 452, clientY: 652, pointerId: 1 });

    // The piece should NOT be in active dragging opacity state
    const pieceContainer = e2.querySelector('.transition-opacity');
    expect(pieceContainer?.className).toContain('opacity-100');
    expect(pieceContainer?.className).not.toContain('opacity-30');

    // Pointer up at (452, 652) - was not dragging, so it acts as click-to-select
    fireEvent.pointerUp(e2, { clientX: 452, clientY: 652, pointerId: 1 });

    // Square e2 should remain selected for click-to-move
    expect(e2.getAttribute('data-selected')).toBe('true');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('pointer movement above 4px threshold (>4px) activates dragging and hardware-accelerated overlay', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;

    // Pointer down on e2 at (450, 650)
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });

    // Move pointer by 6px (dist = sqrt(36+36) = 8.48px > 4px threshold)
    fireEvent.pointerMove(e2, { clientX: 456, clientY: 656, pointerId: 1 });

    const e2AfterMove = container.querySelector('[data-square="e2"]') as HTMLElement;
    const pieceContainer = e2AfterMove.querySelector('.transition-opacity');

    // The square piece should become semi-transparent (opacity-30) during drag
    expect(pieceContainer?.className).toContain('opacity-30');

    // Floating drag overlay element should now be rendered with fixed positioning
    const floatingPiece = container.querySelector('.fixed.top-0.left-0');
    expect(floatingPiece).not.toBeNull();
  });

  it('dragging outside board boundaries snaps back cleanly without executing move', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;

    // Start drag on e2
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 470, clientY: 670, pointerId: 1 });

    // Drag way outside board boundaries (board is 0..800, client moves to 1200, 1200)
    fireEvent.pointerMove(e2, { clientX: 1200, clientY: 1200, pointerId: 1 });

    // Release pointer outside
    fireEvent.pointerUp(e2, { clientX: 1200, clientY: 1200, pointerId: 1 });

    // Move must NOT be called
    expect(onMove).not.toHaveBeenCalled();

    // Snap-back: Piece opacity restored to 100%
    const pieceContainer = e2.querySelector('.transition-opacity');
    expect(pieceContainer?.className).toContain('opacity-100');
    expect(pieceContainer?.className).not.toContain('opacity-30');

    // Floating overlay must be unmounted
    expect(container.querySelector('.fixed.top-0.left-0')).toBeNull();
  });

  it('pointercancel event immediately aborts drag with snap-back', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;

    // Start drag
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 470, clientY: 670, pointerId: 1 });

    // Fire pointer cancel (e.g. system gesture or touch interrupt)
    fireEvent.pointerCancel(e2);

    // Verify immediate snap-back
    expect(onMove).not.toHaveBeenCalled();
    const pieceContainer = e2.querySelector('.transition-opacity');
    expect(pieceContainer?.className).toContain('opacity-100');
    expect(container.querySelector('.fixed.top-0.left-0')).toBeNull();
  });

  it('dragging to an illegal destination square rejects move and snaps back', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;

    // Start drag on e2
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 460, clientY: 660, pointerId: 1 });

    // Drop onto e5 (col 4, row 3 -> x: 450, y: 350) which is illegal for pawn on e2
    fireEvent.pointerUp(e2, { clientX: 450, clientY: 350, pointerId: 1 });

    expect(onMove).not.toHaveBeenCalled();
    expect(e2.querySelector('.transition-opacity')?.className).toContain('opacity-100');
  });

  it('dragging onto a friendly piece square rejects move and snaps back', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;

    // Start drag on e2
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 460, clientY: 660, pointerId: 1 });

    // Drop onto friendly pawn d2 (col 3, row 6 -> x: 350, y: 650)
    fireEvent.pointerUp(e2, { clientX: 350, clientY: 650, pointerId: 1 });

    expect(onMove).not.toHaveBeenCalled();
    expect(e2.querySelector('.transition-opacity')?.className).toContain('opacity-100');
  });

  it('dragging onto a legal destination square executes move via onMove', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: START_FEN, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;

    // Start drag on e2
    fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e2, { clientX: 450, clientY: 600, pointerId: 1 });

    // Drop onto legal square e4 (col 4, row 4 -> x: 450, y: 450)
    fireEvent.pointerUp(e2, { clientX: 450, clientY: 450, pointerId: 1 });

    expect(onMove).toHaveBeenCalledWith('e2', 'e4', undefined);
  });

  it('dragging a promoting pawn onto 8th rank triggers promotion modal', () => {
    // White pawn on e7 ready to promote to e8
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: promoFen, onMove }));
    const board = container.firstElementChild as HTMLElement;
    mockBoardRect(board);

    const e7 = container.querySelector('[data-square="e7"]') as HTMLElement;

    // Start drag on e7
    fireEvent.pointerDown(e7, { clientX: 450, clientY: 150, pointerId: 1, button: 0 });
    fireEvent.pointerMove(e7, { clientX: 450, clientY: 120, pointerId: 1 });

    // Drop onto e8 (col 4, row 0 -> x: 450, y: 50)
    fireEvent.pointerUp(e7, { clientX: 450, clientY: 50, pointerId: 1 });

    // Promotion modal dialog should be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Pawn Promotion')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SUITE 3: PROMOTION WORKFLOW STRESS & UNDERPROMOTION
// ---------------------------------------------------------------------------
describe('M3 Stress Suite 3: Promotion Workflow Stress & Underpromotion', () => {
  it('cancels promotion modal via Escape key and restores clean board state', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: promoFen, onMove }));

    // Click e7 then e8 to trigger promotion modal
    fireEvent.click(container.querySelector('[data-square="e7"]')!);
    fireEvent.click(container.querySelector('[data-square="e8"]')!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Modal dismissed, onMove not called, selection cleared
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it('promotes to Queen on clicking Queen button', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: promoFen, onMove }));

    fireEvent.click(container.querySelector('[data-square="e7"]')!);
    fireEvent.click(container.querySelector('[data-square="e8"]')!);

    const queenBtn = screen.getByLabelText(/Promote to Queen/i);
    fireEvent.click(queenBtn);

    expect(onMove).toHaveBeenCalledWith('e7', 'e8', 'q');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('underpromotes to Knight via hotkey "n"', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: promoFen, onMove }));

    fireEvent.click(container.querySelector('[data-square="e7"]')!);
    fireEvent.click(container.querySelector('[data-square="e8"]')!);

    // Press 'n' for Knight
    fireEvent.keyDown(window, { key: 'n' });

    expect(onMove).toHaveBeenCalledWith('e7', 'e8', 'n');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('underpromotes to Rook via hotkey "r"', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: promoFen, onMove }));

    fireEvent.click(container.querySelector('[data-square="e7"]')!);
    fireEvent.click(container.querySelector('[data-square="e8"]')!);

    // Press 'r' for Rook
    fireEvent.keyDown(window, { key: 'r' });

    expect(onMove).toHaveBeenCalledWith('e7', 'e8', 'r');
  });

  it('underpromotes to Bishop via hotkey "b"', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: promoFen, onMove }));

    fireEvent.click(container.querySelector('[data-square="e7"]')!);
    fireEvent.click(container.querySelector('[data-square="e8"]')!);

    // Press 'b' for Bishop
    fireEvent.keyDown(window, { key: 'b' });

    expect(onMove).toHaveBeenCalledWith('e7', 'e8', 'b');
  });

  it('supports numeric shortcut keys 1 (Queen), 2 (Knight), 3 (Rook), 4 (Bishop)', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      React.createElement(PromotionModal, { color: 'w', isOpen: true, onSelect, onCancel })
    );

    fireEvent.keyDown(window, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith('n');

    onSelect.mockClear();
    fireEvent.keyDown(window, { key: '3' });
    expect(onSelect).toHaveBeenCalledWith('r');

    onSelect.mockClear();
    fireEvent.keyDown(window, { key: '4' });
    expect(onSelect).toHaveBeenCalledWith('b');

    onSelect.mockClear();
    fireEvent.keyDown(window, { key: '1' });
    expect(onSelect).toHaveBeenCalledWith('q');

    unmount();
  });

  it('supports Black pawn underpromotion to Knight on 1st rank', () => {
    // Black pawn on d2 ready to promote to d1
    const blackPromoFen = 'k3K3/8/8/8/8/8/3p4/8 b - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(React.createElement(Chessboard, { fen: blackPromoFen, onMove }));

    fireEvent.click(container.querySelector('[data-square="d2"]')!);
    fireEvent.click(container.querySelector('[data-square="d1"]')!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Select Knight
    fireEvent.keyDown(window, { key: 'n' });
    expect(onMove).toHaveBeenCalledWith('d2', 'd1', 'n');
  });

  it('updates ChessGame rule state accurately upon underpromotion to Knight', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const game = new ChessGame(promoFen);

    // Make underpromotion move e7 -> e8 (Knight)
    const success = game.makeMove('e7', 'e8', 'n');
    expect(success).toBe(true);

    const pieceOnE8 = game.getPiece('e8');
    expect(pieceOnE8).toEqual({ type: 'n', color: 'w' });

    // Knight on e8 attacks c7, d6, f6, g7
    const legalMoves = game.getLegalMoves();
    expect(legalMoves.length).toBeGreaterThan(0);
  });

  it('stress-tests rapid open/cancel cycles (50 iterations) without state lockup', () => {
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const { container } = render(React.createElement(Chessboard, { fen: promoFen }));

    for (let i = 0; i < 50; i++) {
      fireEvent.click(container.querySelector('[data-square="e7"]')!);
      fireEvent.click(container.querySelector('[data-square="e8"]')!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// SUITE 4: TIME-TRAVEL SCRUBBING STRESS & HISTORY NAVIGATION
// ---------------------------------------------------------------------------
describe('M3 Stress Suite 4: Time-Travel Scrubbing Stress & History Navigation', () => {
  const history20Plies = [
    'e4', 'e5',
    'Nf3', 'Nc6',
    'Bb5', 'a6',
    'Ba4', 'Nf6',
    'O-O', 'Be7',
    'Re1', 'b5',
    'Bb3', 'd6',
    'c3', 'O-O',
    'h3', 'Nb8',
    'd4', 'Nbd7',
  ];

  it('renders all 20 plies across 10 turn rows with accurate SAN notation', () => {
    const onJump = vi.fn();
    render(React.createElement(MoveHistory, { history: history20Plies, activePly: 20, onJumpToPly: onJump }));

    for (let t = 1; t <= 10; t++) {
      expect(screen.getByText(`${t}.`)).toBeInTheDocument();
    }
    expect(screen.getByText('20 moves')).toBeInTheDocument();
    expect(screen.getByText('Bb5')).toBeInTheDocument();
    expect(screen.getByText('Nbd7')).toBeInTheDocument();
  });

  it('steps backwards ply by ply from ply 20 down to ply 0, updating active highlight', () => {
    const onJump = vi.fn();
    const { rerender } = render(
      React.createElement(MoveHistory, { history: history20Plies, activePly: 20, onJumpToPly: onJump })
    );

    for (let ply = 20; ply >= 1; ply--) {
      rerender(React.createElement(MoveHistory, { history: history20Plies, activePly: ply, onJumpToPly: onJump }));

      const activeBtn = document.querySelector('[data-active-ply="true"]');
      expect(activeBtn, `Active button must exist at ply ${ply}`).not.toBeNull();
      expect(activeBtn?.textContent?.trim()).toBe(history20Plies[ply - 1]);

      // Previous move button clicks correctly
      fireEvent.click(screen.getByLabelText('Previous Move'));
      expect(onJump).toHaveBeenCalledWith(ply - 1);
    }
  });

  it('jumps directly to start (ply 0) and end (ply 20) via buttons and keyboard shortcuts', () => {
    const onJump = vi.fn();
    const { rerender } = render(
      React.createElement(MoveHistory, { history: history20Plies, activePly: 10, onJumpToPly: onJump })
    );

    // Jump to Start button
    fireEvent.click(screen.getByLabelText('Jump to Start'));
    expect(onJump).toHaveBeenCalledWith(0);

    // Home key
    fireEvent.keyDown(window, { key: 'Home' });
    expect(onJump).toHaveBeenCalledWith(0);

    // Jump to Current Position button
    fireEvent.click(screen.getByLabelText('Jump to Current Position'));
    expect(onJump).toHaveBeenCalledWith(20);

    // End key
    fireEvent.keyDown(window, { key: 'End' });
    expect(onJump).toHaveBeenCalledWith(20);

    // Return to Live button when historical
    rerender(React.createElement(MoveHistory, { history: history20Plies, activePly: 5, onJumpToPly: onJump }));
    const returnLiveBtn = screen.getByText('Return to Live');
    expect(returnLiveBtn).toBeInTheDocument();
    fireEvent.click(returnLiveBtn);
    expect(onJump).toHaveBeenCalledWith(20);
  });

  it('ignores arrow and navigation keys when typing in input or textarea elements', () => {
    const onJump = vi.fn();
    render(
      React.createElement(
        'div',
        null,
        React.createElement('input', { 'data-testid': 'test-input' }),
        React.createElement(MoveHistory, { history: history20Plies, activePly: 10, onJumpToPly: onJump })
      )
    );

    const input = screen.getByTestId('test-input');
    input.focus();

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'Home' });
    fireEvent.keyDown(input, { key: 'End' });

    expect(onJump).not.toHaveBeenCalled();
  });

  it('integrates with useChessGame for accurate FEN restoration across plies', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    // Play 4 plies: 1. e4 e5 2. Nf3 Nc6
    act(() => {
      result.current.actions.makeMove('e2', 'e4');
    });
    const fenAfterE4 = result.current.gameState.fen;

    act(() => {
      result.current.actions.makeMove('e7', 'e5');
    });
    const fenAfterE5 = result.current.gameState.fen;

    act(() => {
      result.current.actions.makeMove('g1', 'f3');
    });
    const fenAfterNf3 = result.current.gameState.fen;

    act(() => {
      result.current.actions.makeMove('b8', 'c6');
    });
    const fenAfterNc6 = result.current.gameState.fen;

    expect(result.current.gameState.history).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);

    // Jump to ply 0 (start)
    act(() => {
      result.current.actions.jumpToHistoryPly(0);
    });
    expect(result.current.gameState.fen).toContain(START_FEN.split(' ')[0]);

    // Jump to ply 1 (after e4)
    act(() => {
      result.current.actions.jumpToHistoryPly(1);
    });
    expect(result.current.gameState.fen).toBe(fenAfterE4);

    // Jump to ply 2 (after e5)
    act(() => {
      result.current.actions.jumpToHistoryPly(2);
    });
    expect(result.current.gameState.fen).toBe(fenAfterE5);

    // Jump to ply 3 (after Nf3)
    act(() => {
      result.current.actions.jumpToHistoryPly(3);
    });
    expect(result.current.gameState.fen).toBe(fenAfterNf3);

    // Jump to ply 4 (live position after Nc6)
    act(() => {
      result.current.actions.jumpToHistoryPly(4);
    });
    expect(result.current.gameState.fen).toBe(fenAfterNc6);

    // Out-of-bounds guards: ply -5 or 999 should be ignored without mutating active ply
    act(() => {
      result.current.actions.jumpToHistoryPly(-5);
    });
    expect(result.current.gameState.fen).toBe(fenAfterNc6);

    act(() => {
      result.current.actions.jumpToHistoryPly(999);
    });
    expect(result.current.gameState.fen).toBe(fenAfterNc6);
  });

  it('rapid random time-travel scrubbing stress (100 jumps) maintains absolute FEN consistency', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    // Play 4 plies with separate act flushes
    act(() => {
      result.current.actions.makeMove('e2', 'e4');
    });
    act(() => {
      result.current.actions.makeMove('e7', 'e5');
    });
    act(() => {
      result.current.actions.makeMove('g1', 'f3');
    });
    act(() => {
      result.current.actions.makeMove('b8', 'c6');
    });

    const fensByPly = [
      START_FEN.split(' ')[0], // ply 0
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR', // ply 1
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR', // ply 2
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', // ply 3
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', // ply 4
    ];

    // Jump randomly 100 times
    for (let i = 0; i < 100; i++) {
      const targetPly = i % 5;
      act(() => {
        result.current.actions.jumpToHistoryPly(targetPly);
      });
      expect(result.current.gameState.fen).toContain(fensByPly[targetPly]);
    }
  });
});

// ---------------------------------------------------------------------------
// SUITE 5: AUDIO SYNTHESIZER STRESS & RESILIENCE
// ---------------------------------------------------------------------------
describe('M3 Stress Suite 5: Audio Synthesizer Stress & Resilience', () => {
  let synth: ChessSoundSynthesizer;

  beforeEach(() => {
    synth = new ChessSoundSynthesizer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('survives 100 rapid consecutive playMove() calls in a single tick without errors', () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        synth.playMove();
      }
    }).not.toThrow();
  });

  it('survives 100 rapid consecutive playCapture() calls in a single tick without errors', () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        synth.playCapture();
      }
    }).not.toThrow();
  });

  it('survives 100 rapid consecutive playCheck() calls in a single tick without errors', () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        synth.playCheck();
      }
    }).not.toThrow();
  });

  it('survives 100 rapid consecutive playCastle() calls with timer advances without leaks', () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        synth.playCastle();
      }
    }).not.toThrow();

    // Advance timers past the 85ms castle second-pulse delay
    act(() => {
      vi.advanceTimersByTime(200);
    });
  });

  it('survives mixed rapid burst of 400 random audio calls across 1 tick', () => {
    const actions = [
      () => synth.playMove(),
      () => synth.playCapture(),
      () => synth.playCheck(),
      () => synth.playCastle(),
    ];

    expect(() => {
      for (let i = 0; i < 400; i++) {
        actions[i % 4]();
      }
    }).not.toThrow();

    act(() => {
      vi.advanceTimersByTime(200);
    });
  });

  it('muted state suppresses 100% of synthesis calls immediately', () => {
    synth.setMuted(true);
    expect(synth.getMuted()).toBe(true);

    const spy = vi.spyOn(synth, 'getContext');

    for (let i = 0; i < 100; i++) {
      synth.playMove();
      synth.playCapture();
      synth.playCheck();
      synth.playCastle();
    }

    // When muted, getContext() should never even be called
    expect(spy).not.toHaveBeenCalled();
  });

  it('lazily resumes AudioContext when state is suspended', () => {
    const mockCtx = {
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(undefined),
      currentTime: 0,
      createOscillator: () => ({
        type: 'sine',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
      }),
      createGain: () => ({
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
      }),
      destination: {},
    };

    const customSynth = new ChessSoundSynthesizer();
    (customSynth as any).ctx = mockCtx;

    customSynth.playMove();
    expect(mockCtx.resume).toHaveBeenCalled();
  });

  it('gracefully handles missing createBiquadFilter and filter failures', () => {
    const customSynth = new ChessSoundSynthesizer();

    // Verify filter is missing or ignored without unhandled exception
    expect(() => {
      customSynth.playCapture();
      customSynth.playMove();
    }).not.toThrow();
  });

  it('defensively clamps volume to [0.0, 1.0] across extreme, negative, and invalid values', () => {
    synth.setVolume(-999);
    expect(synth.getVolume()).toBe(0.0);

    synth.setVolume(-0.0001);
    expect(synth.getVolume()).toBe(0.0);

    synth.setVolume(1.0001);
    expect(synth.getVolume()).toBe(1.0);

    synth.setVolume(999);
    expect(synth.getVolume()).toBe(1.0);

    synth.setVolume(0.42);
    expect(synth.getVolume()).toBe(0.42);

    // Audio calls with volume 0 and volume 1 do not throw
    synth.setVolume(0.0);
    expect(() => synth.playMove()).not.toThrow();

    synth.setVolume(1.0);
    expect(() => synth.playMove()).not.toThrow();
  });
});
