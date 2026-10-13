/**
 * src/engine/fallbackMinimax.ts
 * Pure TypeScript Alpha-Beta Minimax Engine with PeSTO Piece-Square Tables,
 * Tapered Game Phase Evaluation, Quiescence Search, and MultiPV line extraction.
 */

import { Chess, Square, Move } from 'chess.js';
import {
  IChessEngine,
  EngineAnalysisResult,
  SearchOptions,
  MultiPVLine,
  EngineScore,
} from '../types/engine';

/**
 * A move is "forcing" when it gives check or delivers mate.
 * Forcing moves must never be pruned or under-ordered: skipping them makes the
 * engine blind to forced mates and cheap tactical wins.
 */
function isForcingSan(san: string): boolean {
  return san.includes('+') || san.includes('#');
}

// ============================================================================
// PeSTO Piece-Square Tables (by Ronald Friederich)
// ============================================================================
const PESTO_MG_VALUE = { p: 82, n: 337, b: 365, r: 477, q: 1025, k: 0 };
const PESTO_EG_VALUE = { p: 94, n: 281, b: 297, r: 512, q: 936, k: 0 };

// Tables from White's perspective (a1 = index 56 in 8x8 row-major, or rank-ordered)
const MG_PAWN_TABLE = [
    0,   0,   0,   0,   0,   0,   0,   0,
   98, 134,  61,  95,  68, 126,  34, -11,
   -6,   7,  26,  31,  65,  56,  25, -20,
  -14,  13,   6,  21,  23,  12,  17, -23,
  -27,  -2,  -5,  12,  17,   6,  10, -25,
  -26,  -4,  -4, -10,   3,   3,  33, -12,
  -35,  -1, -20, -23, -15,  24,  38, -22,
    0,   0,   0,   0,   0,   0,   0,   0,
];

const EG_PAWN_TABLE = [
    0,   0,   0,   0,   0,   0,   0,   0,
  178, 173, 158, 134, 147, 132, 165, 187,
   94, 100,  85,  67,  56,  53,  82,  84,
   32,  24,  13,   5,  -2,   4,  17,  17,
   13,   9,  -3,  -7,  -7,  -8,   3,  -1,
    4,   7,  -6,   1,   0,  -5,  -1,  -8,
   13,   8,   8,  10,  13,   0,   2,  -7,
    0,   0,   0,   0,   0,   0,   0,   0,
];

const MG_KNIGHT_TABLE = [
  -167, -89, -34, -49,  61, -97, -15, -107,
   -73, -41,  72,  36,  23,  62,   7,  -17,
   -47,  60,  37,  65,  84, 129,  73,   44,
    -9,  17,  19,  53,  37,  69,  18,   22,
   -13,   4,  16,  13,  28,  19,  21,   -8,
   -23,  -9,  12,  10,  19,  17,  25,  -16,
   -29, -53, -12,  -3,  -1,  18, -14,  -19,
  -105, -21, -58, -33, -17, -28, -19,  -23,
];

const EG_KNIGHT_TABLE = [
  -58, -38, -13, -28, -31, -27, -63, -99,
  -25,  -8, -25,  -2,  -9, -25, -24, -52,
  -24, -20,  10,   9,  -1,  -9, -19, -41,
  -17,   3,  22,  22,  22,  11,   8, -18,
  -18,  -6,  16,  25,  16,  17,   4, -18,
  -23,  -3,  -1,  15,  10,  -3, -20, -22,
  -42, -20, -10,  -5,  -2, -20, -23, -44,
  -29, -51, -23, -15, -22, -18, -50, -64,
];

const MG_BISHOP_TABLE = [
  -29,   4, -82, -37, -25, -42,   7,  -8,
  -26,  16, -18, -13,  30,  59,  18, -47,
  -16,  37,  43,  40,  35,  50,  37,  -2,
   -4,   5,  19,  50,  37,  37,   7,  -2,
   -6,  13,  13,  26,  34,  12,  10,   4,
    0,  15,  15,  15,  14,  27,  18,  10,
    4,  15,  16,   0,   7,  21,  33,   1,
  -33,  -3, -14, -21, -13, -12, -39, -21,
];

