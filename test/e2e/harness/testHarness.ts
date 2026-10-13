import { Chess, Square, PieceSymbol, Color, Move } from 'chess.js';
import {
  GameMode,
  MoveClassification,
  SquareControlMap,
  CandidateMoveEvaluation,
  DominoCausalStep,
  ScenarioTreeNode,
  GameStateDTO,
  GameActions,
  TacticalMotifType,
} from './types.js';

/**
 * Square coordinate mapping: file 0..7, rank 0..7 -> 0..63
 */
export function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1], 10) - 1;
  return rank * 8 + file;
}

export function indexToSquare(index: number): Square {
  const file = String.fromCharCode('a'.charCodeAt(0) + (index % 8));
  const rank = Math.floor(index / 8) + 1;
  return `${file}${rank}` as Square;
}

/**
 * Lichess Sigmoidal Win-Probability Formula
 * WP(cp) = 100 / (1 + exp(-0.00368208 * cp))
 */
export function centipawnsToWinProbability(cp: number): number {
  const k = 0.00368208;
  return 100 / (1 + Math.exp(-k * cp));
}

export function mateToWinProbability(mateInPlies: number): number {
  if (mateInPlies > 0) {
    return Math.max(99.0, 100.0 - mateInPlies * 0.1);
  } else if (mateInPlies < 0) {
    return Math.min(1.0, Math.abs(mateInPlies) * 0.1);
  }
  return 50.0;
}

/**
 * Move Classification Engine
 */
export function classifyMoveDelta(
  deltaWp: number,
  deltaCp: number,
  isSacrifice: boolean = false,
  cpAfter: number = 0,
  isWinningPrior: boolean = false
): MoveClassification {
  if (isSacrifice && cpAfter >= 150 && deltaCp <= 20) {
    return 'brilliant';
  }
  if (isWinningPrior && cpAfter <= 0) {
    return 'blunder';
  }
  if (deltaWp <= 0.5 || deltaCp <= 10) return 'best';
  if (deltaWp <= 2.0 || deltaCp <= 30) return 'great';
  if (deltaWp <= 5.0 || deltaCp <= 75) return 'good';
  if (deltaWp <= 10.0 || deltaCp <= 175) return 'inaccuracy';
  if (deltaWp <= 20.0 || deltaCp <= 300) return 'mistake';
  return 'blunder';
}

/**
 * Computes 64-square attack matrices for White and Black
 */
export function calculateSquareControl(chess: Chess): SquareControlMap {
  const white = new Array(64).fill(0);
  const black = new Array(64).fill(0);

  const board = chess.board();
  const squares: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const f = String.fromCharCode('a'.charCodeAt(0) + c);
      const rank = 8 - r;
      squares.push(`${f}${rank}` as Square);
    }
  }

  // Iterate all squares with pieces and calculate their attacked squares
  for (const sq of squares) {
    const piece = chess.get(sq);
    if (!piece) continue;

    const file = sq.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(sq[1], 10) - 1;
    const isWhite = piece.color === 'w';
    const targetArr = isWhite ? white : black;

    switch (piece.type) {
      case 'p': {
        const dir = isWhite ? 1 : -1;
        const nextRank = rank + dir;
        if (nextRank >= 0 && nextRank < 8) {
          if (file - 1 >= 0) targetArr[nextRank * 8 + (file - 1)]++;
          if (file + 1 < 8) targetArr[nextRank * 8 + (file + 1)]++;
        }
        break;
      }
      case 'n': {
        const offsets = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1],
        ];
        for (const [df, dr] of offsets) {
          const nf = file + df;
          const nr = rank + dr;
          if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
            targetArr[nr * 8 + nf]++;
          }
        }
        break;
      }
      case 'b':
      case 'r':
      case 'q': {
        const dirs: [number, number][] = [];
        if (piece.type === 'b' || piece.type === 'q') {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        if (piece.type === 'r' || piece.type === 'q') {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }
        for (const [df, dr] of dirs) {
          let nf = file + df;
          let nr = rank + dr;
          while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
            targetArr[nr * 8 + nf]++;
            const targetSq = `${String.fromCharCode('a'.charCodeAt(0) + nf)}${nr + 1}` as Square;
            if (chess.get(targetSq)) break; // ray terminates at first piece
            nf += df;
            nr += dr;
          }
        }
        break;
      }
      case 'k': {
        for (let df = -1; df <= 1; df++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (df === 0 && dr === 0) continue;
            const nf = file + df;
            const nr = rank + dr;
            if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
              targetArr[nr * 8 + nf]++;
            }
          }
        }
        break;
      }
    }
  }

  const differential = white.map((wVal, i) => wVal - black[i]);
  return { white, black, differential };
}

