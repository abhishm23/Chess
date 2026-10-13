/**
 * src/engine/scenarioTree.ts
 * Multi-ply branching variation tree builder with tactical tags, evaluations,
 * and domino explanations. Adheres strictly to ScenarioTreeNode interface.
 */

import { Chess } from 'chess.js';
import {
  ScenarioTreeNode,
  CandidateMoveEvaluation,
  DominoCausalStep,
} from '../types/engine';
import { centipawnsToWinProbability } from './winProbability';

export interface ScenarioTreeOptions {
  maxCandidateBranches?: number; // Default: 4
  maxNodesPerBranch?: number;    // Default: 6 (strictly <= 6)
  maxDepth?: number;             // Default: 4
  userSelectedMoveSan?: string | null;
  activeDominoChain?: DominoCausalStep[];
}

/**
 * Builds a pruned multi-ply scenario tree from candidate move evaluations.
 */
export function buildScenarioTree(
  rootFen: string,
  candidates: CandidateMoveEvaluation[],
  options: ScenarioTreeOptions = {}
): ScenarioTreeNode {
  const maxBranches = options.maxCandidateBranches ?? 4;
  const maxNodesPerLine = Math.min(options.maxNodesPerBranch ?? 6, 6);
  const maxDepth = options.maxDepth ?? 4;

  const rootChess = new Chess(rootFen);
  const topCandidate = candidates[0];
  const rootCp = topCandidate ? topCandidate.centipawns : 0;
  const rootWp = topCandidate ? topCandidate.winProbability : 50.0;

  // Root tactical tags
  const rootTags: string[] = [];
  if (rootChess.inCheck()) rootTags.push('check');

  // Select candidates to display: top candidates + user-selected move if not in top
  const selectedCandidates: CandidateMoveEvaluation[] = [];
  const topSlice = candidates.slice(0, maxBranches);
  selectedCandidates.push(...topSlice);

  if (options.userSelectedMoveSan) {
    const userSan = options.userSelectedMoveSan;
    const exists = selectedCandidates.some((c) => c.san === userSan);
    if (!exists) {
      const found = candidates.find((c) => c.san === userSan);
      if (found) {
        selectedCandidates.push(found);
      }
    }
  }

  const rootNode: ScenarioTreeNode = {
    id: 'root',
    san: 'root',
    fen: rootFen,
    ply: 0,
    centipawns: rootCp,
    winProbability: rootWp,
    tacticalTags: rootTags,
    dominoExplanation: rootChess.inCheck()
      ? 'King is in check! Immediate defensive action required.'
      : `Current position: evaluate candidate lines (eval: ${rootCp > 0 ? '+' : ''}${(rootCp / 100).toFixed(2)} points).`,
    children: [],
  };

  // Build candidate branches (Ply 1)
  for (const candidate of selectedCandidates) {
    const branchChess = new Chess(rootFen);
    let moveObj;
    try {
      moveObj = branchChess.move({
        from: candidate.from,
        to: candidate.to,
        promotion: candidate.promotion || undefined,
      });
    } catch {
      try {
        moveObj = branchChess.move(candidate.san);
      } catch {
        continue; // Skip invalid move
      }
    }

    if (!moveObj) continue;

    const ply1San = moveObj.san;
    const ply1Fen = branchChess.fen();
    const nodeCount = 1; // Count node for candidate move

    const ply1Node: ScenarioTreeNode = {
      id: `root-${ply1San}`,
      san: ply1San,
      fen: ply1Fen,
      ply: 1,
      centipawns: candidate.centipawns,
      winProbability: candidate.winProbability,
      tacticalTags: [...candidate.tacticalMotifs],
      dominoExplanation: generateDominoSummary(candidate, 1, moveObj.san),
      children: [],
    };

    // Build downstream plies (Plies 2 to maxDepth) following PV or simulated responses
    const pvMoves = candidate.pv && candidate.pv.length > 0 ? candidate.pv : [];
    expandContinuation(
      ply1Node,
      branchChess,
      pvMoves,
      candidate.centipawns,
      candidate.winProbability,
      2,
      maxDepth,
      nodeCount,
      maxNodesPerLine
    );

    rootNode.children.push(ply1Node);
  }

  return rootNode;
}

/**
 * Recursively expands downstream plies along the PV line up to maxNodesPerLine.
 */
