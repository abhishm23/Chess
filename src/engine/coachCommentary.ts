/**
 * src/engine/coachCommentary.ts
 * Natural language translation engine converting engine evaluations, classifications,
 * and domino chains into Plain-English grandmaster advice for Beginner, Intermediate,
 * and Expert personas.
 */

import { MoveClassification, DominoCausalStep } from '../types/engine';

export interface CoachAdviceResult {
  beginner: string;
  intermediate: string;
  expert: string;
}

export interface CoachContext {
  classification: MoveClassification;
  motifs?: string[];
  san: string;
  evalData?: {
    centipawns: number;
    deltaCentipawns?: number;
    winProbability: number;
    deltaWinProbability?: number;
  };
  dominoSteps?: DominoCausalStep[];
  turn?: 'w' | 'b' | 'white' | 'black';
  isCheck?: boolean;
  isCheckmate?: boolean;
  isDraw?: boolean;
  drawReason?: string;
}

/**
 * Universal Grandmaster Coach Commentary Generator.
 * Supports both context object and positional parameters for 100% backward compatibility.
 */
export function generateCoachAdvice(
  classificationOrContext: MoveClassification | CoachContext,
  motifsArg: string[] = [],
  sanArg: string = 'Move',
  evalDataArg?: { centipawns: number; winProbability: number; deltaWinProbability?: number },
  dominoStepsArg?: DominoCausalStep[]
): CoachAdviceResult {
  let ctx: CoachContext;

  if (typeof classificationOrContext === 'object') {
    ctx = classificationOrContext;
  } else {
    ctx = {
      classification: classificationOrContext,
      motifs: motifsArg,
      san: sanArg,
      evalData: evalDataArg ? {
        centipawns: evalDataArg.centipawns,
        winProbability: evalDataArg.winProbability,
        deltaWinProbability: evalDataArg.deltaWinProbability,
      } : undefined,
      dominoSteps: dominoStepsArg,
    };
  }

  const { classification, san } = ctx;
  const motifs = ctx.motifs || [];
  const evalData = ctx.evalData;
  const cpFormatted = evalData ? (evalData.centipawns / 100).toFixed(2) : '0.00';
  const wpFormatted = evalData ? evalData.winProbability.toFixed(1) : '50.0';
  const deltaCp = evalData?.deltaCentipawns ? Math.abs(evalData.deltaCentipawns / 100).toFixed(2) : '2.50';

  // Format motif names cleanly
  const cleanMotif = motifs.length > 0 ? motifs[0].replace(/_/g, ' ') : 'tactical flaw';

  // 1. BLUNDER (??)
  if (classification === 'blunder') {
    if (motifs.includes('royal_fork') || motifs.includes('fork')) {
      return {
        beginner: `Watch out! Playing ${san} loses material to a devastating fork! Check your pieces before you move.`,
        intermediate: `Blunder: ${san} fatally neglects square control and walks directly into a ${cleanMotif}. Your opponent strikes two targets at once.`,
        expert: `Critical tactical oversight (${san}, -${deltaCp} points). Concedes a decisive ${cleanMotif}, creating insurmountable tactical disharmony.`,
      };
    }

    if (motifs.includes('absolute_pin') || motifs.includes('pin')) {
      return {
        beginner: `Be careful! ${san} puts your piece in a pin against your King, so it cannot move!`,
        intermediate: `Blunder: ${san} creates an absolute pin against your King. The pinned defender is immobilized and will fall.`,
        expert: `Severe oversight (${san}). Exploits absolute pin geometry along the critical axis, forcing immediate material liquidation.`,
      };
    }

    if (motifs.includes('skewer')) {
      return {
        beginner: `Watch out! ${san} allows a skewer: your big piece will have to run, and the piece behind it will get captured!`,
        intermediate: `Blunder: ${san} lines up your pieces on an open ray, allowing a crushing skewer that wins major material.`,
        expert: `Tactical blunder with ${san}. Surrenders a linear skewer; compelling piece displacement and winning the rear target.`,
      };
    }

    if (motifs.includes('trapped_piece')) {
      return {
        beginner: `Oops! ${san} traps your own piece. It has nowhere safe to run!`,
        intermediate: `Blunder: ${san} leaves your piece with zero safe escape squares. The opponent will surround and capture it.`,
        expert: `Positional catastrophe (${san}). Results in complete piece domination with 0 safe mobility, guaranteeing net material loss.`,
      };
    }

    if (motifs.includes('hanging_piece')) {
      return {
        beginner: `Watch out! Playing ${san} leaves a piece completely undefended (hanging). Your opponent can take it for free!`,
        intermediate: `Blunder: ${san} abandons critical defense, leaving an unprotected hanging piece vulnerable to immediate capture.`,
        expert: `Tactical blunder (${san}, -${deltaCp} points). Neglects basic Exchange Outcome (Trade Value), dropping material without compensation.`,
      };
    }

    return {
      beginner: `Watch out! Playing ${san} loses material or exposes your King.`,
      intermediate: `Blunder: ${san} neglects key square control and triggers a decisive tactical penalty (${motifs.join(', ') || 'tactical flaw'}).`,
      expert: `Severe tactical oversight with ${san} (-${deltaCp} points). Concedes decisive dynamic compensation and triggers an opponent breakthrough.`,
    };
  }

  // 2. MISTAKE (?)
  if (classification === 'mistake') {
    return {
      beginner: `Oops! ${san} gives away your advantage. Try to keep your pieces safe and active.`,
      intermediate: `Mistake: ${san} concedes central initiative and allows opponent piece infiltration (${cleanMotif}).`,
      expert: `Suboptimal continuation (${san}, eval shift -${deltaCp} points). Surrenders positional initiative and eases opponent defensive tasks.`,
    };
  }

  // 3. INACCURACY (?!)
  if (classification === 'inaccuracy') {
    if (motifs.includes('conceded_outpost')) {
      return {
        beginner: `${san} is okay, but it lets the other player put a knight into a great square where our pawns can't chase it away.`,
        intermediate: `Inaccuracy: ${san} creates a permanent hole and concedes an untouchable outpost to the opponent.`,
        expert: `Positional inaccuracy with ${san}. Surrenders outpost rights; opponent secures a dominant central anchor with lasting pressure.`,
      };
    }

    return {
      beginner: `${san} is okay, but leaves your pieces slightly passive.`,
      intermediate: `Inaccuracy: ${san} surrenders slight initiative and concedes an outpost or square control.`,
      expert: `Suboptimal positional move (${san}). Allows opponent counterplay against subtle pawn weaknesses.`,
    };
  }

  // 4. BRILLIANT (!!)
  if (classification === 'brilliant') {
    return {
      beginner: `Incredible move! You sacrificed a piece to win the game!`,
      intermediate: `Brilliant sacrifice (${san})! Unlocks a crushing mating attack or overwhelming tactical combination.`,
      expert: `Brilliancy (${san}) with deep engine depth calculation: decisive long-term tactical conversion (+${cpFormatted} points).`,
    };
  }

  // 5. GREAT (!)
  if (classification === 'great') {
    return {
      beginner: `Great job! ${san} puts serious pressure on your opponent!`,
      intermediate: `Great move! ${san} finds a sharp tactical resource and coordinates your pieces effectively.`,
      expert: `High-precision alternative (${san}). Restricts counterplay and maintains maximum positional pressure (+${cpFormatted} points).`,
    };
  }

  // 6. BEST (★)
  if (classification === 'best') {
    return {
      beginner: `Best move! ${san} develops your forces safely and controls the board.`,
      intermediate: `Optimal development with ${san}, controlling key central squares and coordinating forces.`,
      expert: `Top engine move (${san}, +${cpFormatted} points, ${wpFormatted}% win chance). Preserves optimal dynamic tension along the best line calculation.`,
    };
  }

  // 7. GOOD (Default sound move)
  return {
    beginner: `Strong move! ${san} develops your pieces safely.`,
    intermediate: `Optimal development with ${san}, controlling key central squares.`,
    expert: `Maintains dynamic balance with ${san}; preserves maximum tactical tension.`,
  };
}