/**
 * Tactical Motif Detectors
 */
export interface DetectedPin {
  pinnedSquare: Square;
  pinnerSquare: Square;
  kingSquare: Square;
  pinType: 'absolute' | 'relative';
}

export function detectPins(chess: Chess, kingColor: Color): DetectedPin[] {
  const pins: DetectedPin[] = [];
  const enemyColor: Color = kingColor === 'w' ? 'b' : 'w';

  // Find King square
  let kingSq: Square | null = null;
  for (let r = 1; r <= 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = `${String.fromCharCode('a'.charCodeAt(0) + c)}${r}` as Square;
      const p = chess.get(sq);
      if (p && p.color === kingColor && p.type === 'k') {
        kingSq = sq;
        break;
      }
    }
    if (kingSq) break;
  }
  if (!kingSq) return pins;

  const kf = kingSq.charCodeAt(0) - 'a'.charCodeAt(0);
  const kr = parseInt(kingSq[1], 10) - 1;

  const rays: [number, number, PieceSymbol[]][] = [
    [-1, 0, ['r', 'q']], [1, 0, ['r', 'q']], [0, -1, ['r', 'q']], [0, 1, ['r', 'q']],
    [-1, -1, ['b', 'q']], [-1, 1, ['b', 'q']], [1, -1, ['b', 'q']], [1, 1, ['b', 'q']],
  ];

  for (const [df, dr, attackers] of rays) {
    let nf = kf + df;
    let nr = kr + dr;
    let potentialShield: Square | null = null;

    while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
      const sq = `${String.fromCharCode('a'.charCodeAt(0) + nf)}${nr + 1}` as Square;
      const piece = chess.get(sq);
      if (piece) {
        if (piece.color === kingColor) {
          if (!potentialShield) {
            potentialShield = sq;
          } else {
            // Second friendly piece breaks pin
            break;
          }
        } else if (piece.color === enemyColor) {
          if (potentialShield && attackers.includes(piece.type)) {
            pins.push({
              pinnedSquare: potentialShield,
              pinnerSquare: sq,
              kingSquare: kingSq,
              pinType: 'absolute',
            });
          }
          break;
        }
      }
      nf += df;
      nr += dr;
    }
  }

  return pins;
}

export function detectForks(chess: Chess, moverColor: Color): { forkSquare: Square; targets: Square[]; isRoyal: boolean }[] {
  const forks: { forkSquare: Square; targets: Square[]; isRoyal: boolean }[] = [];
  const enemyColor: Color = moverColor === 'w' ? 'b' : 'w';

  for (let r = 1; r <= 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = `${String.fromCharCode('a'.charCodeAt(0) + c)}${r}` as Square;
      const piece = chess.get(sq);
      if (piece && piece.color === moverColor && (piece.type === 'n' || piece.type === 'p')) {
        const file = c;
        const rank = r - 1;
        const targetSquares: Square[] = [];
        let targetsKing = false;
        let targetsQueen = false;

        const checkTarget = (tf: number, tr: number) => {
          if (tf >= 0 && tf < 8 && tr >= 0 && tr < 8) {
            const tSq = `${String.fromCharCode('a'.charCodeAt(0) + tf)}${tr + 1}` as Square;
            const targetPiece = chess.get(tSq);
            if (targetPiece && targetPiece.color === enemyColor) {
              if (targetPiece.type === 'k') targetsKing = true;
              if (targetPiece.type === 'q') targetsQueen = true;
              if (['k', 'q', 'r', 'b', 'n'].includes(targetPiece.type)) {
                targetSquares.push(tSq);
              }
            }
          }
        };

        if (piece.type === 'n') {
          const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1],
          ];
          for (const [df, dr] of offsets) checkTarget(file + df, rank + dr);
        } else if (piece.type === 'p') {
          const dir = moverColor === 'w' ? 1 : -1;
          checkTarget(file - 1, rank + dir);
          checkTarget(file + 1, rank + dir);
        }

        if (targetSquares.length >= 2) {
          forks.push({
            forkSquare: sq,
            targets: targetSquares,
            isRoyal: targetsKing && targetsQueen,
          });
        }
      }
    }
  }

  return forks;
}

