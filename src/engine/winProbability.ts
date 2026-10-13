/**
 * src/engine/winProbability.ts
 * Lichess Sigmoidal Win-Probability formula, forced mate score mapping,
 * static material sacrifice detection, and 7-tier move classification engine.
 */

import { Chess, Square, PieceSymbol } from 'chess.js';
import { MoveClassification } from '../types/engine';
import { staticExchangeEvaluation } from './tacticalDetectors';

export const LICHESS_LOGISTIC_CONSTANT = 0.00368208;

/**
 * Converts centipawns to win probability percentage (0.0 to 100.0%)
 * using the Lichess sigmoidal model: WP(cp) = 100 / (1 + exp(-0.00368208 * cp))
 */
export function centipawnsToWinProbability(cp: number): number {
  if (cp >= 3000) return 100.0;
  if (cp <= -3000) return 0.0;
  const k = LICHESS_LOGISTIC_CONSTANT;
  return 100 / (1 + Math.exp(-k * cp));
}

/**
 * Maps forced mate in M plies to win probability percentage.
 * Positive plies = winning mate; Negative plies = losing mate.
 */
export function mateToWinProbability(mateInPlies: number): number {
  if (mateInPlies > 0) {
    return Math.max(99.0, 100.0 - mateInPlies * 0.1);
  } else if (mateInPlies < 0) {
    return Math.min(1.0, Math.abs(mateInPlies) * 0.1);
  }
  return 50.0;
}

/**
 * Standard piece material values for static exchange and sacrifice detection.
 */
export const STATIC_PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Detects whether a candidate move constitutes a net material sacrifice.
 */
export function isMaterialSacrifice(
  fenBefore: string,
  from: string,
  to: string,
  promotion?: string
): boolean {
  try {
    const chess = new Chess(fenBefore);
    const movingPiece = chess.get(from as Square);
    if (!movingPiece || movingPiece.type === 'k') return false;

    const capturedPiece = chess.get(to as Square);
    const movingVal = STATIC_PIECE_VALUES[movingPiece.type];
    const capturedVal = capturedPiece ? STATIC_PIECE_VALUES[capturedPiece.type] : 0;

    // A sacrifice must give up more material than it wins outright.
    if (movingVal - capturedVal < 200) return false;

    const played = chess.move({
      from: from as Square,
      to: to as Square,
      promotion: promotion as PieceSymbol | undefined,
    });
    if (!played) return false;

    // The offer is only real when the opponent can profitably capture the piece.
    // Quiet development onto a safe square must never be flagged as a sacrifice.
    return staticExchangeEvaluation(chess, to as Square) > 0;
  } catch {
    return false;
  }
}

/**
 * Authoritative move classification based on win probability delta,
 * centipawn delta, material sacrifice, and game-turn context.
 */
export function classifyMoveDelta(
  deltaWp: number,
  deltaCp: number,
  isSacrifice = false,
  cpAfter = 0,
  isWinningPrior = false
): MoveClassification {
  // 1. Brilliant (!!)
  // Sound material sacrifice while maintaining a decisive advantage (+1.50 or better)
  if (isSacrifice && cpAfter >= 150 && deltaCp <= 20) {
    return 'brilliant';
  }

  // 2. Blunder (??)
  // Converting a winning position into equality or loss
  if (isWinningPrior && cpAfter <= 0) {
    return 'blunder';
  }
  // Dropping >20% win equity or >300 centipawns
  if (deltaWp > 20.0 || deltaCp > 300) {
    return 'blunder';
  }

  // 3. Mistake (?)
  if (deltaWp > 10.0 || deltaCp > 175) {
    return 'mistake';
  }

  // 4. Inaccuracy (?!)
  if (deltaWp > 5.0 || deltaCp > 75) {
    return 'inaccuracy';
  }

  // 5. Good
  if (deltaWp > 2.0 || deltaCp > 30) {
    return 'good';
  }

  // 6. Great (!)
  if (deltaWp > 0.5 || deltaCp > 10) {
    return 'great';
  }

  // 7. Best (★)
  return 'best';
}

/**
 * Classifies a move given { cp, wp } for best move and candidate move.
 */
export function classifyMove(
  bestMove: { cp: number; wp: number },
  candidateMove: { cp: number; wp: number },
  isSacrifice = false,
  isWinningPrior?: boolean
): MoveClassification {
  const deltaWp = Math.max(0, bestMove.wp - candidateMove.wp);
  const deltaCp = Math.max(0, bestMove.cp - candidateMove.cp);
  const winningPrior = isWinningPrior ?? (bestMove.cp >= 150 || bestMove.wp >= 65.0);

  return classifyMoveDelta(
    deltaWp,
    deltaCp,
    isSacrifice,
    candidateMove.cp,
    winningPrior
  );
}

/**
 * High-level evaluator that classifies a candidate move against the optimal engine line.
 */
export function evaluateAndClassifyMove(
  bestMove: { centipawns: number; winProbability: number },
  candidateMove: { centipawns: number; winProbability: number },
  fenBefore: string,
  move: { from: string; to: string; promotion?: string }
): { deltaWp: number; deltaCp: number; classification: MoveClassification } {
  const deltaWp = Math.max(0, bestMove.winProbability - candidateMove.winProbability);
  const deltaCp = Math.max(0, bestMove.centipawns - candidateMove.centipawns);

  const sacrifice = isMaterialSacrifice(fenBefore, move.from, move.to, move.promotion);
  const isWinningPrior = bestMove.centipawns >= 150 || bestMove.winProbability >= 65.0;

  const classification = classifyMoveDelta(
    deltaWp,
    deltaCp,
    sacrifice,
    candidateMove.centipawns,
    isWinningPrior
  );

  return { deltaWp, deltaCp, classification };
}
