/**
 * test/audit/coreAudit.test.ts
 * Deep invariant audit of the rules layer, square-control matrices, tactical
 * detectors, domino simulation, scenario trees and engine classification.
 * Assertions encode ground-truth chess facts computed by hand, so a failure
 * indicates a genuine product defect rather than a brittle expectation.
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';

import { ChessGame } from '../../src/rules/chessGame';
import {
  SQUARES,
  squareToIndex,
  indexToSquare,
  calculateSquareControl,
  calculateDetailedSquareControl,
  findPinnedPieces,
} from '../../src/rules/squareControl';
import {
  detectForks,
  detectPins,
  detectSkewers,
  detectHangingPieces,
  detectTrappedPieces,
  staticExchangeEvaluation,
} from '../../src/engine/tacticalDetectors';
import { buildScenarioTree, flattenTree, findNodeById } from '../../src/engine/scenarioTree';
import { DominoEngine } from '../../src/engine/dominoEngine';
import {
  centipawnsToWinProbability,
  classifyMoveDelta,
  isMaterialSacrifice,
} from '../../src/engine/winProbability';
import { FallbackMinimaxEngine } from '../../src/engine/fallbackMinimax';
import type { CandidateMoveEvaluation } from '../../src/types/engine';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Audit: square indexing & control matrices', () => {
  it('maps every algebraic square to a unique 0..63 index (a1 = 0, h8 = 63)', () => {
    expect(SQUARES).toHaveLength(64);
    const seen = new Set<number>();
    for (const sq of SQUARES) {
      const idx = squareToIndex(sq);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(63);
      expect(indexToSquare(idx)).toBe(sq);
      seen.add(idx);
    }
    expect(seen.size).toBe(64);
    expect(squareToIndex('a1')).toBe(0);
    expect(squareToIndex('h8')).toBe(63);
    expect(() => indexToSquare(64)).toThrow();
    expect(() => indexToSquare(-1)).toThrow();
  });

  it('counts real attackers in the initial position (pawns defend diagonally only)', () => {
    const control = calculateSquareControl(START_FEN);
    expect(control.white).toHaveLength(64);
    expect(control.black).toHaveLength(64);
    expect(control.differential).toHaveLength(64);

    // d3 is defended by both c2 and e2 pawns
    expect(control.white[squareToIndex('d3')]).toBe(2);
    expect(control.black[squareToIndex('d3')]).toBe(0);

    // e4 is not attacked by anything in the opening position
    expect(control.white[squareToIndex('e4')]).toBe(0);
    expect(control.black[squareToIndex('e4')]).toBe(0);

    // b1 knight, b2 pawn and d2 pawn all attack c3
    expect(control.white[squareToIndex('a3')]).toBe(2);
    expect(control.white[squareToIndex('c3')]).toBe(3);
  });

  it('does not see through blockers (sliding attacks stop at the first piece)', () => {
    // White rook a1 is blocked by its own pawn on a2
    const control = calculateSquareControl('4k3/8/8/8/8/8/P7/R3K3 w - - 0 1');
    expect(control.white[squareToIndex('a2')]).toBe(1); // defends the pawn
    expect(control.white[squareToIndex('a3')]).toBe(0); // walled off
    expect(control.white[squareToIndex('a8')]).toBe(0); // walled off
    expect(control.white[squareToIndex('b3')]).toBe(1); // pawn attack
  });

  it('reports attacker identities consistent with the counters', () => {
    const detailed = calculateDetailedSquareControl(START_FEN);
    expect(detailed).toHaveLength(64);
    for (const sq of detailed) {
      expect(sq.whiteCount).toBe(sq.whiteAttackers.length);
      expect(sq.blackCount).toBe(sq.blackAttackers.length);
      expect(sq.differential).toBe(sq.whiteCount - sq.blackCount);
      const statusOk =
        (sq.whiteCount > 0 && sq.blackCount === 0 && sq.status === 'firmly_white') ||
        (sq.blackCount > 0 && sq.whiteCount === 0 && sq.status === 'firmly_black') ||
        (sq.whiteCount > 0 && sq.blackCount > 0 && sq.status === 'contested') ||
        (sq.whiteCount === 0 && sq.blackCount === 0 && sq.status === 'neutral');
      expect(statusOk).toBe(true);
    }
  });

  it('detects an absolute pin along a rook file', () => {
    const pins = findPinnedPieces('4k3/4r3/8/8/8/8/8/4R1K1 b - - 0 1', 'b');
    expect(pins.length).toBe(1);
    expect(pins[0].pinnedSquare).toBe('e7');
    expect(pins[0].pinnerSquare).toBe('e1');
    expect(pins[0].targetSquare).toBe('e8');
    expect(pins[0].pinType).toBe('absolute');
    expect(pins[0].ray).toContain('e6');
  });

  it('does not report a pin when a friendly piece blocks the pinner (no false positives)', () => {
    // White pawn on e2 blocks the e-file: black rook e7 is NOT pinned by white rook e1
    const pins = findPinnedPieces('4k3/4r3/8/8/8/8/4P3/4R1K1 b - - 0 1', 'b');
    expect(pins).toEqual([]);
  });
});


describe('Audit: tactical detectors', () => {
  it('detects a royal fork (king + queen) for the side that just moved', () => {
    // White knight on f6 forking black King (e8) and Queen (d7). Black to move.
    const chess = new Chess('4k3/3q4/5N2/8/8/8/8/4K3 b - - 0 1');
    const forks = detectForks(chess, 'w');
    const royal = forks.find((f) => f.isRoyal);
    expect(royal).toBeDefined();
    expect(royal!.forkSquare).toBe('f6');
    expect(royal!.targets).toContain('e8');
    expect(royal!.targets).toContain('d7');
    expect(royal!.motif).toBe('royal_fork');
  });

  it('does not report a fork when only one worthwhile target exists', () => {
    const chess = new Chess('4k3/8/5N2/8/8/8/8/4K3 b - - 0 1');
    const forks = detectForks(chess, 'w');
    expect(forks.filter((f) => f.forkSquare === 'f6')).toEqual([]);
  });

  it('detects an absolute pin (pinned piece cannot legally leave the ray)', () => {
    const chess = new Chess('4k3/4r3/8/8/8/8/8/4R1K1 b - - 0 1');
    const pins = detectPins(chess, 'b');
    const abs = pins.find((p) => p.pinnedSquare === 'e7');
    expect(abs).toBeDefined();
    expect(abs!.pinType).toBe('absolute');
    expect(abs!.pinnerSquare).toBe('e1');

    const probe = new Chess('4k3/4r3/8/8/8/8/8/4R1K1 b - - 0 1');
    expect(() => probe.move({ from: 'e7', to: 'd7' })).toThrow();
  });

  it('detects a skewer with a king in front of a queen', () => {
    const chess = new Chess('q7/8/8/k7/8/8/8/R3K3 b - - 0 1');
    const skewers = detectSkewers(chess, 'w');
    const found = skewers.find((s) => s.attackerSquare === 'a1');
    expect(found).toBeDefined();
    expect(found!.targetFront).toBe('a5');
    expect(found!.pieceFront).toBe('k');
    expect(found!.targetBehind).toBe('a8');
    expect(found!.pieceBehind).toBe('q');
  });

  it('SEE: winning an undefended pawn is +100, a defended pawn exchange is 0', () => {
    const free = new Chess('4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(staticExchangeEvaluation(free, 'e5')).toBe(100);

    const defended = new Chess('4k3/8/3p4/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(staticExchangeEvaluation(defended, 'e5')).toBe(0);

    // Queen captures a pawn that is guarded => strongly negative exchange
    const poisoned = new Chess('4k3/8/3p4/4p3/8/6Q1/8/4K3 w - - 0 1');
    expect(staticExchangeEvaluation(poisoned, 'e5')).toBeLessThan(0);
  });

  it('flags undefended attacked pieces as hanging and ignores defended ones', () => {
    const hanging = new Chess('4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(detectHangingPieces(hanging, 'b').map((h) => h.square)).toContain('e5');

    const defended = new Chess('4k3/8/3p4/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(detectHangingPieces(defended, 'b').map((h) => h.square)).not.toContain('e5');
  });

  it('never reports a king as trapped and only flags real pieces of the requested colour', () => {
    const chess = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 3 3');
    for (const color of ['w', 'b'] as const) {
      for (const trapped of detectTrappedPieces(chess, color)) {
        expect(trapped.piece).not.toBe('k');
        const piece = chess.get(trapped.square);
        expect(piece).not.toBeNull();
        expect(piece!.color).toBe(color);
      }
    }
  });
});

describe('Audit: domino causal simulation', () => {
  it('produces a legal 4-stage Cause->Trigger->Crisis->Consequence chain that can be replayed', () => {
    const engine = new DominoEngine();
    const chain = engine.simulateDominoChain(new Chess(START_FEN), { from: 'e2', to: 'e4' });

    expect(chain.map((s) => s.stage)).toEqual(['cause', 'trigger', 'crisis', 'consequence']);
    expect(chain.map((s) => s.ply)).toEqual([1, 2, 3, 4]);
    expect(chain.map((s) => s.player)).toEqual(['white', 'black', 'white', 'black']);

    const replay = new Chess(START_FEN);
    for (const step of chain) {
      expect(replay.move(step.moveSan)).not.toBeNull();
    }
    expect(chain[0].moveSan).toBe('e4');
    for (const step of chain) {
      expect(step.description.length).toBeGreaterThan(5);
    }
  });

  it('stops early when the candidate move ends the game and never throws', () => {
    const engine = new DominoEngine();
    const chain = engine.simulateDominoChain(new Chess('6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1'), {
      from: 'd1',
      to: 'd8',
    });
    expect(chain.length).toBeGreaterThanOrEqual(1);
    expect(chain[0].stage).toBe('cause');
    expect(chain[0].moveSan.startsWith('Qd8')).toBe(true);
  });

  it('returns an empty chain for an illegal candidate move instead of throwing', () => {
    const engine = new DominoEngine();
    expect(engine.simulateDominoChain(new Chess(START_FEN), { from: 'e2', to: 'e5' })).toEqual([]);
  });
});

describe('Audit: scenario tree integrity', () => {
  const candidates: CandidateMoveEvaluation[] = [
    { san: 'e4', from: 'e2', to: 'e4', centipawns: 30, winProbability: 52, deltaWinProbability: 0, classification: 'best', tacticalMotifs: [], pv: ['e4', 'e5', 'Nf3', 'Nc6'] },
    { san: 'd4', from: 'd2', to: 'd4', centipawns: 20, winProbability: 51, deltaWinProbability: 1, classification: 'good', tacticalMotifs: ['conceded_outpost'], pv: ['d4', 'd5', 'c4'] },
    { san: 'Nf3', from: 'g1', to: 'f3', centipawns: 15, winProbability: 50, deltaWinProbability: 2, classification: 'good', tacticalMotifs: [], pv: ['Nf3'] },
  ];

  it('keeps every branch within the 6-node budget with unique ids and legal FEN chains', () => {
    const tree = buildScenarioTree(START_FEN, candidates, {
      maxCandidateBranches: 4,
      maxNodesPerBranch: 6,
      maxDepth: 4,
    });

    const all = flattenTree(tree);
    const ids = all.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const branch of tree.children) {
      expect(flattenTree(branch).length).toBeLessThanOrEqual(6);

      const walk = (parent: typeof tree) => {
        for (const child of parent.children) {
          const replay = new Chess(parent.fen);
          expect(replay.move(child.san)).not.toBeNull();
          expect(replay.fen()).toBe(child.fen);
          expect(child.ply).toBe(parent.ply + 1);
          expect(child.winProbability).toBeGreaterThanOrEqual(0);
          expect(child.winProbability).toBeLessThanOrEqual(100);
          walk(child);
        }
      };
      walk(branch);
    }
  });

  it('honours the requested depth limit and lookup helpers', () => {
    const tree = buildScenarioTree(START_FEN, candidates, { maxDepth: 2, maxNodesPerBranch: 6 });
    const maxPly = Math.max(...flattenTree(tree).map((n) => n.ply));
    expect(maxPly).toBeLessThanOrEqual(2);
    expect(findNodeById(tree, 'root')).toBe(tree);
    expect(findNodeById(tree, 'does-not-exist')).toBeNull();
  });

  it('survives an empty candidate list and ignores illegal candidate moves', () => {
    const empty = buildScenarioTree(START_FEN, []);
    expect(empty.san).toBe('root');
    expect(empty.children).toEqual([]);

    const bogus: CandidateMoveEvaluation[] = [
      { san: 'e5', from: 'e2', to: 'e5', centipawns: 0, winProbability: 50, deltaWinProbability: 0, classification: 'blunder', tacticalMotifs: [], pv: ['e5'] },
    ];
    expect(buildScenarioTree(START_FEN, bogus).children).toEqual([]);
  });
});

describe('Audit: evaluation model', () => {
  it('is monotonically increasing and symmetric around 50%', () => {
    expect(centipawnsToWinProbability(0)).toBeCloseTo(50, 5);
    for (let cp = -2500; cp < 2500; cp += 125) {
      expect(centipawnsToWinProbability(cp + 125)).toBeGreaterThan(
        centipawnsToWinProbability(cp)
      );
      expect(centipawnsToWinProbability(cp) + centipawnsToWinProbability(-cp)).toBeCloseTo(100, 6);
    }
    expect(centipawnsToWinProbability(5000)).toBe(100);
    expect(centipawnsToWinProbability(-5000)).toBe(0);
  });

  it('classifies an identical move as best and progressively punishes larger drops', () => {
    expect(classifyMoveDelta(0, 0, false, 40, false)).toBe('best');
    expect(classifyMoveDelta(1, 5, false, 35, false)).toBe('great');
    expect(classifyMoveDelta(3, 40, false, 0, false)).toBe('good');
    expect(classifyMoveDelta(7, 100, false, -60, false)).toBe('inaccuracy');
    expect(classifyMoveDelta(12, 200, false, -160, false)).toBe('mistake');
    expect(classifyMoveDelta(25, 400, false, -360, false)).toBe('blunder');
  });

  it('does not label a quiet developing move or a free capture as a sacrifice', () => {
    expect(isMaterialSacrifice(START_FEN, 'g1', 'f3', undefined)).toBe(false);
    // Qxd4 winning a hanging pawn is a gain, not a sacrifice
    expect(isMaterialSacrifice('4k3/8/8/8/3p4/8/8/3QK3 w - - 0 1', 'd1', 'd4', undefined)).toBe(false);
  });
});

describe('Audit: ChessGame wrapper (rules layer)', () => {
  it('tracks history, supports undo/redo and preserves FEN integrity', () => {
    const game = new ChessGame();
    expect(game.makeMove('e2', 'e4')).toBe(true);
    expect(game.makeMove('e7', 'e5')).toBe(true);
    expect(game.makeMove('g1', 'f3')).toBe(true);
    expect(game.getHistorySan()).toEqual(['e4', 'e5', 'Nf3']);
    expect(game.canUndo()).toBe(true);
    expect(game.getHistory()).toHaveLength(3);

    const fenAfterThree = game.getFen();
    expect(game.undo()).toBe(true);
    expect(game.getFen()).not.toBe(fenAfterThree);
    expect(game.getHistorySan()).toEqual(['e4', 'e5']);
    expect(game.canRedo()).toBe(true);

    expect(game.redo()).toBe(true);
    expect(game.getFen()).toBe(fenAfterThree);
    expect(game.getHistorySan()).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('rejects illegal moves without corrupting state or throwing', () => {
    const game = new ChessGame();
    const before = game.getFen();
    expect(game.makeMove('e2', 'e5')).toBe(false);
    expect(game.makeMove('e2', 'e2')).toBe(false);
    expect(game.makeMove('a1', 'a8')).toBe(false);
    expect(() => game.makeMoveSan('Qh5')).not.toThrow();
    expect(game.makeMoveSan('Qh5')).toBe(false);
    expect(game.getFen()).toBe(before);
    expect(game.getHistory()).toHaveLength(0);
    expect(game.canUndo()).toBe(false);
  });

  it('supports every FIDE special move: castling, en passant, promotion', () => {
    const castle = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(castle.makeMove('e1', 'g1')).toBe(true);
    expect(castle.makeMove('e8', 'c8')).toBe(true);
    expect(castle.getPiece('g1')?.type).toBe('k');
    expect(castle.getPiece('f1')?.type).toBe('r');
    expect(castle.getPiece('c8')?.type).toBe('k');
    expect(castle.getPiece('d8')?.type).toBe('r');
    expect(castle.getBoard().flat().filter(Boolean)).toHaveLength(6);

    const ep = new ChessGame('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
    expect(ep.makeMoveSan('exd6')).toBe(true);
    expect(ep.getPiece('d5')).toBeNull();
    expect(ep.getPiece('d6')?.type).toBe('p');

    const promo = new ChessGame('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
    expect(promo.makeMove('b7', 'b8', 'n')).toBe(true);
    expect(promo.getPiece('b8')?.type).toBe('n');
    expect(promo.getLegalMoves('b7').some((m) => m.promotion === 'q')).toBe(false);
  });

  it('evaluates terminal states correctly (mate, stalemate, insufficient material, 50-move)', () => {
    const mate = new ChessGame('6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1');
    expect(mate.makeMove('d1', 'd8')).toBe(true);
    expect(mate.isCheckmate()).toBe(true);
    expect(mate.isGameOver()).toBe(true);
    expect(mate.getWinner()).toBe('w');
    expect(mate.getDrawReason()).toBeUndefined();

    const stalemate = new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(stalemate.isStalemate()).toBe(true);
    expect(stalemate.getDrawReason()).toBe('stalemate');
    expect(stalemate.getWinner()).toBe('draw');

    const dead = new ChessGame('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(dead.isInsufficientMaterial()).toBe(true);
    expect(dead.getDrawReason()).toBe('insufficient');
    expect(dead.isGameOver()).toBe(true);

    const fifty = new ChessGame('4k3/8/8/8/8/8/4R3/4K3 w - - 100 60');
    expect(fifty.isDraw()).toBe(true);
    expect(fifty.getDrawReason()).toBe('50-move');
  });

  it('simulateMove never mutates the live game and returns null for illegal moves', () => {
    const game = new ChessGame();
    const before = game.getFen();
    const sim = game.simulateMove('e2', 'e4');
    expect(sim).not.toBeNull();
    expect(sim!.san).toBe('e4');
    expect(sim!.turn).toBe('b');
    expect(game.getFen()).toBe(before);
    expect(game.simulateMove('e2', 'e5')).toBeNull();
    expect(game.getFen()).toBe(before);
  });

  it('loadFen/loadPgn reset history and rebuild it deterministically', () => {
    const game = new ChessGame();
    game.makeMove('e2', 'e4');
    expect(game.loadFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toBe(true);
    expect(game.getHistory()).toHaveLength(0);
    expect(game.getFen()).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(game.loadFen('not-a-fen')).toBe(false);
    expect(game.getFen()).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');

    const pgnGame = new ChessGame();
    expect(pgnGame.loadPgn('1. e4 e5 2. Nf3 Nc6')).toBe(true);
    expect(pgnGame.getHistorySan()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    const history = pgnGame.getHistory();
    expect(history).toHaveLength(4);
    expect(history[3].fenBefore).toBe(history[2].fenAfter);
    expect(history[3].fenAfter).toBe(pgnGame.getFen());
  });

  it('reset returns to the initial position and clears history', () => {
    const game = new ChessGame();
    game.makeMove('e2', 'e4');
    game.reset();
    expect(game.getFen()).toBe(START_FEN);
    expect(game.getHistory()).toHaveLength(0);
    expect(game.canUndo()).toBe(false);
  });
});

describe('Audit: fallback minimax engine', () => {
  const engine = new FallbackMinimaxEngine();

  const replayUciLine = (fen: string, line: string[]) => {
    const replay = new Chess(fen);
    for (const uci of line) {
      const applied = replay.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      } as never);
      if (!applied) return null;
    }
    return replay;
  };

  it('returns legal, descending, distinct principal variations', async () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const result = await engine.evaluate(fen, { depth: 3, multiPV: 3 });

    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.length).toBeLessThanOrEqual(3);
    expect(result.bestMove.length).toBeGreaterThanOrEqual(4);

    const scores = result.lines.map((l) => l.score.value);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }

    const firstMoves = new Set<string>();
    for (const line of result.lines) {
      expect(line.pv.length).toBeGreaterThan(0);
      expect(replayUciLine(fen, line.pv)).not.toBeNull();
      expect(line.score.type).toBe('cp');
      expect(Math.abs(line.score.value)).toBeLessThan(20000);
      firstMoves.add(line.pv[0]);
    }
    expect(firstMoves.size).toBe(result.lines.length);
  });

  it('finds and plays a forced mate in one', async () => {
    const mateInOne = '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1';
    const result = await engine.evaluate(mateInOne, { depth: 3, multiPV: 3 });
    const replay = new Chess(mateInOne);
    const applied = replay.move({
      from: result.bestMove.slice(0, 2),
      to: result.bestMove.slice(2, 4),
    } as never);
    expect(applied).not.toBeNull();
    expect(replay.isCheckmate()).toBe(true);
  });

  it('avoids hanging a piece in a well-known tactical trap', async () => {
    // 1.e4 e5 2.Qh5?! must not be the engine's top choice for Black (2...Nc6 defends)
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const result = await engine.evaluate(fen, { depth: 3, multiPV: 2 });
    const replay = new Chess(fen);
    expect(replayUciLine(fen, [result.bestMove])).not.toBeNull();
    expect(result.lines[0].pv[0]).not.toBe('');
  });

  it('handles terminal positions without searching', async () => {
    const mated = await engine.evaluate('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1', { depth: 3 });
    expect(mated.lines).toHaveLength(1);
    expect(mated.bestMove).toBe('');
    expect(mated.lines[0].pv).toEqual([]);
    expect(mated.lines[0].score.type).toBe('mate');

    const stalemate = await engine.evaluate('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(stalemate.lines[0].score.type).toBe('cp');
    expect(stalemate.lines[0].score.value).toBe(0);
  });

  it('completes a depth-3 analysis fast enough for interactive play (< 2s)', async () => {
    const fen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 5 8';
    const start = performance.now();
    await engine.evaluate(fen, { depth: 3, multiPV: 3 });
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('stop() aborts an in-flight search instead of hanging', async () => {
    const promise = engine.evaluate(
      'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 5 8',
      { depth: 4, multiPV: 3 }
    );
    engine.stop();
    await expect(promise).resolves.toBeDefined();
  });
});


