/**
 * src/engine/tacticalDetectors.ts
 * High-performance tactical motif and positional concession detectors.
 */

import { Chess, Move } from 'chess.js';
import { Square, PieceSymbol, Color } from '../types/chess';
import { TacticalMotif } from '../types/engine';
import {
  SQUARES,
  FILES,
  RANKS,
  squareToIndex,
  calculateSquareControl,
  calculateDetailedSquareControl,
} from '../rules/squareControl';

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

const ROOK_DIRECTIONS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
];

const BISHOP_DIRECTIONS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export interface ForkTarget {
  square: Square;
  piece: PieceSymbol;
  value: number;
  isKing: boolean;
  isUndefended: boolean;
}

export interface DetectedFork {
  forkSquare: Square;
  attackerPiece: PieceSymbol;
  attackerColor: Color;
  targets: Square[];
  targetDetails: ForkTarget[];
  isRoyal: boolean;
  isPawnFork: boolean;
  motif: 'fork' | 'royal_fork';
  description: string;
}

export interface DetectedPin {
  pinnerSquare: Square;
  pinnerPiece: PieceSymbol;
  pinnedSquare: Square;
  pinnedPiece: PieceSymbol;
  targetSquare: Square;
  targetPiece: PieceSymbol;
  kingSquare?: Square;
  pinColor: Color;
  pinType: 'absolute' | 'relative';
  ray: Square[];
  motif: 'absolute_pin' | 'relative_pin' | 'pin';
  description: string;
}

export interface DetectedSkewer {
  attackerSquare: Square;
  attackerPiece: PieceSymbol;
  targetFront: Square;
  pieceFront: PieceSymbol;
  targetBehind: Square;
  pieceBehind: PieceSymbol;
  attackerColor: Color;
  ray: Square[];
  motif: 'skewer';
  description: string;
}

export interface DetectedDiscoveredAttack {
  maskSquare: Square;
  maskPiece: PieceSymbol;
  destinationSquare?: Square;
  sniperSquare: Square;
  sniperPiece: PieceSymbol;
  targetSquare: Square;
  targetPiece: PieceSymbol;
  attackerColor: Color;
  isCheck: boolean;
  isDoubleCheck: boolean;
  motif: 'discovered_attack' | 'discovered_check' | 'double_check';
  description: string;
}

export interface OverworkedPiece {
  defenderSquare: Square;
  defenderPiece: PieceSymbol;
  defenderColor: Color;
  defendedTargets: {
    square: Square;
    piece: PieceSymbol;
    attackersCount: number;
  }[];
  motif: 'overloaded_piece';
  description: string;
}

export interface HangingPiece {
  square: Square;
  piece: PieceSymbol;
  color: Color;
  attackerSquares: Square[];
  value: number;
  seeScore: number;
  motif: 'hanging_piece';
  description: string;
}

export interface LostSquareControlEvent {
  square: Square;
  category: 'center' | 'extended_center' | 'king_shelter' | 'infiltration';
  previousControl: number;
  currentControl: number;
  motif: 'lost_key_square' | 'compromised_king_shelter';
  description: string;
}

export interface ConcededOutpost {
  square: Square;
  beneficiaryColor: Color;
  anchorPawnSquare?: Square;
  motif: 'conceded_outpost';
  description: string;
}

export interface TrappedPiece {
  square: Square;
  piece: PieceSymbol;
  color: Color;
  safeMobility: number;
  motif: 'trapped_piece';
  description: string;
}

export interface TacticalMotifSummary {
  motifs: TacticalMotif[];
  forks: DetectedFork[];
  pins: DetectedPin[];
  skewers: DetectedSkewer[];
  discoveredAttacks: DetectedDiscoveredAttack[];
  overworked: OverworkedPiece[];
  hangingPieces: HangingPiece[];
  trappedPieces: TrappedPiece[];
  concededOutposts: ConcededOutpost[];
  lostSquareControl: LostSquareControlEvent[];
}

