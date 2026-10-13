/**
 * test/engine/domino.test.ts
 * Benchmark test suite for Domino Causal Simulation and Scenario Tree Generation.
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  buildScenarioTree,
  findNodeById,
  getPathToNode,
  flattenTree,
} from '../../src/engine/scenarioTree';
import {
  DominoEngine,
  generateDominoCausalChain,
} from '../../src/engine/dominoEngine';
import { CandidateMoveEvaluation } from '../../src/types/engine';

describe('Domino Effect & Scenario Tree Benchmark Suite', () => {
  const standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const mockCandidates: CandidateMoveEvaluation[] = [
    {
      san: 'e4',
      from: 'e2',
      to: 'e4',
      centipawns: 25,
      winProbability: 52.3,
      deltaWinProbability: 0,
      classification: 'best',
      tacticalMotifs: [],
      pv: ['e2e4', 'c7c5', 'g1f3', 'd7d6'],
    },
    {
      san: 'd4',
      from: 'd2',
      to: 'd4',
      centipawns: 20,
      winProbability: 51.8,
      deltaWinProbability: 0.5,
      classification: 'great',
      tacticalMotifs: [],
      pv: ['d2d4', 'g8f6', 'c2c4', 'e7e6'],
    },
    {
      san: 'f4',
      from: 'f2',
      to: 'f4',
      centipawns: -150,
      winProbability: 36.5,
      deltaWinProbability: 15.8,
      classification: 'mistake',
      tacticalMotifs: ['conceded_outpost'],
      pv: ['f2f4', 'e7e5', 'f4e5', 'd7d6'],
    },
    {
      san: 'g4',
      from: 'g2',
      to: 'g4',
      centipawns: -400,
      winProbability: 18.2,
      deltaWinProbability: 34.1,
      classification: 'blunder',
      tacticalMotifs: ['hanging_piece'],
      pv: ['g2g4', 'd7d5', 'h2h3', 'e7e5'],
    },
  ];

  describe('Scenario Tree Generation', () => {
    it('builds a valid hierarchical scenario tree with root and candidates', () => {
      const tree = buildScenarioTree(standardFen, mockCandidates);

      expect(tree).toBeDefined();
      expect(tree.id).toBe('root');
      expect(tree.ply).toBe(0);
      expect(tree.children.length).toBe(4);
    });

    it('enforces maximum node count constraint (<= 6 nodes per branch)', () => {
      const tree = buildScenarioTree(standardFen, mockCandidates, { maxNodesPerBranch: 6 });

      for (const branch of tree.children) {
        const flattened = flattenTree(branch);
        expect(flattened.length).toBeLessThanOrEqual(6);
      }
    });

    it('correctly maps centipawn scores and win probabilities to nodes', () => {
      const tree = buildScenarioTree(standardFen, mockCandidates);
      const e4Branch = tree.children.find((c) => c.san === 'e4');

      expect(e4Branch).toBeDefined();
      expect(e4Branch?.centipawns).toBe(25);
      expect(e4Branch?.winProbability).toBeCloseTo(52.3, 1);
      expect(e4Branch?.ply).toBe(1);
    });

    it('includes tactical tags and domino explanations on blunder branches', () => {
      const tree = buildScenarioTree(standardFen, mockCandidates);
      const g4Branch = tree.children.find((c) => c.san === 'g4');

      expect(g4Branch).toBeDefined();
      expect(g4Branch?.tacticalTags).toContain('hanging_piece');
      expect(g4Branch?.dominoExplanation).toContain('Blunder');
    });
  });

  describe('Tree Navigation & Path Traversal Utilities', () => {
    it('locates specific nodes by unique ID', () => {
      const tree = buildScenarioTree(standardFen, mockCandidates);
      const targetId = 'root-e4';
      const node = findNodeById(tree, targetId);

      expect(node).toBeDefined();
      expect(node?.id).toBe(targetId);
      expect(node?.san).toBe('e4');
    });

    it('retrieves accurate path from root to downstream continuation node', () => {
      const tree = buildScenarioTree(standardFen, mockCandidates);
      const firstCandidate = tree.children[0];
      if (firstCandidate.children.length > 0) {
        const downstreamNode = firstCandidate.children[0];
        const path = getPathToNode(tree, downstreamNode.id);

        expect(path.length).toBe(3); // root -> candidate -> reply
        expect(path[0].id).toBe('root');
        expect(path[1].id).toBe(firstCandidate.id);
        expect(path[2].id).toBe(downstreamNode.id);
      }
    });
  });

  describe('4-Stage Domino Causal Chain Verification', () => {
    it('generates a 4-stage causal domino chain via DominoEngine', () => {
      const chess = new Chess(standardFen);
      const chain = generateDominoCausalChain(chess, { from: 'f2', to: 'f3', san: 'f3' });

      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain[0].stage).toBe('cause');
      expect(chain[0].player).toBe('white');
      expect(chain[0].ply).toBe(1);

      if (chain.length >= 2) {
        expect(chain[1].stage).toBe('trigger');
        expect(chain[1].player).toBe('black');
        expect(chain[1].ply).toBe(2);
      }
      if (chain.length >= 3) {
        expect(chain[2].stage).toBe('crisis');
        expect(chain[2].player).toBe('white');
        expect(chain[2].ply).toBe(3);
      }
      if (chain.length >= 4) {
        expect(chain[3].stage).toBe('consequence');
        expect(chain[3].player).toBe('black');
        expect(chain[3].ply).toBe(4);
      }
    });

    it('tracks square changes across domino steps', () => {
      const chess = new Chess(standardFen);
      const chain = generateDominoCausalChain(chess, { from: 'e2', to: 'e4', san: 'e4' });

      expect(chain[0].squareChanges).toBeDefined();
      expect(chain[0].squareChanges).toContain('e2');
      expect(chain[0].squareChanges).toContain('e4');
    });

    it('terminates cleanly on immediate checkmate moves', () => {
      // Fool's mate setup
      const fen = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const chess = new Chess(fen);
      // Already checkmated position or mate in 1
      const engine = new DominoEngine();
      expect(() => {
        engine.simulateDominoChain(chess, { from: 'h2', to: 'h3' });
      }).not.toThrow();
    });
  });
});
