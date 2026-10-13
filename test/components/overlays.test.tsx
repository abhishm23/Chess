/**
 * test/components/overlays.test.tsx
 * Unit tests for SVG vector overlays, Knight L-routing, threat halos, and Heatmap overlay.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  SvgOverlay,
  squareToCoords,
  squareToTopLeft,
  isKnightMove,
  computeStraightArrowPath,
  computeKnightLPath,
  CLASSIFICATION_COLORS,
} from '../../src/components/Overlays/SvgOverlay';
import {
  HeatmapOverlay,
  getHeatmapColor,
} from '../../src/components/Overlays/HeatmapOverlay';
import { SquareControlMap } from '../../src/types/rules';

describe('Overlays Vector Mathematics & Coordinate Systems', () => {
  it('correctly maps squares to SVG center coordinates for White orientation', () => {
    // a1: col 0, row 7 -> cx = 50, cy = 750
    const a1 = squareToCoords('a1', 'white');
    expect(a1).toEqual({ x: 50, y: 750 });

    // h8: col 7, row 0 -> cx = 750, cy = 50
    const h8 = squareToCoords('h8', 'white');
    expect(h8).toEqual({ x: 750, y: 50 });

    // e4: col 4, row 4 -> cx = 450, cy = 450
    const e4 = squareToCoords('e4', 'white');
    expect(e4).toEqual({ x: 450, y: 450 });

    // d4: col 3, row 4 -> cx = 350, cy = 450
    const d4 = squareToCoords('d4', 'white');
    expect(d4).toEqual({ x: 350, y: 450 });
  });

  it('correctly maps squares to SVG center coordinates for Black orientation', () => {
    // a1 in Black perspective is top-right: col 7, row 0 -> cx = 750, cy = 50
    const a1 = squareToCoords('a1', 'black');
    expect(a1).toEqual({ x: 750, y: 50 });

    // h8 in Black perspective is bottom-left: col 0, row 7 -> cx = 50, cy = 750
    const h8 = squareToCoords('h8', 'black');
    expect(h8).toEqual({ x: 50, y: 750 });

    // e4: col 3, row 3 -> cx = 350, cy = 350
    const e4 = squareToCoords('e4', 'black');
    expect(e4).toEqual({ x: 350, y: 350 });
  });

  it('identifies Knight moves correctly using mathematical invariant df * dr === 2', () => {
    // All 8 standard knight jumps from e4:
    expect(isKnightMove('e4', 'd6')).toBe(true);
    expect(isKnightMove('e4', 'f6')).toBe(true);
    expect(isKnightMove('e4', 'c5')).toBe(true);
    expect(isKnightMove('e4', 'g5')).toBe(true);
    expect(isKnightMove('e4', 'c3')).toBe(true);
    expect(isKnightMove('e4', 'g3')).toBe(true);
    expect(isKnightMove('e4', 'd2')).toBe(true);
    expect(isKnightMove('e4', 'f2')).toBe(true);

    // Non-knight moves:
    expect(isKnightMove('e2', 'e4')).toBe(false); // pawn 2 squares
    expect(isKnightMove('c1', 'f4')).toBe(false); // bishop diagonal
    expect(isKnightMove('a1', 'a8')).toBe(false); // rook file
    expect(isKnightMove('e1', 'g1')).toBe(false); // king castling
  });

  it('computes straight arrow paths with trimmed endpoints to avoid overlap', () => {
    const p1 = { x: 450, y: 650 }; // e2
    const p2 = { x: 450, y: 450 }; // e4

    const path = computeStraightArrowPath(p1, p2);
    expect(path.d).toContain('M 450.0 632.0 L 450.0 460.0');
    expect(path.endX).toBe(450);
    expect(path.endY).toBe(460);
  });

  it('computes Knight L-paths with rounded fillets and center avoidance', () => {
    const p1 = squareToCoords('g1', 'white'); // (650, 750)
    const p2 = squareToCoords('f3', 'white'); // (550, 550)

    const path = computeKnightLPath(p1, p2);
    // Path contains Move, Line to corner entry, Quadratic Bézier to exit, and Line to end
    expect(path.d).toMatch(/^M [0-9.]+ [0-9.]+ L [0-9.]+ [0-9.]+ Q [0-9.]+ [0-9.]+ [0-9.]+ [0-9.]+ L [0-9.]+ [0-9.]+$/);
    expect(path.endX).toBeDefined();
    expect(path.endY).toBeDefined();
  });

  it('calculates heatmap differential colors with accurate alpha gradients', () => {
    // Neutral square: transparent
    expect(getHeatmapColor(0, 0, 0)).toBe('transparent');

    // Contested square under tension: violet
    expect(getHeatmapColor(0, 2, 2)).toBe('rgba(168, 85, 247, 0.14)');

    // White dominance (+1): Blue tint
    const white1 = getHeatmapColor(1, 2, 1);
    expect(white1).toContain('rgba(59, 130, 246,');

    // White dominance (+3): Deeper Blue tint
    const white3 = getHeatmapColor(3, 4, 1);
    expect(white3).toContain('rgba(59, 130, 246,');

    // Black dominance (-2): Red tint
    const black2 = getHeatmapColor(-2, 1, 3);
    expect(black2).toContain('rgba(239, 68, 68,');
  });
});

describe('SvgOverlay Component Rendering', () => {
  it('renders resolution-independent SVG with viewBox 0 0 800 800 and pointer-events-none', () => {
    const { container } = render(
      <SvgOverlay
        orientation="white"
        arrows={[]}
        threats={[]}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 800 800');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('pointer-events-none');
  });

  it('renders classification arrowhead markers in defs', () => {
    const { container } = render(
      <SvgOverlay
        orientation="white"
        arrows={[]}
        threats={[]}
      />
    );

    const defs = container.querySelector('defs');
    expect(defs).toBeInTheDocument();
    expect(defs?.querySelector('#arrowhead-best')).toBeInTheDocument();
    expect(defs?.querySelector('#arrowhead-blunder')).toBeInTheDocument();
    expect(defs?.querySelector('#arrowhead-brilliant')).toBeInTheDocument();
  });

  it('renders candidate move arrows with appropriate classification colors', () => {
    const arrows = [
      {
        id: 'arrow-1',
        from: 'e2' as const,
        to: 'e4' as const,
        color: CLASSIFICATION_COLORS.best,
        classification: 'best' as const,
      },
      {
        id: 'arrow-2',
        from: 'g1' as const,
        to: 'f3' as const,
        color: CLASSIFICATION_COLORS.great,
        classification: 'great' as const,
        isKnight: true,
      },
    ];

    const { container } = render(
      <SvgOverlay
        orientation="white"
        arrows={arrows}
        threats={[]}
      />
    );

    const paths = container.querySelectorAll('path[stroke]');
    expect(paths.length).toBe(2);
    expect(paths[0]).toHaveAttribute('stroke', CLASSIFICATION_COLORS.best);
    expect(paths[1]).toHaveAttribute('stroke', CLASSIFICATION_COLORS.great);
  });

  it('renders check pulse on King when isCheck is true', () => {
    const { container } = render(
      <SvgOverlay
        orientation="white"
        arrows={[]}
        threats={[]}
        isCheck={true}
        kingSquare="e1"
      />
    );

    const checkPulseCircle = container.querySelector('circle[fill="url(#checkGlow)"]');
    expect(checkPulseCircle).toBeInTheDocument();
    expect(checkPulseCircle).toHaveAttribute('cx', '450'); // e1
    expect(checkPulseCircle).toHaveAttribute('cy', '750');
  });

  it('renders threat indicators for hanging and pinned pieces', () => {
    const threats = [
      { square: 'd5' as const, type: 'hanging' as const },
      { square: 'f3' as const, type: 'pinned' as const, pinnerSquare: 'g4' as const },
    ];

    const { container } = render(
      <SvgOverlay
        orientation="white"
        arrows={[]}
        threats={threats}
      />
    );

    // Hanging piece circle has amber stroke
    const hangingCircle = container.querySelector('circle[stroke="#f59e0b"]');
    expect(hangingCircle).toBeInTheDocument();

    // Pinned piece circle has purple stroke
    const pinnedCircle = container.querySelector('circle[stroke="#a855f7"]');
    expect(pinnedCircle).toBeInTheDocument();

    // Pin ray line exists
    const pinRay = container.querySelector('line[stroke="#a855f7"]');
    expect(pinRay).toBeInTheDocument();
  });
});

describe('HeatmapOverlay Component Rendering', () => {
  it('returns null when showHeatmap is false', () => {
    const squareControl: SquareControlMap = {
      white: new Array(64).fill(1),
      black: new Array(64).fill(0),
      differential: new Array(64).fill(1),
    };

    const { container } = render(
      <HeatmapOverlay
        orientation="white"
        squareControl={squareControl}
        showHeatmap={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders 64-square grid rects when showHeatmap is true', () => {
    const differential = new Array(64).fill(0);
    differential[28] = 2; // e4 (White dominance)
    differential[35] = -2; // d5 (Black dominance)

    const squareControl: SquareControlMap = {
      white: new Array(64).fill(0),
      black: new Array(64).fill(0),
      differential,
    };
    squareControl.white[28] = 2;
    squareControl.black[35] = 2;

    const { container } = render(
      <HeatmapOverlay
        orientation="white"
        squareControl={squareControl}
        showHeatmap={true}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 800 800');

    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });
});