// -----------------------------------------------------------------------------
// 1. Forks & Double Attacks
// -----------------------------------------------------------------------------
export function detectForks(
  chess: Chess,
  moverColor: Color,
  candidateSquare?: Square
): DetectedFork[] {
  const forks: DetectedFork[] = [];
  const enemyColor: Color = moverColor === 'w' ? 'b' : 'w';
  const control = calculateSquareControl(chess);

  const squaresToCheck = candidateSquare ? [candidateSquare] : SQUARES;

  for (const sq of squaresToCheck) {
    const piece = chess.get(sq);
    if (!piece || piece.color !== moverColor) continue;

    const file = sq.charCodeAt(0) - 97;
    const rank = sq.charCodeAt(1) - 49;
    const attackedSquares: Square[] = [];

    if (piece.type === 'p') {
      const dir = moverColor === 'w' ? 1 : -1;
      const tr = rank + dir;
      if (tr >= 0 && tr <= 7) {
        if (file - 1 >= 0) attackedSquares.push(`${FILES[file - 1]}${RANKS[tr]}` as Square);
        if (file + 1 <= 7) attackedSquares.push(`${FILES[file + 1]}${RANKS[tr]}` as Square);
      }
    } else if (piece.type === 'n') {
      for (const [df, dr] of KNIGHT_OFFSETS) {
        const tf = file + df;
        const tr = rank + dr;
        if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          attackedSquares.push(`${FILES[tf]}${RANKS[tr]}` as Square);
        }
      }
    } else if (piece.type === 'k') {
      for (const [df, dr] of KING_OFFSETS) {
        const tf = file + df;
        const tr = rank + dr;
        if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          attackedSquares.push(`${FILES[tf]}${RANKS[tr]}` as Square);
        }
      }
    } else {
      const dirs: number[][] = [];
      if (piece.type === 'b' || piece.type === 'q') dirs.push(...BISHOP_DIRECTIONS);
      if (piece.type === 'r' || piece.type === 'q') dirs.push(...ROOK_DIRECTIONS);

      for (const [df, dr] of dirs) {
        let tf = file + df;
        let tr = rank + dr;
        while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          const tSq = `${FILES[tf]}${RANKS[tr]}` as Square;
          attackedSquares.push(tSq);
          if (chess.get(tSq)) break;
          tf += df;
          tr += dr;
        }
      }
    }

    const targets: ForkTarget[] = [];
    let targetsKing = false;
    let targetsQueen = false;

    for (const tSq of attackedSquares) {
      const targetPiece = chess.get(tSq);
      if (!targetPiece || targetPiece.color !== enemyColor) continue;

      const tIdx = squareToIndex(tSq);
      const enemyDefenders = enemyColor === 'w' ? control.white[tIdx] : control.black[tIdx];
      const isKing = targetPiece.type === 'k';
      const isUndefended = enemyDefenders === 0;

      if (isKing) targetsKing = true;
      if (targetPiece.type === 'q') targetsQueen = true;

      const isTargetWorthy =
        isKing ||
        isUndefended ||
        PIECE_VALUES[targetPiece.type] > PIECE_VALUES[piece.type] ||
        (piece.type === 'p' && ['n', 'b', 'r', 'q'].includes(targetPiece.type)) ||
        (piece.type === 'n' && ['b', 'n', 'r', 'q'].includes(targetPiece.type));

      if (isTargetWorthy) {
        targets.push({
          square: tSq,
          piece: targetPiece.type,
          value: PIECE_VALUES[targetPiece.type],
          isKing,
          isUndefended,
        });
      }
    }

    if (targets.length >= 2) {
      const isRoyal = targetsKing && targetsQueen;
      const isPawnFork = piece.type === 'p';
      const motif: 'fork' | 'royal_fork' = isRoyal ? 'royal_fork' : 'fork';

      const targetDesc = targets.map((t) => `${t.piece.toUpperCase()} on ${t.square}`).join(' and ');
      const description = isRoyal
        ? `Royal fork! ${piece.type.toUpperCase()} on ${sq} forks the King and Queen.`
        : `${piece.type.toUpperCase()} on ${sq} forks ${targetDesc}.`;

      forks.push({
        forkSquare: sq,
        attackerPiece: piece.type,
        attackerColor: moverColor,
        targets: targets.map((t) => t.square),
        targetDetails: targets,
        isRoyal,
        isPawnFork,
        motif,
        description,
      });
    }
  }

  return forks;
}

