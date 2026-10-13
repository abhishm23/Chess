/**
 * src/components/Chessboard/MoveHistory.tsx
 * Move history panel displaying paired White/Black turns in SAN notation,
 * active ply highlighting, and time-travel navigation controls.
 */

import React, { useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
} from 'lucide-react';

export interface MoveHistoryProps {
  history: string[]; // List of SAN moves: [ply 1 (W), ply 2 (B), ply 3 (W)...]
  activePly: number; // 0 = start, 1..history.length
  onJumpToPly: (plyIndex: number) => void;
  currentFen?: string;
  className?: string;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  history,
  activePly,
  onJumpToPly,
  currentFen,
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalPlies = history.length;
  const isLive = activePly === totalPlies;

  // Pair history into turns: [turnNumber, whiteMoveSan, blackMoveSan | null]
  const turnPairs: { turn: number; white: { san: string; ply: number }; black?: { san: string; ply: number } }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const turn = Math.floor(i / 2) + 1;
    turnPairs.push({
      turn,
      white: { san: history[i], ply: i + 1 },
      black: history[i + 1] ? { san: history[i + 1], ply: i + 2 } : undefined,
    });
  }

  // Auto-scroll to active ply or bottom on move
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active-ply="true"]');
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (isLive) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [activePly, history.length, isLive]);

  // Keyboard navigation for history scrubbing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onJumpToPly(Math.max(0, activePly - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onJumpToPly(Math.min(totalPlies, activePly + 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        onJumpToPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onJumpToPly(totalPlies);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePly, totalPlies, onJumpToPly]);

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg ${className}`}
    >
      {/* Header & Status (SAN -> Game Moves, Plies -> Turns/Moves) */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 tracking-wide" title="Game Moves (Move List)">
            GAME MOVES (MOVE LIST)
          </span>
          <span
            className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full font-mono"
            title={`${totalPlies} total half-moves played (${Math.ceil(totalPlies / 2)} turns)`}
          >
            {totalPlies} moves
          </span>
        </div>
        {!isLive && (
          <button
            type="button"
            onClick={() => onJumpToPly(totalPlies)}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Return to Live</span>
          </button>
        )}
      </div>

      {/* Paired Moves Table */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto max-h-48 sm:max-h-60 p-2 space-y-0.5 text-xs font-mono"
      >
        {turnPairs.length === 0 ? (
          <div className="text-center text-slate-500 py-6 text-xs italic">
            No moves played yet.
          </div>
        ) : (
          turnPairs.map((pair) => {
            const isWhiteActive = activePly === pair.white.ply;
            const isBlackActive = pair.black && activePly === pair.black.ply;

            return (
              <div
                key={`turn-${pair.turn}`}
                className="grid grid-cols-12 items-center py-0.5 px-1 rounded-sm hover:bg-slate-800/50 transition-colors"
              >
                {/* Turn Number */}
                <span className="col-span-2 text-slate-500 font-semibold select-none">
                  {pair.turn}.
                </span>

                {/* White Move */}
                <button
                  type="button"
                  data-active-ply={isWhiteActive ? 'true' : 'false'}
                  onClick={() => onJumpToPly(pair.white.ply)}
                  className={`col-span-5 text-left px-2 py-1 rounded transition-all select-none ${
                    isWhiteActive
                      ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-400/60 shadow-xs'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  {pair.white.san}
                </button>

                {/* Black Move */}
                {pair.black ? (
                  <button
                    type="button"
                    data-active-ply={isBlackActive ? 'true' : 'false'}
                    onClick={() => onJumpToPly(pair.black!.ply)}
                    className={`col-span-5 text-left px-2 py-1 rounded transition-all select-none ${
                      isBlackActive
                        ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-400/60 shadow-xs'
                        : 'text-slate-200 hover:bg-slate-700/60'
                    }`}
                  >
                    {pair.black.san}
                  </button>
                ) : (
                  <div className="col-span-5" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Scrubbing Navigation Buttons */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-800/40 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onJumpToPly(0)}
          disabled={activePly === 0}
          title="Jump to Start (Home)"
          aria-label="Jump to Start"
          className="flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onJumpToPly(Math.max(0, activePly - 1))}
          disabled={activePly === 0}
          title="Previous Move (Left Arrow)"
          aria-label="Previous Move"
          className="flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onJumpToPly(Math.min(totalPlies, activePly + 1))}
          disabled={activePly >= totalPlies}
          title="Next Move (Right Arrow)"
          aria-label="Next Move"
          className="flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onJumpToPly(totalPlies)}
          disabled={activePly >= totalPlies}
          title="Jump to Current Position (End)"
          aria-label="Jump to Current Position"
          className="flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsible Board Setup Code (FEN) - Collapsed by Default */}
      <div className="px-2.5 py-1.5 bg-slate-900/90 border-t border-slate-800 text-[10px]">
        <details className="group">
          <summary className="cursor-pointer font-semibold text-slate-300 select-none hover:text-amber-300">
            Board Setup Code
          </summary>
          <div className="mt-1 font-mono text-[10px] break-all select-all text-slate-400 p-1.5 rounded bg-slate-950/80 border border-slate-800">
            {currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
          </div>
        </details>
      </div>
    </div>
  );
};
