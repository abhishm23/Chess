/**
 * src/types/chess.ts
 * Core chess primitives, board coordinates, piece representations, and move DTOs.
 */

export type Color = 'w' | 'b';

export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type FileChar = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type RankChar = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export type Square =
  | 'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'f1' | 'g1' | 'h1'
  | 'a2' | 'b2' | 'c2' | 'd2' | 'e2' | 'f2' | 'g2' | 'h2'
  | 'a3' | 'b3' | 'c3' | 'd3' | 'e3' | 'f3' | 'g3' | 'h3'
  | 'a4' | 'b4' | 'c4' | 'd4' | 'e4' | 'f4' | 'g4' | 'h4'
  | 'a5' | 'b5' | 'c5' | 'd5' | 'e5' | 'f5' | 'g5' | 'h5'
  | 'a6' | 'b6' | 'c6' | 'd6' | 'e6' | 'f6' | 'g6' | 'h6'
  | 'a7' | 'b7' | 'c7' | 'd7' | 'e7' | 'f7' | 'g7' | 'h7'
  | 'a8' | 'b8' | 'c8' | 'd8' | 'e8' | 'f8' | 'g8' | 'h8';

export interface Piece {
  type: PieceSymbol;
  color: Color;
}

export interface BoardSquare {
  square: Square;
  type: PieceSymbol;
  color: Color;
}

export type Board = (BoardSquare | null)[][];

export interface MoveDTO {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  san: string;
  piece: PieceSymbol;
  color: Color;
  captured?: PieceSymbol;
  flags: string;
}

export interface HistoryMove extends MoveDTO {
  fenBefore: string;
  fenAfter: string;
  ply: number;
}

export type DrawReason = 'stalemate' | 'threefold' | '50-move' | 'insufficient';

export interface GameStatus {
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason?: DrawReason;
  isGameOver: boolean;
  winner: Color | 'draw' | null;
}

export type GameMode = 'normal' | 'smart' | 'expert';