// -----------------------------------------------------------------------------
// 2. Absolute and Relative Pins
// -----------------------------------------------------------------------------
export function detectPins(chess: Chess, targetColor: Color): DetectedPin[] {
  const pins: DetectedPin[] = [];

  // Identify high-value targets (King, Queen, Rooks)
  const targets: { square: Square; piece: PieceSymbol }[] = [];
  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (p && p.color === targetColor) {
      if (p.type === 'k' || p.type === 'q' || p.type === 'r') {
        targets.push({ square: sq, piece: p.type });
      }
    }
  }

  for (const tgt of targets) {
    const { file, rank } = {
      file: tgt.square.charCodeAt(0) - 97,
      rank: tgt.square.charCodeAt(1) - 49,
    };

    const checkRays = (dirs: number[][], attackers: PieceSymbol[]) => {
      for (const [df, dr] of dirs) {
        let tf = file + df;
        let tr = rank + dr;
        let shield: { square: Square; piece: PieceSymbol } | null = null;
        const raySquares: Square[] = [];

        while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          const cSq = `${FILES[tf]}${RANKS[tr]}` as Square;
          raySquares.push(cSq);
          const piece = chess.get(cSq);

          if (piece) {
            if (piece.color === targetColor) {
              if (!shield) {
                shield = { square: cSq, piece: piece.type };
              } else {
                break; // Second friendly piece breaks ray
              }
            } else {
              // Enemy piece
              if (shield && attackers.includes(piece.type)) {
                // Pin detected!
                const isAbsolute = tgt.piece === 'k';
                const isWorthyRelative =
                  !isAbsolute &&
                  PIECE_VALUES[tgt.piece] > PIECE_VALUES[shield.piece];

                if (isAbsolute || isWorthyRelative) {
                  const pinType: 'absolute' | 'relative' = isAbsolute ? 'absolute' : 'relative';
                  pins.push({
                    pinnerSquare: cSq,
                    pinnerPiece: piece.type,
                    pinnedSquare: shield.square,
                    pinnedPiece: shield.piece,
                    targetSquare: tgt.square,
                    targetPiece: tgt.piece,
                    kingSquare: isAbsolute ? tgt.square : undefined,
                    pinColor: targetColor,
                    pinType,
                    ray: [...raySquares],
                    motif: isAbsolute ? 'absolute_pin' : 'relative_pin',
                    description: isAbsolute
                      ? `Absolute pin: ${piece.type.toUpperCase()} on ${cSq} pins ${shield.piece.toUpperCase()} on ${shield.square} to King on ${tgt.square}.`
                      : `Relative pin: ${piece.type.toUpperCase()} on ${cSq} pins ${shield.piece.toUpperCase()} on ${shield.square} to ${tgt.piece.toUpperCase()} on ${tgt.square}.`,
                  });
                }
              }
              break;
            }
          }
          tf += df;
          tr += dr;
        }
      }
    };

    checkRays(ROOK_DIRECTIONS, ['r', 'q']);
    checkRays(BISHOP_DIRECTIONS, ['b', 'q']);
  }

  return pins;
}

// -----------------------------------------------------------------------------
// 3. Skewers (Reverse Pins)
// -----------------------------------------------------------------------------
export function detectSkewers(chess: Chess, attackerColor: Color): DetectedSkewer[] {
  const skewers: DetectedSkewer[] = [];
  const defenderColor: Color = attackerColor === 'w' ? 'b' : 'w';

  for (const sq of SQUARES) {
    const piece = chess.get(sq);
    if (!piece || piece.color !== attackerColor) continue;
    if (!['r', 'b', 'q'].includes(piece.type)) continue;

    const file = sq.charCodeAt(0) - 97;
    const rank = sq.charCodeAt(1) - 49;

    const dirs: number[][] = [];
    if (piece.type === 'r' || piece.type === 'q') dirs.push(...ROOK_DIRECTIONS);
    if (piece.type === 'b' || piece.type === 'q') dirs.push(...BISHOP_DIRECTIONS);

    for (const [df, dr] of dirs) {
      let tf = file + df;
      let tr = rank + dr;
      let frontTarget: { sq: Square; type: PieceSymbol } | null = null;
      const ray: Square[] = [];

      while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
        const cSq = `${FILES[tf]}${RANKS[tr]}` as Square;
        const curPiece = chess.get(cSq);

        if (curPiece) {
          if (curPiece.color === defenderColor) {
            if (!frontTarget) {
              if (['k', 'q', 'r'].includes(curPiece.type)) {
                frontTarget = { sq: cSq, type: curPiece.type };
              } else {
                break;
              }
            } else {
              // Found behind target!
              const isSkewer =
                frontTarget.type === 'k' ||
                PIECE_VALUES[frontTarget.type] > PIECE_VALUES[curPiece.type] ||
                (frontTarget.type === 'q' && curPiece.type === 'r');

              if (isSkewer) {
                skewers.push({
                  attackerSquare: sq,
                  attackerPiece: piece.type,
                  targetFront: frontTarget.sq,
                  pieceFront: frontTarget.type,
                  targetBehind: cSq,
                  pieceBehind: curPiece.type,
                  attackerColor,
                  ray,
                  motif: 'skewer',
                  description: `Skewer: ${piece.type.toUpperCase()} on ${sq} skewers ${frontTarget.type.toUpperCase()} on ${frontTarget.sq}, exposing ${curPiece.type.toUpperCase()} on ${cSq}.`,
                });
              }
              break;
            }
          } else {
            break; // Friendly piece blocks
          }
        } else {
          ray.push(cSq);
        }
        tf += df;
        tr += dr;
      }
    }
  }

  return skewers;
}