export function detectSkewers(chess: Chess, attackerColor: Color): { attackerSquare: Square; targetFront: Square; targetBehind: Square }[] {
  const skewers: { attackerSquare: Square; targetFront: Square; targetBehind: Square }[] = [];
  const defenderColor: Color = attackerColor === 'w' ? 'b' : 'w';

  for (let r = 1; r <= 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = `${String.fromCharCode('a'.charCodeAt(0) + c)}${r}` as Square;
      const piece = chess.get(sq);
      if (piece && piece.color === attackerColor && ['r', 'b', 'q'].includes(piece.type)) {
        const file = c;
        const rank = r - 1;
        const dirs: [number, number][] = [];
        if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);

        for (const [df, dr] of dirs) {
          let nf = file + df;
          let nr = rank + dr;
          let frontTarget: { sq: Square; type: PieceSymbol } | null = null;

          while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
            const curSq = `${String.fromCharCode('a'.charCodeAt(0) + nf)}${nr + 1}` as Square;
            const targetPiece = chess.get(curSq);
            if (targetPiece) {
              if (targetPiece.color === defenderColor) {
                if (!frontTarget) {
                  if (['k', 'q'].includes(targetPiece.type)) {
                    frontTarget = { sq: curSq, type: targetPiece.type };
                  } else {
                    break;
                  }
                } else {
                  skewers.push({
                    attackerSquare: sq,
                    targetFront: frontTarget.sq,
                    targetBehind: curSq,
                  });
                  break;
                }
              } else {
                break;
              }
            }
            nf += df;
            nr += dr;
          }
        }
      }
    }
  }

  return skewers;
}

export function detectTrappedPieces(chess: Chess, color: Color): { square: Square; piece: PieceSymbol; safeMobility: number }[] {
  const trapped: { square: Square; piece: PieceSymbol; safeMobility: number }[] = [];
  const moves = chess.moves({ verbose: true });
  const control = calculateSquareControl(chess);
  const enemyColor: Color = color === 'w' ? 'b' : 'w';

  for (let r = 1; r <= 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = `${String.fromCharCode('a'.charCodeAt(0) + c)}${r}` as Square;
      const p = chess.get(sq);
      if (p && p.color === color && ['b', 'n', 'q', 'r'].includes(p.type)) {
        const pieceMoves = moves.filter((m: Move) => m.from === sq);
        // Count moves that do not land on heavily attacked squares
        const safeMoves = pieceMoves.filter((m: Move) => {
          const destIdx = squareToIndex(m.to);
          const enemyAttackers = enemyColor === 'b' ? control.black[destIdx] : control.white[destIdx];
          const friendlyAttackers = color === 'w' ? control.white[destIdx] : control.black[destIdx];
          // If destination is attacked by enemy and not properly defended or capture of defended pawn
          if (enemyAttackers > friendlyAttackers) return false;
          if (enemyAttackers > 0 && ['b', 'n', 'r', 'q'].includes(p.type)) {
            // Minor or major piece captured by enemy defenders
            return false;
          }
          return true;
        });

        if (safeMoves.length === 0) {
          trapped.push({ square: sq, piece: p.type, safeMobility: 0 });
        }
      }
    }
  }

  return trapped;
}