const EG_BISHOP_TABLE = [
  -14, -21, -11,  -8,  -7,  -9, -17, -24,
   -8,  -4,   7, -12,  -3, -13,  -4, -14,
    2,  -8,   0,  -1,  -2,   6,   0,   4,
   -3,   9,  12,   9,  14,  10,   3,   2,
   -6,   3,  13,  19,   7,  10,  -3,  -9,
  -12,  -3,   8,  10,  13,   3,  -7, -15,
  -14, -18,  -7,  -1,   4,  -9, -15, -27,
  -23,  -9, -23,  -5,  -9, -16,  -5, -17,
];

const MG_ROOK_TABLE = [
   32,  42,  32,  51,  63,   9,  31,  43,
   27,  32,  58,  62,  80,  67,  26,  44,
   -5,  19,  26,  36,  17,  45,  61,  16,
  -24, -11,   7,  26,  24,  35,  -8, -20,
  -36, -26, -12,  -1,   9,  -7,   6, -23,
  -45, -25, -16, -17,   3,   0,  -5, -33,
  -44, -16, -20,  -9,  -1,  11,  -6, -71,
  -19, -13,   1,  17,  16,   7, -37, -26,
];

const EG_ROOK_TABLE = [
  13,  10,  18,  15,  12,  12,   8,   5,
  11,  13,  13,  11,  -3,   3,   8,   3,
   7,   7,   7,   5,   4,  -3,  -5,  -3,
   4,   3,  13,   1,   2,   1,  -1,   2,
   3,   5,   8,   4,  -5,  -6,  -8, -11,
  -4,   0,  -5,  -1,  -7, -12,  -8, -16,
  -6,  -6,   0,   2,  -9,  -9, -11,  -3,
  -9,   2,   3,  -1,  -5, -13,   4, -20,
];

const MG_QUEEN_TABLE = [
  -28,   0,  29,  12,  59,  44,  43,  45,
  -24, -39,  -5,   1, -16,  57,  28,  54,
  -13, -17,   7,   8,  29,  56,  47,  57,
  -27, -27, -16, -16,  -1,  17,  -2,   1,
   -9, -26,  -9, -10,  -2,  -4,   3,  -3,
  -14,   2, -11,  -2,  -5,   2,  14,   5,
  -35,  -8,  11,   2,   8,  15,  -3,   1,
   -1, -18,  -9,  10, -15, -25, -48, -18,
];

const EG_QUEEN_TABLE = [
   -9,  22,  22,  27,  27,  19,  10,  20,
  -17,  20,  32,  41,  58,  25,  30,   0,
  -20,   6,   9,  49,  47,  35,  19,   9,
    3,  22,  24,  45,  57,  40,  57,  36,
  -18,  28,  19,  47,  31,  34,  39,  18,
  -16, -27,  15,   6,   9,  17,  10,   5,
  -22, -23, -30, -16, -16, -23, -36, -32,
  -33, -28, -22, -43,  -5, -32, -20, -41,
];

const MG_KING_TABLE = [
  -65,  23,  16, -15, -56, -34,   2,  13,
   29,  -1, -20,  -7,  -8,  -4, -38, -29,
   -9,  24,   2, -16, -20,   6,  22, -22,
  -17, -20, -12, -27, -30, -25, -14, -36,
  -49,  -1, -27, -39, -46, -44, -33, -51,
  -14, -14, -22, -46, -44, -30, -15, -27,
    1,   7,  -8, -64, -43, -16,   9,   8,
  -15,  36,  12, -54,   8, -28,  24,  14,
];