// -----------------------------------------------------------------------------
// 4. Discovered Attacks & Discovered Checks
// -----------------------------------------------------------------------------
export function detectDiscoveredAttacks(
  chess: Chess,
  attackerColor: Color,
  lastMove?: { from: Square; to: Square; piece?: PieceSymbol }
): DetectedDiscoveredAttack[] {
  const discoveries: DetectedDiscoveredAttack[] = [];
  const defenderColor: Color = attackerColor === 'w' ? 'b' : 'w';

  // If last move provided, check rays opening through lastMove.from
  if (lastMove) {
    const fromFile = lastMove.from.charCodeAt(0) - 97;
    const fromRank = lastMove.from.charCodeAt(1) - 49;

    const allDirs = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];

    for (const [df, dr] of allDirs) {
      // Find friendly sniper behind fromSquare
      let sf = fromFile - df;
      let sr = fromRank - dr;
      let sniper: { sq: Square; type: PieceSymbol } | null = null;

      while (sf >= 0 && sf <= 7 && sr >= 0 && sr <= 7) {
        const sSq = `${FILES[sf]}${RANKS[sr]}` as Square;
        const p = chess.get(sSq);
        if (p) {
          if (p.color === attackerColor) {
            const isOrthogonal = df === 0 || dr === 0;
            if (isOrthogonal && (p.type === 'r' || p.type === 'q')) {
              sniper = { sq: sSq, type: p.type };
            } else if (!isOrthogonal && (p.type === 'b' || p.type === 'q')) {
              sniper = { sq: sSq, type: p.type };
            }
          }
          break;
        }
        sf -= df;
        sr -= dr;
      }

      if (!sniper) continue;

      // Find enemy target ahead of fromSquare
      let tf = fromFile + df;
      let tr = fromRank + dr;
      let target: { sq: Square; type: PieceSymbol } | null = null;

      while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
        const tSq = `${FILES[tf]}${RANKS[tr]}` as Square;
        const p = chess.get(tSq);
        if (p) {
          if (p.color === defenderColor) {
            target = { sq: tSq, type: p.type };
          }
          break;
        }
        tf += df;
        tr += dr;
      }

      if (sniper && target) {
        const isCheck = target.type === 'k';
        let movedPieceChecked = false;
        if (isCheck) {
          const detailed = calculateDetailedSquareControl(chess);
          const targetIdx = squareToIndex(target.sq);
          const targetControl = detailed[targetIdx];
          const attackersOnTarget =
            attackerColor === 'w'
              ? targetControl.whiteAttackers
              : targetControl.blackAttackers;
          movedPieceChecked = attackersOnTarget.some((a) => a.square === lastMove.to);
        }
        const isDoubleCheck = isCheck && movedPieceChecked;

        const motif = isDoubleCheck
          ? 'double_check'
          : isCheck
          ? 'discovered_check'
          : 'discovered_attack';

        discoveries.push({
          maskSquare: lastMove.from,
          maskPiece: lastMove.piece || 'p',
          destinationSquare: lastMove.to,
          sniperSquare: sniper.sq,
          sniperPiece: sniper.type,
          targetSquare: target.sq,
          targetPiece: target.type,
          attackerColor,
          isCheck,
          isDoubleCheck,
          motif,
          description: isDoubleCheck
            ? `Devastating double check! King must evade both attackers.`
            : isCheck
            ? `Discovered check: moving from ${lastMove.from} unleashes ${sniper.type.toUpperCase()} on ${sniper.sq} against King on ${target.sq}.`
            : `Discovered attack on ${target.type.toUpperCase()} on ${target.sq}.`,
        });
      }
    }
  }

  return discoveries;
}

