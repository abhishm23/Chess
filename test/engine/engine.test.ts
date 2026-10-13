/**
 * test/engine/engine.test.ts
 * Benchmark test suite for win probability mapping, move classification,
 * coach commentary persona generation, fallback minimax, and stockfish failover.
 */

import { describe, it, expect } from 'vitest';
import {
  centipawnsToWinProbability,
  mateToWinProbability,
  classifyMove,
  classifyMoveDelta,
} from '../../src/engine/winProbability';
import { generateCoachAdvice } from '../../src/engine/coachCommentary';
import { FallbackMinimaxEngine } from '../../src/engine/fallbackMinimax';
import { StockfishClient } from '../../src/engine/stockfishClient';
import { GameModeManager, GAME_MODE_POLICIES } from '../../src/rules/gameModeManager';

describe('Engine Subsystem Benchmark Suite', () => {
  describe('Lichess Sigmoidal Win Probability Formula', () => {
    it('maps 0 centipawns to dead equal 50.0%', () => {
      expect(centipawnsToWinProbability(0)).toBeCloseTo(50.0, 1);
    });

    it('maps +100 cp to moderate advantage (~59.1%)', () => {
      expect(centipawnsToWinProbability(100)).toBeCloseTo(59.1, 1);
    });

    it('maps +300 cp (minor piece) to decisive edge (~75.1%)', () => {
      expect(centipawnsToWinProbability(300)).toBeCloseTo(75.1, 1);
    });

    it('maps -300 cp to low drawing chances (~24.9%)', () => {
      expect(centipawnsToWinProbability(-300)).toBeCloseTo(24.9, 1);
    });

    it('maps +1000 cp (queen up) to overwhelming win (~97.5%)', () => {
      expect(centipawnsToWinProbability(1000)).toBeCloseTo(97.5, 1);
    });

    it('maps -1000 cp to decisive loss (~2.5%)', () => {
      expect(centipawnsToWinProbability(-1000)).toBeCloseTo(2.5, 1);
    });

    it('maps forced mate scores accurately', () => {
      expect(mateToWinProbability(1)).toBeCloseTo(99.9, 1);
      expect(mateToWinProbability(5)).toBeCloseTo(99.5, 1);
      expect(mateToWinProbability(-1)).toBeCloseTo(0.1, 1);
      expect(mateToWinProbability(-2)).toBeCloseTo(0.2, 1);
      expect(mateToWinProbability(0)).toBe(50.0);
    });
  });

  describe('Move Classification Thresholds', () => {
    it('classifies minimal delta (<= 0.5% WP loss) as Best', () => {
      const res = classifyMove({ cp: 50, wp: 54.6 }, { cp: 45, wp: 54.2 });
      expect(res).toBe('best');
    });

    it('classifies small delta (0.5% - 2.0% WP loss) as Great', () => {
      const res = classifyMove({ cp: 50, wp: 54.6 }, { cp: 25, wp: 52.8 });
      expect(res).toBe('great');
    });

    it('classifies moderate delta (2.0% - 5.0% WP loss) as Good', () => {
      const res = classifyMove({ cp: 50, wp: 54.6 }, { cp: 0, wp: 50.0 });
      expect(res).toBe('good');
    });

    it('classifies small slip (5.0% - 10.0% WP loss) as Inaccuracy', () => {
      const res = classifyMove({ cp: 50, wp: 54.6 }, { cp: -50, wp: 45.4 });
      expect(res).toBe('inaccuracy');
    });

    it('classifies clear error (10.0% - 20.0% WP loss) as Mistake', () => {
      const res = classifyMove({ cp: 50, wp: 54.6 }, { cp: -150, wp: 36.5 });
      expect(res).toBe('mistake');
    });

    it('classifies severe drop (> 20.0% WP loss) as Blunder', () => {
      const res = classifyMove({ cp: 50, wp: 54.6 }, { cp: -350, wp: 21.7 });
      expect(res).toBe('blunder');
    });

    it('classifies sound material sacrifice as Brilliant', () => {
      const res = classifyMoveDelta(0.2, 10, true, 250, true);
      expect(res).toBe('brilliant');
    });
  });

  describe('Coach Commentary Persona Generation', () => {
    it('generates distinct advice across Beginner, Intermediate, Expert for a Blunder', () => {
      const advice = generateCoachAdvice('blunder', ['fork'], 'Nf6');

      // Beginner persona: friendly, safety warning
      expect(advice.beginner).toContain('Watch out');
      expect(advice.beginner).toContain('fork');
      expect(advice.beginner).not.toContain('cp');

      // Intermediate persona: positional impact
      expect(advice.intermediate).toContain('Blunder:');
      expect(advice.intermediate).toContain('square control');

      // Expert persona: tactical rigor
      expect(advice.expert).toContain('tactical');
    });

    it('generates encouraging commentary for Brilliant sacrifices', () => {
      const advice = generateCoachAdvice('brilliant', [], 'Rxh7+');

      expect(advice.beginner).toContain('sacrificed');
      expect(advice.intermediate).toContain('Brilliant sacrifice');
      expect(advice.expert).toContain('Brilliancy');
    });

    it('generates constructive advice for Inaccuracies', () => {
      const advice = generateCoachAdvice('inaccuracy', ['conceded_outpost'], 'c5');

      expect(advice.beginner).toContain('okay');
      expect(advice.intermediate).toContain('outpost');
      expect(advice.expert).toContain('outpost');
    });
  });

  describe('Fallback Minimax Engine Performance & Correctness', () => {
    it('evaluates standard initial position within balanced centipawn range', async () => {
      const engine = new FallbackMinimaxEngine();
      await engine.init();

      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await engine.evaluate(startFen, { depth: 2, multiPV: 3 });

      expect(result).toBeDefined();
      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      expect(result.bestMove).toBeTruthy();
      expect(Math.abs(result.lines[0].score.value)).toBeLessThan(60);
    });

    it('orders multiPV lines strictly descending by score', async () => {
      const engine = new FallbackMinimaxEngine();
      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await engine.evaluate(startFen, { depth: 2, multiPV: 3 });

      for (let i = 1; i < result.lines.length; i++) {
        expect(result.lines[i - 1].score.value).toBeGreaterThanOrEqual(result.lines[i].score.value);
      }
    });

    it('detects checkmate positions cleanly', async () => {
      const engine = new FallbackMinimaxEngine();
      // Scholar's mate final position
      const mateFen = 'r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
      const result = await engine.evaluate(mateFen);

      expect(result.lines[0].score.type).toBe('mate');
    });
  });

  describe('StockfishClient Failover & State Resilience', () => {
    it('initializes and gracefully fails over to FallbackMinimax in Node/Vitest', async () => {
      const client = new StockfishClient({ initTimeoutMs: 100 });
      await client.init();

      expect(client.isReady()).toBe(true);

      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await client.evaluate(startFen, { depth: 2 });

      expect(result).toBeDefined();
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.bestMove).toBeTruthy();

      client.terminate();
    });
  });

  describe('GameModeManager Hardening Guarantees', () => {
    it('dispatches events in strictly FIFO chronological order during re-entrant calls', () => {
      const manager = new GameModeManager('normal');
      const events: string[] = [];

      manager.subscribe((event) => {
        if (event.currentMode === 'smart') {
          manager.setMode('expert');
        }
      });

      manager.subscribe((event) => {
        events.push(event.currentMode);
      });

      manager.setMode('smart');

      expect(events).toEqual(['smart', 'expert']);
      expect(manager.getMode()).toBe('expert');
    });

    it('rejects invalid game mode strings without mutating state', () => {
      const manager = new GameModeManager('normal');
      const res = (manager.setMode as any)('invalid_mode');

      expect(res).toBe(false);
      expect(manager.getMode()).toBe('normal');
      expect(manager.getPolicy()).toBeDefined();
      expect(manager.isEngineEnabled()).toBe(false);
    });

    it('enforces immutable policy configurations via Object.freeze', () => {
      const manager = new GameModeManager('normal');
      const policy = manager.getPolicy();

      expect(Object.isFrozen(policy)).toBe(true);
      expect(Object.isFrozen(GAME_MODE_POLICIES)).toBe(true);
      expect(() => {
        (policy as any).engineEnabled = true;
      }).toThrow();
    });
  });
});
