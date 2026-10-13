/**
 * src/types/engine.ts
 * Stockfish UCI contracts, candidate move evaluation, domino causal models, and scenario trees.
 * Exactly adheres to PROJECT.md § Interface Contracts.
 */

export type MoveClassification =
  | 'brilliant'
  | 'best'
  | 'great'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export type TacticalMotif =
  | 'fork'
  | 'royal_fork'
  | 'pin'
  | 'absolute_pin'
  | 'relative_pin'
  | 'skewer'
  | 'discovered_attack'
  | 'discovered_check'
  | 'double_check'
  | 'hanging_piece'
  | 'trapped_piece'
  | 'conceded_outpost'
  | 'deflection'
  | 'overloaded_piece'
  | 'back_rank_weakness';

export type TacticalMotifType = TacticalMotif;

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

export interface EngineScore {
  type: 'cp' | 'mate';
  value: number; // centipawns or moves to mate
}

export interface MultiPVLine {
  multipv: number;
  depth: number;
  score: EngineScore;
  pv: string[]; // UCI format e.g. ["e2e4", "c7c5"]
  sanPv?: string[]; // SAN format e.g. ["e4", "c5"]
  nodes?: number;
  nps?: number;
}

export interface EngineAnalysisResult {
  jobId: number;
  fen: string;
  depth: number;
  lines: MultiPVLine[];
  bestMove: string;
  durationMs: number;
}

export interface SearchOptions {
  depth?: number;
  movetimeMs?: number;
  multiPV?: number;
  signal?: AbortSignal;
}

export interface IChessEngine {
  readonly engineType: 'stockfish_wasm' | 'fallback_minimax';
  init(): Promise<void>;
  evaluate(fen: string, options?: SearchOptions): Promise<EngineAnalysisResult>;
  stop(): void;
  terminate(): void;
  isReady(): boolean;
}
