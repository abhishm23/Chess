/**
 * src/engine/dominoEngine.ts
 * 4-stage causal domino simulation pipeline: Cause -> Trigger -> Crisis -> Consequence.
 */

import { Chess } from 'chess.js';
import { Square, PieceSymbol, Color } from '../types/chess';
import { DominoCausalStep } from '../types/engine';
import {
  detectAllTacticalMotifs,
  detectLostSquareControl,
  detectConcededOutposts,
  detectHangingPieces,
  PIECE_VALUES,
} from './tacticalDetectors';

export interface DominoSimulationOptions {
  maxPlies?: number;
  continuationPv?: string[]; // PV line in SAN or UCI
}

export class DominoEngine {
  /**
   * Simulates forward 2 to 5 plies and constructs a 4-stage causal chain.
   */
  public simulateDominoChain(
    initialChess: Chess,
    candidateMove: { from: Square; to: Square; promotion?: PieceSymbol; san?: string },
    options: DominoSimulationOptions = {}
  ): DominoCausalStep[] {
    const chain: DominoCausalStep[] = [];
    const simChess = new Chess(initialChess.fen());
    const moverColor: Color = simChess.turn();
    const opponentColor: Color = moverColor === 'w' ? 'b' : 'w';

    const moverName: 'white' | 'black' = moverColor === 'w' ? 'white' : 'black';
    const opponentName: 'white' | 'black' = opponentColor === 'w' ? 'white' : 'black';

    // -------------------------------------------------------------------------
    // STAGE 1: CAUSE (Ply 1)
    // -------------------------------------------------------------------------
    const preMoveFen = simChess.fen();
    const chessBefore = new Chess(preMoveFen);

    let appliedMove;
    try {
      appliedMove = simChess.move({
        from: candidateMove.from,
        to: candidateMove.to,
        promotion: candidateMove.promotion || undefined,
      });
    } catch {
      return chain;
    }

    if (!appliedMove) {
      return chain;
    }

    const moveSan1 = appliedMove.san;
    const postMoveFen = simChess.fen();
    const chessAfter = new Chess(postMoveFen);

    // Analyze structural concessions
    const lostSquares = detectLostSquareControl(chessBefore, chessAfter, moverColor);
    const outposts = detectConcededOutposts(chessBefore, chessAfter, moverColor);
    const hangingPieces = detectHangingPieces(chessAfter, moverColor);

    let causeTag: string | undefined;
    let causeDesc = `${moverColor === 'w' ? 'White' : 'Black'} plays ${moveSan1}.`;

    if (lostSquares.length > 0) {
      const primaryLost = lostSquares[0];
      causeTag = primaryLost.motif;
      causeDesc += ` Leaves key square ${primaryLost.square} vulnerable.`;
    } else if (outposts.length > 0) {
      causeTag = 'conceded_outpost';
      causeDesc += ` Concedes an outpost on ${outposts[0].square}.`;
    } else if (hangingPieces.length > 0) {
      causeTag = 'hanging_piece';
      causeDesc += ` Leaves piece on ${hangingPieces[0].square} undefended.`;
    } else {
      causeDesc += ` Shifts piece coordination toward ${candidateMove.to}.`;
    }

    chain.push({
      ply: 1,
      moveSan: moveSan1,
      player: moverName,
      stage: 'cause',
      description: causeDesc,
      tacticalTag: causeTag,
      squareChanges: [candidateMove.from, candidateMove.to],
    });

    if (simChess.isGameOver()) return chain;

    // -------------------------------------------------------------------------
    // STAGE 2: TRIGGER (Ply 2)
    // -------------------------------------------------------------------------
    let move2San = options.continuationPv?.[1];
    let appliedMove2 = move2San ? this.tryApplyMove(simChess, move2San) : null;

    if (!appliedMove2) {
      appliedMove2 = this.findBestRefutationMove(simChess, opponentColor);
    }

    if (!appliedMove2) {
      return chain;
    }

    const chessAfter2 = new Chess(simChess.fen());
    const motifs2 = detectAllTacticalMotifs(chessAfter2, opponentColor, {
      chessBefore: chessAfter,
      lastMove: { from: appliedMove2.from as Square, to: appliedMove2.to as Square },
    });

    let triggerTag: string | undefined = motifs2.motifs[0];
    let triggerDesc = `${opponentColor === 'w' ? 'White' : 'Black'} refutes with ${appliedMove2.san}.`;

    if (motifs2.forks.length > 0) {
      triggerTag = motifs2.forks[0].motif;
      triggerDesc += ` Executes a ${motifs2.forks[0].isRoyal ? 'royal fork' : 'fork'} on ${motifs2.forks[0].forkSquare}.`;
    } else if (motifs2.pins.length > 0) {
      triggerTag = motifs2.pins[0].motif;
      triggerDesc += ` Pins piece on ${motifs2.pins[0].pinnedSquare}.`;
    } else if (motifs2.skewers.length > 0) {
      triggerTag = 'skewer';
      triggerDesc += ` Skewers pieces on ${motifs2.skewers[0].targetFront} and ${motifs2.skewers[0].targetBehind}.`;
    } else if (appliedMove2.captured) {
      triggerTag = 'hanging_piece';
      triggerDesc += ` Captures material on ${appliedMove2.to}.`;
    } else if (simChess.inCheck()) {
      triggerTag = 'discovered_check';
      triggerDesc += ` Delivers check, seizing tactical initiative.`;
    }

    chain.push({
      ply: 2,
      moveSan: appliedMove2.san,
      player: opponentName,
      stage: 'trigger',
      description: triggerDesc,
      tacticalTag: triggerTag,
      squareChanges: [appliedMove2.from, appliedMove2.to],
    });

    if (simChess.isGameOver()) return chain;

    // -------------------------------------------------------------------------
    // STAGE 3: CRISIS (Ply 3)
    // -------------------------------------------------------------------------
    let move3San = options.continuationPv?.[2];
    let appliedMove3 = move3San ? this.tryApplyMove(simChess, move3San) : null;

    if (!appliedMove3) {
      appliedMove3 = this.findBestDefensiveMove(simChess);
    }

    if (!appliedMove3) {
      return chain;
    }

    const inCheck3 = simChess.inCheck();
    let crisisDesc = `${moverColor === 'w' ? 'White' : 'Black'} attempts defense with ${appliedMove3.san}.`;

    if (inCheck3) {
      crisisDesc += ` King is forced to evade check, leaving other pieces unprotected.`;
    } else {
      crisisDesc += ` Defensive resources are stretched thin across multiple threats.`;
    }

    chain.push({
      ply: 3,
      moveSan: appliedMove3.san,
      player: moverName,
      stage: 'crisis',
      description: crisisDesc,
      squareChanges: [appliedMove3.from, appliedMove3.to],
    });

    if (simChess.isGameOver()) return chain;

    // -------------------------------------------------------------------------
    // STAGE 4: CONSEQUENCE (Ply 4)
    // -------------------------------------------------------------------------
    let move4San = options.continuationPv?.[3];
    let appliedMove4 = move4San ? this.tryApplyMove(simChess, move4San) : null;

    if (!appliedMove4) {
      appliedMove4 = this.findBestRefutationMove(simChess, opponentColor);
    }

    if (!appliedMove4) {
      return chain;
    }

    const isCheckmate = simChess.isCheckmate();
    let consequenceDesc = `${opponentColor === 'w' ? 'White' : 'Black'} plays ${appliedMove4.san}.`;

    if (isCheckmate) {
      consequenceDesc += ` Delivers checkmate!`;
    } else if (appliedMove4.captured) {
      const pieceVal = PIECE_VALUES[appliedMove4.captured as PieceSymbol] || 100;
      consequenceDesc += ` Wins decisive material (+${(pieceVal / 100).toFixed(0)} points).`;
    } else {
      consequenceDesc += ` Secures permanent positional dominance and piece activity.`;
    }

    chain.push({
      ply: 4,
      moveSan: appliedMove4.san,
      player: opponentName,
      stage: 'consequence',
      description: consequenceDesc,
      tacticalTag: isCheckmate ? 'back_rank_weakness' : appliedMove4.captured ? 'hanging_piece' : undefined,
      squareChanges: [appliedMove4.from, appliedMove4.to],
    });

    return chain;
  }

