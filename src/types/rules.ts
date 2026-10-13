/**
 * src/types/rules.ts
 * Rules engine contracts, multi-tier game mode definitions, and square control interfaces.
 */

import { Color, PieceSymbol, Square, MoveDTO, HistoryMove, DrawReason, BoardSquare, Piece } from './chess';

export type GameMode = 'normal' | 'smart' | 'expert';

/**
 * 64-length arrays representing square control per PROJECT.md § Interface Contracts.
 * Indexed 0 to 63: a1 = 0, b1 = 1, ..., h1 = 7, a2 = 8, ..., h8 = 63.
 */
export interface SquareControlMap {
  white: number[]; // 64-length array of White attacker counts
  black: number[]; // 64-length array of Black attacker counts
  differential: number[]; // White attacker count minus Black attacker count
}

export interface SquareAttacker {
  piece: PieceSymbol;
  square: Square;
  color: Color;
}

export interface DetailedSquareControl {
  square: Square;
  index: number;
  whiteAttackers: SquareAttacker[];
  blackAttackers: SquareAttacker[];
  whiteCount: number;
  blackCount: number;
  differential: number;
  status: 'firmly_white' | 'contested' | 'firmly_black' | 'neutral';
}

export interface PinnedPiece {
  pinnedSquare: Square;
  pinnerSquare: Square;
  targetSquare: Square; // Square of King (for absolute) or high-value piece (for relative)
  pinType: 'absolute' | 'relative';
  ray: Square[]; // In-between squares along line of pin
}

export interface MoveExecutionResult {
  success: boolean;
  san?: string;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  drawReason?: DrawReason;
  fen: string;
  error?: string;
}

export interface SimulatedMoveResult {
  valid: boolean;
  san: string;
  fen: string;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  turn: Color;
}

export interface ModePolicy {
  mode: GameMode;
  engineDepth: number;
  multiPV: number;
  enableDominoCausalSimulation: boolean;
  enableScenarioTree: boolean;
  enableOverlays: boolean;
  enableSquareControlHeatmap: boolean;
  coachDetailLevel: 'none' | 'beginner' | 'master';
}

export interface IChessGame {
  getFen(): string;
  getTurn(): Color;
  getBoard(): (BoardSquare | null)[][];
  getPiece(square: Square): Piece | null;
  getLegalMoves(square?: Square): MoveDTO[];
  isLegalMove(from: Square, to: Square, promotion?: PieceSymbol): boolean;
  makeMove(from: Square, to: Square, promotion?: PieceSymbol): boolean;
  makeMoveVerbose(from: Square, to: Square, promotion?: PieceSymbol): MoveExecutionResult;
  makeMoveSan(san: string): boolean;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  getHistory(): HistoryMove[];
  getHistorySan(): string[];
  isCheck(): boolean;
  isCheckmate(): boolean;
  isStalemate(): boolean;
  isDraw(): boolean;
  isThreefoldRepetition(): boolean;
  isInsufficientMaterial(): boolean;
  getDrawReason(): DrawReason | undefined;
  isGameOver(): boolean;
  getWinner(): Color | 'draw' | null;
  loadFen(fen: string): boolean;
  exportFen(): string;
  loadPgn(pgn: string): boolean;
  exportPgn(): string;
  reset(startingFen?: string): void;
  simulateMove(from: Square, to: Square, promotion?: PieceSymbol): SimulatedMoveResult | null;
}
