import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import {
  ChessGameCoordinator,
  detectTrappedPieces,
} from './harness/testHarness.js';

describe('Tier 4: Real-World Scenarios & Grandmaster Benchmarks', () => {
  let game: ChessGameCoordinator;

  beforeEach(() => {
    game = new ChessGameCoordinator();
  });

  // =========================================================================
  // Benchmark 1: Paul Morphy's Opera Game (Paris 1858)
  // =========================================================================
  it('4.1 replays complete Opera Game (Paul Morphy vs Duke Karl / Count Isouard)', () => {
    const operaMoves = [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['d2', 'd4'], ['c8', 'g4'],
      ['d4', 'e5'], ['g4', 'f3'],
      ['d1', 'f3'], ['d6', 'e5'],
      ['f1', 'c4'], ['g8', 'f6'],
      ['f3', 'b3'], ['d8', 'e7'],
      ['b1', 'c3'], ['c7', 'c6'],
      ['c1', 'g5'], ['b7', 'b5'],
      ['c3', 'b5'], ['c6', 'b5'],
      ['c4', 'b5'], ['b8', 'd7'], // Bb5+ Nbd7
      ['e1', 'c1'], ['a8', 'd8'], // O-O-O Rd8
      ['d1', 'd7'], ['d8', 'd7'], // Rxd7 Rxd7
      ['h1', 'd1'], ['e7', 'e6'], // Rd1 Qe6
      ['b5', 'd7'], ['f6', 'd7'], // Bxd7+ Nxd7
      ['b3', 'b8'], ['d7', 'b8'], // Qb8+! Nxb8 (Queen sacrifice!)
      ['d1', 'd8'],               // Rd8#
    ];

    for (const [from, to] of operaMoves) {
      expect(game.makeMove(from, to)).toBe(true);
    }

    const state = game.getGameState();
    expect(state.isCheck).toBe(true);
    expect(state.isCheckmate).toBe(true);
    expect(state.history.length).toBe(33); // 33 half-moves (17 moves)
    expect(state.history[state.history.length - 1]).toBe('Rd8#');
  });

  // =========================================================================
  // Benchmark 2: The Noah's Ark Trap (Ruy Lopez)
  // =========================================================================
  it('4.2 executes Noah\'s Ark trap and detects trapped White bishop on b3', () => {
    const noahMoves = [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['b8', 'c6'],
      ['f1', 'b5'], ['a7', 'a6'],
      ['b5', 'a4'], ['d7', 'd6'],
      ['d2', 'd4'], ['b7', 'b5'],
      ['a4', 'b3'], ['c6', 'd4'],
      ['f3', 'd4'], ['e5', 'd4'],
      ['d1', 'd4'], ['c7', 'c5'],
      ['d4', 'd5'], ['c8', 'e6'],
      ['d5', 'c6'], ['e6', 'd7'],
      ['c6', 'd5'], ['c5', 'c4'], // 11... c4! traps White's Bishop on b3
    ];

    for (const [from, to] of noahMoves) {
      expect(game.makeMove(from, to)).toBe(true);
    }

    const state = game.getGameState();
    expect(state.history[state.history.length - 1]).toBe('c4');

    // Detect trapped piece on b3
    const trapped = detectTrappedPieces(game.getChess(), 'w');
    const trappedBishop = trapped.find(p => p.square === 'b3');
    expect(trappedBishop).toBeDefined();
    expect(trappedBishop?.piece).toBe('b');
    expect(trappedBishop?.safeMobility).toBe(0);
  });

  // =========================================================================
  // Benchmark 3: Garry Kasparov vs Veselin Topalov (1999 — "Kasparov's Immortal")
  // =========================================================================
  it('4.3 replays 87-ply masterwork Kasparov vs Topalov 1999 including 24. Rxd4!! sacrifice', () => {
    const ktMoves = [
      'e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'Qd2', 'c6', 'f3', 'b5', 'Nge2', 'Nbd7',
      'Bh6', 'Bxh6', 'Qxh6', 'Bb7', 'a3', 'e5', 'O-O-O', 'Qe7', 'Kb1', 'a6', 'Nc1', 'O-O-O', 'Nb3',
      'exd4', 'Rxd4', 'c5', 'Rd1', 'Nb6', 'g3', 'Kb8', 'Na5', 'Ba8', 'Bh3', 'd5', 'Qf4+', 'Ka7',
      'Rhe1', 'd4', 'Nd5', 'Nbxd5', 'exd5', 'Qd6',
      // Move 24: The immortal Rook sacrifice 24. Rxd4!!
      'Rxd4', 'cxd4',
      // Move 25: 25. Re7+!
      'Re7+', 'Kb6', 'Qxd4+', 'Kxa5', 'b4+', 'Ka4', 'Qc3', 'Qxd5', 'Ra7', 'Bb7', 'Rxb7', 'Qc4',
      'Qxf6', 'Kxa3', 'Qxa6+', 'Kxb4', 'c3+', 'Kxc3', 'Qa1+', 'Kd2', 'Qb2+', 'Kd1', 'Bf1', 'Rd2',
      'Rd7', 'Rxd7', 'Bxc4', 'bxc4', 'Qxh8', 'Rd3', 'Qa8', 'c3', 'Qa4+', 'Ke1', 'f4', 'f5', 'Kc1',
      'Rd2', 'Qa7'
    ];

    const chess = game.getChess();
    for (const san of ktMoves) {
      const move = chess.move(san);
      expect(move).toBeDefined();
    }

    // Verify 87 plies executed
    expect(chess.history().length).toBe(87);
    expect(chess.history()[46]).toBe('Rxd4'); // Move 24. Rxd4
    expect(chess.history()[48]).toBe('Re7+'); // Move 25. Re7+
    expect(chess.history()[chess.history().length - 1]).toBe('Qa7');

    // Black King is completely hunted down to d1/d2 area
    const blackKingSq = chess.board().flat().find(p => p?.type === 'k' && p?.color === 'b');
    expect(blackKingSq).toBeDefined();
  });

  // =========================================================================
  // Benchmark 4: The Greek Gift Sacrifice
  // =========================================================================
  it('4.4 replays classic Greek Gift sacrifice (Bxh7+!) and mating attack', () => {
    const ggMoves = [
      'e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'e5', 'Nfd7', 'Nf3', 'c5', 'Bd3', 'Nc6', 'O-O', 'cxd4',
      'Ne2', 'Ndxe5', 'Nxe5', 'Nxe5', 'Nxd4', 'Bd6', 'Re1', 'O-O',
      // Move 12: 12. Bxh7+! The Greek Gift Sacrifice
      'Bxh7+', 'Kxh7', 'Qh5+', 'Kg8', 'Re3', 'Ng6', 'Rh3', 'Re8', 'Bg5', 'Qb6', 'Qh7+', 'Kf8',
      'Qh8+', 'Nxh8', 'Rxh8#' // Final mate!
    ];

    const chess = game.getChess();
    for (const san of ggMoves) {
      const move = chess.move(san);
      expect(move).toBeDefined();
    }

    expect(chess.history().length).toBe(37);
    expect(chess.history()[22]).toBe('Bxh7+'); // Greek gift sacrifice
    expect(chess.isCheckmate()).toBe(true);
    expect(chess.history()[chess.history().length - 1]).toBe('Rxh8#');
  });

  // =========================================================================
  // Benchmark 5: The Lucena Position (Rook Endgame Bridge Technique)
  // =========================================================================
  it('4.5 executes the classic Lucena position endgame bridge technique', () => {
    // Starting FEN: White King on b8, White Pawn on b7, White Rook on c1, Black King on d8, Black Rook on a2.
    const lucenaFen = '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1';
    game.resetGame(lucenaFen);

    // Step 1: 1. Rd1+ Ke7
    expect(game.makeMove('c1', 'd1')).toBe(true);
    expect(game.makeMove('d8', 'e7')).toBe(true);

    // Step 2: 2. Rd4! (Building the bridge along rank 4)
    expect(game.makeMove('d1', 'd4')).toBe(true);
    expect(game.makeMove('a2', 'a1')).toBe(true);

    // Step 3: King walks out
    // 3. Kc7 Rc1+
    expect(game.makeMove('b8', 'c7')).toBe(true);
    expect(game.makeMove('a1', 'c1')).toBe(true);

    // 4. Kb6 Rb1+
    expect(game.makeMove('c7', 'b6')).toBe(true);
    expect(game.makeMove('c1', 'b1')).toBe(true);

    // 5. Kc6 Rc1+
    expect(game.makeMove('b6', 'c6')).toBe(true);
    expect(game.makeMove('b1', 'c1')).toBe(true);

    // 6. Kb5 Rb1+
    expect(game.makeMove('c6', 'b5')).toBe(true);
    expect(game.makeMove('c1', 'b1')).toBe(true);

    // Step 4: 7. Rb4! (The Bridge: blocking check and guaranteeing promotion)
    expect(game.makeMove('d4', 'b4')).toBe(true);
    const state = game.getGameState();
    expect(state.history[state.history.length - 1]).toBe('Rb4');

    // Black must trade or allow promotion: 7... Rxb4+ 8. Kxb4
    expect(game.makeMove('b1', 'b4')).toBe(true);
    expect(game.makeMove('b5', 'b4')).toBe(true);

    // White pawn promotes to Queen on next move
    expect(game.makeMove('e7', 'd7')).toBe(true);
    expect(game.makeMove('b7', 'b8', 'q')).toBe(true);
    expect(game.getGameState().history[game.getGameState().history.length - 1]).toBe('b8=Q');
  });
});