  private tryApplyMove(chess: Chess, sanOrUci: string) {
    // 1. Try standard SAN first (e.g. "exd4", "Nxd4", "Bxf7", "O-O-O", "d4")
    try {
      const move = chess.move(sanOrUci);
      if (move) return move;
    } catch {
      // Ignore error and fall through to UCI check
    }

    // 2. If SAN failed, check if it matches UCI coordinates (e.g. "e2e4", "e7e8q")
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(sanOrUci)) {
      try {
        const from = sanOrUci.slice(0, 2) as Square;
        const to = sanOrUci.slice(2, 4) as Square;
        const promotion = sanOrUci[4]?.toLowerCase() as PieceSymbol | undefined;
        return chess.move({ from, to, promotion });
      } catch {
        return null;
      }
    }

    return null;
  }

  private findBestRefutationMove(chess: Chess, color: Color) {
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return null;

    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const m of legalMoves) {
      let score = 0;
      if (m.captured) {
        score += (PIECE_VALUES[m.captured as PieceSymbol] || 100) * 10;
      }
      if (m.san.includes('#')) score += 100000;
      else if (m.san.includes('+')) score += 500;

      // Prefer central moves
      if (['d4', 'e4', 'd5', 'e5'].includes(m.to)) score += 50;

      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
    }

    return chess.move(bestMove);
  }

  private findBestDefensiveMove(chess: Chess) {
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return null;

    // Prefer recapture or check evasion
    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const m of legalMoves) {
      let score = 0;
      if (m.captured) {
        score += PIECE_VALUES[m.captured as PieceSymbol] || 100;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
    }

    return chess.move(bestMove);
  }
}

export function generateDominoCausalChain(
  chess: Chess,
  candidateMove: { from: Square; to: Square; promotion?: PieceSymbol; san?: string },
  options?: DominoSimulationOptions
): DominoCausalStep[] {
  const engine = new DominoEngine();
  return engine.simulateDominoChain(chess, candidateMove, options);
}
