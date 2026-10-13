/**
 * test/engine/tactical.test.ts
 * Benchmark test suite for tactical and positional motif detection.
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  detectPins,
  detectForks,
  detectSkewers,
  detectTrappedPieces,
  detectDiscoveredAttacks,
  detectHangingPieces,
  detectLostSquareControl,
  detectConcededOutposts,
  staticExchangeEvaluation,
  detectAllTacticalMotifs,
} from '../../src/engine/tacticalDetectors';


describe('Tactical Benchmark Suite: Pins, Forks, Skewers & Trapped Pieces', () => {
  // 1. FORK BENCHMARKS
  describe('Fork & Double Attack Detection', () => {
    it('detects Royal Fork targeting King and Queen on c7', () => {
      // White Knight on c7 attacks Black King on e8 and Queen on d5
      const fen = '4k3/2N5/8/3q4/8/8/8/4K3 w - - 0 1';
      const chess = new Chess(fen);
      const forks = detectForks(chess, 'w');

      expect(forks.length).toBeGreaterThan(0);
      const royalFork = forks.find((f) => f.forkSquare === 'c7');
      expect(royalFork).toBeDefined();
      expect(royalFork?.isRoyal).toBe(true);
      expect(royalFork?.targets).toContain('e8');
      expect(royalFork?.targets).toContain('d5');
    });

    it('detects minor piece fork attacking two Rooks', () => {
      // White Knight on e7 attacks Black Rook on c8 and Black Rook on g8
      const fen = '2r3r1/4N3/8/8/8/8/8/4K2k w - - 0 1';
      const chess = new Chess(fen);
      const forks = detectForks(chess, 'w');

      expect(forks.length).toBeGreaterThan(0);
      const fork = forks.find((f) => f.forkSquare === 'e7');
      expect(fork).toBeDefined();
      expect(fork?.targets).toContain('c8');
      expect(fork?.targets).toContain('g8');
    });

    it('detects Pawn Fork attacking two minor pieces', () => {
      // Black Pawn on d4 attacks White Knight on c3 and White Bishop on e3
      const fen = '4k3/8/8/8/3p4/2N1B3/8/4K3 b - - 0 1';
      const chess = new Chess(fen);
      const forks = detectForks(chess, 'b');

      expect(forks.length).toBeGreaterThan(0);
      const pawnFork = forks.find((f) => f.forkSquare === 'd4');
      expect(pawnFork).toBeDefined();
      expect(pawnFork?.targets).toContain('c3');
      expect(pawnFork?.targets).toContain('e3');
    });
  });

  // 2. PIN BENCHMARKS
  describe('Absolute & Relative Pin Detection', () => {
    it('detects Absolute Pin against friendly King (Bishop pinning Knight)', () => {
      // Black Bishop on b4 pins White Knight on c3 to King on e1
      const fen = 'rnbqk2r/pppp1ppp/5n2/4p3/1b2P3/2NP4/PPP2PPP/R1BQKBNR w KQkq - 1 4';
      const chess = new Chess(fen);
      const pins = detectPins(chess, 'w');

      expect(pins.length).toBeGreaterThan(0);
      const pin = pins.find((p) => p.pinnedSquare === 'c3');
      expect(pin).toBeDefined();
      expect(pin?.pinnerSquare).toBe('b4');
      expect(pin?.kingSquare).toBe('e1');
      expect(pin?.pinType).toBe('absolute');
    });

    it('detects Relative Pin against Queen (Bishop pinning Knight to Queen)', () => {
      // White Bishop on g5 pins Black Knight on f6 to Queen on d8
      const fen = 'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 1 4';
      const chess = new Chess(fen);
      const pins = detectPins(chess, 'b');

      expect(pins.length).toBeGreaterThan(0);
      const pin = pins.find((p) => p.pinnedSquare === 'f6');
      expect(pin).toBeDefined();
      expect(pin?.pinnerSquare).toBe('g5');
      expect(pin?.targetSquare).toBe('d8');
      expect(pin?.pinType).toBe('relative');
    });
  });

  // 3. SKEWER BENCHMARKS
  describe('Skewer Detection', () => {
    it('detects horizontal/vertical Skewer (Rook skewers King to Rook)', () => {
      // White Rook on e2 skewers Black King on e6 with Black Rook on e8 behind
      const fen = '4r3/8/4k3/8/8/8/4R3/4K3 w - - 0 1';
      const chess = new Chess(fen);
      const skewers = detectSkewers(chess, 'w');

      expect(skewers.length).toBeGreaterThan(0);
      const skewer = skewers.find((s) => s.attackerSquare === 'e2');
      expect(skewer).toBeDefined();
      expect(skewer?.targetFront).toBe('e6');
      expect(skewer?.targetBehind).toBe('e8');
    });

    it('detects diagonal Skewer (Bishop skewers Queen to Rook)', () => {
      // White Bishop on c3 skewers Black Queen on e5 to Black Rook on g7
      const fen = '8/6r1/8/4q3/8/2B5/8/4K2k w - - 0 1';
      const chess = new Chess(fen);
      const skewers = detectSkewers(chess, 'w');

      expect(skewers.length).toBeGreaterThan(0);
      const skewer = skewers.find((s) => s.attackerSquare === 'c3');
      expect(skewer).toBeDefined();
      expect(skewer?.targetFront).toBe('e5');
      expect(skewer?.targetBehind).toBe('g7');
    });
  });

  // 4. TRAPPED PIECE BENCHMARKS
  describe('Trapped Piece Detection', () => {
    it("detects Noah's Ark Trap (Bishop on b3 has zero safe mobility)", () => {
      // White Bishop on b3 trapped by c4, b5, a6 pawns
      const fen = 'r2qkb1r/3b1ppp/p2p4/1p6/2p5/1B6/PPP2PPP/RNB1K2R w KQkq - 0 12';
      const chess = new Chess(fen);
      const trapped = detectTrappedPieces(chess, 'w');

      expect(trapped.length).toBeGreaterThan(0);
      const bishop = trapped.find((p) => p.square === 'b3');
      expect(bishop).toBeDefined();
      expect(bishop?.piece).toBe('b');
      expect(bishop?.safeMobility).toBe(0);
    });

    it('detects trapped Queen on b2 after greedy pawn grab', () => {
      // Black Queen on b2 trapped by White pieces: all 8 squares are defended
      const fen = 'r1b1k2r/pp1p1ppp/2n1pn2/8/Q7/1NB5/PqPP1PPP/R2K1B1R b KQkq - 1 10';
      const chess = new Chess(fen);
      const trapped = detectTrappedPieces(chess, 'b');

      expect(trapped.length).toBeGreaterThan(0);
      const queen = trapped.find((p) => p.square === 'b2');
      expect(queen).toBeDefined();
      expect(queen?.piece).toBe('q');
      expect(queen?.safeMobility).toBe(0);
    });
  });

  // 5. DISCOVERED ATTACK, HANGING PIECE & STATIC EXCHANGE EVALUATION
  describe('Discovered Attack & SEE Benchmarks', () => {
    it('detects discovered attack with check upon knight departure', () => {
      const fen = 'r1b1kb1r/pppp1ppp/5q2/4n3/3QP3/2N5/PPP2PPP/R1B1KB1R b KQkq - 0 7';
      const chess = new Chess(fen);
      // Move 7... Nf3+
      chess.move({ from: 'e5', to: 'f3' });
      const discoveries = detectDiscoveredAttacks(chess, 'b', {
        from: 'e5',
        to: 'f3',
        piece: 'n',
      });

      expect(discoveries.length).toBeGreaterThan(0);
      const d = discoveries[0];
      expect(d.targetSquare).toBe('d4');
      expect(d.targetPiece).toBe('q');
    });

    it('calculates positive Static Exchange Evaluation for hanging piece', () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5';
      const chess = new Chess(fen);
      const see = staticExchangeEvaluation(chess, 'e4');
      expect(see).toBeGreaterThanOrEqual(200);

      const hanging = detectHangingPieces(chess, 'b');
      expect(hanging.some((h) => h.square === 'e4')).toBe(true);
    });

    it('detects conceded outposts after structural pawn advance', () => {
      const fenBefore = 'r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ1BPPP/R1B2RK1 w - - 4 9';
      const chessBefore = new Chess(fenBefore);
      const chessAfter = new Chess(fenBefore);
      chessAfter.move('c5');

      const outposts = detectConcededOutposts(chessBefore, chessAfter, 'w');
      expect(outposts.length).toBeGreaterThan(0);
    });

    it('detects compromised king shelter after reckless pawn push', () => {
      const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chessBefore = new Chess(fenBefore);
      const chessAfter = new Chess(fenBefore);
      chessAfter.move('f3');

      const shelterEvents = detectLostSquareControl(chessBefore, chessAfter, 'w');
      expect(shelterEvents.some((e) => e.category === 'king_shelter')).toBe(true);
    });

    it('aggregates all active tactical motifs in detectAllTacticalMotifs', () => {
      const fen = '4k3/2N5/8/3q4/8/8/8/4K3 w - - 0 1';
      const chess = new Chess(fen);
      const summary = detectAllTacticalMotifs(chess, 'w');

      expect(summary.motifs).toContain('royal_fork');
      expect(summary.forks.length).toBeGreaterThan(0);
    });
  });
});
