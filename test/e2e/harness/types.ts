// Authoritative Interface Contracts from PROJECT.md § Interface Contracts
export type GameMode = 'normal' | 'smart' | 'expert';
export type MoveClassification = 'brilliant' | 'best' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export type TacticalMotifType =
  | 'fork'
  | 'royal_fork'
  | 'absolute_pin'
  | 'relative_pin'
  | 'skewer'
  | 'discovered_attack'
  | 'discovered_check'
  | 'double_check'
  | 'trapped_piece'
  | 'hanging_piece'
  | 'deflection'
  | 'overworked_piece'
  | 'conceded_outpost'
  | 'back_rank_weakness';

export interface SquareControlMap {
  white: number[]; // 64-length array of attacker counts
  black: number[]; // 64-length array of attacker counts
  differential: number[]; // white - black
}

export interface CandidateMoveEvaluation {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  centipawns: number;
  winProbability: number;
  deltaWinProbability: number;
  classification: MoveClassification;
  tacticalMotifs: string[]; // e.g. 'fork', 'pin', 'hanging_piece', 'conceded_outpost'
  pv: string[]; // principal variation line
}

export interface DominoCausalStep {
  ply: number;
  moveSan: string;
  player: 'white' | 'black';
  stage: 'cause' | 'trigger' | 'crisis' | 'consequence';
  description: string;
  tacticalTag?: string;
  squareChanges?: string[];
}

export interface ScenarioTreeNode {
  id: string;
  san: string;
  fen: string;
  ply: number;
  centipawns: number;
  winProbability: number;
  tacticalTags: string[];
  dominoExplanation: string;
  children: ScenarioTreeNode[];
}

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
