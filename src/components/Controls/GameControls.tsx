/**
 * src/components/Controls/GameControls.tsx
 * Game controls toolbar (Flip, Reset, Undo, Sound, Heatmap, Candidate Arrows)
 * with engine operational status indicator.
 */

import React from 'react';
import {
  RotateCw,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  Flame,
  Compass,
  Activity,
} from 'lucide-react';

export interface GameControlsProps {
  onFlipBoard: () => void;
  onResetGame: () => void;
  onUndoMove: () => void;
  canUndo: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showArrows: boolean;
  onToggleArrows: () => void;
  engineStatus?: 'stockfish' | 'minimax' | 'dormant';
  isEvaluating?: boolean;
  className?: string;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onFlipBoard,
  onResetGame,
  onUndoMove,
  canUndo,
  soundEnabled,
  onToggleSound,
  showHeatmap,
  onToggleHeatmap,
  showArrows,
  onToggleArrows,
  engineStatus = 'dormant',
  isEvaluating = false,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
          CONTROLS
        </span>

        {/* Engine Status Badge (Layman Ready Status + Engine Core) */}
        <div
          title={
            isEvaluating
              ? 'Engine Status: Calculating best lines & capture follow-through...'
              : engineStatus === 'stockfish'
              ? 'Engine Status: Ready (Stockfish Grandmaster Core)'
              : engineStatus === 'minimax'
              ? 'Engine Status: Ready (Positional Score Table Engine)'
              : 'Engine Status: Dormant'
          }
          className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700"
        >
          <Activity
            className={`w-3 h-3 ${
              isEvaluating
                ? 'text-amber-400 animate-spin'
                : engineStatus === 'stockfish'
                ? 'text-emerald-400'
                : engineStatus === 'minimax'
                ? 'text-blue-400'
                : 'text-slate-500'
            }`}
          />
          {engineStatus !== 'dormant' && (
            <>
              <span className="text-emerald-400 font-semibold">Engine Status: Ready</span>
              <span className="text-slate-500 text-[9px]">•</span>
            </>
          )}
          <span className="text-slate-300">
            {engineStatus === 'stockfish'
              ? 'Stockfish WASM'
              : engineStatus === 'minimax'
              ? 'Minimax Fallback'
              : 'Engine Dormant'}
          </span>
        </div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {/* Flip Board */}
        <button
          type="button"
          onClick={onFlipBoard}
          title="Flip Board Orientation"
          aria-label="Flip Board"
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all text-center"
        >
          <RotateCw className="w-4 h-4 mb-1 text-slate-300" />
          <span className="text-[10px] font-semibold">Flip</span>
        </button>

        {/* Undo Move */}
        <button
          type="button"
          onClick={onUndoMove}
          disabled={!canUndo}
          title="Undo Last Move"
          aria-label="Undo Move"
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-800 border border-slate-700/80 transition-all text-center"
        >
          <Undo2 className="w-4 h-4 mb-1 text-slate-300" />
          <span className="text-[10px] font-semibold">Undo</span>
        </button>

        {/* Reset Game */}
        <button
          type="button"
          onClick={onResetGame}
          title="Reset to Starting Position"
          aria-label="Reset Game"
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all text-center"
        >
          <RotateCcw className="w-4 h-4 mb-1 text-slate-300" />
          <span className="text-[10px] font-semibold">Reset</span>
        </button>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          aria-label="Toggle Sound"
          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center ${
            soundEnabled
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-slate-800/90 text-slate-400 border-slate-700/80'
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 mb-1 text-amber-400" />
          ) : (
            <VolumeX className="w-4 h-4 mb-1 text-slate-400" />
          )}
          <span className="text-[10px] font-semibold">Sound</span>
        </button>

        {/* Heatmap Toggle */}
        <button
          type="button"
          onClick={onToggleHeatmap}
          title={showHeatmap ? 'Hide Square Control Heatmap' : 'Show Square Control Heatmap'}
          aria-label="Toggle Heatmap"
          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center ${
            showHeatmap
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : 'bg-slate-800/90 text-slate-400 border-slate-700/80'
          }`}
        >
          <Flame className={`w-4 h-4 mb-1 ${showHeatmap ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="text-[10px] font-semibold">Heatmap</span>
        </button>

        {/* Candidate Arrows Toggle */}
        <button
          type="button"
          onClick={onToggleArrows}
          title={showArrows ? 'Hide Candidate Arrows' : 'Show Candidate Arrows'}
          aria-label="Toggle Candidate Arrows"
          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center ${
            showArrows
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800/90 text-slate-400 border-slate-700/80'
          }`}
        >
          <Compass className={`w-4 h-4 mb-1 ${showArrows ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="text-[10px] font-semibold">Arrows</span>
        </button>
      </div>
    </div>
  );
};