// -----------------------------------------------------------------------------
// 5. Overworked Defenders
// -----------------------------------------------------------------------------
export function detectOverworkedDefenders(
  chess: Chess,
  defenderColor: Color
): OverworkedPiece[] {
  const overworked: OverworkedPiece[] = [];
  const detailed = calculateDetailedSquareControl(chess);

  // Map of defender square -> defended targets that are under attack
  const defenderMap = new Map<
    Square,
    { square: Square; piece: PieceSymbol; attackersCount: number }[]
  >();

  for (const info of detailed) {
    const p = chess.get(info.square);
    if (!p || p.color !== defenderColor) continue;

    const enemyAttackers = defenderColor === 'w' ? info.blackAttackers : info.whiteAttackers;
    const friendlyDefenders = defenderColor === 'w' ? info.whiteAttackers : info.blackAttackers;

    if (enemyAttackers.length > 0 && friendlyDefenders.length === 1) {
      const soleDefender = friendlyDefenders[0];
      if (!defenderMap.has(soleDefender.square)) {
        defenderMap.set(soleDefender.square, []);
      }
      defenderMap.get(soleDefender.square)!.push({
        square: info.square,
        piece: p.type,
        attackersCount: enemyAttackers.length,
      });
    }
  }

  for (const [defSq, duties] of defenderMap.entries()) {
    if (duties.length >= 2) {
      const p = chess.get(defSq);
      if (p) {
        overworked.push({
          defenderSquare: defSq,
          defenderPiece: p.type,
          defenderColor,
          defendedTargets: duties,
          motif: 'overloaded_piece',
          description: `${p.type.toUpperCase()} on ${defSq} is overworked: solely defending ${duties.length} attacked pieces simultaneously.`,
        });
      }
    }
  }

  return overworked;
}

// -----------------------------------------------------------------------------
// 6. Hanging Pieces & Static Exchange Evaluation (SEE)
// -----------------------------------------------------------------------------
export function staticExchangeEvaluation(chess: Chess, targetSquare: Square): number {
  const target = chess.get(targetSquare);
  if (!target) return 0;

  const control = calculateDetailedSquareControl(chess);
  const targetIdx = squareToIndex(targetSquare);
  const detailedSq = control[targetIdx];

  const whitePins = detectPins(chess, 'w').filter((p) => p.pinType === 'absolute');
  const blackPins = detectPins(chess, 'b').filter((p) => p.pinType === 'absolute');

  const whiteAttackers = detailedSq.whiteAttackers.filter((a) => {
    const pin = whitePins.find((p) => p.pinnedSquare === a.square);
    return !pin || pin.ray.includes(targetSquare) || targetSquare === pin.pinnerSquare;
  });
  const blackAttackers = detailedSq.blackAttackers.filter((a) => {
    const pin = blackPins.find((p) => p.pinnedSquare === a.square);
    return !pin || pin.ray.includes(targetSquare) || targetSquare === pin.pinnerSquare;
  });

  let currentSide: Color = target.color === 'w' ? 'b' : 'w';
  const victimValues: number[] = [0, PIECE_VALUES[target.type]];
  let depth = 0;

  while (true) {
    const attackers = currentSide === 'w' ? whiteAttackers : blackAttackers;
    if (attackers.length === 0) break;

    // Pick least valuable attacker
    attackers.sort((a, b) => PIECE_VALUES[a.piece] - PIECE_VALUES[b.piece]);
    const nextAttacker = attackers.shift()!;

    depth++;
    victimValues[depth + 1] = PIECE_VALUES[nextAttacker.piece];

    currentSide = currentSide === 'w' ? 'b' : 'w';
  }

  if (depth === 0) return 0;

  // Minimax fold backwards from leaf
  const gain: number[] = new Array(depth + 1).fill(0);
  gain[depth] = victimValues[depth];

  for (let d = depth - 1; d >= 1; d--) {
    gain[d] = victimValues[d] - Math.max(0, gain[d + 1]);
  }

  return gain[1];
}