function expandContinuation(
  parentNode: ScenarioTreeNode,
  simChess: Chess,
  pvMoves: string[],
  baseCp: number,
  baseWp: number,
  currentPly: number,
  maxPly: number,
  nodeCount: number,
  maxNodes: number
): void {
  if (currentPly > maxPly || nodeCount >= maxNodes || simChess.isGameOver()) {
    return;
  }

  // Determine the next move from PV or engine legal response
  let nextMoveSan: string | null = null;
  const pvIndex = currentPly - 1; // pv[0] is candidate move, pv[1] is reply

  if (pvIndex < pvMoves.length) {
    const rawMove = pvMoves[pvIndex];
    // rawMove can be in UCI (e.g. "c7c5") or SAN (e.g. "c5")
    try {
      if (rawMove.length >= 4 && /^[a-h][1-8][a-h][1-8]/.test(rawMove)) {
        const from = rawMove.substring(0, 2);
        const to = rawMove.substring(2, 4);
        const promotion = rawMove.length > 4 ? rawMove[4] : undefined;
        const res = simChess.move({ from, to, promotion });
        if (res) nextMoveSan = res.san;
      } else {
        const res = simChess.move(rawMove);
        if (res) nextMoveSan = res.san;
      }
    } catch {
      nextMoveSan = null;
    }
  }

  // Fallback if PV move was unavailable or invalid: pick top legal move or capture
  if (!nextMoveSan) {
    const legalMoves = simChess.moves({ verbose: true });
    if (legalMoves.length === 0) return;
    // Prefer capture or check if available
    const tacticalMove = legalMoves.find((m) => m.captured || simChess.inCheck()) || legalMoves[0];
    const res = simChess.move(tacticalMove);
    if (res) nextMoveSan = res.san;
  }

  if (!nextMoveSan) return;

  const currentFen = simChess.fen();
  const stepTags: string[] = [];
  if (simChess.inCheck()) stepTags.push('check');
  if (simChess.isCheckmate()) stepTags.push('checkmate');

  const childCp = baseCp;
  const childWp = baseWp;

  const childNode: ScenarioTreeNode = {
    id: `${parentNode.id}-${nextMoveSan}`,
    san: nextMoveSan,
    fen: currentFen,
    ply: currentPly,
    centipawns: childCp,
    winProbability: childWp,
    tacticalTags: stepTags,
    dominoExplanation: `Ply ${currentPly}: ${nextMoveSan} (${currentPly % 2 === 0 ? 'Opponent response' : 'Follow-up move'})`,
    children: [],
  };

  parentNode.children.push(childNode);
  const updatedCount = nodeCount + 1;

  // Recurse to next ply
  expandContinuation(
    childNode,
    simChess,
    pvMoves,
    baseCp,
    baseWp,
    currentPly + 1,
    maxPly,
    updatedCount,
    maxNodes
  );
}

/**
 * Generates an intuitive domino summary line for a candidate move.
 */
function generateDominoSummary(candidate: CandidateMoveEvaluation, ply: number, san: string): string {
  const motifs = candidate.tacticalMotifs;
  if (candidate.classification === 'blunder') {
    if (motifs.includes('fork') || motifs.includes('royal_fork')) {
      return `Blunder! Playing ${san} triggers an immediate opponent fork.`;
    }
    if (motifs.includes('trapped_piece')) {
      return `Blunder! ${san} leaves your piece trapped without safe squares.`;
    }
    if (motifs.includes('hanging_piece')) {
      return `Blunder! ${san} leaves a critical piece hanging undefended.`;
    }
    return `Blunder! ${san} drops decisive evaluation (${(candidate.centipawns / 100).toFixed(2)} points).`;
  }

  if (candidate.classification === 'inaccuracy') {
    if (motifs.includes('conceded_outpost')) {
      return `Inaccuracy: ${san} permanently concedes a strong enemy outpost.`;
    }
    return `Inaccuracy: ${san} allows counterplay and eases opponent pressure.`;
  }

  if (candidate.classification === 'brilliant') {
    return `Brilliant! ${san} sacrifices material to unlock an overwhelming tactical attack!`;
  }

  return `Candidate move ${san}: solid line with ${(candidate.winProbability).toFixed(1)}% win probability.`;
}

/**
 * Helper: Find node by ID in scenario tree.
 */
export function findNodeById(tree: ScenarioTreeNode, id: string): ScenarioTreeNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Helper: Retrieve array path of nodes from root to target ID.
 */
export function getPathToNode(tree: ScenarioTreeNode, id: string): ScenarioTreeNode[] {
  if (tree.id === id) return [tree];
  for (const child of tree.children) {
    const subPath = getPathToNode(child, id);
    if (subPath.length > 0) {
      return [tree, ...subPath];
    }
  }
  return [];
}

/**
 * Helper: Flatten tree into array of all nodes (useful for scrubber / list view).
 */
export function flattenTree(tree: ScenarioTreeNode): ScenarioTreeNode[] {
  const list: ScenarioTreeNode[] = [tree];
  for (const child of tree.children) {
    list.push(...flattenTree(child));
  }
  return list;
}
