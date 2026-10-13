/**
 * src/components/CoachPanel/EvalBar.tsx
 * Dynamic win probability / centipawn evaluation gauge
 * with smooth CSS transitions, high-contrast markers, and forced mate indicators.
 */

import React from 'react';
import { BoardOrientation } from '../../types/ui';

export interface EvalBarProps {
  centipawns: number;
  winProbability: number; // 0.0 to 100.0 (from White perspective)
  mateScore?: number | null; // e.g. +2 for Mate in 2, -1 for Mated in 1
  orientation?: BoardOrientation;
  className?: string;
  isVertical?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  centipawns,
  winProbability,
  mateScore,
  orientation = 'white',
  className = '',
  isVertical = true,
}) => {
  // Clamp win probability between 2% and 98% for visual aesthetics
  const clampedWp = Math.max(2, Math.min(98, winProbability));

  // Determine White fill percentage based on board orientation
  // If White is at bottom (default): White bar is at bottom
  // If Black is at bottom: White bar is at top
  const whiteHeightPercent = orientation === 'white' ? clampedWp : 100 - clampedWp;

  // Format evaluation text
  let evalText: string;
  if (mateScore !== undefined && mateScore !== null) {
    evalText = mateScore > 0 ? `M${mateScore}` : `-M${Math.abs(mateScore)}`;
  } else {
    const pawns = (centipawns / 100).toFixed(1);
    evalText = centipawns > 0 ? `+${pawns}` : pawns === '-0.0' ? '0.0' : pawns;
  }

  // Determine which side is winning for text contrast
  const isWhiteWinning = centipawns >= 0;

  if (!isVertical) {
    // Horizontal Bar (for mobile viewports)
    return (
      <div
        className={`relative w-full h-5 rounded-md overflow-hidden bg-slate-800 border border-slate-700 flex shadow-inner ${className}`}
        title={`Point Advantage: ${evalText} Pawns (${isWhiteWinning ? 'White' : 'Black'} leading)`}
        aria-label={`Evaluation Gauge: ${evalText} (${winProbability.toFixed(0)}% White win probability)`}
      >
        <div
          className="h-full bg-slate-200 transition-all duration-300 ease-out"
          style={{ width: `${clampedWp}%` }}
        />
        <div
          className="h-full bg-slate-900 transition-all duration-300 ease-out"
          style={{ width: `${100 - clampedWp}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono font-bold">
          <span className={clampedWp > 50 ? 'text-slate-900' : 'text-slate-100'}>
            {evalText}
          </span>
          <span className={clampedWp > 50 ? 'text-slate-900' : 'text-slate-400'}>
            {winProbability.toFixed(0)}% W
          </span>
        </div>
      </div>
    );
  }

  // Vertical Bar (Desktop / Tablet viewports adjacent to chessboard)
  return (
    <div
      className={`relative w-7 h-full min-h-[360px] rounded-lg overflow-hidden bg-slate-900 border-2 border-slate-700 flex flex-col justify-end shadow-xl select-none ${className}`}
      title={`Point Advantage: ${evalText} Pawns (${isWhiteWinning ? 'White' : 'Black'} leading)`}
      aria-label={`Evaluation Gauge: ${evalText} (${winProbability.toFixed(0)}% White win probability)`}
    >
      {/* Black Section (Top in White orientation) */}
      <div
        className="w-full bg-slate-900 transition-all duration-300 ease-out relative"
        style={{ height: `${100 - whiteHeightPercent}%` }}
      >
        {!isWhiteWinning && (
          <span className="absolute top-2 inset-x-0 text-center text-[11px] font-mono font-bold text-slate-200 drop-shadow-sm">
            {evalText}
          </span>
        )}
      </div>

      {/* White Section (Bottom in White orientation) */}
      <div
        className="w-full bg-[#f0d9b5] transition-all duration-300 ease-out relative"
        style={{ height: `${whiteHeightPercent}%` }}
      >
        {isWhiteWinning && (
          <span className="absolute bottom-2 inset-x-0 text-center text-[11px] font-mono font-bold text-slate-900 drop-shadow-sm">
            {evalText}
          </span>
        )}
      </div>

      {/* Center 50% Equality Marker */}
      <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-amber-500/70 z-20 pointer-events-none" />
    </div>
  );
};
