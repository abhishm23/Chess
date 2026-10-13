import { describe, it, expect, vi } from 'vitest';
import { ChessGame } from '../../src/rules/chessGame';
import { GameModeManager } from '../../src/rules/gameModeManager';
import {
  calculateSquareControl,
  calculateDetailedSquareControl,
  findPinnedPieces,
  squareToIndex,
  indexToSquare,
} from '../../src/rules/squareControl';

describe('Chess Rules Edge-Cases Test Suite', () => {
  // --------------------------------------------------------------------------
  // 1. Horizontal En Passant Discovered Check
  // --------------------------------------------------------------------------
  describe('Horizontal En Passant Discovered Check', () => {
    it('disallows en passant capture when it opens a horizontal attack ray to the King', () => {
      // White King on a5, White Pawn on e5, Black Pawn on d5, Black Rook on h5, Black King on e8.
      // Black just moved d7-d5, creating en passant opportunity at d6.
      const fen = '4k3/8/8/K2pP2r/8/8/8/8 w - d6 0 1';
      const game = new ChessGame(fen);

      const legalMoves = game.getLegalMoves();
      const hasEpCapture = legalMoves.some(
        (m) => m.from === 'e5' && m.to === 'd6'
      );

      // exd6 e.p. would simultaneously remove e5 and d5, exposing Ka5 to Rh5
      expect(hasEpCapture).toBe(false);
      expect(game.isLegalMove('e5', 'd6')).toBe(false);
      expect(game.makeMove('e5', 'd6')).toBe(false);
    });

    it('allows en passant capture when the King is safely off the attack rank', () => {
      // White King on a2 instead of a5, Black King on e8.
      const fen = '4k3/8/8/4Pp1r/8/8/K7/8 w - f6 0 1';
      const game = new ChessGame(fen);

      expect(game.isLegalMove('e5', 'f6')).toBe(true);
      const success = game.makeMove('e5', 'f6');
      expect(success).toBe(true);
      // Verify Black pawn on f5 was captured and removed
      expect(game.getPiece('f5')).toBeNull();
      expect(game.getPiece('f6')?.type).toBe('p');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Castling Rights & Restrictions
  // --------------------------------------------------------------------------
  describe('Castling Rights & Restrictions', () => {
    it('forbids castling kingside through an attacked transit square (f1)', () => {
      // Black Bishop on c4 covers f1 and b1.
      const fen = 'r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1';
      const game = new ChessGame(fen);

      // Kingside castling (e1 -> f1 -> g1) passes through attacked f1
      expect(game.isLegalMove('e1', 'g1')).toBe(false);
      expect(game.makeMove('e1', 'g1')).toBe(false);
    });

    it('permits castling queenside when only b1 is attacked (King transits safe d1 to c1)', () => {
      // Under FIDE Art. 3.8.2, only d1 and c1 must be safe for the King. b1 may be attacked!
      const fen = 'r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1';
      const game = new ChessGame(fen);

      expect(game.isLegalMove('e1', 'c1')).toBe(true);
      const success = game.makeMove('e1', 'c1');
      expect(success).toBe(true);
      expect(game.getPiece('c1')?.type).toBe('k');
      expect(game.getPiece('d1')?.type).toBe('r');
    });

    it('forbids all castling when the King is in check', () => {
      // Black Rook on e4 checks White King on e1
      const fen = 'r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1';
      const game = new ChessGame(fen);

      expect(game.isCheck()).toBe(true);
      expect(game.isLegalMove('e1', 'g1')).toBe(false);
      expect(game.isLegalMove('e1', 'c1')).toBe(false);
    });

    it('permanently revokes both castling rights when the King moves and returns', () => {
      const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');

      // 1. King moves e1 -> e2
      expect(game.makeMove('e1', 'e2')).toBe(true);
      // Black makes a non-interfering move
      expect(game.makeMove('a8', 'b8')).toBe(true);
      // 2. King returns e2 -> e1
      expect(game.makeMove('e2', 'e1')).toBe(true);
      expect(game.makeMove('b8', 'a8')).toBe(true);

      // Castling rights should now be permanently lost for White
      expect(game.isLegalMove('e1', 'g1')).toBe(false);
      expect(game.isLegalMove('e1', 'c1')).toBe(false);
      const castlingField = game.getFen().split(' ')[2];
      expect(castlingField).not.toContain('K'); // White has permanently lost kingside rights
      expect(castlingField).not.toContain('Q'); // White has permanently lost queenside rights
      expect(castlingField).toBe('k');
    });

    it('revokes kingside castling right when kingside rook moves', () => {
      const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');

      // Rook moves h1 -> g1, then returns
      game.makeMove('h1', 'g1');
      game.makeMove('a8', 'b8');
      game.makeMove('g1', 'h1');
      game.makeMove('b8', 'a8');

      // Queenside castling remains legal, kingside is revoked
      expect(game.isLegalMove('e1', 'g1')).toBe(false);
      expect(game.isLegalMove('e1', 'c1')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Threefold Repetition Position Equivalence
  // --------------------------------------------------------------------------
  describe('Threefold Repetition Position Equivalence', () => {
    it('detects threefold repetition when identical moves occur three times', () => {
      const game = new ChessGame();

      // Cycle Knights back and forth 3 times
      const moves: [string, string][] = [
        ['g1', 'f3'], ['g8', 'f6'],
        ['f3', 'g1'], ['f6', 'g8'], // 2nd occurrence of initial board
        ['g1', 'f3'], ['g8', 'f6'],
        ['f3', 'g1'], ['f6', 'g8'], // 3rd occurrence of initial board
      ];

      for (const [from, to] of moves) {
        expect(game.makeMove(from as any, to as any)).toBe(true);
      }

      expect(game.isThreefoldRepetition()).toBe(true);
      expect(game.isDraw()).toBe(true);
    });

    it('does NOT treat identical piece placement as repetition if castling rights differ', () => {
      const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');

      // White King and Black King move and return
      expect(game.makeMove('e1', 'e2')).toBe(true);
      expect(game.makeMove('e8', 'e7')).toBe(true);
      expect(game.makeMove('e2', 'e1')).toBe(true);
      expect(game.makeMove('e7', 'e8')).toBe(true);

      // Board has identical pieces on identical squares, but castling rights are gone (- -)
      // This must NOT count as repetition of Position A
      expect(game.isThreefoldRepetition()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. 50-Move Rule Draw & Reset
  // --------------------------------------------------------------------------
  describe('50-Move Rule Draw & Reset', () => {
    it('declares draw when halfmove clock reaches 100 on a quiet move', () => {
      // Halfmove clock at 99
      const fen = '8/8/8/4k3/8/8/4K3/4R3 w - - 99 50';
      const game = new ChessGame(fen);

      expect(game.isDraw()).toBe(false);
      // Quiet rook move e1 -> d1 reaches 100 half-moves
      expect(game.makeMove('e1', 'd1')).toBe(true);

      expect(game.isDraw()).toBe(true);
      expect(game.getDrawReason()).toBe('50-move');
    });

    it('resets halfmove clock to 0 upon pawn advance, preventing draw', () => {
      const fen = '8/8/8/4k3/8/4P3/4K3/8 w - - 99 50';
      const game = new ChessGame(fen);

      // Pawn advance resets counter
      expect(game.makeMove('e3', 'e4')).toBe(true);
      expect(game.isDraw()).toBe(false);
      expect(game.getFen()).toContain(' 0 50');
    });

    it('resets halfmove clock to 0 upon piece capture, preventing draw', () => {
      // King on d2 so Rook on e1 has clear path to capture e4
      const fen = '8/8/8/4k3/4p3/8/3K4/4R3 w - - 99 50';
      const game = new ChessGame(fen);

      // Rook captures pawn on e4
      expect(game.makeMove('e1', 'e4')).toBe(true);
      expect(game.isDraw()).toBe(false);
      expect(game.getFen()).toContain(' 0 50');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Pawn Underpromotions
  // --------------------------------------------------------------------------
  describe('Pawn Underpromotions', () => {
    it('supports all four promotion piece types (Q, R, B, N)', () => {
      const fen = '8/3P4/8/8/8/4k3/8/4K3 w - - 0 1';
      const game = new ChessGame(fen);

      const moves = game.getLegalMoves().filter((m) => m.from === 'd7' && m.to === 'd8');
      const promoTypes = moves.map((m) => m.promotion).sort();
      expect(promoTypes).toEqual(['b', 'n', 'q', 'r']);
    });

    it('executes Knight underpromotion to fork King and Queen', () => {
      // White Pawn on d7, King on h2. Black King on b7, Black Queen on f7.
      // d8=N+ checks King on b7 (dx=2, dy=1) AND attacks Queen on f7 (dx=2, dy=1)
      const fen = '8/1k1P1q2/8/8/8/8/7K/8 w - - 0 1';
      const game = new ChessGame(fen);

      // Promoting to Knight gives check
      expect(game.makeMove('d7', 'd8', 'n')).toBe(true);
      expect(game.isCheck()).toBe(true);
      expect(game.getPiece('d8')?.type).toBe('n');
    });

    it('verifies Saavedra style underpromotion to avoid stalemate defense', () => {
      // White pawn on c7, Black rook on e4. If c8=Q, Rc4+ leads to stalemate.
      // Promoting to Rook c8=R is valid and avoids queen stalemate traps.
      const fen = '8/2P5/8/8/4r3/8/8/1K1k4 w - - 0 1';
      const game = new ChessGame(fen);

      expect(game.isLegalMove('c7', 'c8', 'r')).toBe(true);
      expect(game.makeMove('c7', 'c8', 'r')).toBe(true);
      expect(game.getPiece('c8')?.type).toBe('r');
      expect(game.isStalemate()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. GameModeManager Mid-Game State Preservation
  // --------------------------------------------------------------------------
  describe('GameModeManager Mid-Game State Preservation', () => {
    it('seamlessly switches modes mid-game without resetting board, history, or turn', () => {
      const game = new ChessGame();
      const modeManager = new GameModeManager('normal');

      // Play 3 moves in Normal mode
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      game.makeMove('g1', 'f3');

      const fenBefore = game.getFen();
      const historyBefore = [...game.getHistory()];
      const turnBefore = game.getTurn();
      const isCheckBefore = game.isCheck();

      // Listen for transition
      const listener = vi.fn();
      const unsubscribe = modeManager.subscribe(listener);

      // Switch to Smart Mode
      expect(modeManager.setMode('smart')).toBe(true);
      expect(modeManager.getMode()).toBe('smart');
      expect(modeManager.isEngineEnabled()).toBe(true);
      expect(modeManager.getAnalysisDepth()).toBe(12);
      expect(modeManager.shouldShowThreats()).toBe(true);

      // Verify game state is completely untouched
      expect(game.getFen()).toBe(fenBefore);
      expect(game.getHistory()).toEqual(historyBefore);
      expect(game.getTurn()).toBe(turnBefore);
      expect(game.isCheck()).toBe(isCheckBefore);

      // Make next move in Smart Mode
      expect(game.makeMove('b8', 'c6')).toBe(true);
      expect(game.getHistory().length).toBe(historyBefore.length + 1);

      // Switch to Expert Mode
      expect(modeManager.setMode('expert')).toBe(true);
      expect(modeManager.getMode()).toBe('expert');
      expect(modeManager.getAnalysisDepth()).toBe(18);
      expect(modeManager.shouldGenerateScenarioTree()).toBe(true);
      expect(modeManager.shouldShowHeatmap()).toBe(true);

      // Listener was invoked for each transition
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
        previousMode: 'normal',
        currentMode: 'smart',
      }));
      expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
        previousMode: 'smart',
        currentMode: 'expert',
      }));

      // No-op when setting identical mode
      expect(modeManager.setMode('expert')).toBe(false);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Square Control & Pin Detection Verification
  // --------------------------------------------------------------------------
  describe('Square Control & Pin Detection Verification', () => {
    it('computes accurate 64-square attack matrix and coordinates', () => {
      expect(squareToIndex('a1')).toBe(0);
      expect(squareToIndex('h1')).toBe(7);
      expect(squareToIndex('a8')).toBe(56);
      expect(squareToIndex('h8')).toBe(63);
      expect(indexToSquare(0)).toBe('a1');
      expect(indexToSquare(63)).toBe('h8');

      // Initial position
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const control = calculateSquareControl(initialFen);
      expect(control.white.length).toBe(64);
      expect(control.black.length).toBe(64);
      expect(control.differential.length).toBe(64);

      // White Knight attacks c3, Black attacks c6
      expect(control.white[squareToIndex('c3')]).toBeGreaterThan(0);
      expect(control.black[squareToIndex('c6')]).toBeGreaterThan(0);

      // Detailed square control
      const detailed = calculateDetailedSquareControl(initialFen);
      expect(detailed.length).toBe(64);
      const c3Detail = detailed[squareToIndex('c3')];
      expect(c3Detail.whiteCount).toBeGreaterThan(0);
      expect(c3Detail.status).toBe('firmly_white');
    });

    it('detects absolute pins against the King', () => {
      // White King on e1, White Knight on e2, Black Rook on e8 (Knight pinned to King), Black King on a8
      const fen = 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1';
      const pins = findPinnedPieces(fen, 'w');
      expect(pins.length).toBe(1);
      expect(pins[0].pinnedSquare).toBe('e2');
      expect(pins[0].pinnerSquare).toBe('e8');
      expect(pins[0].targetSquare).toBe('e1');
      expect(pins[0].pinType).toBe('absolute');
    });

    it('pinned piece still exerts valid square control under FIDE Art. 3.1', () => {
      // White King on e1, White Bishop on e2, Black Rook on e8, Black King on a8.
      // Bishop on e2 is pinned, but still controls d3 and f3!
      const fen = 'k3r3/8/8/8/8/8/4B3/4K3 w - - 0 1';
      const control = calculateSquareControl(fen);
      // d3 and f3 should have White control count >= 1 from Bishop on e2
      expect(control.white[squareToIndex('d3')]).toBeGreaterThanOrEqual(1);
      expect(control.white[squareToIndex('f3')]).toBeGreaterThanOrEqual(1);
    });

    it('non-destructively simulates moves via simulateMove', () => {
      const game = new ChessGame();
      const fenBefore = game.getFen();

      const sim = game.simulateMove('e2', 'e4');
      expect(sim).not.toBeNull();
      expect(sim?.valid).toBe(true);
      expect(sim?.san).toBe('e4');
      expect(sim?.fen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq');

      // Actual game state is unchanged
      expect(game.getFen()).toBe(fenBefore);
      expect(game.getTurn()).toBe('w');
      expect(game.getHistory().length).toBe(0);
    });

    it('supports undo and redo stacks reliably', () => {
      const game = new ChessGame();
      expect(game.canUndo()).toBe(false);
      expect(game.canRedo()).toBe(false);

      game.makeMove('e2', 'e4');
      expect(game.canUndo()).toBe(true);
      expect(game.canRedo()).toBe(false);
      expect(game.getTurn()).toBe('b');

      expect(game.undo()).toBe(true);
      expect(game.getTurn()).toBe('w');
      expect(game.canRedo()).toBe(true);

      expect(game.redo()).toBe(true);
      expect(game.getTurn()).toBe('b');
      expect(game.canUndo()).toBe(true);
    });
  });
});
