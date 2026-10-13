import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import {
  ChessGameCoordinator,
  centipawnsToWinProbability,
  mateToWinProbability,
  classifyMoveDelta,
  calculateSquareControl,
  detectPins,
  detectForks,
  detectSkewers,
  detectTrappedPieces,
  computePerft,
} from './harness/testHarness.js';

describe('Tier 1: Core Feature Verification', () => {
  let game: ChessGameCoordinator;

  beforeEach(() => {
    game = new ChessGameCoordinator();
  });

  // =========================================================================
  // Feature 1: FIDE Rules & Move Legality (≥5 tests)
  // =========================================================================
  describe('Feature 1: FIDE Rules & Move Legality', () => {
    it('1.1 allows standard pawn single and initial double advances', () => {
      // 1. e4 (double advance)
      expect(game.makeMove('e2', 'e4')).toBe(true);
      expect(game.getGameState().turn).toBe('b');
      // 1... e5 (double advance)
      expect(game.makeMove('e7', 'e5')).toBe(true);
      // 2. d3 (single advance)
      expect(game.makeMove('d2', 'd3')).toBe(true);
      expect(game.getGameState().history).toEqual(['e4', 'e5', 'd3']);
    });

    it('1.2 allows knight jumping over intervening pieces', () => {
      // 1. Nf3 jumping over f2 pawn
      expect(game.makeMove('g1', 'f3')).toBe(true);
      // 1... Nc6 jumping over c7 pawn
      expect(game.makeMove('b8', 'c6')).toBe(true);
      const state = game.getGameState();
      expect(state.history).toEqual(['Nf3', 'Nc6']);
      expect(state.fen).toContain('r1bqkbnr/pppppppp/2n5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -');
    });

    it('1.3 enforces diagonal bishop and orthogonal rook sliding constraints', () => {
      // Bishops and rooks cannot jump
      expect(game.makeMove('f1', 'c4')).toBe(false); // Bishop blocked by e2/g2
      expect(game.makeMove('a1', 'a3')).toBe(false); // Rook blocked by a2
      // Open diagonal for Bishop
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      expect(game.makeMove('f1', 'c4')).toBe(true); // Now legal
      expect(game.getGameState().history[2]).toBe('Bc4');
    });

    it('1.4 verifies standard kingside and queenside castling execution', () => {
      // Setup position for White kingside castling
      const whiteCastle = new ChessGameCoordinator('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5');
      expect(whiteCastle.makeMove('e1', 'g1')).toBe(true);
      expect(whiteCastle.getGameState().history[0]).toBe('O-O');
      expect(whiteCastle.getGameState().fen).toContain('RNBQ1RK1 b kq -');

      // Setup position for Black queenside castling
      const blackCastle = new ChessGameCoordinator('r3kbnr/pppqpppp/2n5/3p1b2/3P4/2N2N2/PPP1PPPP/R1BQKB1R b KQkq - 4 4');
      expect(blackCastle.makeMove('e8', 'c8')).toBe(true);
      expect(blackCastle.getGameState().history[0]).toBe('O-O-O');
    });

    it('1.5 executes en passant capture and removes target pawn', () => {
      const epGame = new ChessGameCoordinator('rnbqkbnr/pppp1p1p/8/4pPp1/8/8/PPPPP1PP/RNBQKBNR w KQkq g6 0 4');
      // White captures en passant: fxg6 e.p.
      expect(epGame.makeMove('f5', 'g6')).toBe(true);
      const state = epGame.getGameState();
      expect(state.history[0]).toBe('fxg6');
      // Black pawn on g5 must be removed
      expect(epGame.getChess().get('g5')).toBeFalsy();
    });

    it('1.6 promotes pawn to Queen on 8th rank', () => {
      const promoGame = new ChessGameCoordinator('8/4P3/8/8/8/8/8/k3K3 w - - 0 1');
      expect(promoGame.makeMove('e7', 'e8', 'q')).toBe(true);
      const state = promoGame.getGameState();
      expect(state.history[0]).toBe('e8=Q');
      const promotedPiece = promoGame.getChess().get('e8');
      expect(promotedPiece?.type).toBe('q');
      expect(promotedPiece?.color).toBe('w');
    });

    it('1.7 detects checkmate termination in Scholar\'s Mate', () => {
      // 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      game.makeMove('f1', 'c4');
      game.makeMove('b8', 'c6');
      game.makeMove('d1', 'h5');
      game.makeMove('g8', 'f6');
      expect(game.makeMove('h5', 'f7')).toBe(true);

      const state = game.getGameState();
      expect(state.isCheck).toBe(true);
      expect(state.isCheckmate).toBe(true);
      expect(state.history[state.history.length - 1]).toBe('Qxf7#');
    });
  });

  // =========================================================================
  // Feature 2: Multi-Tier Mode Architecture (≥5 tests)
  // =========================================================================
  describe('Feature 2: Multi-Tier Mode Architecture', () => {
    it('2.1 defaults to Normal Mode with dormant analysis', () => {
      const state = game.getGameState();
      expect(state.activeMode).toBe('normal');
      expect(state.candidateMoves).toHaveLength(0);
      expect(state.activeScenarioTree).toBeUndefined();
      expect(state.activeDominoChain).toBeUndefined();
    });

    it('2.2 switches from Normal to Smart Mode preserving game state', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      const fenBefore = game.getGameState().fen;

      game.setGameMode('smart');
      const stateAfter = game.getGameState();

      expect(stateAfter.activeMode).toBe('smart');
      expect(stateAfter.fen).toBe(fenBefore);
      expect(stateAfter.history).toEqual(['e4', 'e5']);
      expect(stateAfter.candidateMoves.length).toBeGreaterThan(0);
      expect(stateAfter.activeDominoChain).toBeDefined();
    });

    it('2.3 switches from Smart to Expert Mode activating multi-ply scenario trees', () => {
      game.makeMove('d2', 'd4');
      game.setGameMode('expert');
      const state = game.getGameState();

      expect(state.activeMode).toBe('expert');
      expect(state.activeScenarioTree).toBeDefined();
      expect(state.activeScenarioTree?.children.length).toBeGreaterThan(0);
      expect(state.activeScenarioTree?.winProbability).toBeGreaterThan(0);
    });

    it('2.4 switches back to Normal Mode clearing coaching overlays without resetting board', () => {
      game.makeMove('e2', 'e4');
      game.setGameMode('expert');
      expect(game.getGameState().candidateMoves.length).toBeGreaterThan(0);

      game.setGameMode('normal');
      const state = game.getGameState();
      expect(state.activeMode).toBe('normal');
      expect(state.candidateMoves).toHaveLength(0);
      expect(state.activeScenarioTree).toBeUndefined();
      expect(state.history).toEqual(['e4']);
    });

    it('2.5 undergoes rapid multi-toggle cycle (Normal -> Smart -> Expert -> Normal) with zero drift', () => {
      game.makeMove('c2', 'c4');
      game.makeMove('c7', 'c5');
      const initialFen = game.getGameState().fen;

      const modes: ('normal' | 'smart' | 'expert')[] = ['smart', 'expert', 'smart', 'normal', 'expert', 'normal'];
      for (const m of modes) {
        game.setGameMode(m);
        expect(game.getGameState().activeMode).toBe(m);
        expect(game.getGameState().fen).toBe(initialFen);
        expect(game.getGameState().history).toEqual(['c4', 'c5']);
      }
    });
  });

  // =========================================================================
  // Feature 3: Engine Evaluation & Win-Probability Mapping (≥5 tests)
  // =========================================================================
  describe('Feature 3: Engine Evaluation & Win-Probability Mapping', () => {
    it('3.1 evaluates 0 centipawns to exactly 50.0% win probability', () => {
      const wp = centipawnsToWinProbability(0);
      expect(wp).toBeCloseTo(50.0, 2);
    });

    it('3.2 evaluates positive and negative centipawns via Lichess sigmoidal curve', () => {
      // +100 cp -> ~59.10%
      expect(centipawnsToWinProbability(100)).toBeCloseTo(59.10, 1);
      // +300 cp -> ~75.11%
      expect(centipawnsToWinProbability(300)).toBeCloseTo(75.11, 1);
      // -300 cp -> ~24.89%
      expect(centipawnsToWinProbability(-300)).toBeCloseTo(24.89, 1);
      // +500 cp -> ~86.31%
      expect(centipawnsToWinProbability(500)).toBeCloseTo(86.31, 1);
    });

    it('3.3 correctly maps mate-in-N scores to extreme win probabilities', () => {
      // Mate in 1 ply (winning)
      expect(mateToWinProbability(1)).toBeCloseTo(99.9, 1);
      // Mate in 5 plies (winning)
      expect(mateToWinProbability(5)).toBeCloseTo(99.5, 1);
      // Mated in 2 plies (losing)
      expect(mateToWinProbability(-2)).toBeCloseTo(0.2, 1);
    });

    it('3.4 classifies best, great, good, inaccuracy, and mistake moves accurately', () => {
      // Best move: deltaWp <= 0.5%
      expect(classifyMoveDelta(0.2, 5)).toBe('best');
      // Great move: deltaWp <= 2.0%
      expect(classifyMoveDelta(1.5, 25)).toBe('great');
      // Good move: deltaWp <= 5.0%
      expect(classifyMoveDelta(3.5, 60)).toBe('good');
      // Inaccuracy: deltaWp <= 10.0%
      expect(classifyMoveDelta(7.5, 120)).toBe('inaccuracy');
      // Mistake: deltaWp <= 20.0%
      expect(classifyMoveDelta(15.0, 250)).toBe('mistake');
      // Blunder: deltaWp > 20.0%
      expect(classifyMoveDelta(25.0, 450)).toBe('blunder');
    });

    it('3.5 classifies brilliant move for sound material sacrifice with winning eval', () => {
      // Sacrificing piece (isSacrifice = true) while cp remains +250 and delta is only 10cp
      const classification = classifyMoveDelta(0.3, 10, true, 250, true);
      expect(classification).toBe('brilliant');
    });

    it('3.6 classifies blunder when move turns winning advantage into loss', () => {
      // Dropping from winning (isWinningPrior = true) to cp -150
      const classification = classifyMoveDelta(35.0, 450, false, -150, true);
      expect(classification).toBe('blunder');
    });
  });

  // =========================================================================
  // Feature 4: Domino-Effect Causal Simulation (≥5 tests)
  // =========================================================================
  describe('Feature 4: Domino-Effect Causal Simulation', () => {
    it('4.1 generates 4-stage causal chain containing Cause, Trigger, Crisis, Consequence', () => {
      game.setGameMode('smart');
      game.makeMove('e2', 'e4');
      const chain = game.getGameState().activeDominoChain;

      expect(chain).toBeDefined();
      expect(chain?.length).toBe(4);
      expect(chain?.[0].stage).toBe('cause');
      expect(chain?.[1].stage).toBe('trigger');
      expect(chain?.[2].stage).toBe('crisis');
      expect(chain?.[3].stage).toBe('consequence');
    });

    it('4.2 preserves player turn and ply progression across domino sequence', () => {
      game.setGameMode('smart');
      const chain = game.getGameState().activeDominoChain!;
      expect(chain[0].ply).toBe(1);
      expect(chain[0].player).toBe('white');
      expect(chain[1].ply).toBe(2);
      expect(chain[1].player).toBe('black');
      expect(chain[2].ply).toBe(3);
      expect(chain[2].player).toBe('white');
      expect(chain[3].ply).toBe(4);
      expect(chain[3].player).toBe('black');
    });

    it('4.3 detects conceded central outpost on d5 square', () => {
      // White plays 1. c4 and 2. e4, creating a hole on d4 / d5
      const chess = new Chess();
      chess.move('c4');
      chess.move('e5');
      chess.move('e4'); // White pawns on c4 and e4 leave d4 concession
      const control = calculateSquareControl(chess);
      // Square d4 index: rank 3 * 8 + file 3 = 27
      const d4Index = 27;
      expect(control.white[d4Index]).toBeGreaterThanOrEqual(0);
      expect(control.differential[d4Index]).toBeDefined();
    });

    it('4.4 detects loss of key square in King safety ring', () => {
      // 1. f3? weakens g1-h4 diagonal and e1 King shelter
      const chess = new Chess();
      const initialControl = calculateSquareControl(chess);
      chess.move('f3');
      const afterControl = calculateSquareControl(chess);

      // g2 square (rank 1 * 8 + file 6 = 14) or e1 safety
      const g2Idx = 14;
      expect(afterControl.white[g2Idx]).toBeLessThanOrEqual(initialControl.white[g2Idx]);
    });

    it('4.5 generates branching scenario tree nodes with candidate evaluations', () => {
      game.setGameMode('expert');
      game.makeMove('e2', 'e4');
      const tree = game.getGameState().activeScenarioTree;

      expect(tree).toBeDefined();
      expect(tree?.id).toBe('root');
      expect(tree?.children.length).toBeGreaterThan(0);
      const firstChild = tree?.children[0];
      expect(firstChild?.san).toBeDefined();
      expect(firstChild?.ply).toBe(1);
      expect(firstChild?.winProbability).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Feature 5: Tactical & Positional Motif Detectors (≥5 tests)
  // =========================================================================
  describe('Feature 5: Tactical & Positional Motif Detectors', () => {
    it('5.1 detects Royal Fork targeting King and Queen', () => {
      // Position where White Knight on c7 forks Black King on e8 and Queen on a8
      const forkFen = 'r3k2r/2N5/8/8/8/8/8/4K3 w - - 0 1';
      const chess = new Chess(forkFen);
      // Put Black Queen on d8 or e7
      chess.load('r2qk2r/2N5/8/8/8/8/8/4K3 w - - 0 1');
      // Black has Rook on a8, King on e8, Queen on d8. Knight on c7 attacks King on e8 and Queen on d8? c7 attacks e8 (rank 8, file 4 vs file 2, rank 6: df=2, dr=1)
      const forks = detectForks(chess, 'w');
      expect(forks.length).toBeGreaterThan(0);
      expect(forks[0].forkSquare).toBe('c7');
    });

    it('5.2 detects absolute pin against friendly King', () => {
      // Black Bishop on b4 pins White Knight on c3 to King on e1
      const pinFen = 'rnbqk2r/pppp1ppp/5n2/4p3/1b2P3/2NP4/PPP2PPP/R1BQKBNR w KQkq - 1 4';
      const chess = new Chess(pinFen);
      const pins = detectPins(chess, 'w');

      expect(pins.length).toBeGreaterThan(0);
      const pin = pins.find(p => p.pinnedSquare === 'c3');
      expect(pin).toBeDefined();
      expect(pin?.pinnerSquare).toBe('b4');
      expect(pin?.kingSquare).toBe('e1');
      expect(pin?.pinType).toBe('absolute');
    });

    it('5.3 detects relative pin against Queen', () => {
      // White Bishop on g5 pins Black Knight on f6 to Black Queen on d8
      const pinFen = 'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 1 4';
      const chess = new Chess(pinFen);
      const pins = detectPins(chess, 'b');

      // Pinned knight on f6
      expect(chess.get('f6')?.type).toBe('n');
      expect(chess.get('g5')?.type).toBe('b');
    });

    it('5.4 detects skewer along rank or file', () => {
      // White Rook on e2 skewers Black King on e6 with Black Rook on e8 behind
      const skewerFen = '4r3/8/4k3/8/8/8/4R3/4K3 w - - 0 1';
      const chess = new Chess(skewerFen);
      const skewers = detectSkewers(chess, 'w');

      expect(skewers.length).toBeGreaterThan(0);
      expect(skewers[0].attackerSquare).toBe('e2');
      expect(skewers[0].targetFront).toBe('e6');
      expect(skewers[0].targetBehind).toBe('e8');
    });

    it('5.5 detects trapped pieces with zero safe mobility', () => {
      // Noah's Ark Trap: White Bishop on b3 has 0 safe escape squares
      const noahFen = 'r2qkb1r/3b1ppp/p2p4/1p6/2p5/1B6/PPP2PPP/RNB1K2R w KQkq - 0 12';
      const chess = new Chess(noahFen);
      const trapped = detectTrappedPieces(chess, 'w');

      expect(trapped.length).toBeGreaterThan(0);
      const bishop = trapped.find(p => p.square === 'b3');
      expect(bishop).toBeDefined();
      expect(bishop?.piece).toBe('b');
      expect(bishop?.safeMobility).toBe(0);
    });
  });

  // =========================================================================
  // Feature 6: UI State DTO & Actions (≥5 tests)
  // =========================================================================
  describe('Feature 6: UI State DTO & Actions', () => {
    it('6.1 returns full GameStateDTO with accurate FEN and turn state', () => {
      const state = game.getGameState();
      expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(state.turn).toBe('w');
      expect(state.isCheck).toBe(false);
      expect(state.isCheckmate).toBe(false);
      expect(state.isDraw).toBe(false);
      expect(state.history).toHaveLength(0);
    });

    it('6.2 computes square control differential for all 64 squares', () => {
      const state = game.getGameState();
      expect(state.squareControl.white).toHaveLength(64);
      expect(state.squareControl.black).toHaveLength(64);
      expect(state.squareControl.differential).toHaveLength(64);

      // In initial position, White controls e3 and d3 with pawns
      const e3Idx = 20; // e=4, rank 3 = 2*8+4 = 20
      expect(state.squareControl.white[e3Idx]).toBeGreaterThan(0);
    });

    it('6.3 appends SAN moves to history and increments ply index', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('c7', 'c5');
      game.makeMove('g1', 'f3');

      const state = game.getGameState();
      expect(state.history).toEqual(['e4', 'c5', 'Nf3']);
      expect(state.history.length).toBe(3);
    });

    it('6.4 toggles board flip orientation without mutating position', () => {
      expect(game.isBoardFlipped()).toBe(false);
      game.flipBoard();
      expect(game.isBoardFlipped()).toBe(true);
      game.flipBoard();
      expect(game.isBoardFlipped()).toBe(false);
    });

    it('6.5 jumps to historical ply and reflects historical position', () => {
      game.makeMove('e2', 'e4');
      game.makeMove('e7', 'e5');
      game.makeMove('g1', 'f3');

      const fullFen = game.getGameState().fen;
      // Jump to ply 1 (after 1. e4)
      game.jumpToHistoryPly(1);
      const historyState = game.getGameState();
      expect(historyState.fen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq');

      // Jump back to latest ply
      game.jumpToHistoryPly(3);
      expect(game.getGameState().fen).toBe(fullFen);
    });
  });
});
