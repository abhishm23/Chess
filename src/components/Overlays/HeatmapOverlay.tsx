/**
 * src/components/Overlays/HeatmapOverlay.tsx
 * Real-time square control differential heatmap overlay.
 * Delta(s) = A_w(s) - A_b(s).
 */

import React from 'react';
import { BoardOrientation } from '../../types/ui';
import { SquareControlMap } from '../../types/rules';

export interface HeatmapOverlayProps {
  orientation: BoardOrientation;
  squareControl?: SquareControlMap | null;
  showHeatmap: boolean;
}

export function getHeatmapColor(diff: number, wCount: number, bCount: number): string {
  if (diff === 0) {
    if (wCount > 0 && bCount > 0) {
      // Contested square under tension
      return 'rgba(168, 85, 247, 0.14)';
    }
    return 'transparent';
  }

  if (diff > 0) {
    // White dominance: Blue tint ramp
    const alpha = Math.min(0.38, 0.08 + diff * 0.075);
    return `rgba(59, 130, 246, ${alpha.toFixed(3)})`;
  } else {
    // Black dominance: Red tint ramp
    const absDiff = Math.abs(diff);
    const alpha = Math.min(0.38, 0.08 + absDiff * 0.075);
    return `rgba(239, 68, 68, ${alpha.toFixed(3)})`;
  }
}

export const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({
  orientation,
  squareControl,
  showHeatmap,
}) => {
  if (!showHeatmap || !squareControl || !squareControl.differential) {
    return null;
  }

  const rects: React.ReactNode[] = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const idx = r * 8 + f;
      const diff = squareControl.differential[idx] || 0;
      const wCount = squareControl.white?.[idx] || 0;
      const bCount = squareControl.black?.[idx] || 0;

      const fill = getHeatmapColor(diff, wCount, bCount);
      if (fill === 'transparent') continue;

      const col = orientation === 'white' ? f : 7 - f;
      const row = orientation === 'white' ? 7 - r : r;
      const x = col * 100;
      const y = row * 100;

      rects.push(
        <rect
          key={`heatmap-sq-${r}-${f}`}
          data-testid={`heatmap-rect-${idx}`}
          x={x}
          y={y}
          width={100}
          height={100}
          fill={fill}
        />
      );
    }
  }

  return (
    <svg
      viewBox="0 0 800 800"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-label="Square Control Heatmap"
    >
      {rects}
    </svg>
  );
};
