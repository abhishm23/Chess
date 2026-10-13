/**
 * src/rules/squareControl.ts
 * High-performance 64-square control matrices, attack differentials, and pin detection.
 */

import { Chess } from 'chess.js';
import { Color, PieceSymbol, Square, BoardSquare } from '../types/chess';
import {
  SquareControlMap,
  DetailedSquareControl,
  SquareAttacker,
  PinnedPiece,
} from '../types/rules';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export const SQUARES: Square[] = [];
for (let r = 0; r < 8; r++) {
  for (let f = 0; f < 8; f++) {
    SQUARES.push(`${FILES[f]}${RANKS[r]}` as Square);
  }
}

export function squareToIndex(square: string): number {
  const f = square.charCodeAt(0) - 97; // 'a' -> 0
  const r = square.charCodeAt(1) - 49; // '1' -> 0
  return r * 8 + f;
}

export function indexToSquare(index: number): Square {
  if (index < 0 || index >= 64) {
    throw new Error(`Invalid square index: ${index}`);
  }
  return SQUARES[index];
}

export function fileAndRankToSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

export function squareToFileAndRank(square: string): { file: number; rank: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return { file, rank };
}

interface PieceOnBoard {
  square: Square;
  file: number;
  rank: number;
  type: PieceSymbol;
  color: Color;
}

function extractPieces(
  source: string | Chess | (BoardSquare | null)[][]
): PieceOnBoard[] {
  const pieces: PieceOnBoard[] = [];

  if (typeof source === 'string') {
    const chess = new Chess(source);
    const rawBoard = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = rawBoard[r][f];
        if (cell) {
          const rank = 7 - r; // chess.board() row 0 is rank 8
          const file = f;
          const square = `${FILES[file]}${RANKS[rank]}` as Square;
          pieces.push({
            square,
            file,
            rank,
            type: cell.type as PieceSymbol,
            color: cell.color as Color,
          });
        }
      }
    }
  } else if (source && typeof source === 'object' && 'board' in source && typeof source.board === 'function') {
    const rawBoard = source.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = rawBoard[r][f];
        if (cell) {
          const rank = 7 - r;
          const file = f;
          const square = `${FILES[file]}${RANKS[rank]}` as Square;
          pieces.push({
            square,
            file,
            rank,
            type: cell.type as PieceSymbol,
            color: cell.color as Color,
          });
        }
      }
    }
  } else if (Array.isArray(source)) {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = source[r][f];
        if (cell) {
          const { file, rank } = squareToFileAndRank(cell.square);
          pieces.push({
            square: cell.square,
            file,
            rank,
            type: cell.type,
            color: cell.color,
          });
        }
      }
    }
  }

  return pieces;
}

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

/**
 * Computes the 64-length SquareControlMap (white, black, differential)
 */
export function calculateSquareControl(
  source: string | Chess | (BoardSquare | null)[][]
): SquareControlMap {
  const white = new Array(64).fill(0);
  const black = new Array(64).fill(0);
  const differential = new Array(64).fill(0);

  const pieces = extractPieces(source);
  const occupied = new Set<string>(pieces.map((p) => p.square));

  for (const piece of pieces) {
    const isWhite = piece.color === 'w';
    const targetArr = isWhite ? white : black;
    const { file, rank, type } = piece;

    if (type === 'p') {
      const forward = isWhite ? 1 : -1;
      const targetRank = rank + forward;
      if (targetRank >= 0 && targetRank <= 7) {
        if (file - 1 >= 0) {
          targetArr[targetRank * 8 + (file - 1)]++;
        }
        if (file + 1 <= 7) {
          targetArr[targetRank * 8 + (file + 1)]++;
        }
      }
    } else if (type === 'n') {
      for (const [df, dr] of KNIGHT_OFFSETS) {
        const tf = file + df;
        const tr = rank + dr;
        if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          targetArr[tr * 8 + tf]++;
        }
      }
    } else if (type === 'k') {
      for (const [df, dr] of KING_OFFSETS) {
        const tf = file + df;
        const tr = rank + dr;
        if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          targetArr[tr * 8 + tf]++;
        }
      }
    } else {
      // Sliding pieces: B, R, Q
      const directions: number[][] = [];
      if (type === 'b' || type === 'q') directions.push(...BISHOP_DIRECTIONS);
      if (type === 'r' || type === 'q') directions.push(...ROOK_DIRECTIONS);

      for (const [df, dr] of directions) {
        let tf = file + df;
        let tr = rank + dr;
        while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          const sqIdx = tr * 8 + tf;
          targetArr[sqIdx]++;
          const sqStr = `${FILES[tf]}${RANKS[tr]}`;
          if (occupied.has(sqStr)) {
            // Ray terminates upon encountering first occupied square
            break;
          }
          tf += df;
          tr += dr;
        }
      }
    }
  }

  for (let i = 0; i < 64; i++) {
    differential[i] = white[i] - black[i];
  }

  return { white, black, differential };
}

/**
 * Computes detailed attacker lists and square statuses for rich tooltips and tactical motifs.
 */