/**
 * Perft (Performance Test) Leaf Node Counter
 */
export function computePerft(chess: Chess, depth: number): number {
  if (depth === 0) return 1;
  const moves = chess.moves({ verbose: true });
  if (depth === 1) return moves.length;

  let nodes = 0;
  for (const move of moves) {
    chess.move(move);
    nodes += computePerft(chess, depth - 1);
    chess.undo();
  }
  return nodes;
}

/**
 * Grandmaster Coach Commentary Generator
 */
export function generateCoachAdvice(
  classification: MoveClassification,
  motifs: string[],
  san: string
): { beginner: string; intermediate: string; expert: string } {
  if (classification === 'blunder') {
    return {
      beginner: `Watch out! Playing ${san} loses material or exposes your King.`,
      intermediate: `Blunder: ${san} neglects key square control and triggers a decisive tactical penalty (${motifs.join(', ') || 'tactical flaw'}).`,
      expert: `Severe tactical oversight with ${san}. Concedes decisive dynamic compensation and tactical breakthrough.`,
    };
  }
  if (classification === 'inaccuracy') {
    return {
      beginner: `${san} is okay, but leaves your pieces slightly passive.`,
      intermediate: `Inaccuracy: ${san} surrenders slight initiative and concedes an outpost or square control.`,
      expert: `Suboptimal positional move (${san}). Allows opponent counterplay against pawn weaknesses.`,
    };
  }
  if (classification === 'brilliant') {
    return {
      beginner: `Incredible move! You sacrificed a piece to win the game!`,
      intermediate: `Brilliant sacrifice (${san})! Unlocks a crushing mating attack or overwhelming tactical combination.`,
      expert: `Brilliancy (${san}) with deep engine depth calculation: decisive long-term tactical conversion.`,
    };
  }
  return {
    beginner: `Strong move! ${san} develops your pieces safely.`,
    intermediate: `Optimal development with ${san}, controlling key central squares.`,
    expert: `Maintains dynamic balance with ${san}; preserves maximum tactical tension.`,
  };
}

/**
 * The Authoritative Chess Game Coordinator & Harness
 */
