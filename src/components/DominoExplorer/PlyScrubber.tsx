/**
 * src/components/DominoExplorer/PlyScrubber.tsx
 * Interactive variation stepper with ply pills and navigation buttons.
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
} from 'lucide-react';

export interface VariationPly {
  ply: number;
  san: string;
  fen: string;
}

export interface PlyScrubberProps {
  plies: VariationPly[];
  activePlyIndex: number | null; // null = live board, 0..plies.length - 1 = previewing ply
  onSelectPly: (index: number | null) => void;
  className?: string;
}

export const PlyScrubber: React.FC<PlyScrubberProps> = ({
  plies,
  activePlyIndex,
  onSelectPly,
  className = '',
}) => {
  if (plies.length === 0) return null;

  const total = plies.length;
  const isPreviewing = activePlyIndex !== null;

  return (
    <div
      className={`flex flex-col gap-2 p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-lg ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300" title="Variation Line Timeline (Best Line Calculation)">
          Variation Line Timeline
        </span>
        {isPreviewing && (
          <button
            type="button"
            onClick={() => onSelectPly(null)}
            className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Return to Live</span>
          </button>
        )}
      </div>

      {/* Clickable Ply Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
        {plies.map((p, idx) => {
          const isActive = activePlyIndex === idx;
          return (
            <button
              key={`${p.ply}-${p.san}-${idx}`}
              type="button"
              onClick={() => onSelectPly(isActive ? null : idx)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 select-none ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm ring-1 ring-amber-400'
                  : 'bg-slate-700/70 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {p.san}
            </button>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-700/40">
        <button
          type="button"
          onClick={() => onSelectPly(0)}
          disabled={activePlyIndex === 0}
          title="First Step"
          aria-label="First Step"
          className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-700"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            const nextIdx = activePlyIndex === null ? 0 : Math.max(0, activePlyIndex - 1);
            onSelectPly(nextIdx);
          }}
          disabled={activePlyIndex === 0}
          title="Previous Step"
          aria-label="Previous Step"
          className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="text-[11px] font-mono text-slate-400 px-2" title="Steps forward in calculated variation">
          {activePlyIndex !== null ? `Step ${activePlyIndex + 1} of ${total} Forward` : 'Live Game'}
        </span>

        <button
          type="button"
          onClick={() => {
            const nextIdx = activePlyIndex === null ? 0 : Math.min(total - 1, activePlyIndex + 1);
            onSelectPly(nextIdx);
          }}
          disabled={activePlyIndex === total - 1}
          title="Next Step"
          aria-label="Next Step"
          className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-700"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onSelectPly(total - 1)}
          disabled={activePlyIndex === total - 1}
          title="Last Step"
          aria-label="Last Step"
          className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-700"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
