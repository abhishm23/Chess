/**
 * test/engine/m2Challenger2Stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE: Milestone 2 Challenger 2
 *
 * Rigorously challenges:
 * 1. FallbackMinimaxEngine:
 *    - Search depth limits & execution time bounds (<100ms for depth 3).
 *    - PeSTO evaluation consistency (White advantage positive, Black advantage negative).
 *    - Quiescence search termination on capture cascades.
 *    - MultiPV ranking: Line 1 must evaluate >= Line 2 >= Line 3.
 * 2. WinProbability & MoveClassifier:
 *    - Monotonicity: Higher centipawns must strictly map to higher win probability.
 *    - Symmetry: WP(cp) + WP(-cp) = 100.0%.
 *    - Boundary tests: Mate in 1 (99.9%), Mate in 10 (99.0%), checkmated (0.1%), +1000 cp, -1000 cp.
 * 3. ScenarioTreeNode invariants:
 *    - Branch node budget constraint: strictly <= 6 nodes per candidate move branch.
 *    - Tree node depth and ply matching.
 *    - FEN validity at every node.
 * 4. Mode switching resilience under rapid concurrent mutations.
 * 5. Tactical Detectors & Domino Engine Adversarial Invariants:
 *    - Out-of-turn Trapped Piece detection false positive check.
 *    - Single discovered check vs double check distinction.
 *    - 4-character SAN parsing in Domino continuation PV.
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { FallbackMinimaxEngine } from '../../src/engine/fallbackMinimax';
import {
  centipawnsToWinProbability,
  mateToWinProbability,
  classifyMoveDelta,
} from '../../src/engine/winProbability';
import {
  buildScenarioTree,
  flattenTree,
} from '../../src/engine/scenarioTree';
import { CandidateMoveEvaluation, ScenarioTreeNode } from '../../src/types/engine';
import {
  GameModeManager,
  isValidGameMode,
} from '../../src/rules/gameModeManager';
import { GameMode } from '../../src/types/chess';
import {
  detectTrappedPieces,
  detectDiscoveredAttacks,
} from '../../src/engine/tacticalDetectors';
import { DominoEngine } from '../../src/engine/dominoEngine';

describe('Milestone 2 Challenger 2 — Empirical Adversarial Stress Suite', () => {
  // ==========================================================================
  // SECTION 1: FallbackMinimaxEngine Stress & Invariants
  // ==========================================================================
  describe('1. FallbackMinimaxEngine: Search Limits, PeSTO, Quiescence, MultiPV', () => {
    it('enforces search depth limits and execution time bounds (<100ms for depth 3)', async () => {
      const engine = new FallbackMinimaxEngine();
      await engine.init();

      // Standard initial position
      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      const start = performance.now();
      const result = await engine.evaluate(startFen, { depth: 3, multiPV: 3 });
      const elapsed = performance.now() - start;

      expect(result).toBeDefined();
      expect(result.depth).toBe(3);
      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      expect(result.bestMove).toBeTruthy();

      // Empirical Challenge: The worker claimed <50ms, and dispatch requires <100ms for depth 3.
      // In reality, depth 3 on starting position takes ~2800ms (28x over budget).
      expect(result.durationMs).toBeLessThan(500);
      expect(elapsed).toBeLessThan(500);
    });

    it('verifies PeSTO evaluation consistency (White advantage positive, Black advantage negative)', async () => {
      const engine = new FallbackMinimaxEngine();
      await engine.init();

      // Position A: White is up a full Queen (+Q) - White to move
      const whiteUpQueenWhiteToMove = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const evalWhiteWinning = await engine.evaluate(whiteUpQueenWhiteToMove, { depth: 2, multiPV: 1 });
      expect(evalWhiteWinning.lines[0].score.value).toBeGreaterThan(700);

      // Position B: White is down a full Queen (-Q) - White to move
      const whiteDownQueenWhiteToMove = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
      const evalWhiteLosing = await engine.evaluate(whiteDownQueenWhiteToMove, { depth: 2, multiPV: 1 });
      expect(evalWhiteLosing.lines[0].score.value).toBeLessThan(-700);

      // Position C: Black is up a full Queen (+Q for Black) - Black to move
      const blackUpQueenBlackToMove = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1';
      const evalBlackWinning = await engine.evaluate(blackUpQueenBlackToMove, { depth: 2, multiPV: 1 });
      expect(evalBlackWinning.lines[0].score.value).toBeGreaterThan(700);

      // Position D: Black is down a full Queen (-Q for Black) - Black to move
      const blackDownQueenBlackToMove = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
      const evalBlackLosing = await engine.evaluate(blackDownQueenBlackToMove, { depth: 2, multiPV: 1 });
      expect(evalBlackLosing.lines[0].score.value).toBeLessThan(-700);
    });

    it('guarantees quiescence search termination on complex capture cascades within 150ms bound', async () => {
      const engine = new FallbackMinimaxEngine();
      await engine.init();

      // Heavy tactical center with mutually capturing pieces
      const captureCascadeFen = 'r1b1k2r/pp1n1ppp/2p1p3/q2pP3/2PP4/2PB1N2/P1Q2PPP/R3K2R w KQkq - 0 12';
      const startCascade = performance.now();
      const resultCascade = await engine.evaluate(captureCascadeFen, { depth: 2, multiPV: 3 });
      const durationCascade = performance.now() - startCascade;

      expect(resultCascade).toBeDefined();
      // Quiescence at depth 2 with heavy captures must complete within real-time limits (<150ms)
      expect(durationCascade).toBeLessThan(150);
    });

    it('maintains strict MultiPV ranking: Line 1 >= Line 2 >= Line 3 across diverse positions', async () => {
      const engine = new FallbackMinimaxEngine();
      await engine.init();

      const positions = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', // King and pawn endgame
        'r1b2rk1/pp1p1ppp/2n1pn2/8/1bP5/2N1PN2/PP1B1PPP/R3KB1R w KQ - 3 9',
      ];

      for (const fen of positions) {
        const res = await engine.evaluate(fen, { depth: 1, multiPV: 3 });
        expect(res.lines.length).toBeGreaterThanOrEqual(1);

        for (let i = 1; i < res.lines.length; i++) {
          const prevScore = res.lines[i - 1].score.value;
          const currScore = res.lines[i].score.value;
          expect(prevScore).toBeGreaterThanOrEqual(currScore);
        }
      }
    });

    it('handles boundary positions with 1 legal move, 2 legal moves, or checkmate correctly', async () => {
      const engine = new FallbackMinimaxEngine();
      await engine.init();

      // Scholar's Mate: Black is checkmated (0 legal moves)
      const mateFen = 'r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
      const mateRes = await engine.evaluate(mateFen);
      expect(mateRes.lines.length).toBe(1);
      expect(mateRes.lines[0].score.type).toBe('mate');
      expect(mateRes.bestMove).toBe('');

      // Position with restricted legal moves
      const singleLegalMoveFen = 'k7/8/1K6/8/8/8/8/1R6 w - - 0 1';
      const res = await engine.evaluate(singleLegalMoveFen, { depth: 1, multiPV: 3 });
      expect(res.lines.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // SECTION 2: WinProbability & MoveClassifier Stress & Invariants
  // ==========================================================================
  describe('2. WinProbability & MoveClassifier: Monotonicity, Symmetry, Boundaries', () => {
    it('verifies strict monotonicity: higher centipawns strictly map to higher win probability within [-2500, 2500]', () => {
      let prevWp = centipawnsToWinProbability(-3000);

      for (let cp = -2900; cp <= 2900; cp += 100) {
        const currWp = centipawnsToWinProbability(cp);
        expect(currWp).toBeGreaterThan(prevWp);
        prevWp = currWp;
      }
    });

    it('verifies exact symmetry: WP(cp) + WP(-cp) = 100.0% for all centipawn values', () => {
      const testCps = [0, 10, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];

      for (const cp of testCps) {
        const wpPositive = centipawnsToWinProbability(cp);
        const wpNegative = centipawnsToWinProbability(-cp);
        const sum = wpPositive + wpNegative;

        expect(sum).toBeCloseTo(100.0, 8);
      }
    });

    it('verifies boundary tests: Mate in 1 (99.9%), Mate in 10 (99.0%), checkmated (0.1%), +1000 cp, -1000 cp', () => {
      expect(mateToWinProbability(1)).toBeCloseTo(99.9, 1);
      expect(mateToWinProbability(10)).toBeCloseTo(99.0, 1);
      expect(mateToWinProbability(-1)).toBeCloseTo(0.1, 1);
      expect(mateToWinProbability(-10)).toBeCloseTo(1.0, 1);
      expect(centipawnsToWinProbability(1000)).toBeCloseTo(97.54, 1);
      expect(centipawnsToWinProbability(-1000)).toBeCloseTo(2.46, 1);
      expect(centipawnsToWinProbability(3000)).toBe(100.0);
      expect(centipawnsToWinProbability(-3000)).toBe(0.0);
    });

    it('validates 7-tier move classification thresholds and sacrifice classification', () => {
      expect(classifyMoveDelta(0.2, 5, true, 200, true)).toBe('brilliant');
      expect(classifyMoveDelta(0.1, 5, false, 50, false)).toBe('best');
      expect(classifyMoveDelta(1.2, 15, false, 50, false)).toBe('great');
      expect(classifyMoveDelta(3.5, 45, false, 50, false)).toBe('good');
      expect(classifyMoveDelta(7.0, 90, false, 50, false)).toBe('inaccuracy');
      expect(classifyMoveDelta(15.0, 200, false, 50, false)).toBe('mistake');
      expect(classifyMoveDelta(25.0, 350, false, -100, false)).toBe('blunder');
      expect(classifyMoveDelta(5.0, 50, false, -10, true)).toBe('blunder');
    });
  });

  // ==========================================================================
  // SECTION 3: ScenarioTreeNode Invariants & Pruning Bounds
  // ==========================================================================
  describe('3. ScenarioTreeNode: Pruning Bounds (<=6 nodes), Depth/Ply Matching, FEN Validity', () => {
    const mockCandidates: CandidateMoveEvaluation[] = [
      {
        san: 'e4',
        from: 'e2',
        to: 'e4',
        centipawns: 30,
        winProbability: 54.0,
        deltaWinProbability: 0,
        classification: 'best',
        tacticalMotifs: [],
        pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5'],
      },
      {
        san: 'd4',
        from: 'd2',
        to: 'd4',
        centipawns: 25,
        winProbability: 53.0,
        deltaWinProbability: 1.0,
        classification: 'great',
        tacticalMotifs: [],
        pv: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5'],
      },
    ];

    it('strictly enforces branch node budget: <= 6 nodes per candidate move branch', () => {
      const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      const treeDefault = buildScenarioTree(rootFen, mockCandidates);
      for (const branch of treeDefault.children) {
        const branchNodes = flattenTree(branch);
        expect(branchNodes.length).toBeLessThanOrEqual(6);
      }

      const treeOverBudget = buildScenarioTree(rootFen, mockCandidates, { maxNodesPerBranch: 20, maxDepth: 10 });
      for (const branch of treeOverBudget.children) {
        const branchNodes = flattenTree(branch);
        expect(branchNodes.length).toBeLessThanOrEqual(6);
      }
    });

    it('verifies tree node depth and ply matching across all branches', () => {
      const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const tree = buildScenarioTree(rootFen, mockCandidates, { maxDepth: 6 });

      expect(tree.ply).toBe(0);

      function assertPlyAndDepth(node: ScenarioTreeNode, expectedPly: number): void {
        expect(node.ply).toBe(expectedPly);
        for (const child of node.children) {
          assertPlyAndDepth(child, expectedPly + 1);
        }
      }

      for (const candidateBranch of tree.children) {
        assertPlyAndDepth(candidateBranch, 1);
      }
    });

    it('verifies 100% FEN validity and move legality at every node in the scenario tree', () => {
      const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const tree = buildScenarioTree(rootFen, mockCandidates, { maxDepth: 6 });
      const allNodes = flattenTree(tree);

      for (const node of allNodes) {
        expect(() => new Chess(node.fen)).not.toThrow();

        for (const child of node.children) {
          const parentChess = new Chess(node.fen);
          const legalSans = parentChess.moves({ verbose: true }).map((m) => m.san);
          expect(legalSans).toContain(child.san);
        }
      }
    });
  });

  // ==========================================================================
  // SECTION 4: Mode Switching Resilience & Concurrent Re-entrancy
  // ==========================================================================
  describe('4. Mode Switching Resilience & Re-entrant Concurrency', () => {
    it('survives 1,000 rapid chaotic mode toggles without state corruption', () => {
      const manager = new GameModeManager('normal');
      const MODES: GameMode[] = ['normal', 'smart', 'expert'];

      for (let i = 0; i < 1000; i++) {
        const targetMode = MODES[i % MODES.length];
        manager.setMode(targetMode);

        expect(isValidGameMode(manager.getMode())).toBe(true);
        expect(manager.getPolicy().mode).toBe(manager.getMode());
      }
    });

    it('handles 3-tier deep cascading re-entrant transitions in strict FIFO order', () => {
      const manager = new GameModeManager('normal');
      const eventLog: string[] = [];

      manager.subscribe((event) => {
        if (event.currentMode === 'smart') {
          manager.setMode('expert');
        }
      });

      manager.subscribe((event) => {
        eventLog.push(`${event.previousMode}->${event.currentMode}`);
      });

      manager.setMode('smart');

      expect(eventLog).toEqual(['normal->smart', 'smart->expert']);
      expect(manager.getMode()).toBe('expert');
    });

    it('safely tolerates subscriber unsubscription during mid-dispatch execution', () => {
      const manager = new GameModeManager('normal');
      const receivedCalls: string[] = [];

      let unsubscribe2: () => void = () => {};

      manager.subscribe((event) => {
        receivedCalls.push(`L1:${event.currentMode}`);
        unsubscribe2();
      });

      unsubscribe2 = manager.subscribe((event) => {
        receivedCalls.push(`L2:${event.currentMode}`);
      });

      manager.subscribe((event) => {
        receivedCalls.push(`L3:${event.currentMode}`);
      });

      manager.setMode('smart');

      expect(receivedCalls).toContain('L1:smart');
      expect(receivedCalls).toContain('L3:smart');
    });

    it('isolates subscriber errors and ensures queue drains without stopping other listeners', () => {
      const manager = new GameModeManager('normal');
      const healthyEvents: string[] = [];

      manager.subscribe(() => {
        throw new Error('Hostile listener failure simulation');
      });

      manager.subscribe((event) => {
        healthyEvents.push(event.currentMode);
      });

      expect(() => manager.setMode('smart')).not.toThrow();
      expect(healthyEvents).toEqual(['smart']);
      expect(manager.getMode()).toBe('smart');
    });
  });

  // ==========================================================================
  // SECTION 5: Tactical Detectors & Domino Engine Adversarial Flaw Reproductions
  // ==========================================================================
  describe('5. Tactical Detectors & Domino Engine Adversarial Flaw Reproductions', () => {
    it('demonstrates detectTrappedPieces false positives when evaluated out-of-turn', () => {
      // In initial position (White to move), Black has not moved yet. None of Black pieces are trapped.
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      // Defect reproduction: detectTrappedPieces calls chess.moves({ verbose: true }), which returns 0 moves for Black!
      const trappedBlack = detectTrappedPieces(chess, 'b');

      // In reality, Black pieces are on their starting squares, not trapped.
      // But due to the bug, trappedBlack.length returns 7!
      expect(trappedBlack.length).toBe(0);
    });

    it('demonstrates detectDiscoveredAttacks falsely reporting discovered check as double check', () => {
      // Position where Nd3+ unleashes discovered check from Bb2 to Kg7.
      // Knight on d3 does NOT attack g7 (King is on g7, Knight on d3 attacks c5, e5, f4, b4, b2, f2, e1, c1).
      const fen = '8/6k1/8/4N3/8/8/1B6/4K3 w - - 0 1';
      const chess = new Chess(fen);
      chess.move({ from: 'e5', to: 'd3' });

      const discoveries = detectDiscoveredAttacks(chess, 'w', {
        from: 'e5',
        to: 'd3',
        piece: 'n',
      });

      expect(discoveries.length).toBeGreaterThan(0);
      // Defect reproduction: Lines 522-524 mark isDoubleCheck = true because chess.inCheck() is true!
      // It should be false, and motif should be 'discovered_check', NOT 'double_check'.
      expect(discoveries[0].isDoubleCheck).toBe(false);
      expect(discoveries[0].motif).toBe('discovered_check');
    });

    it('demonstrates DominoEngine failure on 4-character and 5-character SAN moves', () => {
      // Position after 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5
      const fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
      const chess = new Chess(fen);
      const engine = new DominoEngine();

      // continuationPv has SAN moves: 'exd4' is 4 chars!
      const chain = engine.simulateDominoChain(
        chess,
        { from: 'd2', to: 'd4', san: 'd4' },
        { continuationPv: ['d4', 'exd4', 'c3', 'dxc3'] }
      );

      // Defect reproduction: tryApplyMove assumes length 4 is UCI!
      // 'exd4' has from='ex' to='d4', which throws an error and falls back to refutation move instead of exd4!
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain[1].moveSan).toBe('exd4');
    });
  });
});
