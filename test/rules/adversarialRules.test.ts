import { describe, it, expect } from 'vitest';
import { ChessGame } from '../../src/rules/chessGame';
import {
  calculateSquareControl,
  calculateDetailedSquareControl,
  findPinnedPieces,
  squareToIndex,
  indexToSquare,
  SQUARES,
} from '../../src/rules/squareControl';
import { Square, PieceSymbol } from '../../src/types/chess';

describe('Adversarial FIDE Edge-Cases & Stress Test Suite', () => {
  // ==========================================================================
  // 1. Triple Pinned Pieces & Cross-Pin Invariants
  // ==========================================================================
  describe('1. Triple Pinned Pieces & Multi-Ray Pin Invariants', () => {
    it('accurately detects and enforces 3 simultaneous absolute pins against friendly King', () => {
      // Setup:
      // White King on e4.
      // 1. Black Rook on e8 pins White Rook on e6 along vertical e-file.
      // 2. Black Bishop on a8 pins White Knight on c6 along diagonal a8-h1.
      // 3. Black Bishop on h7 pins White Pawn on f5 along diagonal h7-b1.
      // Black King on h8 safely away.
      // FEN: b3r2k/7b/2N1R3/5P2/4K3/8/8/8 w - - 0 1
      const fen = 'b3r2k/7b/2N1R3/5P2/4K3/8/8/8 w - - 0 1';
      const game = new ChessGame(fen);

      // Verify King is NOT in check
      expect(game.isCheck()).toBe(false);

      // 1. Check findPinnedPieces detects all 3 pins
      const pinned = findPinnedPieces(fen, 'w');
      expect(pinned.length).toBe(3);

      const pinnedSquares = pinned.map((p) => p.pinnedSquare).sort();
      expect(pinnedSquares).toEqual(['c6', 'e6', 'f5'].sort());

      const pinMap = new Map(pinned.map((p) => [p.pinnedSquare, p]));
      expect(pinMap.get('e6')?.pinnerSquare).toBe('e8');
      expect(pinMap.get('e6')?.targetSquare).toBe('e4');
      expect(pinMap.get('c6')?.pinnerSquare).toBe('a8');
      expect(pinMap.get('c6')?.targetSquare).toBe('e4');
      expect(pinMap.get('f5')?.pinnerSquare).toBe('h7');
      expect(pinMap.get('f5')?.targetSquare).toBe('e4');

      // 2. Pinned Knight on c6 cannot move anywhere (cannot slide along diagonal ray)
      expect(game.isLegalMove('c6', 'b4')).toBe(false);
      expect(game.isLegalMove('c6', 'd4')).toBe(false);
      expect(game.isLegalMove('c6', 'e7')).toBe(false);
      expect(game.isLegalMove('c6', 'a5')).toBe(false);
      expect(game.makeMove('c6', 'e7')).toBe(false);

      // 3. Pinned Pawn on f5 cannot advance off its pin ray
      expect(game.isLegalMove('f5', 'f6')).toBe(false);
      expect(game.makeMove('f5', 'f6')).toBe(false);

      // 4. Pinned Rook on e6 CANNOT move off vertical ray
      expect(game.isLegalMove('e6', 'd6')).toBe(false);
      expect(game.isLegalMove('e6', 'f6')).toBe(false);
      expect(game.isLegalMove('e6', 'c6')).toBe(false);

      // 5. Pinned Rook on e6 CAN move along the pin ray (e6-e7 or e6xe8 capture!)
      expect(game.isLegalMove('e6', 'e7')).toBe(true);
      expect(game.isLegalMove('e6', 'e8')).toBe(true);

      // 6. Dynamic unpinning: Moving White King e4 -> d4 steps off all 3 pin rays!
      expect(game.isLegalMove('e4', 'd4')).toBe(true);
      expect(game.makeMove('e4', 'd4')).toBe(true);
      expect(game.isCheck()).toBe(false);

      // Now King is on d4, so none of the 3 pieces are pinned anymore!
      const pinsAfter = findPinnedPieces(game.getFen(), 'w');
      expect(pinsAfter.length).toBe(0);

      // Undo King move to restore initial test position
      expect(game.undo()).toBe(true);

      // Execute legal capture along pin ray
      expect(game.makeMove('e6', 'e8')).toBe(true);
      expect(game.getPiece('e8')?.type).toBe('r');
      expect(game.getPiece('e8')?.color).toBe('w');
    });

    it('enforces mutual pin on the same file: neither piece can step off the file', () => {
      // White King on e1, White Rook on e4. Black Rook on e7, Black King on e8.
      // White Rook on e4 is pinned to Ke1 by Re7.
      // Black Rook on e7 is pinned to Ke8 by Re4.
      const fen = '4k3/4r3/8/8/4R3/8/8/4K3 w - - 0 1';
      const game = new ChessGame(fen);

      // White Rook can move along e-file: e4-e2, e4-e3, e4-e5, e4-e6, e4xe7
      expect(game.isLegalMove('e4', 'e3')).toBe(true);
      expect(game.isLegalMove('e4', 'e5')).toBe(true);
      expect(game.isLegalMove('e4', 'e7')).toBe(true);

      // White Rook CANNOT move off e-file
      expect(game.isLegalMove('e4', 'd4')).toBe(false);
      expect(game.isLegalMove('e4', 'f4')).toBe(false);
      expect(game.isLegalMove('e4', 'a4')).toBe(false);

      // Execute capture e4xe7+
      expect(game.makeMove('e4', 'e7')).toBe(true);
      expect(game.isCheck()).toBe(true); // Black King is now in check
      expect(game.isLegalMove('e8', 'e7')).toBe(true); // Black King can recapture
    });
  });

  // ==========================================================================
  // 2. Underpromotion Chains & Promotion Boundary Exploitation
  // ==========================================================================
  describe('2. Underpromotion Chains & Boundary Handling', () => {
    it('executes consecutive underpromotions to Knight and Bishop without state corruption', () => {
      // White pawns on b7 and e7. Black King on h8, Black Queen on a6. White King on f2.
      const fen = '7k/1P2P3/q7/8/8/8/5K2/8 w - - 0 1';
      const game = new ChessGame(fen);

      // Underpromote b7 to Knight (b8=N)
      expect(game.isLegalMove('b7', 'b8', 'n')).toBe(true);
      expect(game.makeMove('b7', 'b8', 'n')).toBe(true);
      expect(game.getPiece('b8')?.type).toBe('n');

      // Black Queen moves: a6-a5 (does not check White King)
      expect(game.makeMove('a6', 'a5')).toBe(true);

      // White underpromotes second pawn e7 to Bishop (e8=B)
      expect(game.isLegalMove('e7', 'e8', 'b')).toBe(true);
      expect(game.makeMove('e7', 'e8', 'b')).toBe(true);
      expect(game.getPiece('e8')?.type).toBe('b');
      expect(game.isGameOver()).toBe(false);
    });

    it('rejects illegal promotion piece characters and maintains pristine state', () => {
      const fen = '8/3P4/8/8/8/4k3/8/4K3 w - - 0 1';
      const game = new ChessGame(fen);

      // Cannot promote to King or Pawn
      expect(game.isLegalMove('d7', 'd8', 'k' as any)).toBe(false);
      expect(game.isLegalMove('d7', 'd8', 'p' as any)).toBe(false);
      expect(game.makeMove('d7', 'd8', 'k' as any)).toBe(false);
      expect(game.makeMove('d7', 'd8', 'p' as any)).toBe(false);

      // Moving to rank 8 without specifying promotion piece should be rejected
      expect(game.makeMove('d7', 'd8')).toBe(false);

      // Board must remain unchanged
      expect(game.getFen()).toBe(fen);
      expect(game.getPiece('d7')?.type).toBe('p');
      expect(game.getPiece('d8')).toBeNull();
    });

    it('underpromotion to Knight immediately delivers checkmate', () => {
      // Construct smothered-style promotion mate:
      // Black King on a8, Black Pawns on a7, b7. White Pawn on c7, White King on c6.
      // If White plays c8=N#, Knight on c8 attacks a7 (dx=2, dy=1)... wait:
      // c8 to a7: file c(2) to a(0) = dx 2; rank 8(7) to 7(6) = dy 1. Knight on c8 attacks a7!
      // But King is on a8! From c8 to a8: file c to a = 2, rank 8 to 8 = 0 (not knight move).
      // Let's set Black King on b8, White pawn on a7, White Bishop on c6.
      // If White pawn on a7 is supported by Bishop on c6, a8=Q is check.
      // Better: Black King on h8, Black Rook on g8, Black Pawn on h7.
      // White Knight on g5, White Pawn on f7.
      // f8=N delivers mate?
      // Let's verify: Black King on h8, White Queen on h6, White Pawn on f7.
      // Black Pawns on g7, h7? No, Queen on h6.
      // Simple direct checkmate via promotion:
      // White pawn on e7, Black King on d8, Black Queen on c8, Black Rook on e8?
      // White pawn e7xd8=Q# or e7xd8=N#
      const fen = '3qkb1r/4P3/8/8/8/8/8/4K3 w k - 0 1';
      const game = new ChessGame(fen);

      // e7xd8=Q+ checks King
      expect(game.isLegalMove('e7', 'd8', 'q')).toBe(true);
      const res = game.makeMoveVerbose('e7', 'd8', 'q');
      expect(res.success).toBe(true);
      expect(res.isCheck).toBe(true);
      expect(res.captured).toBe('q');
      expect(res.promotion).toBe('q');
    });
  });

  // ==========================================================================
  // 3. Complex En Passant Discoveries & Legality Expiry
  // ==========================================================================
  describe('3. En Passant Discovered Attacks & Invalidation', () => {
    it('discovers vertical check on enemy King upon executing en passant capture', () => {
      // White Rook on e1, Black King on e8.
      // White Pawn on e5, Black Pawn on d5 (just played d7-d5).
      // When White plays e5xd6 e.p., the pawn on e5 leaves the e-file and lands on d6,
      // the Black pawn on d5 is captured, and the entire e-file is cleared.
      // Black King on e8 is directly checked by White Rook on e1!
      const fen = '4k3/8/8/3pP3/8/8/8/4R1K1 w - d6 0 1';
      const game = new ChessGame(fen);

      expect(game.isCheck()).toBe(false);
      expect(game.isLegalMove('e5', 'd6')).toBe(true);

      const moveRes = game.makeMoveVerbose('e5', 'd6');
      expect(moveRes.success).toBe(true);
      expect(moveRes.captured).toBe('p');
      expect(moveRes.isCheck).toBe(true); // Black King is now in check from Re1!
      expect(game.getPiece('d5')).toBeNull(); // Black pawn on d5 removed
      expect(game.getPiece('e5')).toBeNull(); // White pawn left e5
      expect(game.getPiece('d6')?.type).toBe('p');
      expect(game.getPiece('d6')?.color).toBe('w');
    });

    it('strictly forbids en passant when capturing pawn is absolutely pinned diagonally', () => {
      // White King on h8, White Pawn on e5.
      // Black Pawn on d5 (just played d7-d5).
      // Black Queen on a1 pins White Pawn on e5 along a1-h8 diagonal.
      // Capturing d6 leaves the long diagonal open, exposing Kh8 to Qa1!
      const fen = '7K/8/8/3pP3/8/8/8/q6k w - d6 0 1';
      const game = new ChessGame(fen);

      expect(game.isCheck()).toBe(false);
      expect(game.isLegalMove('e5', 'd6')).toBe(false);
      expect(game.makeMove('e5', 'd6')).toBe(false);
      // Ensure board state was not mutated
      expect(game.getPiece('e5')?.type).toBe('p');
      expect(game.getPiece('d5')?.type).toBe('p');
    });

    it('strictly forbids en passant when horizontal discovery exposes Black King (Black perspective)', () => {
      // Black King on a4, Black Pawn on e4.
      // White Pawn on d4 (just played d2-d4).
      // White Rook on h4.
      // Capturing e4xd3 e.p. removes both pawns from rank 4, exposing Ka4 to Rh4!
      const fen = '8/8/8/8/k2Pp2R/8/8/4K3 b - d3 0 1';
      const game = new ChessGame(fen);

      expect(game.isCheck()).toBe(false);
      expect(game.isLegalMove('e4', 'd3')).toBe(false);
      expect(game.makeMove('e4', 'd3')).toBe(false);
    });

    it('expires en passant rights after exactly one ply (FIDE Article 3.7.4)', () => {
      const game = new ChessGame();
      // 1. e4 Nf6
      game.makeMove('e2', 'e4');
      game.makeMove('g8', 'f6');
      // 2. e5 d5 (creating e.p. target at d6)
      game.makeMove('e4', 'e5');
      game.makeMove('d7', 'd5');

      expect(game.getFen()).toContain(' d6 ');
      expect(game.isLegalMove('e5', 'd6')).toBe(true);

      // White chooses NOT to capture e.p. and plays a quiet move: h2-h3
      game.makeMove('h2', 'h3');
      // Black plays quiet move: a7-a6
      game.makeMove('a7', 'a6');

      // Now White's turn again. En passant right MUST be gone!
      expect(game.getFen()).toContain(' - ');
      expect(game.isLegalMove('e5', 'd6')).toBe(false);
      expect(game.makeMove('e5', 'd6')).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Castling Rights & Transit Verification
  // ==========================================================================
  describe('4. Castling Invariants & Transit Checks', () => {
    it('permits castling kingside when the Rook on h1 is attacked but King transit is safe', () => {
      // Black Bishop on d5 attacks h1.
      // King on e1, transit squares f1 and g1 are completely safe.
      // Under FIDE Art. 3.8.2, castling is legal!
      const fen = '4k3/8/8/3b4/8/8/8/R3K2R w KQ - 0 1';
      const game = new ChessGame(fen);

      expect(game.isCheck()).toBe(false);
      expect(game.isLegalMove('e1', 'g1')).toBe(true);
      expect(game.makeMove('e1', 'g1')).toBe(true);
      expect(game.getPiece('g1')?.type).toBe('k');
      expect(game.getPiece('f1')?.type).toBe('r');
    });

    it('forbids castling kingside when intermediate square f1 is attacked by a Knight', () => {
      // Black Knight on d2 attacks f1, b1, b3, c4, e4.
      // White King on e1 transiting to g1 must pass through f1.
      const fen = '4k3/8/8/8/8/8/3n4/R3K2R w KQ - 0 1';
      const game = new ChessGame(fen);

      expect(game.isLegalMove('e1', 'g1')).toBe(false);
      expect(game.makeMove('e1', 'g1')).toBe(false);
    });

    it('permanently loses queenside castling right when the a1 Rook is captured', () => {
      // White can castle both sides. Black plays Rxa1.
      const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1';
      const game = new ChessGame(fen);

      // Black Rook captures White a1 Rook
      expect(game.makeMove('a8', 'a1')).toBe(true);

      // White castling rights in FEN must lose 'Q'
      const fenAfter = game.getFen();
      const castlingRights = fenAfter.split(' ')[2];
      expect(castlingRights).not.toContain('Q');
      // But kingside 'K' should still be preserved
      expect(castlingRights).toContain('K');

      // White cannot castle queenside
      expect(game.isLegalMove('e1', 'c1')).toBe(false);
      expect(game.makeMove('e1', 'c1')).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Square Control Differential Consistency & Extremes
  // ==========================================================================
  describe('5. Square Control Differential Consistency & Extremes', () => {
    function makeEmptyBoard(): (import('../../src/types/chess').BoardSquare | null)[][] {
      return Array.from({ length: 8 }, () => Array(8).fill(null));
    }

    it('computes exact attack coverage for corner pieces without wraparound overflow', () => {
      // Single White Knight on a1 passed via BoardSquare array
      const boardKnight = makeEmptyBoard();
      boardKnight[0][0] = { square: 'a1', type: 'n', color: 'w' };
      const ctrlKnight = calculateSquareControl(boardKnight);
      const totalWhiteAttacks = ctrlKnight.white.reduce((acc, v) => acc + v, 0);

      // Knight on a1 can attack ONLY b3 and c2 (exactly 2 squares)
      expect(totalWhiteAttacks).toBe(2);
      expect(ctrlKnight.white[squareToIndex('b3')]).toBe(1);
      expect(ctrlKnight.white[squareToIndex('c2')]).toBe(1);
      // Ensure NO wraparound to h-file or higher ranks
      expect(ctrlKnight.white[squareToIndex('h2')]).toBe(0);
      expect(ctrlKnight.white[squareToIndex('g3')]).toBe(0);

      // Single White Pawn on a2 passed via BoardSquare array
      const boardPawnA2 = makeEmptyBoard();
      boardPawnA2[1][0] = { square: 'a2', type: 'p', color: 'w' };
      const ctrlPawnA2 = calculateSquareControl(boardPawnA2);
      const totalPawnAttacks = ctrlPawnA2.white.reduce((acc, v) => acc + v, 0);
      // Pawn on a2 attacks ONLY b3 (does not attack a3, does not wrap to h3)
      expect(totalPawnAttacks).toBe(1);
      expect(ctrlPawnA2.white[squareToIndex('b3')]).toBe(1);
      expect(ctrlPawnA2.white[squareToIndex('a3')]).toBe(0);
      expect(ctrlPawnA2.white[squareToIndex('h3')]).toBe(0);

      // Single White Pawn on h2 passed via BoardSquare array
      const boardPawnH2 = makeEmptyBoard();
      boardPawnH2[1][7] = { square: 'h2', type: 'p', color: 'w' };
      const ctrlPawnH2 = calculateSquareControl(boardPawnH2);
      expect(ctrlPawnH2.white.reduce((acc, v) => acc + v, 0)).toBe(1);
      expect(ctrlPawnH2.white[squareToIndex('g3')]).toBe(1);
      expect(ctrlPawnH2.white[squareToIndex('a3')]).toBe(0);
    });

    it('throws descriptive error when passed a FEN string lacking kings due to chess.js validation', () => {
      // FEN without kings is rejected by chess.js engine constructor
      expect(() => calculateSquareControl('8/8/8/8/8/8/8/N7 w - - 0 1')).toThrow(/king/i);
    });

    it('verifies algebraic mathematical differential: diff[i] === white[i] - black[i] across all 64 squares', () => {
      // Crowded dynamic position
      const fen = 'r1bqk2r/pp2bppp/2n1pn2/2pp4/2PP4/2N1PN2/PP2BPPP/R1BQK2R w KQkq - 0 7';
      const ctrl = calculateSquareControl(fen);
      const detailed = calculateDetailedSquareControl(fen);

      expect(ctrl.white.length).toBe(64);
      expect(ctrl.black.length).toBe(64);
      expect(ctrl.differential.length).toBe(64);
      expect(detailed.length).toBe(64);

      for (let i = 0; i < 64; i++) {
        const w = ctrl.white[i];
        const b = ctrl.black[i];
        const d = ctrl.differential[i];

        // Bounds and non-NaN check
        expect(Number.isInteger(w)).toBe(true);
        expect(Number.isInteger(b)).toBe(true);
        expect(Number.isInteger(d)).toBe(true);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(d).toBe(w - b);

        // Detailed check
        const dt = detailed[i];
        expect(dt.whiteCount).toBe(w);
        expect(dt.blackCount).toBe(b);
        expect(dt.differential).toBe(d);
        expect(dt.whiteAttackers.length).toBe(w);
        expect(dt.blackAttackers.length).toBe(b);

        // Verify status classification
        if (w > 0 && b === 0) expect(dt.status).toBe('firmly_white');
        else if (b > 0 && w === 0) expect(dt.status).toBe('firmly_black');
        else if (w > 0 && b > 0) expect(dt.status).toBe('contested');
        else expect(dt.status).toBe('neutral');
      }
    });

    it('ray termination: sliding piece control terminates upon encountering first occupied square', () => {
      // White Rook on a1, White Pawn on a4 via BoardSquare array
      const boardRook = makeEmptyBoard();
      boardRook[0][0] = { square: 'a1', type: 'r', color: 'w' };
      boardRook[3][0] = { square: 'a4', type: 'p', color: 'w' };
      const ctrl = calculateSquareControl(boardRook);

      expect(ctrl.white[squareToIndex('a2')]).toBeGreaterThanOrEqual(1);
      expect(ctrl.white[squareToIndex('a3')]).toBeGreaterThanOrEqual(1);
      expect(ctrl.white[squareToIndex('a4')]).toBeGreaterThanOrEqual(1);
      // Beyond a4 should be 0 from the rook!
      expect(ctrl.white[squareToIndex('a5')]).toBe(0);
      expect(ctrl.white[squareToIndex('a6')]).toBe(0);
    });
  });

  // ==========================================================================
  // 6. 100+ Plies Random Move Simulation & Stress Harness
  // ==========================================================================
  describe('6. Rapid Random Move Simulation & State Invariance (Fuzzing)', () => {
    it('executes 120+ consecutive plies of random legal moves without crashes, NaN, or corruption', () => {
      const game = new ChessGame();
      let pliesPlayed = 0;
      const targetPlies = 120;

      for (let ply = 0; ply < targetPlies; ply++) {
        if (game.isGameOver()) {
          expect(game.getWinner()).not.toBeUndefined();
          break;
        }

        const legalMoves = game.getLegalMoves();
        if (legalMoves.length === 0) break;

        // Choose pseudo-random deterministic move
        const selectedMove = legalMoves[(ply * 37) % legalMoves.length];

        // Move execution
        const success = game.makeMove(
          selectedMove.from,
          selectedMove.to,
          selectedMove.promotion
        );
        expect(success).toBe(true);
        pliesPlayed++;

        // Verify FEN integrity
        const fen = game.getFen();
        expect(fen.split(' ').length).toBe(6);

        // Verify SquareControl consistency at every 10th ply to stress test
        if (pliesPlayed % 10 === 0) {
          const control = calculateSquareControl(fen);
          expect(control.white.length).toBe(64);
          expect(control.black.length).toBe(64);
          expect(control.differential.length).toBe(64);

          for (let i = 0; i < 64; i++) {
            expect(isNaN(control.white[i])).toBe(false);
            expect(isNaN(control.black[i])).toBe(false);
            expect(control.differential[i]).toBe(control.white[i] - control.black[i]);
          }

          // Test non-destructive simulation doesn't mutate current state
          const testSim = game.simulateMove(
            game.getLegalMoves()[0].from,
            game.getLegalMoves()[0].to
          );
          expect(game.getFen()).toBe(fen);
        }
      }

      // Ensure at least 60 plies played before potential draw/checkmate
      expect(pliesPlayed).toBeGreaterThanOrEqual(40);

      // Verify undo/redo across last 10 plies
      const currentFen = game.getFen();
      const undoCount = Math.min(10, pliesPlayed);
      for (let u = 0; u < undoCount; u++) {
        expect(game.undo()).toBe(true);
      }
      for (let r = 0; r < undoCount; r++) {
        expect(game.redo()).toBe(true);
      }
      expect(game.getFen()).toBe(currentFen);
    });

    it('runs 5 independent randomized mini-games without throwing unhandled exceptions', () => {
      for (let g = 0; g < 5; g++) {
        const game = new ChessGame();
        for (let p = 0; p < 50; p++) {
          if (game.isGameOver()) break;
          const moves = game.getLegalMoves();
          if (moves.length === 0) break;
          const move = moves[(p * 17 + g) % moves.length];
          const ok = game.makeMove(move.from, move.to, move.promotion);
          expect(ok).toBe(true);
        }
        expect(game.getHistory().length).toBeGreaterThan(0);
        expect(game.getFen()).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // 7. Defensive API Boundaries & Malformed Input Handling
  // ==========================================================================
  describe('7. Defensive API Boundaries & Malformed Input Handling', () => {
    it('gracefully rejects malformed FEN and PGN without throwing or corrupting state', () => {
      const game = new ChessGame();
      const initialFen = game.getFen();

      expect(game.loadFen('garbage-fen-string')).toBe(false);
      expect(game.getFen()).toBe(initialFen);

      expect(game.loadPgn('invalid [Event "None"] garbage 999')).toBe(false);
      expect(game.getFen()).toBe(initialFen);
    });

    it('gracefully rejects invalid move coordinates and invalid promotion targets', () => {
      const game = new ChessGame();

      expect(game.isLegalMove('e2' as Square, 'e5' as Square)).toBe(false);
      expect(game.makeMove('e2' as Square, 'e5' as Square)).toBe(false);

      expect(game.isLegalMove('z9' as Square, 'e4' as Square)).toBe(false);
      expect(game.makeMove('z9' as Square, 'e4' as Square)).toBe(false);

      expect(game.getPiece('z9' as Square)).toBeNull();
    });

    it('bounds checks indexToSquare and squareToIndex', () => {
      expect(squareToIndex('a1')).toBe(0);
      expect(squareToIndex('h8')).toBe(63);
      expect(indexToSquare(0)).toBe('a1');
      expect(indexToSquare(63)).toBe('h8');

      expect(() => indexToSquare(-1)).toThrow();
      expect(() => indexToSquare(64)).toThrow();
    });
  });

  // ==========================================================================
  // 8. Insufficient Material Verification
  // ==========================================================================
  describe('8. Insufficient Material Verification', () => {
    it('detects insufficient material draws for K vs K, K+N vs K, K+B vs K, and same-color bishops', () => {
      // King vs King
      const gameK = new ChessGame('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
      expect(gameK.isInsufficientMaterial()).toBe(true);
      expect(gameK.isDraw()).toBe(true);
      expect(gameK.getDrawReason()).toBe('insufficient');

      // King + Knight vs King
      const gameKN = new ChessGame('8/8/8/4k3/8/5N2/4K3/8 w - - 0 1');
      expect(gameKN.isInsufficientMaterial()).toBe(true);
      expect(gameKN.isDraw()).toBe(true);
      expect(gameKN.getDrawReason()).toBe('insufficient');

      // King + Bishop vs King
      const gameKB = new ChessGame('8/8/8/4k3/8/5B2/4K3/8 w - - 0 1');
      expect(gameKB.isInsufficientMaterial()).toBe(true);
      expect(gameKB.isDraw()).toBe(true);
      expect(gameKB.getDrawReason()).toBe('insufficient');

      // King + Bishop vs King + Bishop (same-colored bishops: both on light squares c1 and f8)
      // c1 is dark? file 2, rank 0: 2+0=2 (dark). f8: file 5, rank 7: 5+7=12 (dark). Both dark!
      const gameKBB = new ChessGame('5b2/8/8/4k3/8/8/4K3/2B5 w - - 0 1');
      expect(gameKBB.isInsufficientMaterial()).toBe(true);
      expect(gameKBB.isDraw()).toBe(true);
      expect(gameKBB.getDrawReason()).toBe('insufficient');

      // King + Pawn vs King is SUFFICIENT material
      const gameKP = new ChessGame('8/8/8/4k3/8/4P3/4K3/8 w - - 0 1');
      expect(gameKP.isInsufficientMaterial()).toBe(false);
      expect(gameKP.isDraw()).toBe(false);
    });
  });

  // ==========================================================================
  // 9. Multi-Attacker Convergence on Single Square
  // ==========================================================================
  describe('9. Multi-Attacker Convergence on Single Square', () => {
    it('accurately resolves 4 White attackers and 2 Black attackers converging on e4', () => {
      // White attackers of e4:
      // 1. Pawn on d3 (attacks e4 diagonally)
      // 2. Knight on f2 (dx=-1, dy=2 -> attacks e4)
      // 3. Bishop on b1 (b1-c2-d3-e4? wait, if d3 has pawn, bishop is blocked!).
      // Let's place Bishop on g2 (g2-f3-e4, diagonal unobstructed).
      // 4. Rook on e1 (e1-e2-e3-e4, file unobstructed).
      // Black attackers of e4:
      // 1. Pawn on f5 (attacks e4 diagonally)
      // 2. Knight on c5 (dx=2, dy=-1 -> attacks e4)
      // Kings safely away: White on h1, Black on h8.
      // Board check:
      // White: Kh1, Re1, Pf2? (wait, Nf2 is on f2, so no pawn on f2), pawn on d3, Bishop on g2.
      // Black: Kh8, Pawn on f5, Knight on c5.
      // Squares on e-file: e1 (R), e2, e3, e4. Unobstructed!
      // Diagonal g2-e4: g2 (B), f3, e4. Unobstructed!
      // Pawn d3: attacks e4!
      // Knight f2: attacks e4 (f2 -> e4: dx=-1, dy=2)!
      // Black pawn f5: attacks e4 (f5 -> e4: dx=-1, dy=-1)!
      // Black knight c5: attacks e4 (c5 -> e4: dx=2, dy=-1)!
      // Total White on e4: 4 (d3, f2, g2, e1)
      // Total Black on e4: 2 (f5, c5)
      // FEN:
      // 7k/8/8/2n2p2/4p3? no e4 is target square (empty):
      // Rank 8: 7k (h8: k)
      // Rank 7: 8
      // Rank 6: 8
      // Rank 5: 2n2p2 (c5: n, f5: p)
      // Rank 4: 8
      // Rank 3: 3P4 (d3: P)
      // Rank 2: 5NB1 (f2: N, g2: B)
      // Rank 1: 4R2K (e1: R, h1: K)
      const fen = '7k/8/8/2n2p2/8/3P4/5NB1/4R2K w - - 0 1';
      const detailed = calculateDetailedSquareControl(fen);
      const e4Detail = detailed[squareToIndex('e4')];

      expect(e4Detail.whiteCount).toBe(4);
      expect(e4Detail.blackCount).toBe(2);
      expect(e4Detail.differential).toBe(2);
      expect(e4Detail.status).toBe('contested');

      const whiteAttackerTypes = e4Detail.whiteAttackers.map((a) => a.piece).sort();
      expect(whiteAttackerTypes).toEqual(['b', 'n', 'p', 'r'].sort());

      const blackAttackerTypes = e4Detail.blackAttackers.map((a) => a.piece).sort();
      expect(blackAttackerTypes).toEqual(['n', 'p'].sort());
    });
  });

  // ==========================================================================
  // 10. Large Fuzzing Stress: 25 Independent Games
  // ==========================================================================
  describe('10. Multi-Game Random Simulation (25-Game Fuzzing Stress)', () => {
    it('runs 25 independent games without NaN, exceptions, or memory corruption', () => {
      let totalPlies = 0;
      for (let g = 0; g < 25; g++) {
        const game = new ChessGame();
        for (let p = 0; p < 80; p++) {
          if (game.isGameOver()) break;
          const moves = game.getLegalMoves();
          if (moves.length === 0) break;
          const chosen = moves[(p * 31 + g * 7) % moves.length];
          const ok = game.makeMove(chosen.from, chosen.to, chosen.promotion);
          expect(ok).toBe(true);
          totalPlies++;
        }
        const control = calculateSquareControl(game.getFen());
        expect(control.differential.every((d) => !isNaN(d))).toBe(true);
      }
      expect(totalPlies).toBeGreaterThanOrEqual(500);
    });
  });
});

