/**
 * src/rules/gameModeManager.ts
 * Coordinates gameplay policies across Normal, Smart, and Expert modes.
 * Hardened with FIFO re-entrancy dispatch queue, strict input validation,
 * and deep policy freezing.
 */

import { GameMode } from '../types/chess';

export interface GameModePolicy {
  readonly mode: GameMode;
  readonly name: string;
  readonly description: string;
  readonly engineEnabled: boolean;
  readonly analysisDepth: number;
  readonly multiPV: number;
  readonly generateDominoChain: boolean;
  readonly maxDominoPlies: number;
  readonly generateScenarioTree: boolean;
  readonly maxScenarioTreeDepth: number;
  readonly showThreatHighlights: boolean;
  readonly showCandidateArrows: boolean;
  readonly showSquareControlHeatmap: boolean;
  readonly coachingPersona: 'disabled' | 'beginner' | 'intermediate' | 'expert';
  readonly movePreviewAllowed: boolean;
  readonly autoPromoteToQueenDefault: boolean;
}

export const VALID_GAME_MODES: ReadonlySet<GameMode> = new Set<GameMode>([
  'normal',
  'smart',
  'expert',
]);

export function isValidGameMode(mode: unknown): mode is GameMode {
  return typeof mode === 'string' && VALID_GAME_MODES.has(mode as GameMode);
}

export const GAME_MODE_POLICIES: Readonly<Record<GameMode, Readonly<GameModePolicy>>> = Object.freeze({
  normal: Object.freeze({
    mode: 'normal',
    name: 'Normal Mode',
    description: 'Standard competitive play without real-time engine evaluation or coaching overlays.',
    engineEnabled: false,
    analysisDepth: 0,
    multiPV: 0,
    generateDominoChain: false,
    maxDominoPlies: 0,
    generateScenarioTree: false,
    maxScenarioTreeDepth: 0,
    showThreatHighlights: false,
    showCandidateArrows: false,
    showSquareControlHeatmap: false,
    coachingPersona: 'disabled',
    movePreviewAllowed: false,
    autoPromoteToQueenDefault: true,
  }),
  smart: Object.freeze({
    mode: 'smart',
    name: 'Smart Mode',
    description: 'Guided coaching mode for beginners and intermediate players with threat highlights and domino consequence projections.',
    engineEnabled: true,
    analysisDepth: 12,
    multiPV: 3,
    generateDominoChain: true,
    maxDominoPlies: 3,
    generateScenarioTree: false,
    maxScenarioTreeDepth: 2,
    showThreatHighlights: true,
    showCandidateArrows: true,
    showSquareControlHeatmap: false,
    coachingPersona: 'beginner',
    movePreviewAllowed: true,
    autoPromoteToQueenDefault: false,
  }),
  expert: Object.freeze({
    mode: 'expert',
    name: 'Expert Mode',
    description: 'Grandmaster-level analysis with multi-ply scenario trees, deep threat calculation, and evaluation heatmaps.',
    engineEnabled: true,
    analysisDepth: 18,
    multiPV: 5,
    generateDominoChain: true,
    maxDominoPlies: 5,
    generateScenarioTree: true,
    maxScenarioTreeDepth: 4,
    showThreatHighlights: true,
    showCandidateArrows: true,
    showSquareControlHeatmap: true,
    coachingPersona: 'expert',
    movePreviewAllowed: true,
    autoPromoteToQueenDefault: false,
  }),
});

export interface ModeChangeEvent {
  readonly previousMode: GameMode;
  readonly currentMode: GameMode;
  readonly policy: GameModePolicy;
  readonly timestamp: number;
}

export type ModeChangeListener = (event: ModeChangeEvent) => void;

export class GameModeManager {
  private activeMode: GameMode;
  private readonly listeners: Set<ModeChangeListener> = new Set();
  private isDispatching = false;
  private readonly dispatchQueue: ModeChangeEvent[] = [];

  constructor(initialMode: GameMode = 'normal') {
    this.activeMode = isValidGameMode(initialMode) ? initialMode : 'normal';
  }

  public getMode(): GameMode {
    return this.activeMode;
  }

  public getPolicy(): GameModePolicy {
    return GAME_MODE_POLICIES[this.activeMode];
  }

  public static getPolicyFor(mode: GameMode): GameModePolicy {
    return GAME_MODE_POLICIES[isValidGameMode(mode) ? mode : 'normal'];
  }

  /**
   * Switches the active game mode mid-game.
   * Validates target mode, prevents duplicate transitions, and queues events
   * to guarantee FIFO dispatch during re-entrant calls.
   */
  public setMode(newMode: GameMode): boolean {
    if (!isValidGameMode(newMode)) {
      console.warn(`[GameModeManager] Rejected invalid game mode: "${String(newMode)}"`);
      return false;
    }

    if (this.activeMode === newMode) {
      return false;
    }

    const previousMode = this.activeMode;
    this.activeMode = newMode;
    const policy = this.getPolicy();

    const event: ModeChangeEvent = {
      previousMode,
      currentMode: newMode,
      policy,
      timestamp: Date.now(),
    };

    this.dispatchQueue.push(event);

    // Drain queue in FIFO sequence if not already dispatching
    if (!this.isDispatching) {
      this.isDispatching = true;
      try {
        while (this.dispatchQueue.length > 0) {
          const nextEvent = this.dispatchQueue.shift()!;
          this.broadcastEvent(nextEvent);
        }
      } finally {
        this.isDispatching = false;
      }
    }

    return true;
  }

  public subscribe(listener: ModeChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcastEvent(event: ModeChangeEvent): void {
    // Snapshot current listeners to allow safe mid-dispatch unsubscribe
    const listenerSnapshot = Array.from(this.listeners);
    for (const listener of listenerSnapshot) {
      if (!this.listeners.has(listener)) continue;
      try {
        listener(event);
      } catch (err) {
        console.error('Error in GameModeManager listener:', err);
      }
    }
  }

  // Ergonomic helper query methods for UI and Engine dispatchers
  public isEngineEnabled(): boolean {
    return this.getPolicy().engineEnabled;
  }

  public getAnalysisDepth(): number {
    return this.getPolicy().analysisDepth;
  }

  public getMultiPV(): number {
    return this.getPolicy().multiPV;
  }

  public shouldGenerateDomino(): boolean {
    return this.getPolicy().generateDominoChain;
  }

  public shouldGenerateScenarioTree(): boolean {
    return this.getPolicy().generateScenarioTree;
  }

  public shouldShowThreats(): boolean {
    return this.getPolicy().showThreatHighlights;
  }

  public shouldShowArrows(): boolean {
    return this.getPolicy().showCandidateArrows;
  }

  public shouldShowHeatmap(): boolean {
    return this.getPolicy().showSquareControlHeatmap;
  }

  public getCoachingPersona(): 'disabled' | 'beginner' | 'intermediate' | 'expert' {
    return this.getPolicy().coachingPersona;
  }
}