export function detectHangingPieces(chess: Chess, color: Color): HangingPiece[] {
  const hanging: HangingPiece[] = [];
  const detailed = calculateDetailedSquareControl(chess);
  const pins = detectPins(chess, color).filter((p) => p.pinType === 'absolute');

  for (const info of detailed) {
    const p = chess.get(info.square);
    if (!p || p.color !== color || p.type === 'k') continue;

    const enemyAttackers = color === 'w' ? info.blackAttackers : info.whiteAttackers;
    const rawDefenders = color === 'w' ? info.whiteAttackers : info.blackAttackers;
    const friendlyDefenders = rawDefenders.filter((d) => {
      const pin = pins.find((pi) => pi.pinnedSquare === d.square);
      return !pin || pin.ray.includes(info.square) || info.square === pin.pinnerSquare;
    });

    if (enemyAttackers.length > 0) {
      const see = staticExchangeEvaluation(chess, info.square);
      if (friendlyDefenders.length === 0 || see > 0) {
        hanging.push({
          square: info.square,
          piece: p.type,
          color,
          attackerSquares: enemyAttackers.map((a) => a.square),
          value: PIECE_VALUES[p.type],
          seeScore: see,
          motif: 'hanging_piece',
          description: `Hanging piece: ${p.type.toUpperCase()} on ${info.square} is undefended or tactically vulnerable.`,
        });
      }
    }
  }

  return hanging;
}

// -----------------------------------------------------------------------------
// 7. Lost Control of Key Squares & Compromised King Shelter
// -----------------------------------------------------------------------------
export function detectLostSquareControl(
  chessBefore: Chess,
  chessAfter: Chess,
  moverColor: Color
): LostSquareControlEvent[] {
  const events: LostSquareControlEvent[] = [];
  const ctrlBefore = calculateSquareControl(chessBefore);
  const ctrlAfter = calculateSquareControl(chessAfter);

  // Identify King square
  let kingSq: Square | null = null;
  for (const sq of SQUARES) {
    const p = chessAfter.get(sq);
    if (p && p.color === moverColor && p.type === 'k') {
      kingSq = sq;
      break;
    }
  }

  const kingRing: Set<string> = new Set();
  if (kingSq) {
    const kf = kingSq.charCodeAt(0) - 97;
    const kr = kingSq.charCodeAt(1) - 49;
    for (const [df, dr] of KING_OFFSETS) {
      const tf = kf + df;
      const tr = kr + dr;
      if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
        kingRing.add(`${FILES[tf]}${RANKS[tr]}`);
      }
    }
  }

  const keySquares: { square: Square; category: 'center' | 'extended_center' | 'king_shelter' }[] = [
    { square: 'd4', category: 'center' },
    { square: 'e4', category: 'center' },
    { square: 'd5', category: 'center' },
    { square: 'e5', category: 'center' },
    { square: 'c4', category: 'extended_center' },
    { square: 'f4', category: 'extended_center' },
    { square: 'c5', category: 'extended_center' },
    { square: 'f5', category: 'extended_center' },
  ];

  for (const item of keySquares) {
    const idx = squareToIndex(item.square);
    const diffBefore = moverColor === 'w' ? ctrlBefore.differential[idx] : -ctrlBefore.differential[idx];
    const diffAfter = moverColor === 'w' ? ctrlAfter.differential[idx] : -ctrlAfter.differential[idx];

    if (diffBefore >= 0 && diffAfter < 0) {
      events.push({
        square: item.square,
        category: item.category,
        previousControl: diffBefore,
        currentControl: diffAfter,
        motif: 'lost_key_square',
        description: `Lost control of key square ${item.square}.`,
      });
    }
  }

  // Check king ring
  for (const kRingSq of kingRing) {
    const idx = squareToIndex(kRingSq);
    const diffBefore = moverColor === 'w' ? ctrlBefore.differential[idx] : -ctrlBefore.differential[idx];
    const diffAfter = moverColor === 'w' ? ctrlAfter.differential[idx] : -ctrlAfter.differential[idx];

    const friendlyBefore = moverColor === 'w' ? ctrlBefore.white[idx] : ctrlBefore.black[idx];
    const friendlyAfter = moverColor === 'w' ? ctrlAfter.white[idx] : ctrlAfter.black[idx];

    const pawnMovedAway =
      chessBefore.get(kRingSq as Square)?.type === 'p' &&
      chessBefore.get(kRingSq as Square)?.color === moverColor &&
      !chessAfter.get(kRingSq as Square);

    if ((diffBefore >= 0 && diffAfter < 0) || (friendlyAfter < friendlyBefore) || pawnMovedAway) {
      events.push({
        square: kRingSq as Square,
        category: 'king_shelter',
        previousControl: diffBefore,
        currentControl: diffAfter,
        motif: 'compromised_king_shelter',
        description: `Compromised King shelter on ${kRingSq}.`,
      });
    }
  }

  return events;
}

