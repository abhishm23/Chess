/**
 * test/components/m3Challenger2Stress.test.ts
 * 
 * Empirical and Adversarial Stress Test Suite for Milestone 3:
 * - Non-destructive variation preview (`previewFen`) isolation & square control differential
 * - Rapid multi-tier mode transitions under live play
 * - SVG vector overlay coordinate transformations, Knight L-routing center avoidance & path syntax
 * - Heatmap differential scaling with extreme attacker imbalances & alpha clamping [0.08, 0.38]
 * - Dynamic EvalBar centipawn and forced mate stress (+/-10000 cp, Mate in 1, -Mate in 3)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, act, fireEvent } from '@testing-library/react';
import { Chess } from 'chess.js';

import { useChessGame } from '../../src/hooks/useChessGame';
import {
  SvgOverlay,
  squareToCoords,
  computeStraightArrowPath,
  computeKnightLPath,
  isKnightMove,
} from '../../src/components/Overlays/SvgOverlay';
import {
  HeatmapOverlay,
  getHeatmapColor,
} from '../../src/components/Overlays/HeatmapOverlay';
import { EvalBar } from '../../src/components/CoachPanel/EvalBar';
import { DominoExplorer } from '../../src/components/DominoExplorer/DominoExplorer';
import { calculateSquareControl } from '../../src/rules/squareControl';
import { Square } from '../../src/types/chess';
import { BoardOrientation } from '../../src/types/ui';
import { SquareControlMap } from '../../src/types/rules';

describe('1. Non-destructive Variation Preview Stress Testing', () => {
  it('enters preview, updates square control differential on preview FEN, and isolates live state', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    // Advance live game: 1. e4 e5 2. Nf3 Nc6
    act(() => {
      result.current.actions.makeMove('e2', 'e4');
      result.current.actions.makeMove('e7', 'e5');
      result.current.actions.makeMove('g1', 'f3');
      result.current.actions.makeMove('b8', 'c6');
    });

    const liveFen = result.current.liveFen;
    const liveHistory = [...result.current.gameState.history];
    const liveSquareControl = result.current.gameState.squareControl;

    expect(liveHistory).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(result.current.previewFen).toBeNull();
    expect(result.current.isHistoricalPreview).toBe(false);

    // Hypothetical Domino variation: Italian Game 3. Bc4
    const previewFenBc4 = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    const expectedPreviewControl = calculateSquareControl(new Chess(previewFenBc4));

    // 1. Enter Preview
    act(() => {
      result.current.actions.previewVariationPly(previewFenBc4);
    });

    expect(result.current.previewFen).toBe(previewFenBc4);
    expect(result.current.displayFen).toBe(previewFenBc4);
    expect(result.current.gameState.fen).toBe(previewFenBc4);
    expect(result.current.isHistoricalPreview).toBe(true);

    // Square control MUST reflect the preview position, not the live game
    expect(result.current.gameState.squareControl.differential).toEqual(
      expectedPreviewControl.differential
    );
    expect(result.current.gameState.squareControl.differential).not.toEqual(
      liveSquareControl.differential
    );

    // Live FEN and history must remain untouched
    expect(result.current.liveFen).toBe(liveFen);
    expect(result.current.gameState.history).toEqual(liveHistory);

    // 2. Flip board while previewing: preview state must NOT be wiped
    act(() => {
      result.current.actions.flipBoard();
    });

    expect(result.current.orientation).toBe('black');
    expect(result.current.previewFen).toBe(previewFenBc4);
    expect(result.current.gameState.fen).toBe(previewFenBc4);
    expect(result.current.gameState.squareControl.differential).toEqual(
      expectedPreviewControl.differential
    );

    // 3. Revert preview on null: restores live game state cleanly
    act(() => {
      result.current.actions.previewVariationPly(null);
    });

    expect(result.current.previewFen).toBeNull();
    expect(result.current.displayFen).toBe(liveFen);
    expect(result.current.gameState.fen).toBe(liveFen);
    expect(result.current.isHistoricalPreview).toBe(false);
    expect(result.current.gameState.history).toEqual(liveHistory);
    expect(result.current.gameState.squareControl.differential).toEqual(
      liveSquareControl.differential
    );
    // Board flip preference is maintained
    expect(result.current.orientation).toBe('black');
  });

  it('automatically cancels preview when a live move is executed', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    act(() => {
      result.current.actions.makeMove('e2', 'e4');
    });

    const previewFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';

    act(() => {
      result.current.actions.previewVariationPly(previewFen);
    });
    expect(result.current.previewFen).toBe(previewFen);

    // Making a move on the live board dismisses preview and updates live game
    let moveResult = false;
    act(() => {
      moveResult = result.current.actions.makeMove('e7', 'e5');
    });

    expect(moveResult).toBe(true);
    expect(result.current.previewFen).toBeNull();
    expect(result.current.gameState.history).toEqual(['e4', 'e5']);
    expect(result.current.displayFen).toBe(result.current.liveFen);
  });

  it('safely handles corrupted or malformed preview FEN strings without crashing', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    const liveFen = result.current.liveFen;

    act(() => {
      result.current.actions.previewVariationPly('totally_corrupted_fen_string_adversarial');
    });

    // Hook does not throw and safely handles displayChess fallback
    expect(result.current.previewFen).toBe('totally_corrupted_fen_string_adversarial');
    expect(result.current.gameState.squareControl).toBeDefined();

    // Reverting restores clean live state
    act(() => {
      result.current.actions.previewVariationPly(null);
    });
    expect(result.current.previewFen).toBeNull();
    expect(result.current.gameState.fen).toBe(liveFen);
  });
});

describe('2. Rapid Mode Switching Stress Testing', () => {
  it('seamlessly transitions Normal -> Smart -> Expert -> Normal while interleaving moves', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    // Normal Mode Verification
    expect(result.current.gameState.activeMode).toBe('normal');
    expect(result.current.showHeatmap).toBe(false);
    expect(result.current.showArrows).toBe(false);
    expect(result.current.engineStatus).toBe('dormant');
    expect(result.current.arrows).toEqual([]);
    expect(result.current.threats).toEqual([]);

    // Play 1. d4 in Normal mode
    act(() => {
      result.current.actions.makeMove('d2', 'd4');
    });
    expect(result.current.gameState.history).toEqual(['d4']);

    // Switch to Smart Mode
    act(() => {
      result.current.actions.setGameMode('smart');
    });
    expect(result.current.gameState.activeMode).toBe('smart');
    expect(result.current.showArrows).toBe(true);
    expect(result.current.showHeatmap).toBe(false);
    expect(result.current.gameState.history).toEqual(['d4']);

    // Play 1... d5 in Smart mode
    act(() => {
      result.current.actions.makeMove('d7', 'd5');
    });
    expect(result.current.gameState.history).toEqual(['d4', 'd5']);

    // Switch to Expert Mode
    act(() => {
      result.current.actions.setGameMode('expert');
    });
    expect(result.current.gameState.activeMode).toBe('expert');
    expect(result.current.showArrows).toBe(true);
    expect(result.current.showHeatmap).toBe(true);
    expect(result.current.gameState.history).toEqual(['d4', 'd5']);

    // Play 2. c4 in Expert mode
    act(() => {
      result.current.actions.makeMove('c2', 'c4');
    });
    expect(result.current.gameState.history).toEqual(['d4', 'd5', 'c4']);

    // Switch back to Normal Mode
    act(() => {
      result.current.actions.setGameMode('normal');
    });
    expect(result.current.gameState.activeMode).toBe('normal');
    expect(result.current.showHeatmap).toBe(false);
    expect(result.current.showArrows).toBe(false);
    expect(result.current.engineStatus).toBe('dormant');
    expect(result.current.arrows).toEqual([]);
    expect(result.current.threats).toEqual([]);
    expect(result.current.gameState.history).toEqual(['d4', 'd5', 'c4']);
  });

  it('survives rapid consecutive mode cycles without desynchronization or state corruption', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'normal' }));

    act(() => {
      result.current.actions.makeMove('e2', 'e4');
      result.current.actions.makeMove('c7', 'c5');
    });

    const fenBefore = result.current.gameState.fen;
    const historyBefore = [...result.current.gameState.history];

    // Rapid cycle 20 times: Normal -> Smart -> Expert -> Normal
    for (let i = 0; i < 20; i++) {
      act(() => {
        result.current.actions.setGameMode('smart');
      });
      expect(result.current.gameState.activeMode).toBe('smart');
      expect(result.current.showArrows).toBe(true);

      act(() => {
        result.current.actions.setGameMode('expert');
      });
      expect(result.current.gameState.activeMode).toBe('expert');
      expect(result.current.showHeatmap).toBe(true);

      act(() => {
        result.current.actions.setGameMode('normal');
      });
      expect(result.current.gameState.activeMode).toBe('normal');
      expect(result.current.showHeatmap).toBe(false);
      expect(result.current.showArrows).toBe(false);
    }

    // Live chess state must remain 100% identical
    expect(result.current.gameState.fen).toBe(fenBefore);
    expect(result.current.gameState.history).toEqual(historyBefore);
  });
});

describe('3. SVG Vector Overlays & Knight L-Routing Stress Testing', () => {
  const knightOrigins: Square[] = ['e4', 'd5', 'c3', 'f6', 'b1', 'g8', 'a1', 'h8'];

  it('strictly verifies computeKnightLPath avoids center obstruction (400, 400) for all 8 moves across multiple squares', () => {
    const orientations: BoardOrientation[] = ['white', 'black'];

    for (const orientation of orientations) {
      for (const origin of knightOrigins) {
        const f1 = origin.charCodeAt(0) - 97;
        const r1 = origin.charCodeAt(1) - 49;

        // All 8 possible knight deltas
        const deltas = [
          [-1, 2], [1, 2], [-2, 1], [2, 1],
          [-2, -1], [2, -1], [-1, -2], [1, -2],
        ];

        for (const [df, dr] of deltas) {
          const f2 = f1 + df;
          const r2 = r1 + dr;
          if (f2 < 0 || f2 > 7 || r2 < 0 || r2 > 7) continue;

          const target = `${String.fromCharCode(97 + f2)}${r2 + 1}` as Square;
          expect(isKnightMove(origin, target)).toBe(true);

          const p1 = squareToCoords(origin, orientation);
          const p2 = squareToCoords(target, orientation);

          const kh = { x: p2.x, y: p1.y };
          const kv = { x: p1.x, y: p2.y };
          const dh = Math.hypot(kh.x - 400, kh.y - 400);
          const dv = Math.hypot(kv.x - 400, kv.y - 400);

          const result = computeKnightLPath(p1, p2);

          // Extract corner (cx, cy) from SVG path "M ... L ... Q cx cy ... L ..."
          const match = result.d.match(/Q ([0-9.-]+) ([0-9.-]+)/);
          expect(match).not.toBeNull();
          const cornerX = parseFloat(match![1]);
          const cornerY = parseFloat(match![2]);

          const chosenDist = Math.hypot(cornerX - 400, cornerY - 400);

          // Verify center avoidance:
          // If one corner is strictly farther from center (> 0.5px margin), it must be chosen.
          if (dh > dv + 0.5) {
            expect(chosenDist).toBeCloseTo(dh, 1);
            expect(cornerX).toBeCloseTo(kh.x, 1);
            expect(cornerY).toBeCloseTo(kh.y, 1);
          } else if (dv > dh + 0.5) {
            expect(chosenDist).toBeCloseTo(dv, 1);
            expect(cornerX).toBeCloseTo(kv.x, 1);
            expect(cornerY).toBeCloseTo(kv.y, 1);
          } else {
            // Symmetrical: chosen distance must equal dh (or dv)
            expect(chosenDist).toBeCloseTo(dh, 1);
          }

          // Invariant: chosen corner must not collapse into center (400, 400)
          // Board square centers are at 50, 150, 250, 350, 450, 550, 650, 750
          // Minimum distance from center (400, 400) to any square center is hypot(50, 50) = 70.71px
          expect(chosenDist).toBeGreaterThanOrEqual(70);
        }
      }
    }
  });

  it('generates syntactically valid SVG path grammar with finite coordinates for straight arrows', () => {
    // Standard move
    const p1 = { x: 450, y: 650 }; // e2
    const p2 = { x: 450, y: 450 }; // e4
    const path = computeStraightArrowPath(p1, p2);

    expect(path.d).toMatch(/^M [0-9.-]+ [0-9.-]+ L [0-9.-]+ [0-9.-]+$/);
    expect(Number.isFinite(path.endX)).toBe(true);
    expect(Number.isFinite(path.endY)).toBe(true);

    // Diagonal long move (a1 to h8)
    const pA1 = { x: 50, y: 750 };
    const pH8 = { x: 750, y: 50 };
    const diagPath = computeStraightArrowPath(pA1, pH8);
    expect(diagPath.d).toMatch(/^M [0-9.-]+ [0-9.-]+ L [0-9.-]+ [0-9.-]+$/);

    // Boundary stress: identical points (zero distance) should not produce NaN or Infinity
    const zeroDist = computeStraightArrowPath({ x: 400, y: 400 }, { x: 400, y: 400 });
    expect(zeroDist.d).not.toContain('NaN');
    expect(zeroDist.d).not.toContain('Infinity');
  });

  it('generates syntactically valid Bézier fillet curves for Knight paths without NaN', () => {
    const p1 = squareToCoords('b1', 'white');
    const p2 = squareToCoords('c3', 'white');

    const path = computeKnightLPath(p1, p2);
    expect(path.d).toMatch(
      /^M [0-9.-]+ [0-9.-]+ L [0-9.-]+ [0-9.-]+ Q [0-9.-]+ [0-9.-]+ [0-9.-]+ [0-9.-]+ L [0-9.-]+ [0-9.-]+$/
    );
    expect(path.d).not.toContain('NaN');
    expect(path.d).not.toContain('undefined');
    expect(Number.isFinite(path.endX)).toBe(true);
    expect(Number.isFinite(path.endY)).toBe(true);
  });

  it('renders SvgOverlay with valid DOM attributes and elements', () => {
    const { container } = render(
      React.createElement(SvgOverlay, {
        orientation: 'white',
        arrows: [
          {
            id: 'arrow-straight',
            from: 'e2',
            to: 'e4',
            color: '#10b981',
            classification: 'best',
          },
          {
            id: 'arrow-knight',
            from: 'g1',
            to: 'f3',
            color: '#06b6d4',
            classification: 'brilliant',
            isKnight: true,
          },
        ],
        threats: [
          { square: 'd5', type: 'hanging' },
          { square: 'c6', type: 'pinned' },
        ],
        isCheck: true,
        kingSquare: 'e1',
      })
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 800 800');

    // Straight and Knight arrow paths
    const arrowPaths = container.querySelectorAll('path[stroke]');
    expect(arrowPaths.length).toBeGreaterThanOrEqual(2);

    // Threat circles
    const threatCircles = container.querySelectorAll('circle');
    expect(threatCircles.length).toBeGreaterThanOrEqual(2);
  });
});

describe('4. Square Control Heatmap Differential & Clamping Stress Testing', () => {
  it('correctly clamps alpha to [0.08, 0.38] under extreme differential imbalances', () => {
    // 1. Extreme White dominance (+10 white vs 0 black)
    const colorWhite10 = getHeatmapColor(10, 10, 0);
    expect(colorWhite10).toBe('rgba(59, 130, 246, 0.380)');

    // 2. Extreme Black dominance (-8 black vs 0 white)
    const colorBlack8 = getHeatmapColor(-8, 0, 8);
    expect(colorBlack8).toBe('rgba(239, 68, 68, 0.380)');

    // 3. Clamping boundary testing: +100 and -100
    const colorWhite100 = getHeatmapColor(100, 100, 0);
    expect(colorWhite100).toBe('rgba(59, 130, 246, 0.380)');

    const colorBlack100 = getHeatmapColor(-100, 0, 100);
    expect(colorBlack100).toBe('rgba(239, 68, 68, 0.380)');

    // 4. Subtle differential (+1): alpha = 0.08 + 1 * 0.075 = 0.155 (strictly in [0.08, 0.38])
    const colorWhite1 = getHeatmapColor(1, 1, 0);
    expect(colorWhite1).toBe('rgba(59, 130, 246, 0.155)');

    const colorBlack1 = getHeatmapColor(-1, 0, 1);
    expect(colorBlack1).toBe('rgba(239, 68, 68, 0.155)');

    // 5. Contested square under tension (diff = 0, both sides attack)
    const contested = getHeatmapColor(0, 3, 3);
    expect(contested).toBe('rgba(168, 85, 247, 0.14)');

    const contestedMinimal = getHeatmapColor(0, 1, 1);
    expect(contestedMinimal).toBe('rgba(168, 85, 247, 0.14)');

    // 6. Completely neutral square (diff = 0, no attackers)
    const neutral = getHeatmapColor(0, 0, 0);
    expect(neutral).toBe('transparent');
  });

  it('renders HeatmapOverlay with extreme square control differential map', () => {
    const differential = new Array(64).fill(0);
    const white = new Array(64).fill(0);
    const black = new Array(64).fill(0);

    // Index 27 (d4): +10 White
    differential[27] = 10;
    white[27] = 10;
    black[27] = 0;

    // Index 35 (d5): -8 Black
    differential[35] = -8;
    white[35] = 0;
    black[35] = 8;

    // Index 28 (e4): contested 2 vs 2
    differential[28] = 0;
    white[28] = 2;
    black[28] = 2;

    // Index 0 (a1): neutral 0 vs 0
    differential[0] = 0;
    white[0] = 0;
    black[0] = 0;

    const mockControl: SquareControlMap = { white, black, differential };

    const { container, rerender } = render(
      React.createElement(HeatmapOverlay, {
        orientation: 'white',
        squareControl: mockControl,
        showHeatmap: true,
      })
    );

    const rectD4 = container.querySelector('[data-testid="heatmap-rect-27"]');
    expect(rectD4).toBeInTheDocument();
    expect(rectD4).toHaveAttribute('fill', 'rgba(59, 130, 246, 0.380)');

    const rectD5 = container.querySelector('[data-testid="heatmap-rect-35"]');
    expect(rectD5).toBeInTheDocument();
    expect(rectD5).toHaveAttribute('fill', 'rgba(239, 68, 68, 0.380)');

    const rectE4 = container.querySelector('[data-testid="heatmap-rect-28"]');
    expect(rectE4).toBeInTheDocument();
    expect(rectE4).toHaveAttribute('fill', 'rgba(168, 85, 247, 0.14)');

    // Neutral square must not generate a rect
    const rectA1 = container.querySelector('[data-testid="heatmap-rect-0"]');
    expect(rectA1).toBeNull();

    // When showHeatmap is false, nothing is rendered
    rerender(
      React.createElement(HeatmapOverlay, {
        orientation: 'white',
        squareControl: mockControl,
        showHeatmap: false,
      })
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('5. Dynamic EvalBar Stress & Extreme Centipawn Testing', () => {
  it('correctly handles extreme positive centipawns (+10000) and clamps win probability to 98%', () => {
    const { container } = render(
      React.createElement(EvalBar, {
        centipawns: 10000,
        winProbability: 100.0,
        orientation: 'white',
        isVertical: true,
      })
    );

    // Formatted evaluation text: +100.0 pawns
    expect(container).toHaveTextContent('+100.0');

    // Aria label contains accurate info
    const gauge = container.querySelector('[aria-label]');
    expect(gauge).toHaveAttribute(
      'aria-label',
      'Evaluation Gauge: +100.0 (100% White win probability)'
    );

    // White height percent clamped to 98% (Black height to 2%)
    const sections = container.querySelectorAll('div[style*="height"]');
    expect(sections.length).toBe(2);
    // Black section (top)
    expect(sections[0]).toHaveStyle({ height: '2%' });
    // White section (bottom)
    expect(sections[1]).toHaveStyle({ height: '98%' });
  });

  it('correctly handles extreme negative centipawns (-10000) and clamps win probability to 2%', () => {
    const { container } = render(
      React.createElement(EvalBar, {
        centipawns: -10000,
        winProbability: 0.0,
        orientation: 'white',
        isVertical: true,
      })
    );

    // Formatted evaluation text: -100.0 pawns
    expect(container).toHaveTextContent('-100.0');

    const gauge = container.querySelector('[aria-label]');
    expect(gauge).toHaveAttribute(
      'aria-label',
      'Evaluation Gauge: -100.0 (0% White win probability)'
    );

    const sections = container.querySelectorAll('div[style*="height"]');
    expect(sections.length).toBe(2);
    // Black section (top: 100 - 2 = 98%)
    expect(sections[0]).toHaveStyle({ height: '98%' });
    // White section (bottom: 2%)
    expect(sections[1]).toHaveStyle({ height: '2%' });
  });

  it('correctly formats dead equality (0 centipawns) without negative zero', () => {
    const { container } = render(
      React.createElement(EvalBar, {
        centipawns: 0,
        winProbability: 50.0,
        orientation: 'white',
        isVertical: true,
      })
    );

    expect(container).toHaveTextContent('0.0');
    expect(container.textContent).not.toContain('-0.0');
    expect(container.textContent).not.toContain('+0.0');

    const sections = container.querySelectorAll('div[style*="height"]');
    expect(sections[0]).toHaveStyle({ height: '50%' });
    expect(sections[1]).toHaveStyle({ height: '50%' });
  });

  it('correctly formats positive Mate in 1 (M1) and negative Mate in 3 (-M3)', () => {
    // Mate in 1
    const { container: cMate1 } = render(
      React.createElement(EvalBar, {
        centipawns: 9900,
        winProbability: 99.5,
        mateScore: 1,
        orientation: 'white',
      })
    );
    expect(cMate1).toHaveTextContent('M1');
    const gauge1 = cMate1.querySelector('[aria-label]');
    expect(gauge1).toHaveAttribute('aria-label', 'Evaluation Gauge: M1 (100% White win probability)');

    // -Mate in 3 (Black forces mate)
    const { container: cMate3 } = render(
      React.createElement(EvalBar, {
        centipawns: -9700,
        winProbability: 0.5,
        mateScore: -3,
        orientation: 'white',
      })
    );
    expect(cMate3).toHaveTextContent('-M3');
    const gauge3 = cMate3.querySelector('[aria-label]');
    expect(gauge3).toHaveAttribute('aria-label', 'Evaluation Gauge: -M3 (1% White win probability)');
  });

  it('accurately flips gauge proportions when board orientation is Black', () => {
    // White winning 80% WP:
    // White orientation: White section is at bottom with 80% height.
    // Black orientation: White section is at top with 20% height (or reversed).
    const { container } = render(
      React.createElement(EvalBar, {
        centipawns: 350,
        winProbability: 80.0,
        orientation: 'black',
        isVertical: true,
      })
    );

    const sections = container.querySelectorAll('div[style*="height"]');
    // In black orientation: whiteHeightPercent = 100 - clampedWp = 100 - 80 = 20%
    // Black section height = 100 - 20 = 80%
    expect(sections[0]).toHaveStyle({ height: '80%' });
    // White section height = 20%
    expect(sections[1]).toHaveStyle({ height: '20%' });
  });

  it('correctly guards against negative zero display (-0.0) for tiny negative centipawns', () => {
    // e.g. -4 centipawns: (-4/100).toFixed(1) is "-0.0"
    const { container } = render(
      React.createElement(EvalBar, {
        centipawns: -4,
        winProbability: 49.8,
        orientation: 'white',
      })
    );

    expect(container).toHaveTextContent('0.0');
    expect(container.textContent).not.toContain('-0.0');
  });

  it('renders horizontal layout correctly for mobile viewports', () => {
    const { container } = render(
      React.createElement(EvalBar, {
        centipawns: 200,
        winProbability: 70.0,
        isVertical: false,
      })
    );

    const horizontalBars = container.querySelectorAll('div[style*="width"]');
    expect(horizontalBars.length).toBe(2);
    // White bar width: 70%
    expect(horizontalBars[0]).toHaveStyle({ width: '70%' });
    // Black bar width: 30%
    expect(horizontalBars[1]).toHaveStyle({ width: '30%' });
    expect(container).toHaveTextContent('+2.0');
    expect(container).toHaveTextContent('70% W');
  });
});

describe('6. Domino Explorer Scenario Tree & Causal Chain Interaction Stress Testing', () => {
  it('correctly triggers onPreviewPly with node FEN on tree node selection and null on reset', () => {
    const onPreviewPlyMock = vi.fn();
    const onSelectCandidateMock = vi.fn();

    const mockTree = {
      id: 'root-Nf3',
      san: 'Nf3',
      fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      ply: 1,
      centipawns: 35,
      winProbability: 54.2,
      tacticalTags: ['outpost'],
      dominoExplanation: 'Develops knight and controls d4 and e5.',
      children: [
        {
          id: 'child-d5',
          san: 'd5',
          fen: 'rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2',
          ply: 2,
          centipawns: 30,
          winProbability: 53.6,
          tacticalTags: [],
          dominoExplanation: 'Black stakes claim in the center.',
          children: [],
        },
      ],
    };

    const { container, rerender } = render(
      React.createElement(DominoExplorer, {
        activeMode: 'expert',
        candidateMoves: [
          {
            san: 'Nf3',
            from: 'g1',
            to: 'f3',
            centipawns: 35,
            winProbability: 54.2,
            deltaWinProbability: 0,
            classification: 'best',
            tacticalMotifs: ['outpost'],
            pv: ['Nf3', 'd5'],
          },
        ],
        selectedCandidateSan: 'Nf3',
        onSelectCandidate: onSelectCandidateMock,
        activeScenarioTree: mockTree,
        activePreviewFen: null,
        onPreviewPly: onPreviewPlyMock,
      })
    );

    // Switch to tree view
    const treeTabBtn = container.querySelector('button[title="Scenario Tree View"]') ||
      Array.from(container.querySelectorAll('button')).find((b: any) => b.textContent?.includes('Tree'));
    if (treeTabBtn) {
      fireEvent.click(treeTabBtn);
    }

    // Find clickable child node for 'd5'
    const d5Elements = Array.from(container.querySelectorAll('span, div, button')).filter(
      (el: any) => el.textContent?.trim() === 'd5'
    );
    expect(d5Elements.length).toBeGreaterThanOrEqual(1);

    // Click d5 node
    fireEvent.click(d5Elements[0]);
    expect(onPreviewPlyMock).toHaveBeenCalledWith(mockTree.children[0].fen);

    // Clicking when activePreviewFen matches toggles it back to null
    rerender(
      React.createElement(DominoExplorer, {
        activeMode: 'expert',
        candidateMoves: [
          {
            san: 'Nf3',
            from: 'g1',
            to: 'f3',
            centipawns: 35,
            winProbability: 54.2,
            deltaWinProbability: 0,
            classification: 'best',
            tacticalMotifs: ['outpost'],
            pv: ['Nf3', 'd5'],
          },
        ],
        selectedCandidateSan: 'Nf3',
        onSelectCandidate: onSelectCandidateMock,
        activeScenarioTree: mockTree,
        activePreviewFen: mockTree.children[0].fen,
        onPreviewPly: onPreviewPlyMock,
      })
    );

    fireEvent.click(d5Elements[0]);
    expect(onPreviewPlyMock).toHaveBeenCalledWith(null);
  });
});
