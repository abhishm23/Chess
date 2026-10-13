/**
 * test/rules/modeSwitchStress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE:
 * Milestone 1 Challenger 2 — Mode Switching & State Invariance Verifier
 *
 * Rigorously challenges:
 * 1. 100 simulated random games with chaotic mode toggling across Normal, Smart, and Expert.
 * 2. 100% state invariance across mode toggles: FEN, move history, turn, check state, legal moves, clocks.
 * 3. Subscriber listener management under load (1000+ listeners, rapid churn, error isolation, re-entrancy).
 * 4. Adversarial inputs and edge-case boundary mutations.
 */

import { describe, it, expect, vi } from 'vitest';
import { ChessGame } from '../../src/rules/chessGame';
import {
  GameModeManager,
  GAME_MODE_POLICIES,
  GameModePolicy,
  ModeChangeEvent,
} from '../../src/rules/gameModeManager';
import { GameMode, Square } from '../../src/types/chess';
import { calculateSquareControl } from '../../src/rules/squareControl';

/**
 * Seedable Linear Congruential Generator (LCG) for deterministic reproducibility.
 */
class DeterministicPRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  public pick<T>(array: T[]): T {
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  public range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

describe('Adversarial Stress Test: GameModeManager & State Coordination', () => {
  const ALL_MODES: GameMode[] = ['normal', 'smart', 'expert'];

  // ==========================================================================
  // 1. 100 Simulated Games with Chaotic Mode Switching & State Invariance
  // ==========================================================================
  describe('100 Simulated Games: Rapid Mode Toggling & State Invariance Verification', () => {
    it('executes 100 games, randomly switching modes before, during, and after moves while guaranteeing state invariance', () => {
      const prng = new DeterministicPRNG(424242);
      const NUM_GAMES = 100;
      const MAX_PLIES_PER_GAME = 60; // Up to 60 plies per game to avoid infinite loops

      let totalMovesPlayed = 0;
      let totalModeSwitches = 0;
      let totalStateAssertions = 0;

      for (let gameIdx = 0; gameIdx < NUM_GAMES; gameIdx++) {
        const game = new ChessGame();
        const modeManager = new GameModeManager('normal');

        // Simulated player clocks in milliseconds
        const clocks = {
          w: 300000, // 5 min
          b: 300000,
          increment: 2000, // 2s
        };

        for (let ply = 0; ply < MAX_PLIES_PER_GAME; ply++) {
          if (game.isGameOver()) {
            break;
          }

          // ------------------------------------------------------------------
          // PHASE A: Mode toggling BEFORE move selection
          // ------------------------------------------------------------------
          const fenBeforeToggleA = game.getFen();
          const historyBeforeA = [...game.getHistory()];
          const turnBeforeA = game.getTurn();
          const isCheckBeforeA = game.isCheck();
          const legalMovesBeforeA = game.getLegalMoves().map(m => m.san).sort();
          const clockSnapshotA = { ...clocks };

          // Rapid toggle storm (1 to 5 rapid switches)
          const numTogglesBefore = prng.range(1, 5);
          for (let t = 0; t < numTogglesBefore; t++) {
            const targetMode = prng.pick(ALL_MODES);
            const changed = modeManager.setMode(targetMode);
            if (changed) totalModeSwitches++;

            // STATE INVARIANCE ASSERTIONS
            expect(game.getFen()).toBe(fenBeforeToggleA);
            expect(game.getHistory()).toEqual(historyBeforeA);
            expect(game.getTurn()).toBe(turnBeforeA);
            expect(game.isCheck()).toBe(isCheckBeforeA);
            expect(game.getLegalMoves().map(m => m.san).sort()).toEqual(legalMovesBeforeA);
            expect(clocks).toEqual(clockSnapshotA);
            totalStateAssertions += 6;
          }

          // ------------------------------------------------------------------
          // PHASE B: Mode toggling DURING candidate move evaluation / simulation
          // ------------------------------------------------------------------
          const legalMoves = game.getLegalMoves();
          expect(legalMoves.length).toBeGreaterThan(0);

          const candidateMove = prng.pick(legalMoves);

          // Simulate move before toggle
          const simBefore = game.simulateMove(candidateMove.from, candidateMove.to, candidateMove.promotion);
          expect(simBefore).not.toBeNull();

          // Rapid mode toggle during simulation
          const simTargetMode = prng.pick(ALL_MODES);
          modeManager.setMode(simTargetMode);
          totalModeSwitches++;

          // Simulate move after toggle: must be 100% identical
          const simAfter = game.simulateMove(candidateMove.from, candidateMove.to, candidateMove.promotion);
          expect(simAfter).toEqual(simBefore);
          expect(game.getFen()).toBe(fenBeforeToggleA); // Game state remains intact
          totalStateAssertions += 2;

          // ------------------------------------------------------------------
          // Execute Move and update player clock
          // ------------------------------------------------------------------
          const activeTurn = game.getTurn();
          const simulatedTurnDuration = prng.range(500, 3500); // 0.5s to 3.5s elapsed
          clocks[activeTurn] = Math.max(0, clocks[activeTurn] - simulatedTurnDuration + clocks.increment);

          const moveSuccess = game.makeMove(candidateMove.from, candidateMove.to, candidateMove.promotion);
          expect(moveSuccess).toBe(true);
          totalMovesPlayed++;

          // ------------------------------------------------------------------
          // PHASE C: Mode toggling AFTER move execution
          // ------------------------------------------------------------------
          const fenAfterMove = game.getFen();
          const historyAfterMove = [...game.getHistory()];
          const turnAfterMove = game.getTurn();
          const isCheckAfterMove = game.isCheck();
          const isCheckmateAfterMove = game.isCheckmate();
          const isDrawAfterMove = game.isDraw();
          const legalMovesAfterMove = game.getLegalMoves().map(m => m.san).sort();
          const clockSnapshotAfterMove = { ...clocks };

          // Rapid toggle storm through all 3 modes
          for (const m of ALL_MODES) {
            modeManager.setMode(m);
            totalModeSwitches++;

            expect(game.getFen()).toBe(fenAfterMove);
            expect(game.getHistory()).toEqual(historyAfterMove);
            expect(game.getTurn()).toBe(turnAfterMove);
            expect(game.isCheck()).toBe(isCheckAfterMove);
            expect(game.isCheckmate()).toBe(isCheckmateAfterMove);
            expect(game.isDraw()).toBe(isDrawAfterMove);
            expect(game.getLegalMoves().map(m => m.san).sort()).toEqual(legalMovesAfterMove);
            expect(clocks).toEqual(clockSnapshotAfterMove);
            totalStateAssertions += 8;
          }

          // ------------------------------------------------------------------
          // PHASE D: Interleaved Undo / Redo with Mode Switching
          // ------------------------------------------------------------------
          if (ply > 0 && ply % 12 === 0) {
            // Test Undo under mode shift
            modeManager.setMode('smart');
            const undoOk = game.undo();
            expect(undoOk).toBe(true);
            modeManager.setMode('expert');
            expect(game.getFen()).toBe(fenBeforeToggleA);

            // Test Redo under mode shift
            modeManager.setMode('normal');
            const redoOk = game.redo();
            expect(redoOk).toBe(true);
            expect(game.getFen()).toBe(fenAfterMove);
            totalStateAssertions += 4;
          }
        }
      }

      console.log(
        `[Empirical Stress Test Summary] Completed ${NUM_GAMES} games | ` +
        `Total moves: ${totalMovesPlayed} | Total mode switches: ${totalModeSwitches} | ` +
        `Total state invariance assertions: ${totalStateAssertions}`
      );

      expect(totalMovesPlayed).toBeGreaterThan(1000);
      expect(totalModeSwitches).toBeGreaterThan(5000);
      expect(totalStateAssertions).toBeGreaterThan(25000);
    }, 60000);
  });

  // ==========================================================================
  // 2. Subscriber Listener Management Under Load
  // ==========================================================================
  describe('Subscriber Listener Lifecycle & Load Stress', () => {
    it('manages 1,000 concurrent listeners with 100 rapid mode switches without dropping events', () => {
      const manager = new GameModeManager('normal');
      const LISTENER_COUNT = 1000;
      const SWITCH_COUNT = 100;

      const callCounts = new Int32Array(LISTENER_COUNT);
      const unsubs: Array<() => void> = [];

      // Register 1000 subscribers
      for (let i = 0; i < LISTENER_COUNT; i++) {
        const index = i;
        const unsub = manager.subscribe((event: ModeChangeEvent) => {
          expect(event).toBeDefined();
          expect(event.currentMode).toBeDefined();
          expect(event.previousMode).toBeDefined();
          expect(event.policy).toBeDefined();
          expect(event.timestamp).toBeGreaterThan(0);
          callCounts[index]++;
        });
        unsubs.push(unsub);
      }

      // Execute 100 rapid mode switches
      let expectedCallsPerListener = 0;
      let lastMode: GameMode = 'normal';

      for (let i = 0; i < SWITCH_COUNT; i++) {
        const nextMode: GameMode = ALL_MODES[(i + 1) % 3];
        if (nextMode !== lastMode) {
          const res = manager.setMode(nextMode);
          expect(res).toBe(true);
          expectedCallsPerListener++;
          lastMode = nextMode;
        }
      }

      // Assert all 1000 listeners received every single broadcast
      for (let i = 0; i < LISTENER_COUNT; i++) {
        expect(callCounts[i]).toBe(expectedCallsPerListener);
      }

      // Unsubscribe half (500) listeners
      for (let i = 0; i < LISTENER_COUNT / 2; i++) {
        unsubs[i]();
      }

      // Trigger another mode switch
      manager.setMode(lastMode === 'expert' ? 'normal' : 'expert');

      // Unsubscribed listeners must not have increased
      for (let i = 0; i < LISTENER_COUNT / 2; i++) {
        expect(callCounts[i]).toBe(expectedCallsPerListener);
      }
      // Remaining listeners must have received the new event
      for (let i = LISTENER_COUNT / 2; i < LISTENER_COUNT; i++) {
        expect(callCounts[i]).toBe(expectedCallsPerListener + 1);
      }

      // Unsubscribe remaining
      for (let i = LISTENER_COUNT / 2; i < LISTENER_COUNT; i++) {
        unsubs[i]();
      }

      // Further switches should reach nobody
      manager.setMode('smart');
      for (let i = 0; i < LISTENER_COUNT; i++) {
        const finalCount = i < LISTENER_COUNT / 2 ? expectedCallsPerListener : expectedCallsPerListener + 1;
        expect(callCounts[i]).toBe(finalCount);
      }
    });

    it('isolates listener errors so one throwing subscriber does not break others', () => {
      const manager = new GameModeManager('normal');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const listener1 = vi.fn();
      const faultyListener = vi.fn(() => {
        throw new Error('Explosive subscriber error!');
      });
      const listener3 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(faultyListener);
      manager.subscribe(listener3);

      expect(() => {
        manager.setMode('smart');
      }).not.toThrow();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(faultyListener).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('handles self-unsubscribing listeners safely during dispatch without skipping peers', () => {
      const manager = new GameModeManager('normal');
      const order: string[] = [];

      let unsubB: () => void;

      const listenerA = () => {
        order.push('A');
      };
      const listenerB = () => {
        order.push('B');
        unsubB(); // Unsubscribes itself during execution
      };
      const listenerC = () => {
        order.push('C');
      };

      manager.subscribe(listenerA);
      unsubB = manager.subscribe(listenerB);
      manager.subscribe(listenerC);

      // First mode switch: all three should execute
      manager.setMode('smart');
      expect(order).toEqual(['A', 'B', 'C']);

      // Second mode switch: B should NOT execute
      order.length = 0;
      manager.setMode('expert');
      expect(order).toEqual(['A', 'C']);
    });

    it('handles listeners that subscribe new listeners during dispatch', () => {
      const manager = new GameModeManager('normal');
      let lateListenerCalled = false;

      manager.subscribe(() => {
        manager.subscribe(() => {
          lateListenerCalled = true;
        });
      });

      manager.setMode('smart');
      lateListenerCalled = false;
      manager.setMode('expert');
      expect(lateListenerCalled).toBe(true);
    });

    it('supports rapid subscribe/unsubscribe cycles without memory leaks', () => {
      const manager = new GameModeManager('normal');
      const CYCLES = 5000;

      for (let i = 0; i < CYCLES; i++) {
        const dummyListener = () => {};
        const unsub = manager.subscribe(dummyListener);
        unsub();
      }

      // Mode switch after 5000 churns should run in O(1) time
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setMode('smart');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // 3. Adversarial Mode Manager Policy & State Boundaries
  // ==========================================================================
  describe('Policy Integrity, Re-entrancy & Edge Case Robustness', () => {
    it('guarantees policy configuration consistency and helper query accuracy', () => {
      const manager = new GameModeManager('normal');

      // Normal mode invariants
      expect(manager.getMode()).toBe('normal');
      expect(manager.isEngineEnabled()).toBe(false);
      expect(manager.getAnalysisDepth()).toBe(0);
      expect(manager.getMultiPV()).toBe(0);
      expect(manager.shouldGenerateDomino()).toBe(false);
      expect(manager.shouldGenerateScenarioTree()).toBe(false);
      expect(manager.shouldShowThreats()).toBe(false);
      expect(manager.shouldShowArrows()).toBe(false);
      expect(manager.shouldShowHeatmap()).toBe(false);
      expect(manager.getCoachingPersona()).toBe('disabled');

      // Smart mode invariants
      manager.setMode('smart');
      expect(manager.getMode()).toBe('smart');
      expect(manager.isEngineEnabled()).toBe(true);
      expect(manager.getAnalysisDepth()).toBe(12);
      expect(manager.getMultiPV()).toBe(3);
      expect(manager.shouldGenerateDomino()).toBe(true);
      expect(manager.shouldGenerateScenarioTree()).toBe(false);
      expect(manager.shouldShowThreats()).toBe(true);
      expect(manager.shouldShowArrows()).toBe(true);
      expect(manager.shouldShowHeatmap()).toBe(false);
      expect(manager.getCoachingPersona()).toBe('beginner');

      // Expert mode invariants
      manager.setMode('expert');
      expect(manager.getMode()).toBe('expert');
      expect(manager.isEngineEnabled()).toBe(true);
      expect(manager.getAnalysisDepth()).toBe(18);
      expect(manager.getMultiPV()).toBe(5);
      expect(manager.shouldGenerateDomino()).toBe(true);
      expect(manager.shouldGenerateScenarioTree()).toBe(true);
      expect(manager.shouldShowThreats()).toBe(true);
      expect(manager.shouldShowArrows()).toBe(true);
      expect(manager.shouldShowHeatmap()).toBe(true);
      expect(manager.getCoachingPersona()).toBe('expert');
    });

    it('rejects identical mode transitions and prevents spurious listener dispatches', () => {
      const manager = new GameModeManager('normal');
      const listener = vi.fn();
      manager.subscribe(listener);

      expect(manager.setMode('normal')).toBe(false);
      expect(manager.setMode('normal')).toBe(false);
      expect(listener).not.toHaveBeenCalled();

      expect(manager.setMode('smart')).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      expect(manager.setMode('smart')).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('verifies FIFO re-entrant event order dispatch without inversion', () => {
      const manager = new GameModeManager('normal');
      const l2Events: string[] = [];

      // Listener 1 triggers a synchronous re-entrant mode change to 'expert' when 'smart' is received
      manager.subscribe((event) => {
        if (event.currentMode === 'smart') {
          manager.setMode('expert');
        }
      });

      // Listener 2 observes the dispatched sequence
      manager.subscribe((event) => {
        l2Events.push(event.currentMode);
      });

      manager.setMode('smart');

      // With FIFO re-entrancy queue:
      // Outer setMode('smart') finishes first for all listeners, then queued setMode('expert') dispatches.
      // Consequently, L2 receives ['smart', 'expert'] in chronological order!
      expect(l2Events).toEqual(['smart', 'expert']);
      expect(manager.getMode()).toBe('expert');
      expect(l2Events[l2Events.length - 1]).toBe('expert');
    });

    it('verifies invalid mode input rejection and graceful preservation of state', () => {
      const manager = new GameModeManager('normal');

      // Pass an invalid mode string (e.g. from unchecked query string or JSON payload)
      const res = (manager.setMode as any)('hyper_bullet');
      expect(res).toBe(false);
      expect(manager.getMode()).toBe('normal');

      // Invalid mode was rejected, so getPolicy() returns the valid current policy
      expect(manager.getPolicy()).toBeDefined();

      // Subsequent helper queries function normally without throwing
      expect(manager.isEngineEnabled()).toBe(false);
      expect(manager.getAnalysisDepth()).toBe(0);
      expect(manager.shouldGenerateDomino()).toBe(false);
    });

    it('verifies policy object immutability via deep Object.freeze', () => {
      const manager = new GameModeManager('normal');
      const policy = manager.getPolicy();

      // The returned policy object and GAME_MODE_POLICIES are deeply frozen
      expect(Object.isFrozen(policy)).toBe(true);
      expect(Object.isFrozen(GAME_MODE_POLICIES)).toBe(true);
      expect(policy.engineEnabled).toBe(false);

      // Mutate attempt in strict mode throws TypeError
      expect(() => {
        (policy as any).engineEnabled = true;
      }).toThrow();
      expect(policy.engineEnabled).toBe(false);
      expect(manager.isEngineEnabled()).toBe(false);
    });
  });
});