// -----------------------------------------------------------------------------
// 8. Conceded Outposts
// -----------------------------------------------------------------------------
export function detectConcededOutposts(
  chessBefore: Chess,
  chessAfter: Chess,
  moverColor: Color
): ConcededOutpost[] {
  const outposts: ConcededOutpost[] = [];
  const enemyColor: Color = moverColor === 'w' ? 'b' : 'w';

  // Candidate ranks: ranks 4, 5, 6 from enemy perspective
  const targetRanks = enemyColor === 'w' ? [3, 4, 5] : [4, 3, 2]; // 0-indexed: White 4,5,6 -> 3,4,5; Black 4,5,6 -> 4,3,2

  for (let f = 1; f < 7; f++) {
    for (const r of targetRanks) {
      const sq = `${FILES[f]}${RANKS[r]}` as Square;
      // Check if enemy pawn anchors this square
      const anchorRank = enemyColor === 'w' ? r - 1 : r + 1;
      const leftAnchor = f > 0 ? (`${FILES[f - 1]}${RANKS[anchorRank]}` as Square) : null;
      const rightAnchor = f < 7 ? (`${FILES[f + 1]}${RANKS[anchorRank]}` as Square) : null;

      const pLeft = leftAnchor ? chessAfter.get(leftAnchor) : null;
      const pRight = rightAnchor ? chessAfter.get(rightAnchor) : null;
      const hasAnchorPawn =
        (pLeft && pLeft.type === 'p' && pLeft.color === enemyColor) ||
        (pRight && pRight.type === 'p' && pRight.color === enemyColor);

      if (hasAnchorPawn) {
        let adjacentPawnAdvancedPast = false;
        let canBeChallenged = false;

        for (let pr = 0; pr < 8; pr++) {
          const adjLeft = `${FILES[f - 1]}${RANKS[pr]}` as Square;
          const adjRight = `${FILES[f + 1]}${RANKS[pr]}` as Square;
          const pl = chessAfter.get(adjLeft);
          const prt = chessAfter.get(adjRight);
          if (pl && pl.type === 'p' && pl.color === moverColor) {
            if (moverColor === 'w' ? pr >= r : pr <= r) adjacentPawnAdvancedPast = true;
            else canBeChallenged = true;
          }
          if (prt && prt.type === 'p' && prt.color === moverColor) {
            if (moverColor === 'w' ? pr >= r : pr <= r) adjacentPawnAdvancedPast = true;
            else canBeChallenged = true;
          }
        }

        let wasContestable = false;
        for (let pr = 0; pr < 8; pr++) {
          const adjLeft = `${FILES[f - 1]}${RANKS[pr]}` as Square;
          const adjRight = `${FILES[f + 1]}${RANKS[pr]}` as Square;
          const pl = chessBefore.get(adjLeft);
          const prt = chessBefore.get(adjRight);
          if (pl && pl.type === 'p' && pl.color === moverColor) {
            if (moverColor === 'w' ? pr <= r : pr >= r) wasContestable = true;
          }
          if (prt && prt.type === 'p' && prt.color === moverColor) {
            if (moverColor === 'w' ? pr <= r : pr >= r) wasContestable = true;
          }
        }

        if ((wasContestable && adjacentPawnAdvancedPast) || !canBeChallenged) {
          outposts.push({
            square: sq,
            beneficiaryColor: enemyColor,
            anchorPawnSquare: (pLeft?.type === 'p' ? leftAnchor : rightAnchor) || undefined,
            motif: 'conceded_outpost',
            description: `Conceded permanent outpost to opponent on ${sq}.`,
          });
        }
      }
    }
  }

  return outposts;
}

const STARTING_SQUARES: Record<Color, Record<string, Square[]>> = {
  w: {
    r: ['a1', 'h1'],
    n: ['b1', 'g1'],
    b: ['c1', 'f1'],
    q: ['d1'],
  },
  b: {
    r: ['a8', 'h8'],
    n: ['b8', 'g8'],
    b: ['c8', 'f8'],
    q: ['d8'],
  },
};

function isUndevelopedPieceBehindPawns(
  chess: Chess,
  sq: Square,
  color: Color,
  pieceType: string
): boolean {
  const squares = STARTING_SQUARES[color]?.[pieceType];
  if (!squares || !squares.includes(sq)) {
    return false;
  }

  const fileCode = sq.charCodeAt(0);
  const pawnRank = color === 'w' ? '2' : '7';

  // Check if friendly pawns are on home rank on this or adjacent files
  for (let f = fileCode - 1; f <= fileCode + 1; f++) {
    if (f >= 97 && f <= 104) {
      const pawnSq = `${String.fromCharCode(f)}${pawnRank}` as Square;
      const pieceOnPawnSq = chess.get(pawnSq);
      if (pieceOnPawnSq && pieceOnPawnSq.type === 'p' && pieceOnPawnSq.color === color) {
        return true;
      }
    }
  }

  return false;
}

