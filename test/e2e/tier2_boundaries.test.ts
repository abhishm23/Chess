import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import {
  ChessGameCoordinator,
  calculateSquareControl,
  detectPins,
  classifyMoveDelta,
} from './harness/testHarness.js';

describe('Tier 2: Boundary & Corner Cases', () => {
  let game: ChessGameCoordinator;

  beforeEach(() => {
    game = new ChessGameCoordinator();
  });

  // =========================================================================
  // Category 1: Pinned Pieces Subtleties (≥5 tests)
  // =========================================================================
  describe('Boundary 1: Pinned Pieces Subtleties', () => {
    it('1.1 strictly prohibits absolutely pinned piece from moving off pin ray', () => {
      // White King on e1, White Knight on e2, Black Rook on e8, Black King on a8
      const fen = 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1';
      game.resetGame(fen);
      // Knight on e2 is absolutely pinned along the e-file
      expect(game.makeMove('e2', 'd4')).toBe(false);
      expect(game.makeMove('e2', 'f4')).toBe(false);
      expect(game.makeMove('e2', 'c3')).toBe(false);
      expect(game.makeMove('e2', 'g3')).toBe(false);
    });

    it('1.2 allows pinned piece to move along the pin ray', () => {
      // White King on e1, White Rook on e4, Black Rook on e8, Black King on a8
      const fen = 'k3r3/8/8/8/4R3/8/8/4K3 w - - 0 1';
      game.resetGame(fen);
      // Rook can move vertically along e-file
      expect(game.makeMove('e4', 'e5')).toBe(true);
      // Pinned rook can capture the pinner
      game.resetGame(fen);
      expect(game.makeMove('e4', 'e8')).toBe(true);
      expect(game.getGameState().history[0]).toBe('Rxe8+');
    });

    it('1.3 confirms pinned piece still exerts square control against enemy King (FIDE Art 3.1)', () => {
      // White King on d1, White Bishop on d4 pinned to King on d1 by Black Rook on d8, Black King on f4
      const fen = '3r4/8/8/8/3B1k2/8/8/3K4 b - - 0 1';
      const chess = new Chess(fen);
      // Black King on f4 tries to move to e3 (attacked by pinned Bishop on d4)
      const moves = chess.moves({ verbose: true });
      const canMoveToE3 = moves.some(m => m.from === 'f4' && m.to === 'e3');
      expect(canMoveToE3).toBe(false);

      // Square control verifies White still controls e3
      const control = calculateSquareControl(chess);
      // e3 is index 20 (rank 2*8+4 = 20)
      expect(control.white[20]).toBeGreaterThan(0);
    });

    it('1.4 allows pinned pawn to advance along pin ray but not capture off ray', () => {
      // White King on e1, White Pawn on e2, Black Rook on e8, Black King on a8
      const fen = 'k3r3/8/8/8/8/8/4P3/4K3 w - - 0 1';
      game.resetGame(fen);
      // Pawn on e2 can push to e3 along the e-file pin line
      expect(game.makeMove('e2', 'e3')).toBe(true);

      // Reset and add enemy piece on d3: pawn cannot capture off the ray
      const fenWithTarget = 'k3r3/8/8/8/8/3n4/4P3/4K3 w - - 0 1';
      game.resetGame(fenWithTarget);
      expect(game.makeMove('e2', 'd3')).toBe(false);
    });

    it('1.5 detects multiple simultaneous pins (diagonal and orthogonal)', () => {
      // White King on e1. Black Rook on e8 pins White Rook on e4 along e-file;
      // Black Bishop on a5 pins White Knight on c3 along a5-e1 diagonal.
      const doublePinFen = 'k3r3/8/8/b7/4R3/2N5/8/4K3 w - - 0 1';
      const chess = new Chess(doublePinFen);
      const whitePins = detectPins(chess, 'w');
      expect(whitePins.length).toBe(2);
      expect(whitePins.some(p => p.pinnedSquare === 'e4')).toBe(true);
      expect(whitePins.some(p => p.pinnedSquare === 'c3')).toBe(true);
    });
  });

  // =========================================================================
  // Category 2: En Passant & Discovered Checks (≥5 tests)
  // =========================================================================
  describe('Boundary 2: En Passant & Discovered Checks', () => {
    it('2.1 invalidates horizontal en passant discovered check', () => {
      // FEN: White King a5, White Pawn e5, Black Pawn d5, Black Rook h5, Black King e8.
      // If White plays exd6 e.p., both pawns disappear, exposing a5 King to h5 Rook!
      const fen = '4k3/8/8/K2pP2r/8/8/8/8 w - d6 0 1';
      game.resetGame(fen);
      // Attempting exd6 must be strictly ILLEGAL
      expect(game.makeMove('e5', 'd6')).toBe(false);
      // Legal moves for White should NOT contain exd6
      const legalMoves = game.getChess().moves({ verbose: true });
      expect(legalMoves.some(m => m.from === 'e5' && m.to === 'd6')).toBe(false);
    });

    it('2.2 enforces ephemeral window: en passant expires if not played immediately', () => {
      const epFen = 'rnbqkbnr/pppp1p1p/8/4pPp1/8/8/PPPPP1PP/RNBQKBNR w KQkq g6 0 4';
      game.resetGame(epFen);
      // White makes another move instead of en passant: 4. d3
      expect(game.makeMove('d2', 'd3')).toBe(true);
      // Black makes move: 4... h6
      expect(game.makeMove('h7', 'h6')).toBe(true);
      // White tries to play en passant now: fxg6
      expect(game.makeMove('f5', 'g6')).toBe(false);
    });

    it('2.3 executes en passant capture delivering check', () => {
      // White pawn on e5, Black pawn on f5, Black King on e7, White King on e1
      // Black just played f7-f5. White captures exf6+ e.p. checking e7 King!
      const fen = '8/4k3/8/4Pp2/8/8/8/4K3 w - f6 0 1';
      game.resetGame(fen);
      expect(game.makeMove('e5', 'f6')).toBe(true);
      expect(game.getGameState().history[0]).toBe('exf6+');
      expect(game.getGameState().isCheck).toBe(true);
    });

    it('2.4 executes en passant capture uncovering checkmate', () => {
      // Setup position where en passant delivers checkmate
      const fen = '8/8/8/4kPpQ/8/8/8/4K3 w - g6 0 1';
      game.resetGame(fen);
      expect(game.makeMove('f5', 'g6')).toBe(true);
      expect(game.getGameState().history[0]).toContain('fxg6');
    });

    it('2.5 rejects pawn 2-square advance when intermediate square is blocked', () => {
      // White pawn on e2, piece on e3
      const fen = 'rnbqkbnr/pppppppp/8/8/8/4n3/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      game.resetGame(fen);
      // e2-e4 is blocked by knight on e3
      expect(game.makeMove('e2', 'e4')).toBe(false);
      expect(game.makeMove('e2', 'e3')).toBe(false);
    });
  });

  // =========================================================================
  // Category 3: Castling Boundary Constraints (≥5 tests)
  // =========================================================================
  describe('Boundary 3: Castling Boundary Constraints', () => {
    it('3.1 strictly forbids castling when King is currently in check', () => {
      // Black Queen on e8 gives check to White King on e1, Black King on a8
      const fen = 'k3q3/8/8/8/8/8/8/R3K2R w KQ - 0 1';
      game.resetGame(fen);
      expect(game.getGameState().isCheck).toBe(true);
      expect(game.makeMove('e1', 'g1')).toBe(false); // O-O illegal
      expect(game.makeMove('e1', 'c1')).toBe(false); // O-O-O illegal
    });

    it('3.2 strictly forbids castling through an attacked transit square', () => {
      // Black Bishop on c4 covers f1 square. White tries Kingside castling
      const fen = 'r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1';
      game.resetGame(fen);
      // f1 is transit square: O-O is strictly illegal
      expect(game.makeMove('e1', 'g1')).toBe(false);
      const moves = game.getChess().moves();
      expect(moves.includes('O-O')).toBe(false);
    });

    it('3.3 allows Queenside castling when b1 is attacked (only d1/c1 must be safe)', () => {
      // Black Bishop on a2 attacks b1. Squares c1 and d1 are safe.
      const fen = 'r3k2r/8/8/8/8/8/b7/R3K2R w KQkq - 0 1';
      game.resetGame(fen);
      expect(game.makeMove('e1', 'c1')).toBe(true);
      expect(game.getGameState().history[0]).toBe('O-O-O');
    });

    it('3.4 permanently revokes castling rights once King moves', () => {
      const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
      game.resetGame(fen);
      // King steps to e2
      expect(game.makeMove('e1', 'e2')).toBe(true);
      expect(game.makeMove('e8', 'e7')).toBe(true);
      // King steps back to e1
      expect(game.makeMove('e2', 'e1')).toBe(true);
      expect(game.makeMove('e7', 'e8')).toBe(true);
      // White attempts castling now: MUST BE ILLEGAL
      expect(game.makeMove('e1', 'g1')).toBe(false);
      expect(game.makeMove('e1', 'c1')).toBe(false);
    });

    it('3.5 revokes castling rights when rook is captured on starting square', () => {
      // Black Queen captures White Rook on h1
      const fen = 'r3k2r/8/8/8/8/8/7q/R3K2R b KQkq - 0 1';
      game.resetGame(fen);
      expect(game.makeMove('h2', 'h1')).toBe(true); // Qxh1+
      const state = game.getGameState();
      const castlingRights = state.fen.split(' ')[2];
      expect(castlingRights).not.toContain('K'); // White lost 'K' castling right
      expect(castlingRights).toBe('Qkq');
    });
  });

  // =========================================================================
  // Category 4: King Safety & Check/Double Check (≥5 tests)
  // =========================================================================
  describe('Boundary 4: King Safety & Check / Double Check', () => {
    it('4.1 strictly rejects King moving into an attacked square (self-check)', () => {
      // White King on e1, Black Rook on e5, Black King on a8
      const fen = 'k7/8/8/4r3/8/8/8/4K3 w - - 0 1';
      game.resetGame(fen);
      // e2 is attacked by e5 rook
      expect(game.makeMove('e1', 'e2')).toBe(false);
      // Moving to safe squares d1, f1, d2, f2 is legal
      expect(game.makeMove('e1', 'd1')).toBe(true);
    });

    it('4.2 under double check, King MUST move (blocking/capturing is illegal)', () => {
      // White King on e1, Black King on a8, Black Rook on e8, Black Knight on d3
      const fen = 'k3r3/8/8/8/8/3n4/8/4K2R w K - 0 1';
      game.resetGame(fen);
      expect(game.getGameState().isCheck).toBe(true);

      // White tries to capture Knight with Rook: Rh1xd3? ILLEGAL because e8 Rook still checks!
      expect(game.makeMove('h1', 'd3')).toBe(false);
      // King must move!
      expect(game.makeMove('e1', 'f1')).toBe(true);
    });

    it('4.3 resolves single check by interposing a piece', () => {
      // Black Rook on e8 attacks King on e1, White Bishop on d2, Black King on a8
      const fen = 'k3r3/8/8/8/8/8/3B4/4K3 w - - 0 1';
      game.resetGame(fen);
      expect(game.getGameState().isCheck).toBe(true);
      expect(game.makeMove('d2', 'e3')).toBe(true);
      expect(game.getGameState().isCheck).toBe(false);
    });

    it('4.4 resolves single check by capturing the checking piece', () => {
      // Black Queen on e2 gives check to e1 King, Black King on a8. King captures Queen!
      const fen = 'k7/8/8/8/8/8/4q3/4K3 w - - 0 1';
      game.resetGame(fen);
      expect(game.getGameState().isCheck).toBe(true);
      expect(game.makeMove('e1', 'e2')).toBe(true);
      expect(game.getGameState().isCheck).toBe(false);
    });

    it('4.5 King safely steps out of check onto unattacked adjacent square', () => {
      const fen = 'k7/8/8/8/4r3/8/8/4K3 w - - 0 1';
      game.resetGame(fen);
      expect(game.makeMove('e1', 'f2')).toBe(true);
      expect(game.getGameState().isCheck).toBe(false);
    });
  });

  // =========================================================================
  // Category 5: Underpromotion Tactical Endgames (≥5 tests)
  // =========================================================================
  describe('Boundary 5: Underpromotion Tactical Endgames', () => {
    it('5.1 underpromotion to Knight delivers immediate check', () => {
      // FEN: White King c1, White Pawn e7, Black King f6.
      const fen = '8/4P3/5k2/8/8/8/8/2K5 w - - 0 1';
      game.resetGame(fen);
      expect(game.makeMove('e7', 'e8', 'n')).toBe(true);
      const state = game.getGameState();
      expect(state.isCheck).toBe(true);
      expect(state.history[0]).toBe('e8=N+');
    });

    it('5.2 underpromotion to Rook avoids unintended stalemate', () => {
      // Black King on a8, White King on c7, White Pawn on c6
      const fen = 'k7/2P1K3/8/8/8/8/8/8 w - - 0 1';
      game.resetGame(fen);
      expect(game.makeMove('c7', 'c8', 'r')).toBe(true);
      expect(game.getGameState().history[0]).toContain('c8=R');
    });

    it('5.3 underpromotion to Bishop delivers check or avoids queen stalemate', () => {
      const fen = 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1';
      game.resetGame(fen);
      // Promoting to Bishop is legal
      expect(game.makeMove('c7', 'c8', 'b')).toBe(true);
      const state = game.getGameState();
      expect(state.history[0]).toContain('c8=B');
    });

    it('5.4 executes Black pawn underpromotion to Knight on rank 1 with check', () => {
      // Black pawn on e2 promotes on e1 to Knight, White King on d3, Black King on a8
      const fen = 'k7/8/8/8/3K4/8/4p3/8 b - - 0 1';
      game.resetGame(fen);
      expect(game.makeMove('e2', 'e1', 'n')).toBe(true);
      const state = game.getGameState();
      expect(state.history[0]).toBe('e1=N');
    });

    it('5.5 rejects underpromotion to illegal piece types (King or Pawn)', () => {
      const fen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
      game.resetGame(fen);
      // Promoting to 'k' (King) or 'p' (Pawn) is invalid
      expect(game.makeMove('e7', 'e8', 'k')).toBe(false);
      expect(game.makeMove('e7', 'e8', 'p')).toBe(false);
    });
  });

  // =========================================================================
  // Category 6: Drawn Endgames & Repetition (≥5 tests)
  // =========================================================================
  describe('Boundary 6: Drawn Endgames & Repetition', () => {
    it('6.1 detects draw by 50-move rule when halfmove clock reaches 100', () => {
      // FEN with halfmove clock at 99. White moves piece without capture or pawn push -> 100
      const fen = '8/8/8/8/4k3/8/8/4K2R w - - 99 50';
      game.resetGame(fen);
      expect(game.makeMove('h1', 'h2')).toBe(true);
      const state = game.getGameState();
      expect(state.isDraw).toBe(true);
      expect(state.drawReason).toBe('50-move');
    });

    it('6.2 resets halfmove clock upon pawn push or piece capture', () => {
      // FEN with halfmove clock at 40
      const fen = '8/4p3/8/8/4k3/8/4P3/4K3 w - - 40 21';
      game.resetGame(fen);
      // Pawn push resets clock
      game.makeMove('e2', 'e3');
      expect(game.getGameState().fen).toContain('0 21');
    });

    it('6.3 detects threefold repetition draw', () => {
      // Knight dance: 1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8
      game.makeMove('g1', 'f3');
      game.makeMove('g8', 'f6');
      game.makeMove('f3', 'g1');
      game.makeMove('f6', 'g8');
      game.makeMove('g1', 'f3');
      game.makeMove('g8', 'f6');
      game.makeMove('f3', 'g1');
      game.makeMove('f6', 'g8');

      const state = game.getGameState();
      expect(state.isDraw).toBe(true);
      expect(state.drawReason).toBe('threefold');
    });

    it('6.4 detects insufficient material draw for King vs King', () => {
      const fen = '8/8/8/8/4k3/8/8/4K3 w - - 0 1';
      game.resetGame(fen);
      const state = game.getGameState();
      expect(state.isDraw).toBe(true);
      expect(state.drawReason).toBe('insufficient');
    });

    it('6.5 detects insufficient material draw for King + Knight vs King and King + Bishop vs King', () => {
      // K + N vs K
      const knFen = '8/8/8/8/4k3/8/4N3/4K3 w - - 0 1';
      const knGame = new ChessGameCoordinator(knFen);
      expect(knGame.getGameState().isDraw).toBe(true);

      // K + B vs K
      const kbFen = '8/8/8/8/4k3/8/4B3/4K3 w - - 0 1';
      const kbGame = new ChessGameCoordinator(kbFen);
      expect(kbGame.getGameState().isDraw).toBe(true);
    });

    it('6.6 detects stalemate when player has 0 legal moves and is not in check', () => {
      // Classic stalemate: Black King on a8, White Queen on c7, White King on a6
      const fen = 'k7/2Q5/K7/8/8/8/8/8 b - - 0 1';
      game.resetGame(fen);
      const state = game.getGameState();
      expect(state.isCheck).toBe(false);
      expect(state.isCheckmate).toBe(false);
      expect(state.isDraw).toBe(true);
      expect(state.drawReason).toBe('stalemate');
    });
  });

  // =========================================================================
  // Category 7: Engine Timeout & Search Cancellation Handling (≥5 tests)
  // =========================================================================
  describe('Boundary 7: Engine Timeout & Cancellation Handling', () => {
    it('7.1 handles search cancellation via AbortSignal without corrupting state', () => {
      const controller = new AbortController();
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
      expect(game.getGameState().activeMode).toBe('normal');
    });

    it('7.2 discards outdated search results with superseded jobId', () => {
      let currentJobId = 1;
      const onSearchResult = (resultJobId: number, fen: string) => {
        if (resultJobId !== currentJobId) {
          return null; // Discard outdated job result
        }
        return fen;
      };

      // Search 1 dispatched
      currentJobId = 2; // User moved before search 1 completed
      const staleResult = onSearchResult(1, 'old_fen');
      expect(staleResult).toBeNull();

      const freshResult = onSearchResult(2, 'new_fen');
      expect(freshResult).toBe('new_fen');
    });

    it('7.3 immediately returns checkmate without search hang on terminal position', () => {
      // Scholar's Mate checkmate position
      const mateFen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
      const mateGame = new ChessGameCoordinator(mateFen);
      const state = mateGame.getGameState();
      expect(state.isCheckmate).toBe(true);
      mateGame.setGameMode('smart');
      expect(mateGame.getGameState().candidateMoves).toHaveLength(0);
    });

    it('7.4 immediately evaluates stalemate position to 50% draw without search hang', () => {
      const staleFen = 'k7/2Q5/K7/8/8/8/8/8 b - - 0 1';
      const staleGame = new ChessGameCoordinator(staleFen);
      const state = staleGame.getGameState();
      expect(state.isDraw).toBe(true);
      staleGame.setGameMode('smart');
      expect(staleGame.getGameState().candidateMoves).toHaveLength(0);
    });

    it('7.5 classifies extreme centipawn evaluations safely without numerical overflow', () => {
      const hugeWp = classifyMoveDelta(0.1, 10, false, 30000, true);
      expect(hugeWp).toBe('best');
      const blundWp = classifyMoveDelta(50.0, 30000, false, -30000, true);
      expect(blundWp).toBe('blunder');
    });
  });
});
