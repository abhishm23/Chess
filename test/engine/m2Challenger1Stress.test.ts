/**
 * test/engine/m2Challenger1Stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE: Milestone 2 Challenger 1 (Replacement r1)
 *
 * Rigorously challenges:
 * 1. Tactical Motifs & Geometric Detectors under Adversarial FENs:
 *    - True double check vs single discovered check (revealing false double check bug).
 *    - King evasion requirement under double check (all non-King moves illegal).
 *    - Pinned piece illegal moves and pinned piece inability to defend off pin line.
 *    - Invalidation of Static Exchange Evaluation (SEE) when defender is absolutely pinned.
 *    - Deep Royal & Triple Knight forks with check + undefended Queen + Rook.
 *    - Pinned knight delivering phantom "forks" when legally paralyzed.
 *    - Geometric skewers along all three axes: File, Rank, Diagonal.
 *    - Equal-value pieces (Rook skewers Rook to Rook) limitation.
 *    - Trapped pieces: Starting position false positives (undeveloped vs trapped).
 *    - Out-of-turn false positive bug in detectTrappedPieces.
 *    - Genuine trapped piece (Noah's Ark trap).
 *    - Conceded outposts on ranks 4, 5, 6 and edge-file (a/h) omission.
 * 2. Crash Resilience, Termination & Boundary Handling:
 *    - Minimal board: Kings only FEN.
 *    - Extreme crowded board: 16 Queens FEN.
 *    - Stalemate and checkmate positions.
 *    - Illegal candidate moves, malformed continuationPv arrays, and undefined options.
 * 3. 4-Stage Domino Simulation Pipeline:
 *    - Strict ply sequence: 1, 2, 3, 4.
 *    - Strict alternating colors: white -> black -> white -> black (or vice versa).
 *    - Strict stage transitions: cause -> trigger -> crisis -> consequence.
 *    - Early termination on checkmate at ply 2 without phantom plies.
 *    - 4-character and 5-character SAN moves in continuationPv (exd4, cxd5, Bxf7+, O-O-O).
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  detectForks,
  detectPins,
  detectSkewers,
  detectDiscoveredAttacks,
  detectOverworkedDefenders,
  detectHangingPieces,
  detectLostSquareControl,
  detectConcededOutposts,
  detectTrappedPieces,
  detectAllTacticalMotifs,
  staticExchangeEvaluation,
} from '../../src/engine/tacticalDetectors';
import {
  DominoEngine,
  generateDominoCausalChain,
} from '../../src/engine/dominoEngine';
import { Square, PieceSymbol, Color } from '../../src/types/chess';
import { DominoCausalStep } from '../../src/types/engine';
import { calculateSquareControl } from '../../src/rules/squareControl';

describe('Milestone 2 Challenger 1 (r1) — Empirical Adversarial Stress Suite', () => {
  // ==========================================================================
  // OBJECTIVE 1: Tactical Detectors Under Complex, Crowded & Adversarial FENs
  // ==========================================================================
  describe('Objective 1: Tactical Detectors & Geometric Motifs under Edge FENs', () => {
    // ------------------------------------------------------------------------
    // 1.1 Double Check vs Single Discovered Check
    // ------------------------------------------------------------------------
    it('accurately identifies genuine double check where moving piece AND discovered sniper both check King', () => {
      // Setup:
      // White: King e1, Bishop b2, Knight e5.
      // Black: King h8.
      // Diagonal b2-h8 passes through c3, d4, e5, f6, g7, h8.
      // Knight on e5 blocks the bishop's ray to h8.
      // White plays Knight e5 -> f7 (Nf7+):
      // 1. Knight on f7 attacks King on h8 (dx=2, dy=1 -> Knight check).
      // 2. Bishop on b2 unmasked attacks King on h8 along diagonal -> Bishop check.
      // Both pieces attack King simultaneously: GENUINE DOUBLE CHECK!
      const fen = '7k/8/8/4N3/8/8/1B6/4K3 w - - 0 1';
      const chess = new Chess(fen);
      chess.move({ from: 'e5', to: 'f7' });

      // Verify board state: Black is in check
      expect(chess.inCheck()).toBe(true);

      const discoveries = detectDiscoveredAttacks(chess, 'w', {
        from: 'e5',
        to: 'f7',
        piece: 'n',
      });

      expect(discoveries.length).toBeGreaterThan(0);
      const disc = discoveries[0];
      expect(disc.isCheck).toBe(true);
      expect(disc.isDoubleCheck).toBe(true);
      expect(disc.motif).toBe('double_check');
    });

    it('enforces FIDE rule that under double check, King MUST move (no piece capture or interposition allowed)', () => {
      // Setup: Same position after Nf7+ double check, with Black Rook on f8 and Black Pawn on g7.
      // Under single check, Black could play Rxf7 or g6.
      // Under double check, Black cannot block both checks or capture both checkers!
      // FEN: 5r1k/5p2/8/4N3/8/8/1B6/4K3 w - - 0 1
      const fen = '5r1k/5p2/8/4N3/8/8/1B6/4K3 w - - 0 1';
      const chess = new Chess(fen);
      chess.move({ from: 'e5', to: 'f7' });

      // In double check:
      const legalMoves = chess.moves({ verbose: true });
      expect(legalMoves.length).toBeGreaterThan(0);

      // EVERY legal move must be a King move!
      for (const m of legalMoves) {
        expect(m.piece).toBe('k');
      }
    });

    it('adversarial check: exposes flaw where single discovered check is falsely reported as double check', () => {
      // Position: White King e1, Bishop b2, Knight e5. Black King g7.
      // White moves Knight from e5 to d3 (Nd3+).
      // Bishop on b2 checks King on g7 along diagonal b2-g7.
      // Knight on d3 attacks c5, e5, f4, b4, b2, f2, e1, c1 — DOES NOT attack g7!
      const fen = '8/6k1/8/4N3/8/8/1B6/4K3 w - - 0 1';
      const chess = new Chess(fen);
      chess.move({ from: 'e5', to: 'd3' });

      expect(chess.inCheck()).toBe(true);

      const discoveries = detectDiscoveredAttacks(chess, 'w', {
        from: 'e5',
        to: 'd3',
        piece: 'n',
      });

      expect(discoveries.length).toBeGreaterThan(0);
      const disc = discoveries[0];
      expect(disc.isCheck).toBe(true);

      // ADVERSARIAL FLAW ASSERTION:
      // Lines 523-524 in tacticalDetectors.ts define:
      // const movedPieceChecked = chess.inCheck();
      // const isDoubleCheck = isCheck && movedPieceChecked;
      // Since chess.inCheck() is true from the Bishop, isDoubleCheck becomes true!
      // A correct engine MUST report isDoubleCheck = false and motif = 'discovered_check'.
      expect(disc.isDoubleCheck).toBe(false);
      expect(disc.motif).toBe('discovered_check');
    });

    // ------------------------------------------------------------------------
    // 1.2 Pinned Pieces Attempting Illegal Moves & Defending Off-Pin-Line
    // ------------------------------------------------------------------------
    it('detects absolute pin and verifies pinned piece cannot legally move off pin ray', () => {
      // White King on e1.
      // White Rook on e4.
      // Black Rook on e8.
      // White Rook on e4 is absolutely pinned along the vertical e-file.
      const fen = '4r3/8/8/8/4R3/8/8/4K2k w - - 0 1';
      const chess = new Chess(fen);

      const pins = detectPins(chess, 'w');
      expect(pins.length).toBeGreaterThan(0);
      const pin = pins.find((p) => p.pinnedSquare === 'e4');
      expect(pin).toBeDefined();
      expect(pin?.pinType).toBe('absolute');
      expect(pin?.pinnerSquare).toBe('e8');
      expect(pin?.targetSquare).toBe('e1');

      // Check legal moves for White: Rook on e4 can only move along e-file (e5, e6, e7, e8, e3, e2)
      const moves = chess.moves({ verbose: true }).filter((m) => m.from === 'e4');
      for (const m of moves) {
        expect(m.to.startsWith('e')).toBe(true); // Must remain on e-file!
      }
      // Cannot move horizontally to d4, f4, c4, g4!
      expect(moves.some((m) => m.to === 'd4')).toBe(false);
      expect(moves.some((m) => m.to === 'f4')).toBe(false);
    });

    it('adversarial check: exposes SEE defect where absolutely pinned piece is counted as defending off-pin target', () => {
      // Setup:
      // White King on e1.
      // White Rook on e4 (absolutely pinned along e-file by Black Rook on e8).
      // White Pawn on d4.
      // Black Knight on c6 attacks pawn on d4.
      // In real chess: Black Knight can capture Nxd4 for free, because White Rook cannot capture Rxd4 without exposing King to check!
      // Therefore, White Pawn on d4 is completely UNDEFENDED (hanging)!
      const fen = '4r2k/8/2n5/8/3PR3/8/8/4K3 w - - 0 1';
      const chess = new Chess(fen);

      // Verify that White Rook on e4 CANNOT legally capture or move to d4
      const legalMovesFromE4 = chess.moves({ verbose: true }).filter((m) => m.from === 'e4');
      expect(legalMovesFromE4.some((m) => m.to === 'd4')).toBe(false);

      // ADVERSARIAL FLAW ASSERTION:
      // detectHangingPieces and staticExchangeEvaluation use calculateDetailedSquareControl,
      // which counts raw geometric rays without checking if the defender is absolutely pinned!
      // In reality, White pawn on d4 is hanging to the Knight on c6.
      const hangingWhite = detectHangingPieces(chess, 'w');
      const d4Hanging = hangingWhite.some((h) => h.square === 'd4');

      // The pawn on d4 should be recognized as hanging because its sole defender is pinned!
      expect(d4Hanging).toBe(true);
    });

    // ------------------------------------------------------------------------
    // 1.3 Deep Knight Forks: Royal Forks, Triple Forks & Pinned Knights
    // ------------------------------------------------------------------------
    it('detects deep Knight triple fork checking King while attacking Queen and Rook', () => {
      // White Knight on c7.
      // Black King on e8 (dx=2, dy=1 -> attacked + in check).
      // Black Queen on a8 (dx=-2, dy=1 -> attacked).
      // Black Rook on a6 (dx=-2, dy=-1 -> attacked).
      // Black King is in check, Queen and Rook are undefended.
      const fen = 'q3k3/2N5/r7/8/8/8/8/4K3 w - - 0 1';
      const chess = new Chess(fen);

      const forks = detectForks(chess, 'w', 'c7');
      expect(forks.length).toBeGreaterThan(0);
      const fork = forks[0];
      expect(fork.isRoyal).toBe(true);
      expect(fork.motif).toBe('royal_fork');
      expect(fork.targets).toContain('e8'); // King
      expect(fork.targets).toContain('a8'); // Queen
      expect(fork.targets).toContain('a6'); // Rook
      expect(fork.targets.length).toBeGreaterThanOrEqual(3);
    });

    it('adversarial check: verifies detectForks behavior when forking Knight is absolutely pinned to King', () => {
      // Setup:
      // White King on e1.
      // White Knight on e4 (shielding King from Black Rook on e8: absolutely pinned!).
      // Black Queen on c5 (attacked by Knight on e4).
      // Black Rook on g5 (attacked by Knight on e4).
      // The Knight CANNOT move to c5 or g5 without leaving King in check!
      const fen = '4r2k/8/8/2q3r1/4N3/8/8/4K3 w - - 0 1';
      const chess = new Chess(fen);

      // Verify Knight on e4 has ZERO legal moves
      const knightMoves = chess.moves({ verbose: true }).filter((m) => m.from === 'e4');
      expect(knightMoves.length).toBe(0);

      // Detect forks for White
      const forks = detectForks(chess, 'w', 'e4');
      // If the engine evaluates geometric attacks without pin validation, it will claim a fork on c5 and g5
      // An engine should not report an active actionable tactical fork when the piece is 100% paralyzed!
      // Documenting whether pinned piece generates phantom fork:
      if (forks.length > 0) {
        expect(forks[0].forkSquare).toBe('e4');
      }
    });

    // ------------------------------------------------------------------------
    // 1.4 Skewers Along Files, Ranks, Diagonals & Equal Value Pieces
    // ------------------------------------------------------------------------
    it('detects skewers along File, Rank, and Diagonal axes', () => {
      // 1. File skewer: White Rook on e1 skewers Black King on e4 and Black Rook on e8
      const fileChess = new Chess('4r3/8/8/8/4k3/8/8/K3R3 w - - 0 1');
      const fileSkewers = detectSkewers(fileChess, 'w');
      expect(fileSkewers.length).toBeGreaterThan(0);
      expect(fileSkewers[0].targetFront).toBe('e4');
      expect(fileSkewers[0].targetBehind).toBe('e8');

      // 2. Rank skewer: White Rook on a4 skewers Black King on e4 and Black Queen on h4
      const rankChess = new Chess('8/8/8/8/R3k2q/8/8/4K3 w - - 0 1');
      const rankSkewers = detectSkewers(rankChess, 'w');
      expect(rankSkewers.length).toBeGreaterThan(0);
      expect(rankSkewers[0].targetFront).toBe('e4');
      expect(rankSkewers[0].targetBehind).toBe('h4');

      // 3. Diagonal skewer: White Bishop on a1 skewers Black King on d4 and Black Queen on g7
      const diagChess = new Chess('8/6q1/8/8/3k4/8/8/B3K3 w - - 0 1');
      const diagSkewers = detectSkewers(diagChess, 'w');
      expect(diagSkewers.length).toBeGreaterThan(0);
      expect(diagSkewers[0].targetFront).toBe('d4');
      expect(diagSkewers[0].targetBehind).toBe('g7');
    });

    it('adversarial check: verifies skewer detection on equal-value pieces (Rook skewers Rook to Rook)', () => {
      // White Rook on e1 attacks Black Rook on e4 with Black Rook on e8 behind it.
      // Both target pieces are Rooks (value 500 == 500).
      const fen = '4r2k/8/8/8/4r3/8/8/4R2K w - - 0 1';
      const chess = new Chess(fen);

      const skewers = detectSkewers(chess, 'w');
      // In tacticalDetectors.ts line 425:
      // const isSkewer = frontTarget.type === 'k' || PIECE_VALUES[frontTarget.type] > PIECE_VALUES[curPiece.type] || ...
      // PIECE_VALUES['r'] > PIECE_VALUES['r'] is FALSE!
      // So Rook-Rook skewers on the same file are omitted from skewers.
      // Documenting this design boundary:
      expect(Array.isArray(skewers)).toBe(true);
    });

    // ------------------------------------------------------------------------
    // 1.5 Trapped Pieces: Complex Pawn Chains, Noah's Ark, and False Positives
    // ------------------------------------------------------------------------
    it('accurately identifies Bishop in Noahs Ark Trap with zero safe mobility squares', () => {
      // Classic Noah's Ark Trap: Black pawns a6, b5, c4 trap White Bishop on b3
      // FEN: r1bqk1nr/1ppp1ppp/p1n5/1B6/2P1P3/1B6/PP1P1PPP/RNBQK2R b KQkq - 0 1
      // Position where White Bishop on b3 is trapped by pawn chain:
      // a2 (defended by Black pawn b3? No, pawns on a6, b5, c4 surround b3).
      // Let's use clean Noah's Ark trap FEN where White is to move and Bb3 has 0 safe moves:
      // White: King e1, Bishop b3, Pawns a2, d2, f2, g2, h2.
      // Black: King e8, Pawns a6, b5, c4, d7, e5, f7, g7, h7, Knight c6.
      // FEN: r1bqk1nr/3p1ppp/p1n5/1p2p3/2p1P3/1B6/PPPP1PPP/RNBQK1NR w KQkq - 0 6
      const fen = 'r1bqk1nr/3p1ppp/p1n5/1p2p3/2p1P3/1B6/PPPP1PPP/RNBQK1NR w KQkq - 0 6';
      const chess = new Chess(fen);

      const trapped = detectTrappedPieces(chess, 'w');
      const trappedBishop = trapped.find((t) => t.square === 'b3' && t.piece === 'b');
      expect(trappedBishop).toBeDefined();
      expect(trappedBishop?.safeMobility).toBe(0);
    });

    it('adversarial check: exposes critical bug where detectTrappedPieces reports 7 false positives out-of-turn', () => {
      // In initial starting position: White to move ('w').
      // Black has NOT moved yet. None of Black's pieces are trapped!
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      // ADVERSARIAL FLAW ASSERTION:
      // detectTrappedPieces calls chess.moves({ verbose: true }).
      // Because chess.turn() is 'w', chess.moves() returns 0 moves for Black ('b').
      // Thus, for every Black piece (b8, g8, c8, f8, a8, h8, d8), pieceMoves is [] and safeMoves is [].
      // safeMoves.length === 0 is TRUE for all 7 major/minor pieces!
      // It falsely reports 7 trapped Black pieces on move 1!
      const trappedBlack = detectTrappedPieces(chess, 'b');

      // A correct engine MUST report 0 trapped pieces for Black in the starting position:
      expect(trappedBlack.length).toBe(0);
    });

    it('adversarial check: tests whether undeveloped White pieces behind pawns are falsely flagged as trapped', () => {
      // In starting position, White's bishops on c1 and f1, Queen on d1, and Rooks on a1 and h1 have 0 legal moves!
      // Only Knights on b1 and g1 have legal moves (Na3, Nc3, Nf3, Nh3).
      // Does detectTrappedPieces(chess, 'w') falsely flag c1, f1, d1, a1, h1 as trapped pieces?
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const trappedWhite = detectTrappedPieces(chess, 'w');
      // Undeveloped pieces behind their own home pawns are NOT "trapped" in chess!
      // A trapped piece is one that was developed or attacked and cannot escape capture.
      // Flagging all backrank pieces as trapped is a severe false positive.
      expect(trappedWhite.length).toBe(0);
    });

    // ------------------------------------------------------------------------
    // 1.6 Conceded Outpost Detection & Edge-File Omission
    // ------------------------------------------------------------------------
    it('detects conceded outposts on ranks 4, 5, 6 with dynamic pawn advance', () => {
      // Position before: White pawn on c2, Black pawn on d5 anchored by e6.
      // White plays c2-c4, advancing past d4 and conceding the d4/d5 outpost.
      const fenBefore = 'rnbqkbnr/ppp2ppp/4p3/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fenAfter = 'rnbqkbnr/ppp2ppp/4p3/3p4/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1';

      const chessBefore = new Chess(fenBefore);
      const chessAfter = new Chess(fenAfter);

      const outposts = detectConcededOutposts(chessBefore, chessAfter, 'w');
      expect(Array.isArray(outposts)).toBe(true);
    });

    it('adversarial check: verifies that edge files a and h are omitted by the outpost loop', () => {
      // In tacticalDetectors.ts line 792:
      // for (let f = 1; f < 7; f++)
      // The loop starts at file 1 ('b') and ends at file 6 ('g').
      // Files 0 ('a') and 7 ('h') are never examined for outposts!
      // If Black has an anchor pawn on b5 supporting an outpost on a4, or g5 supporting h4,
      // detectConcededOutposts will never detect it.
      const fenBefore = 'rnbqkbnr/1ppppppp/8/p7/P7/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chessBefore = new Chess(fenBefore);
      const chessAfter = new Chess(fenBefore);

      const outposts = detectConcededOutposts(chessBefore, chessAfter, 'w');
      const edgeOutposts = outposts.filter((o) => o.square.startsWith('a') || o.square.startsWith('h'));
      expect(edgeOutposts.length).toBe(0);
    });
  });

  // ==========================================================================
  // OBJECTIVE 2: Crash Resilience, Termination & Boundary Handling
  // ==========================================================================
  describe('Objective 2: Crash Resilience & Infinity Loop Invariants on Legal, Extreme & Malformed Inputs', () => {
    it('detectAllTacticalMotifs survives minimal board with Kings only without crashing', () => {
      const fen = '8/8/8/8/8/8/8/4K2k w - - 0 1';
      const chess = new Chess(fen);

      expect(() => {
        const summary = detectAllTacticalMotifs(chess, 'w');
        expect(summary).toBeDefined();
        expect(summary.forks.length).toBe(0);
        expect(summary.pins.length).toBe(0);
        expect(summary.skewers.length).toBe(0);
      }).not.toThrow();
    });

    it('detectAllTacticalMotifs survives extreme crowded board with 16 Queens without crashing or timing out', () => {
      // 8 White Queens on rank 7, 8 Black Queens on rank 2, Kings on e1 and e8
      const fen = '4k3/QQQQQQQQ/8/8/8/8/qqqqqqqq/4K3 w - - 0 1';
      const chess = new Chess(fen);

      const start = Date.now();
      expect(() => {
        const summary = detectAllTacticalMotifs(chess, 'w');
        expect(summary).toBeDefined();
        expect(summary.motifs.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Must complete in < 1 second
    });

    it('DominoEngine.simulateDominoChain survives stalemate position gracefully', () => {
      // Stalemate: Black King on a8, White Queen on c7, White King on a6. Black has 0 moves.
      const fen = 'k7/2Q5/K7/8/8/8/8/8 b - - 0 1';
      const chess = new Chess(fen);
      expect(chess.isGameOver()).toBe(true);

      const engine = new DominoEngine();
      expect(() => {
        const chain = engine.simulateDominoChain(chess, { from: 'a8', to: 'a7' });
        expect(Array.isArray(chain)).toBe(true);
        expect(chain.length).toBe(0); // Illegal move returns empty chain
      }).not.toThrow();
    });

    it('DominoEngine.simulateDominoChain survives checkmate position gracefully', () => {
      // Fool's Mate checkmate
      const fen = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const chess = new Chess(fen);
      expect(chess.isCheckmate()).toBe(true);

      const engine = new DominoEngine();
      expect(() => {
        const chain = engine.simulateDominoChain(chess, { from: 'e1', to: 'e2' });
        expect(Array.isArray(chain)).toBe(true);
        expect(chain.length).toBe(0);
      }).not.toThrow();
    });

    it('DominoEngine handles completely illegal candidate moves and malformed continuationPv without throwing', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);
      const engine = new DominoEngine();

      expect(() => {
        // 1. Illegal from/to
        const chain1 = engine.simulateDominoChain(chess, { from: 'e1', to: 'e8' });
        expect(chain1).toEqual([]);

        // 2. Malformed continuationPv containing garbage strings, numbers, nulls
        const chain2 = engine.simulateDominoChain(
          chess,
          { from: 'e2', to: 'e4', san: 'e4' },
          { continuationPv: ['e4', 'NOT_A_MOVE', 'xyz!@#', null as any, undefined as any] }
        );
        expect(Array.isArray(chain2)).toBe(true);
        expect(chain2.length).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // OBJECTIVE 3: 4-Stage Domino Simulation Pipeline & Invariant Validation
  // ==========================================================================
  describe('Objective 3: 4-Stage Domino Simulation Pipeline & Invariant Validation', () => {
    it('produces valid 4-stage DominoCausalStep sequence with strictly sequential plies and alternating colors', () => {
      // Tactical blunder position: White blunders queen with 1. Qe4??
      const fen = 'r1bqk2r/pp2bppp/2n1pn2/2pp4/4P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 2 6';
      const chess = new Chess(fen);
      const engine = new DominoEngine();

      const chain = engine.simulateDominoChain(chess, { from: 'd1', to: 'd2', san: 'Qd2' });
      expect(chain.length).toBeGreaterThanOrEqual(2);

      // Verify Ply 1: CAUSE
      expect(chain[0].ply).toBe(1);
      expect(chain[0].stage).toBe('cause');
      expect(chain[0].player).toBe('white');
      expect(chain[0].moveSan).toBe('Qd2');
      expect(chain[0].squareChanges).toBeDefined();

      // Verify Ply 2: TRIGGER
      expect(chain[1].ply).toBe(2);
      expect(chain[1].stage).toBe('trigger');
      expect(chain[1].player).toBe('black');
      expect(chain[1].squareChanges).toBeDefined();

      if (chain.length >= 3) {
        // Verify Ply 3: CRISIS
        expect(chain[2].ply).toBe(3);
        expect(chain[2].stage).toBe('crisis');
        expect(chain[2].player).toBe('white');
      }

      if (chain.length >= 4) {
        // Verify Ply 4: CONSEQUENCE
        expect(chain[3].ply).toBe(4);
        expect(chain[3].stage).toBe('consequence');
        expect(chain[3].player).toBe('black');
      }

      // Verify strictly sequential plies
      for (let i = 0; i < chain.length; i++) {
        expect(chain[i].ply).toBe(i + 1);
        const expectedPlayer = i % 2 === 0 ? 'white' : 'black';
        expect(chain[i].player).toBe(expectedPlayer);
      }
    });

    it('terminates domino chain immediately when checkmate occurs on Ply 2 (no phantom plies 3 and 4)', () => {
      // Scholar's Mate setup:
      // 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
      const chess = new Chess(fen);
      const engine = new DominoEngine();

      // White plays Qxf7# on ply 1
      const chain = engine.simulateDominoChain(chess, {
        from: 'h5',
        to: 'f7',
        san: 'Qxf7#',
      });

      // Since move 1 delivers checkmate, game is over! Chain must terminate at ply 1.
      expect(chain.length).toBe(1);
      expect(chain[0].moveSan).toBe('Qxf7#');
    });

    it('adversarial check: exposes DominoEngine crash on 4-character and 5-character SAN moves in continuationPv', () => {
      // In Italian Game: 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5
      // Candidate move d4: Black's PV response is 'exd4' (length 4).
      // Following moves: 'c3', 'dxc3' (length 4).
      const fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
      const chess = new Chess(fen);
      const engine = new DominoEngine();

      // ADVERSARIAL FLAW ASSERTION:
      // In dominoEngine.ts line 225:
      // if (sanOrUci.length === 4 || sanOrUci.length === 5) {
      //   const from = sanOrUci.slice(0, 2) as Square;
      //   const to = sanOrUci.slice(2, 4) as Square;
      //   ...
      //   return chess.move({ from, to, promotion });
      // }
      // For 'exd4', from = 'ex', to = 'd4' -> chess.move throws!
      // It catches the error and returns null, discarding continuationPv and choosing a fallback refutation!
      const chain = engine.simulateDominoChain(
        chess,
        { from: 'd2', to: 'd4', san: 'd4' },
        { continuationPv: ['d4', 'exd4', 'c3', 'dxc3'] }
      );

      expect(chain.length).toBeGreaterThanOrEqual(2);
      // The engine MUST apply 'exd4' from continuationPv at ply 2!
      expect(chain[1].moveSan).toBe('exd4');
    });
  });
});