// -----------------------------------------------------------------------------
// 9. Trapped Pieces (Noah's Ark Trap)
// -----------------------------------------------------------------------------
export function detectTrappedPieces(
  chess: Chess,
  color: Color
): TrappedPiece[] {
  const trapped: TrappedPiece[] = [];

  let moves: Move[];
  if (chess.turn() === color) {
    moves = chess.moves({ verbose: true });
  } else {
    try {
      const tokens = chess.fen().split(' ');
      tokens[1] = color;
      tokens[3] = '-';
      const flippedChess = new Chess(tokens.join(' '));
      moves = flippedChess.moves({ verbose: true });
    } catch {
      moves = [];
    }
  }

  const control = calculateSquareControl(chess);
  const enemyColor: Color = color === 'w' ? 'b' : 'w';

  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (!p || p.color !== color || !['b', 'n', 'r', 'q'].includes(p.type)) continue;

    // Undeveloped starting pieces behind friendly pawns are never trapped
    if (isUndevelopedPieceBehindPawns(chess, sq, color, p.type)) continue;

    const pieceMoves = moves.filter((m) => m.from === sq);
    const safeMoves = pieceMoves.filter((m) => {
      const destIdx = squareToIndex(m.to);
      const enemyCount = enemyColor === 'w' ? control.white[destIdx] : control.black[destIdx];
      const friendlyCount = color === 'w' ? control.white[destIdx] : control.black[destIdx];

      if (enemyCount > friendlyCount) return false;
      if (enemyCount > 0 && ['b', 'n', 'r', 'q'].includes(p.type)) {
        const destPiece = chess.get(m.to as Square);
        if (!destPiece || PIECE_VALUES[destPiece.type] < PIECE_VALUES[p.type]) {
          return false;
        }
      }
      return true;
    });

    if (safeMoves.length === 0) {
      trapped.push({
        square: sq,
        piece: p.type,
        color,
        safeMobility: 0,
        motif: 'trapped_piece',
        description: `Trapped piece: ${p.type.toUpperCase()} on ${sq} has zero safe squares.`,
      });
    }
  }

  return trapped;
}

// -----------------------------------------------------------------------------
// Unified Aggregator
// -----------------------------------------------------------------------------
export function detectAllTacticalMotifs(
  chess: Chess,
  moverColor: Color,
  context?: { chessBefore?: Chess; lastMove?: { from: Square; to: Square; piece?: PieceSymbol } }
): TacticalMotifSummary {
  const forks = detectForks(chess, moverColor);
  const pins = detectPins(chess, moverColor);
  const skewers = detectSkewers(chess, moverColor);
  const discoveredAttacks = detectDiscoveredAttacks(chess, moverColor, context?.lastMove);
  const overworked = detectOverworkedDefenders(chess, moverColor);
  const hangingPieces = detectHangingPieces(chess, moverColor === 'w' ? 'b' : 'w');
  const trappedPieces = detectTrappedPieces(chess, moverColor === 'w' ? 'b' : 'w');

  const concededOutposts = context?.chessBefore
    ? detectConcededOutposts(context.chessBefore, chess, moverColor)
    : [];
  const lostSquareControl = context?.chessBefore
    ? detectLostSquareControl(context.chessBefore, chess, moverColor)
    : [];

  const motifSet = new Set<TacticalMotif>();
  forks.forEach((f) => {
    motifSet.add(f.motif);
    if (f.isRoyal) motifSet.add('royal_fork');
  });
  pins.forEach((p) => motifSet.add(p.motif));
  skewers.forEach((s) => motifSet.add(s.motif));
  discoveredAttacks.forEach((d) => motifSet.add(d.motif));
  overworked.forEach((o) => motifSet.add(o.motif));
  hangingPieces.forEach((h) => motifSet.add(h.motif));
  trappedPieces.forEach((t) => motifSet.add(t.motif));
  concededOutposts.forEach((c) => motifSet.add(c.motif));

  return {
    motifs: Array.from(motifSet),
    forks,
    pins,
    skewers,
    discoveredAttacks,
    overworked,
    hangingPieces,
    trappedPieces,
    concededOutposts,
    lostSquareControl,
  };
}