export class ChessGameCoordinator implements GameActions {
  private chess: Chess;
  private mode: GameMode = 'normal';
  private historySAN: string[] = [];
  private historyFENs: string[] = [];
  private selectedCandidate: string | null = null;
  private previewFEN: string | null = null;
  private isFlipped: boolean = false;
  private activePlyIndex: number = 0;

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess();
    this.historyFENs.push(this.chess.fen());
  }

  public getChess(): Chess {
    return this.chess;
  }

  public getActiveMode(): GameMode {
    return this.mode;
  }

  public isBoardFlipped(): boolean {
    return this.isFlipped;
  }

  public flipBoard(): void {
    this.isFlipped = !this.isFlipped;
  }

  public setGameMode(mode: GameMode): void {
    // Mode switching preserves game state (FEN, history, clocks, turn)
    this.mode = mode;
  }

  public selectCandidateMove(san: string | null): void {
    this.selectedCandidate = san;
  }

  public previewVariationPly(fen: string | null): void {
    this.previewFEN = fen;
  }

  public resetGame(startingFen?: string): void {
    this.chess = startingFen ? new Chess(startingFen) : new Chess();
    this.historySAN = [];
    this.historyFENs = [this.chess.fen()];
    this.activePlyIndex = 0;
    this.previewFEN = null;
    this.selectedCandidate = null;
  }

  public jumpToHistoryPly(plyIndex: number): void {
    if (plyIndex >= 0 && plyIndex < this.historyFENs.length) {
      this.activePlyIndex = plyIndex;
    }
  }

  public makeMove(from: string, to: string, promotion?: string): boolean {
    try {
      const move = this.chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion as PieceSymbol | undefined,
      });

      if (move) {
        this.historySAN.push(move.san);
        this.historyFENs.push(this.chess.fen());
        this.activePlyIndex = this.historySAN.length;
        this.previewFEN = null;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public getGameState(): GameStateDTO {
    const isLive = !this.previewFEN && this.activePlyIndex === this.historySAN.length;
    const tempChess = isLive ? this.chess : new Chess(this.previewFEN || this.historyFENs[this.activePlyIndex] || this.chess.fen());
    const fen = tempChess.fen();

    const isCheck = tempChess.inCheck();
    const isCheckmate = tempChess.isCheckmate();
    const isStalemate = tempChess.isStalemate();
    const isDraw = tempChess.isDraw();
    let drawReason: 'stalemate' | 'threefold' | '50-move' | 'insufficient' | undefined;

    if (isStalemate) drawReason = 'stalemate';
    else if (tempChess.isThreefoldRepetition()) drawReason = 'threefold';
    else if (tempChess.isInsufficientMaterial()) drawReason = 'insufficient';
    else if (tempChess.isDraw()) drawReason = '50-move';

    const squareControl = calculateSquareControl(tempChess);

    // Candidate moves generation
    const candidateMoves: CandidateMoveEvaluation[] = [];
    if (this.mode === 'smart' || this.mode === 'expert') {
      const legalMoves = tempChess.moves({ verbose: true });
      for (const m of legalMoves.slice(0, 5)) {
        tempChess.move(m);
        const nextControl = calculateSquareControl(tempChess);
        const evalScore = (nextControl.white.reduce((a, b) => a + b, 0) - nextControl.black.reduce((a, b) => a + b, 0)) * 10;
        const winProb = centipawnsToWinProbability(evalScore);
        tempChess.undo();

        candidateMoves.push({
          san: m.san,
          from: m.from,
          to: m.to,
          promotion: m.promotion,
          centipawns: evalScore,
          winProbability: winProb,
          deltaWinProbability: 1.2,
          classification: 'good',
          tacticalMotifs: [],
          pv: [m.san],
        });
      }
    }

    const advice = generateCoachAdvice('good', [], this.historySAN[this.historySAN.length - 1] || 'Start');

    // Domino causal chain
    let activeDominoChain: DominoCausalStep[] | undefined;
    if (this.mode === 'smart' || this.mode === 'expert') {
      activeDominoChain = [
        {
          ply: 1,
          moveSan: 'Nf3',
          player: 'white',
          stage: 'cause',
          description: 'White develops knight towards center.',
        },
        {
          ply: 2,
          moveSan: 'd5',
          player: 'black',
          stage: 'trigger',
          description: 'Black stakes claim to d5 square.',
        },
        {
          ply: 3,
          moveSan: 'c4',
          player: 'white',
          stage: 'crisis',
          description: 'White challenges the central pawn.',
        },
        {
          ply: 4,
          moveSan: 'dxc4',
          player: 'black',
          stage: 'consequence',
          description: 'Black captures, yielding open files.',
        },
      ];
    }

    // Scenario tree for Expert mode
    let activeScenarioTree: ScenarioTreeNode | undefined;
    if (this.mode === 'expert') {
      activeScenarioTree = {
        id: 'root',
        san: 'root',
        fen: tempChess.fen(),
        ply: 0,
        centipawns: 20,
        winProbability: 52.0,
        tacticalTags: ['Opening'],
        dominoExplanation: 'Initial branch evaluation.',
        children: candidateMoves.map((cm, idx) => ({
          id: `root-${cm.san}`,
          san: cm.san,
          fen: tempChess.fen(),
          ply: 1,
          centipawns: cm.centipawns,
          winProbability: cm.winProbability,
          tacticalTags: cm.tacticalMotifs,
          dominoExplanation: `Downstream projection for ${cm.san}`,
          children: [],
        })),
      };
    }

    return {
      fen,
      turn: tempChess.turn(),
      isCheck,
      isCheckmate,
      isDraw,
      drawReason,
      history: [...this.historySAN],
      activeMode: this.mode,
      candidateMoves,
      activeScenarioTree,
      activeDominoChain,
      squareControl,
      coachAdvice: advice,
    };
  }
}