export function calculateDetailedSquareControl(
  source: string | Chess | (BoardSquare | null)[][]
): DetailedSquareControl[] {
  const pieces = extractPieces(source);
  const occupied = new Set<string>(pieces.map((p) => p.square));

  const whiteAttackers: SquareAttacker[][] = Array.from({ length: 64 }, () => []);
  const blackAttackers: SquareAttacker[][] = Array.from({ length: 64 }, () => []);

  for (const piece of pieces) {
    const isWhite = piece.color === 'w';
    const targetBucket = isWhite ? whiteAttackers : blackAttackers;
    const attackerInfo: SquareAttacker = {
      piece: piece.type,
      square: piece.square,
      color: piece.color,
    };
    const { file, rank, type } = piece;

    if (type === 'p') {
      const forward = isWhite ? 1 : -1;
      const tr = rank + forward;
      if (tr >= 0 && tr <= 7) {
        if (file - 1 >= 0) targetBucket[tr * 8 + (file - 1)].push(attackerInfo);
        if (file + 1 <= 7) targetBucket[tr * 8 + (file + 1)].push(attackerInfo);
      }
    } else if (type === 'n') {
      for (const [df, dr] of KNIGHT_OFFSETS) {
        const tf = file + df;
        const tr = rank + dr;
        if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          targetBucket[tr * 8 + tf].push(attackerInfo);
        }
      }
    } else if (type === 'k') {
      for (const [df, dr] of KING_OFFSETS) {
        const tf = file + df;
        const tr = rank + dr;
        if (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          targetBucket[tr * 8 + tf].push(attackerInfo);
        }
      }
    } else {
      const directions: number[][] = [];
      if (type === 'b' || type === 'q') directions.push(...BISHOP_DIRECTIONS);
      if (type === 'r' || type === 'q') directions.push(...ROOK_DIRECTIONS);

      for (const [df, dr] of directions) {
        let tf = file + df;
        let tr = rank + dr;
        while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
          const sqIdx = tr * 8 + tf;
          targetBucket[sqIdx].push(attackerInfo);
          const sqStr = `${FILES[tf]}${RANKS[tr]}`;
          if (occupied.has(sqStr)) break;
          tf += df;
          tr += dr;
        }
      }
    }
  }

  return SQUARES.map((square, index) => {
    const w = whiteAttackers[index];
    const b = blackAttackers[index];
    const diff = w.length - b.length;

    let status: 'firmly_white' | 'contested' | 'firmly_black' | 'neutral' = 'neutral';
    if (w.length > 0 && b.length === 0) status = 'firmly_white';
    else if (b.length > 0 && w.length === 0) status = 'firmly_black';
    else if (w.length > 0 && b.length > 0) status = 'contested';

    return {
      square,
      index,
      whiteAttackers: w,
      blackAttackers: b,
      whiteCount: w.length,
      blackCount: b.length,
      differential: diff,
      status,
    };
  });
}

/**
 * Finds all pinned pieces (absolute pins against friendly King)
 */
export function findPinnedPieces(
  source: string | Chess | (BoardSquare | null)[][],
  targetColor: Color = 'w'
): PinnedPiece[] {
  const pieces = extractPieces(source);
  const kingPiece = pieces.find(
    (p) => p.type === 'k' && p.color === targetColor
  );

  if (!kingPiece) return [];

  const pieceMap = new Map<string, PieceOnBoard>();
  for (const p of pieces) {
    pieceMap.set(p.square, p);
  }

  const pinnedPieces: PinnedPiece[] = [];

  const checkRays = (
    directions: number[][],
    validAttackerTypes: PieceSymbol[]
  ) => {
    for (const [df, dr] of directions) {
      let tf = kingPiece.file + df;
      let tr = kingPiece.rank + dr;
      let friendlyShield: PieceOnBoard | null = null;
      const raySquares: Square[] = [];

      while (tf >= 0 && tf <= 7 && tr >= 0 && tr <= 7) {
        const currentSq = `${FILES[tf]}${RANKS[tr]}` as Square;
        const currentPiece = pieceMap.get(currentSq);

        if (currentPiece) {
          if (currentPiece.color === targetColor) {
            if (!friendlyShield) {
              friendlyShield = currentPiece;
            } else {
              // Second friendly piece breaks the pin ray
              break;
            }
          } else {
            // Enemy piece encountered
            if (
              friendlyShield &&
              validAttackerTypes.includes(currentPiece.type)
            ) {
              pinnedPieces.push({
                pinnedSquare: friendlyShield.square,
                pinnerSquare: currentPiece.square,
                targetSquare: kingPiece.square,
                pinType: 'absolute',
                ray: raySquares,
              });
            }
            break;
          }
        } else {
          raySquares.push(currentSq);
        }

        tf += df;
        tr += dr;
      }
    }
  };

  // Check orthogonal rays for Queen and Rook
  checkRays(ROOK_DIRECTIONS, ['r', 'q']);
  // Check diagonal rays for Queen and Bishop
  checkRays(BISHOP_DIRECTIONS, ['b', 'q']);

  return pinnedPieces;
}
