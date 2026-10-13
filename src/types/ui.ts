/**
 * src/types/ui.ts
 * UI Presentation state, actions, overlays, and coach advice DTOs.
 * Exactly adheres to PROJECT.md § Interface Contracts.
 */

import { GameMode, SquareControlMap } from './rules';
import { CandidateMoveEvaluation, DominoCausalStep, ScenarioTreeNode, MoveClassification } from './engine';
import { Square, PieceSymbol } from './chess';

export interface GameStateDTO {
  fen: string;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  drawReason?: 'stalemate' | 'threefold' | '50-move' | 'insufficient';
  history: string[]; // SAN moves
  activeMode: GameMode;
  candidateMoves: CandidateMoveEvaluation[];
  activeScenarioTree?: ScenarioTreeNode;
  activeDominoChain?: DominoCausalStep[];
  squareControl: SquareControlMap;
  coachAdvice: {
    beginner: string;
    intermediate: string;
    expert: string;
  };
}

export interface GameActions {
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  setGameMode: (mode: GameMode) => void;
  selectCandidateMove: (san: string | null) => void;
  previewVariationPly: (fen: string | null) => void;
  resetGame: () => void;
  flipBoard: () => void;
  jumpToHistoryPly: (plyIndex: number) => void;
}

export type BoardOrientation = 'white' | 'black';

export interface SvgArrow {
  id: string;
  from: Square;
  to: Square;
  color: string;
  opacity?: number;
  isKnight?: boolean;
  classification?: MoveClassification;
}

export interface ThreatIndicator {
  square: Square;
  type: 'check' | 'hanging' | 'pinned';
  intensity?: number;
}

export interface OverlayState {
  arrows: SvgArrow[];
  threats: ThreatIndicator[];
  showHeatmap: boolean;
}

export interface PromotionSelection {
  from: Square;
  to: Square;
  allowedPieces: PieceSymbol[];
}
