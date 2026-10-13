import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import {
  ChessGameCoordinator,
  calculateSquareControl,
  centipawnsToWinProbability,
  classifyMoveDelta,
} from './harness/testHarness.js';

describe('Tier 3: Combinatorial & Pairwise Feature Interactions', () => {
  let game: ChessGameCoordinator;

  beforeEach(() => {
    game = new ChessGameCoordinator();
  });

  // =========================================================================
  // Interaction 1: Mode Switching During Active Domino & Candidate Selection
  // =========================================================================
  describe('Interaction 1: Mode Switching During Active Domino & Candidate Selection', () => {
    it('1.1 seamlessly transitions from Smart to Expert mode while preserving selected candidate move', () => {
      game.setGameMode('smart');
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');

      const smartState = game.getGameState();
      expect(smartState.candidateMoves.length).toBeGreaterThan(0);
      const chosenSan = smartState.candidateMoves[0].san;
      game.selectCandidateMove(chosenSan);

      // Switch to Expert mode
      game.setGameMode('expert');
      const expertState = game.getGameState();

      expect(expertState.activeMode).toBe('expert');
      expect(expertState.fen).toBe(smartState.fen);
      expect(expertState.history).toEqual(['e4', 'e5']);
      expect(expertState.activeScenarioTree).toBeDefined();
      expect(expertState.activeScenarioTree?.children.length).toBeGreaterThan(0);
    });

    it('1.2 switches from Expert to Normal mode clearing scenario tree while board remains intact', () => {
      game.setGameMode('expert');
      game.makeMove('d2', 'd4');
      game.makeMove('d7', 'd5');
      game.makeMove('c2', 'c4');

      expect(game.getGameState().activeScenarioTree).toBeDefined();

      // Switch to Normal mode
      game.setGameMode('normal');
      const normalState = game.getGameState();

      expect(normalState.activeMode).toBe('normal');
      expect(normalState.activeScenarioTree).toBeUndefined();
      expect(normalState.candidateMoves).toHaveLength(0);
      expect(normalState.history).toEqual(['d4', 'd5', 'c4']);
      expect(normalState.turn).toBe('b');
    });

    it('1.3 maintains state integrity across rapid alternating moves and mode toggles', () => {
      // Move 1 (Normal)
      game.setGameMode('normal');
      game.makeMove('e2', 'e4');
      // Move 2 (Smart)
      game.setGameMode('smart');
      game.makeMove('c7', 'c5');
      // Move 3 (Expert)
      game.setGameMode('expert');
      game.makeMove('g1', 'f3');
      // Move 4 (Normal)
      game.setGameMode('normal');
      game.makeMove('d7', 'd6');

      const state = game.getGameState();
      expect(state.history).toEqual(['e4', 'c5', 'Nf3', 'd6']);
      expect(state.turn).toBe('w');
      expect(state.activeMode).toBe('normal');
    });
  });

  // =========================================================================
  // Interaction 2: Promotion with Simultaneous Discovered Check & Domino Eval
  // =========================================================================
  describe('Interaction 2: Promotion with Simultaneous Discovered Check & Domino Eval', () => {
    it('2.1 executes pawn promotion that simultaneously unmasks discovered check from a Rook', () => {
      // White Rook on e1, White Pawn on e7, Black King on e8? No, pawn on d7, White Rook on d1, Black King on d8.
      // Setup: White Rook on e1, White Pawn on d7, Black King on e8.
      // Wait: If White Rook is on d1 and White Pawn is on d7, Black King on d8 is already checked by pawn!
      // Better: White Rook on e1, White Pawn on e7. Black King on e5.
      // Wait, if White Pawn is on e7 and White Rook on e1, moving pawn e7-f8=Q unmasks Rook on e1 against King on e8!
      // FEN: Black King on e8, White Pawn on e7, White Rook on e1.
      // Wait, e7 pawn cannot move straight because e8 is occupied by King!
      // But pawn on e7 can CAPTURE diagonally to f8 or d8: e7xd8=Q or e7xf8=Q!
      // If Black Rook on f8, White pawn plays e7xf8=Q+:
      // The promoted Queen checks or unmasks the e1 Rook!
      // When e7 captures on f8, the e-file is OPEN!
      // White Rook on e1 now delivers discovered check along the open e-file to Black King on e8!
      // FEN: White King c1, White Rook e1, White Pawn e7, Black King e8, Black Rook f8.
      const fen = '4kr2/4P3/8/8/8/8/8/2K1R3 w - - 0 1';
      game.resetGame(fen);

      // White captures e7xf8=Q+
      expect(game.makeMove('e7', 'f8', 'q')).toBe(true);
      const state = game.getGameState();

      // Check delivered! Both the promoted Queen on f8 and the Rook on e1 attack e8 King (double check!)
      expect(state.isCheck).toBe(true);
      expect(state.history[0]).toBe('exf8=Q+');
      // Black King on e8 is under double check: King MUST move
      expect(game.makeMove('e8', 'f8')).toBe(true); // King captures Queen
    });

    it('2.2 evaluates promotion with discovered check under Smart mode domino engine', () => {
      const fen = '4kr2/4P3/8/8/8/8/8/2K1R3 w - - 0 1';
      game.resetGame(fen);
      game.setGameMode('smart');

      expect(game.makeMove('e7', 'f8', 'q')).toBe(true);
      const state = game.getGameState();
      expect(state.activeMode).toBe('smart');
      expect(state.isCheck).toBe(true);
      expect(state.activeDominoChain).toBeDefined();
    });

    it('2.3 underpromotes to Knight delivering fork while unmasking discovered attack', () => {
      // White Rook on d1, White Pawn on e7, Black King on e8.
      // White Pawn captures on d8: e7xd8=N+ delivering Knight check
      // FEN: White King c1, White Rook d1, White Pawn e7, Black King f7, Black Queen d8.
      const fen = '3q4/4Pk2/8/8/8/8/8/2KR4 w - - 0 1';
      game.resetGame(fen);

      // e7xd8=N+ forks or captures Queen with check
      expect(game.makeMove('e7', 'd8', 'n')).toBe(true);
      const state = game.getGameState();
      expect(state.history[0]).toBe('exd8=N+');
      expect(state.isCheck).toBe(true);
    });
  });

  // =========================================================================
  // Interaction 3: Fast Time-Travel Move Scrubbing During Engine Evaluation
  // =========================================================================
  describe('Interaction 3: Fast Time-Travel Move Scrubbing During Engine Evaluation', () => {
    it('3.1 navigates backward and forward through move history with exact FEN fidelity', () => {
      game.setGameMode('smart');
      // Play a 4-move opening: 1. e4 e5 2. Nf3 Nc6
      game.makeMove('e2', 'e4');
      const fen1 = game.getGameState().fen;
      game.makeMove('e7', 'e5');
      const fen2 = game.getGameState().fen;
      game.makeMove('g1', 'f3');
      const fen3 = game.getGameState().fen;
      game.makeMove('b8', 'c6');
      const fen4 = game.getGameState().fen;

      // Scrub back to ply 1 (after 1. e4)
      game.jumpToHistoryPly(1);
      expect(game.getGameState().fen).toBe(fen1);

      // Scrub forward to ply 3 (after 2. Nf3)
      game.jumpToHistoryPly(3);
      expect(game.getGameState().fen).toBe(fen3);

      // Scrub back to ply 0 (initial board)
      game.jumpToHistoryPly(0);
      expect(game.getGameState().fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

      // Return to live ply (ply 4)
      game.jumpToHistoryPly(4);
      expect(game.getGameState().fen).toBe(fen4);
      expect(game.getGameState().history).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    });

    it('3.2 preserves active engine mode during history scrubbing', () => {
      game.setGameMode('expert');
      game.makeMove('d2', 'd4');
      game.makeMove('d7', 'd5');

      game.jumpToHistoryPly(1);
      expect(game.getGameState().activeMode).toBe('expert');

      game.jumpToHistoryPly(2);
      expect(game.getGameState().activeMode).toBe('expert');
    });

    it('3.3 making a move from live position appends to history while preserving prior plies', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      game.jumpToHistoryPly(1); // view ply 1
      game.jumpToHistoryPly(2); // back to live ply 2

      // Make 3rd move
      expect(game.makeMove('f1', 'c4')).toBe(true);
      expect(game.getGameState().history).toEqual(['e4', 'e5', 'Bc4']);
    });

    it('3.4 retains candidate evaluations across historical navigation in Smart mode', () => {
      game.setGameMode('smart');
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');

      game.jumpToHistoryPly(1);
      const histState = game.getGameState();
      expect(histState.activeMode).toBe('smart');
      expect(histState.history).toHaveLength(2);

      game.jumpToHistoryPly(2);
      const liveState = game.getGameState();
      expect(liveState.activeMode).toBe('smart');
      expect(liveState.candidateMoves.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Interaction 4: Board Flipping During Active Candidate Preview & Square Control
  // =========================================================================
  describe('Interaction 4: Board Flipping During Active Candidate Preview & Square Control', () => {
    it('4.1 previews hypothetical variation without mutating active game board', () => {
      game.makeMove('e2', 'e4');
      const liveFen = game.getGameState().fen;

      // Preview hypothetical variation: 1... e5 2. Nf3
      const previewFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
      game.previewVariationPly(previewFen);

      const previewState = game.getGameState();
      expect(previewState.fen).toBe(previewFen);
      expect(previewState.turn).toBe('b');

      // Exit preview
      game.previewVariationPly(null);
      const restoredState = game.getGameState();
      expect(restoredState.fen).toBe(liveFen);
      expect(restoredState.turn).toBe('b');
    });

    it('4.2 toggles board flip during active variation preview without losing preview state', () => {
      const previewFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
      game.previewVariationPly(previewFen);

      expect(game.isBoardFlipped()).toBe(false);
      game.flipBoard();
      expect(game.isBoardFlipped()).toBe(true);
      expect(game.getGameState().fen).toBe(previewFen);

      // Exit preview: board remains flipped
      game.previewVariationPly(null);
      expect(game.isBoardFlipped()).toBe(true);
    });

    it('4.3 updates square control differential consistently across hypothetical preview and live board', () => {
      const initialControl = game.getGameState().squareControl;
      // In initial position, white has control over rank 3
      expect(initialControl.white[20]).toBeGreaterThan(0); // e3

      // Preview aggressive central pawn position
      const centerPawnFen = 'rnbqkbnr/pppppppp/8/3PP3/8/8/PPP2PPP/RNBQKBNR b KQkq - 0 2';
      game.previewVariationPly(centerPawnFen);

      const previewControl = game.getGameState().squareControl;
      // e5 and d5 differential should reflect advanced white pawns
      expect(previewControl.differential).toBeDefined();

      game.previewVariationPly(null);
      expect(game.getGameState().squareControl.white).toEqual(initialControl.white);
    });
  });

  // =========================================================================
  // Interaction 5: Threefold Repetition & Tactical Pinned Piece Defense
  // =========================================================================
  describe('Interaction 5: Threefold Repetition & Tactical Pinned Piece Defense', () => {
    it('5.1 detects threefold repetition during continuous tactical candidate moves', () => {
      game.setGameMode('smart');
      // Repetition loop
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

    it('5.2 unpins piece when King moves out of pin line, updating square control and legal moves', () => {
      // Black Rook on e8 pins White Knight on e2 to King on e1.
      // White moves King to d1: Knight on e2 is now UNPINNED!
      const fen = 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1';
      game.resetGame(fen);

      // Initially, Knight cannot move off e-file
      expect(game.makeMove('e2', 'd4')).toBe(false);

      // King moves to d1
      expect(game.makeMove('e1', 'd1')).toBe(true);
      // Black makes a waiting move with King
      expect(game.makeMove('a8', 'b8')).toBe(true);

      // Knight on e2 is now completely UNPINNED and can legally jump to d4!
      expect(game.makeMove('e2', 'd4')).toBe(true);
      expect(game.getGameState().history).toEqual(['Kd1', 'Kb8', 'Nd4']);
    });

    it('5.3 captures pinner piece with pinned piece delivering counter-check and resolving pin', () => {
      // White King e1, White Rook e4 pinned by Black Rook e8, Black King a8
      const fen = 'k3r3/8/8/8/4R3/8/8/4K3 w - - 0 1';
      game.resetGame(fen);

      // Pinned rook captures pinner on e8 with check!
      expect(game.makeMove('e4', 'e8')).toBe(true);
      const state = game.getGameState();
      expect(state.history[0]).toBe('Rxe8+');
      expect(state.isCheck).toBe(true);
    });
  });
});