const EG_KING_TABLE = [
  -74, -35, -18, -18, -11,  15,   4, -17,
  -12,  17,  14,  17,  17,  38,  23,  11,
   10,  17,  23,  15,  20,  45,  44,  13,
   -8,  22,  24,  27,  26,  33,  26,   3,
  -18,  -4,  21,  24,  27,  23,   9, -11,
  -19,  -3,  11,  21,  23,  16,   7,  -9,
  -27, -11,   4,  13,  14,   4,  -5, -17,
  -53, -34, -21, -11, -28, -14, -24, -43,
];

export class FallbackMinimaxEngine implements IChessEngine {
  public readonly engineType = 'fallback_minimax' as const;

  private isStopped = false;
  private isReadyFlag = true;
  private pvTable: string[][] = [];

  public async init(): Promise<void> {
    this.isReadyFlag = true;
    return Promise.resolve();
  }

  public isReady(): boolean {
    return this.isReadyFlag;
  }

  public stop(): void {
    this.isStopped = true;
  }

  public terminate(): void {
    this.isStopped = true;
  }

  public async evaluate(fen: string, options?: SearchOptions): Promise<EngineAnalysisResult> {
    this.isStopped = false;
    const startTime = performance.now();
    const chess = new Chess(fen);

    const targetDepth = options?.depth || 3;
    const multiPVCount = options?.multiPV || 3;

    // Terminal position checks
    if (chess.isGameOver()) {
      let score: EngineScore = { type: 'cp', value: 0 };
      if (chess.isCheckmate()) {
        score = { type: 'mate', value: 0 };
      }
      return {
        jobId: 0,
        fen,
        depth: targetDepth,
        lines: [
          {
            multipv: 1,
            depth: targetDepth,
            score,
            pv: [],
          },
        ],
        bestMove: '',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const legalMoves = chess.moves({ verbose: true });
    this.orderMoves(legalMoves);

    interface CandidateLine {
      move: Move;
      score: number;
      pv: string[];
    }

    const evaluatedLines: CandidateLine[] = [];
    this.pvTable = Array.from({ length: 32 }, () => []);

    let alpha = -Infinity;
    const beta = Infinity;

    // Root Search loop across candidate moves with alpha-beta narrowing and PVS
    let moveIdx = 0;
    for (const move of legalMoves) {
      if (this.isStopped || options?.signal?.aborted) break;

      // Late move pruning at root for quiet moves beyond top candidates
      const maxRootQuiet = targetDepth <= 3 ? Math.max(multiPVCount, 4) : 8;
      if (moveIdx >= maxRootQuiet && !move.captured && !isForcingSan(move.san)) {
        continue;
      }

      const uci = move.from + move.to + (move.promotion || '');
      chess.move(move);
      this.pvTable[1] = [];

      let moveScore: number;
      if (moveIdx < multiPVCount || alpha === -Infinity) {
        moveScore = -this.alphaBeta(chess, targetDepth - 1, -beta, -alpha, 1, isForcingSan(move.san));
      } else {
        // Null-window search for moves beyond multiPV window
        moveScore = -this.alphaBeta(chess, targetDepth - 1, -alpha - 1, -alpha, 1, isForcingSan(move.san));
        if (moveScore > alpha && moveScore < beta) {
          this.pvTable[1] = [];
          moveScore = -this.alphaBeta(chess, targetDepth - 1, -beta, -alpha, 1, isForcingSan(move.san));
        }
      }
      moveIdx++;
      chess.undo();

      const pv = [uci, ...(this.pvTable[1] || [])];
      evaluatedLines.push({
        move,
        score: moveScore,
        pv,
      });

      alpha = Math.max(alpha, moveScore);
    }

    // Sort moves descending by score (from side-to-move perspective)
    evaluatedLines.sort((a, b) => b.score - a.score);

    const topLines = evaluatedLines.slice(0, Math.min(multiPVCount, evaluatedLines.length));
    const lines: MultiPVLine[] = topLines.map((line, idx) => ({
      multipv: idx + 1,
      depth: targetDepth,
      score: { type: 'cp', value: line.score },
      pv: line.pv,
    }));

    const bestMove = topLines[0]
      ? topLines[0].move.from + topLines[0].move.to + (topLines[0].move.promotion || '')
      : '';

    return {
      jobId: 0,
      fen,
      depth: targetDepth,
      lines,
      bestMove,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  private alphaBeta(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    gaveCheck = false
  ): number {
    if (this.isStopped) return 0;
    this.pvTable[ply] = [];

    if (depth <= 0) {
      // Terminal detection at the search horizon: only positions entered through a
      // checking move can be mate, so this stays O(1) for ordinary leaves.
      if (gaveCheck && chess.isCheckmate()) return -30000 + ply * 100;

      const standPat = this.evaluateStaticPosition(chess);
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
      if (standPat + 900 < alpha) return alpha;
      return this.quiescence(chess, alpha, beta, 1, standPat);
    }

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) return -30000 + ply * 100;
      if (chess.isDraw()) return 0;
    }

    const sans = this.orderSanMoves(chess.moves());

    let moveCount = 0;
    for (const san of sans) {
      if (depth <= 1 && moveCount >= 4 && !san.includes('x') && !isForcingSan(san)) {
        continue;
      }
      if (depth === 2 && moveCount >= 4 && !san.includes('x') && !isForcingSan(san)) {
        continue;
      }
      const move = chess.move(san);
      if (!move) continue;
      const uci = move.from + move.to + (move.promotion || '');
      this.pvTable[ply + 1] = [];

      let score: number;
      if (moveCount === 0 || depth <= 1) {
        score = -this.alphaBeta(chess, depth - 1, -beta, -alpha, ply + 1, isForcingSan(san));
      } else {
        score = -this.alphaBeta(chess, depth - 1, -alpha - 1, -alpha, ply + 1, isForcingSan(san));
        if (score > alpha && score < beta) {
          this.pvTable[ply + 1] = [];
          score = -this.alphaBeta(chess, depth - 1, -beta, -alpha, ply + 1, isForcingSan(san));
        }
      }
      moveCount++;
      chess.undo();

      if (score >= beta) return beta;
      if (score > alpha) {
        alpha = score;
        this.pvTable[ply] = [uci, ...(this.pvTable[ply + 1] || [])];
      }
    }

    return alpha;
  }

  private getSanWeight(san: string): number {
    let w = 0;
    if (san.includes('x')) w += 1000;
    if (san.includes('#')) w += 5000;
    else if (san.includes('+')) w += 500;
    const len = san.length;
    if (len === 2) {
      const c = san.charCodeAt(0);
      const r = san.charCodeAt(1);
      if ((c === 101 || c === 100) && (r === 52 || r === 53)) w += 400; // e4, d4, e5, d5
      else if ((c === 99 || c === 102) && (r === 52 || r === 53)) w += 200; // c4, f4, c5, f5
      else w += 50;
    } else if (san.charCodeAt(0) === 78) { // 'N'
      if (san === 'Nf3' || san === 'Nc3' || san === 'Nf6' || san === 'Nc6') w += 300;
      else w += 100;
    } else if (san.charCodeAt(0) === 79) { // 'O'
      w += 250;
    } else if (san.charCodeAt(0) === 66) { // 'B'
      w += 150;
    }
    return w;
  }

  private orderSanMoves(sans: string[]): string[] {
    const len = sans.length;
    if (len <= 1) return sans;
    const weights = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      weights[i] = this.getSanWeight(sans[i]);
    }
    for (let i = 1; i < len; i++) {
      const curSan = sans[i];
      const curWeight = weights[i];
      let j = i - 1;
      while (j >= 0 && weights[j] < curWeight) {
        sans[j + 1] = sans[j];
        weights[j + 1] = weights[j];
        j--;
      }
      sans[j + 1] = curSan;
      weights[j + 1] = curWeight;
    }
    return sans;
  }

  private quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    qDepth: number,
    cachedStandPat?: number
  ): number {
    const standPat = cachedStandPat !== undefined ? cachedStandPat : this.evaluateStaticPosition(chess);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (qDepth <= 0) return standPat;

    // Delta pruning: if even capturing a Queen (+ margin) cannot beat alpha, prune
    const DELTA_MARGIN = 200;
    if (standPat + 900 + DELTA_MARGIN < alpha) return alpha;

    // Fast zero-allocation capture scan
    const sanMoves = chess.moves();
    let hasCapture = false;
    for (let i = 0; i < sanMoves.length; i++) {
      if (sanMoves[i].includes('x')) {
        hasCapture = true;
        break;
      }
    }
    if (!hasCapture) return standPat;

    const captureSans: string[] = [];
    for (let i = 0; i < sanMoves.length; i++) {
      if (sanMoves[i].includes('x')) captureSans.push(sanMoves[i]);
    }

    // Sort captures by victim weight (Q > R > B/N > P)
    captureSans.sort((a, b) => {
      const getVictimWeight = (san: string) => {
        const xIdx = san.indexOf('x');
        if (xIdx !== -1 && xIdx + 1 < san.length) {
          const char = san[xIdx + 1];
          if (char >= 'a' && char <= 'h') return 1; // pawn
        }
        return 3; // major/minor piece
      };
      return getVictimWeight(b) - getVictimWeight(a);
    });

    const searchCaptures = captureSans.length > 4 ? captureSans.slice(0, 4) : captureSans;
    for (const san of searchCaptures) {
      chess.move(san);
      const score = -this.quiescence(chess, -beta, -alpha, qDepth - 1);
      chess.undo();

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  private orderMoves(moves: Move[]): void {
    const PIECE_WEIGHTS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
    moves.sort((a, b) => {
      // 1. MVV-LVA for captures
      const aCap = a.captured ? (PIECE_WEIGHTS[a.captured] || 1) * 10 - (PIECE_WEIGHTS[a.piece] || 1) : -100;
      const bCap = b.captured ? (PIECE_WEIGHTS[b.captured] || 1) * 10 - (PIECE_WEIGHTS[b.piece] || 1) : -100;
      if (aCap !== bCap) return bCap - aCap;

      // 2. Promotions
      if (a.promotion && !b.promotion) return -1;
      if (!a.promotion && b.promotion) return 1;

      // 3. Checks and mates (mates ordered ahead of every other quiet move)
      const aCheck = a.san.includes('#') ? 100 : a.san.includes('+') ? 50 : 0;
      const bCheck = b.san.includes('#') ? 100 : b.san.includes('+') ? 50 : 0;
      if (aCheck !== bCheck) return bCheck - aCheck;

      // 4. Center / development bonus for quiet moves
      const aBonus = this.quietMoveBonus(a);
      const bBonus = this.quietMoveBonus(b);
      return bBonus - aBonus;
    });
  }

  private quietMoveBonus(m: Move): number {
    let score = 0;
    const to = m.to;
    if (to === 'e4' || to === 'd4' || to === 'e5' || to === 'd5') score += 40;
    else if (to === 'c4' || to === 'f4' || to === 'c5' || to === 'f5') score += 20;
    if (m.piece === 'n') {
      if (to === 'f3' || to === 'c3' || to === 'f6' || to === 'c6') score += 30;
      else score += 10;
    } else if (m.piece === 'b') {
      score += 15;
    }
    if (m.san === 'O-O' || m.san === 'O-O-O') score += 25;
    return score;
  }

  private evaluateStaticPosition(chess: Chess): number {
    let mgWhite = 0;
    let egWhite = 0;
    let mgBlack = 0;
    let egBlack = 0;
    let gamePhase = 0;

    const b = (chess as any)._board;
    if (b) {
      for (let r = 0; r < 8; r++) {
        const rowOffset = r << 4;
        const sqRowOffset = r << 3;
        const mirRowOffset = (7 - r) << 3;
        for (let c = 0; c < 8; c++) {
          const piece = b[rowOffset | c];
          if (!piece) continue;

          const sqIndex = sqRowOffset | c;
          const mirroredIndex = mirRowOffset | c;

          const type = piece.type as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
          const isWhite = piece.color === 'w';

          if (type === 'n' || type === 'b') gamePhase += 1;
          else if (type === 'r') gamePhase += 2;
          else if (type === 'q') gamePhase += 4;

          let mgPst = 0;
          let egPst = 0;
          const targetIndex = isWhite ? sqIndex : mirroredIndex;

          switch (type) {
            case 'p':
              mgPst = MG_PAWN_TABLE[targetIndex];
              egPst = EG_PAWN_TABLE[targetIndex];
              break;
            case 'n':
              mgPst = MG_KNIGHT_TABLE[targetIndex];
              egPst = EG_KNIGHT_TABLE[targetIndex];
              break;
            case 'b':
              mgPst = MG_BISHOP_TABLE[targetIndex];
              egPst = EG_BISHOP_TABLE[targetIndex];
              break;
            case 'r':
              mgPst = MG_ROOK_TABLE[targetIndex];
              egPst = EG_ROOK_TABLE[targetIndex];
              break;
            case 'q':
              mgPst = MG_QUEEN_TABLE[targetIndex];
              egPst = EG_QUEEN_TABLE[targetIndex];
              break;
            case 'k':
              mgPst = MG_KING_TABLE[targetIndex];
              egPst = EG_KING_TABLE[targetIndex];
              break;
          }

          const mgTotal = PESTO_MG_VALUE[type] + mgPst;
          const egTotal = PESTO_EG_VALUE[type] + egPst;

          if (isWhite) {
            mgWhite += mgTotal;
            egWhite += egTotal;
          } else {
            mgBlack += mgTotal;
            egBlack += egTotal;
          }
        }
      }
    } else {
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (!piece) continue;

          const sqIndex = r * 8 + c;
          const mirroredIndex = (7 - r) * 8 + c;

          const type = piece.type as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
          const isWhite = piece.color === 'w';

          if (type === 'n' || type === 'b') gamePhase += 1;
          else if (type === 'r') gamePhase += 2;
          else if (type === 'q') gamePhase += 4;

          let mgPst = 0;
          let egPst = 0;
          const targetIndex = isWhite ? sqIndex : mirroredIndex;

          switch (type) {
            case 'p':
              mgPst = MG_PAWN_TABLE[targetIndex];
              egPst = EG_PAWN_TABLE[targetIndex];
              break;
            case 'n':
              mgPst = MG_KNIGHT_TABLE[targetIndex];
              egPst = EG_KNIGHT_TABLE[targetIndex];
              break;
            case 'b':
              mgPst = MG_BISHOP_TABLE[targetIndex];
              egPst = EG_BISHOP_TABLE[targetIndex];
              break;
            case 'r':
              mgPst = MG_ROOK_TABLE[targetIndex];
              egPst = EG_ROOK_TABLE[targetIndex];
              break;
            case 'q':
              mgPst = MG_QUEEN_TABLE[targetIndex];
              egPst = EG_QUEEN_TABLE[targetIndex];
              break;
            case 'k':
              mgPst = MG_KING_TABLE[targetIndex];
              egPst = EG_KING_TABLE[targetIndex];
              break;
          }

          const mgTotal = PESTO_MG_VALUE[type] + mgPst;
          const egTotal = PESTO_EG_VALUE[type] + egPst;

          if (isWhite) {
            mgWhite += mgTotal;
            egWhite += egTotal;
          } else {
            mgBlack += mgTotal;
            egBlack += egTotal;
          }
        }
      }
    }

    const mgScore = mgWhite - mgBlack;
    const egScore = egWhite - egBlack;

    // Tapered evaluation interpolation
    const phase = Math.min(24, Math.max(0, gamePhase));
    const evalFromWhite = Math.round((mgScore * phase + egScore * (24 - phase)) / 24);

    // Return relative to side to move
    return chess.turn() === 'w' ? evalFromWhite : -evalFromWhite;
  }
}
