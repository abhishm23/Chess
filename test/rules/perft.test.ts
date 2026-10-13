import { describe, it, expect } from 'vitest';
import { ChessGame } from '../../src/rules/chessGame';

/**
 * Recursive perft leaf-node counting algorithm.
 */
export function perft(game: ChessGame, depth: number): number {
  if (depth === 0) return 1;

  const legalMoves = game.getLegalMoves();
  if (depth === 1) return legalMoves.length;

  let nodes = 0;
  for (const move of legalMoves) {
    game.makeMove(move.from, move.to, move.promotion);
    nodes += perft(game, depth - 1);
    game.undo();
  }
  return nodes;
}

/**
 * Diagnostic perft divide utility to isolate discrepancies per root move.
 */
export function perftDivide(game: ChessGame, depth: number): Record<string, number> {
  const moves = game.getLegalMoves();
  const distribution: Record<string, number> = {};

  for (const move of moves) {
    const key = `${move.from}${move.to}${move.promotion || ''}`;
    game.makeMove(move.from, move.to, move.promotion);
    const count = perft(game, depth - 1);
    distribution[key] = count;
    game.undo();
  }

  return distribution;
}

describe('Perft Benchmark Test Suite (Positions 1 to 5)', () => {
  describe('Position 1: Standard Initial Position', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    it('depth 1: 20 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 1)).toBe(20);
    });

    it('depth 2: 400 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 2)).toBe(400);
    });

    it('depth 3: 8,902 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 3)).toBe(8902);
    });

    it('depth 4: 197,281 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 4)).toBe(197281);
    }, 20000);
  });

  describe('Position 2: Kiwipete (Peter McKenzie)', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

    it('depth 1: 48 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 1)).toBe(48);
    });

    it('depth 2: 2,039 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 2)).toBe(2039);
    });

    it('depth 3: 97,862 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 3)).toBe(97862);
    }, 20000);
  });

  describe('Position 3: Silver Suite Position 3 (Endgame & Checks)', () => {
    const fen = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';

    it('depth 1: 14 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 1)).toBe(14);
    });

    it('depth 2: 191 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 2)).toBe(191);
    });

    it('depth 3: 2,812 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 3)).toBe(2812);
    });

    it('depth 4: 43,238 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 4)).toBe(43238);
    }, 20000);
  });

  describe('Position 4: Mirrored Castling & Promotion Check', () => {
    const fen = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';

    it('depth 1: 6 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 1)).toBe(6);
    });

    it('depth 2: 264 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 2)).toBe(264);
    });

    it('depth 3: 9,467 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 3)).toBe(9467);
    });

    it('depth 4: 422,333 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 4)).toBe(422333);
    }, 30000);
  });

  describe('Position 5: Promotion & En Passant Interleaving', () => {
    const fen = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

    it('depth 1: 44 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 1)).toBe(44);
    });

    it('depth 2: 1,486 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 2)).toBe(1486);
    });

    it('depth 3: 62,379 nodes', () => {
      const game = new ChessGame(fen);
      expect(perft(game, 3)).toBe(62379);
    }, 20000);
  });
});
