/**
 * src/components/DominoExplorer/DominoExplorer.tsx
 * Domino Effect Explorer container coordinating candidate move lines,
 * branching scenario trees, 4-stage causal cascades, and interactive variation scrubbers.
 */

import React, { useMemo, useState } from 'react';
import { Chess, Move } from 'chess.js';
import { GameMode } from '../../types/chess';
import { CandidateMoveEvaluation, ScenarioTreeNode, DominoCausalStep } from '../../types/engine';
import { TreeNode } from './TreeNode';
import { CausalChainView } from './CausalChainView';
import { PlyScrubber, VariationPly } from './PlyScrubber';
import { GitBranch, ListTree, Sparkles, Zap } from 'lucide-react';
import { CLASSIFICATION_COLORS } from '../Overlays/SvgOverlay';

export interface DominoExplorerProps {
  activeMode: GameMode;
  candidateMoves: CandidateMoveEvaluation[];
  selectedCandidateSan: string | null;
  onSelectCandidate: (san: string | null) => void;
  activeScenarioTree?: ScenarioTreeNode;
  activeDominoChain?: DominoCausalStep[];
  activePreviewFen: string | null;
  onPreviewPly: (fen: string | null) => void;
  onSwitchMode?: (mode: GameMode) => void;
  /** Live position from which the analysed candidate lines branch. */
  baseFen?: string;
  className?: string;
}

/**
 * Applies a principal-variation move expressed in SAN ("Nf3") or UCI ("g1f3")
 * to the supplied replay position. Returns null when the move is not playable.
 */
export function applyVariationMove(chess: Chess, rawMove: string): Move | null {
  try {
    if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(rawMove)) {
      return chess.move({
        from: rawMove.slice(0, 2),
        to: rawMove.slice(2, 4),
        promotion: rawMove.length > 4 ? rawMove[4].toLowerCase() : undefined,
      } as { from: string; to: string; promotion?: string });
    }
    return chess.move(rawMove);
  } catch {
    return null;
  }
}

export const DominoExplorer: React.FC<DominoExplorerProps> = ({
  activeMode,
  candidateMoves,
  selectedCandidateSan,
  onSelectCandidate,
  activeScenarioTree,
  activeDominoChain,
  activePreviewFen,
  onPreviewPly,
  onSwitchMode,
  baseFen,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'tree' | 'causal'>('causal');

  // Candidate line currently under exploration (falls back to the top engine line)
  const selectedCandidate =
    candidateMoves.find((c) => c.san === selectedCandidateSan) || candidateMoves[0];
  const pvMoves = useMemo(() => selectedCandidate?.pv ?? [], [selectedCandidate]);

  /**
   * Replays the principal variation from the live position so each scrubber step
   * maps to a real, previewable board state. Without a base position only step
   * labels can be produced (previews are then unavailable).
   */
  const variationPlies: VariationPly[] = useMemo(() => {
    const labelsOnly = () => pvMoves.map((san, idx) => ({ ply: idx + 1, san, fen: '' }));
    if (pvMoves.length === 0) return [];
    if (!baseFen) return labelsOnly();

    let replay: Chess;
    try {
      replay = new Chess(baseFen);
    } catch {
      return labelsOnly();
    }

    const plies: VariationPly[] = [];
    for (let idx = 0; idx < pvMoves.length; idx++) {
      const applied = applyVariationMove(replay, pvMoves[idx]);
      if (!applied) break;
      plies.push({ ply: idx + 1, san: applied.san, fen: replay.fen() });
    }
    return plies;
  }, [pvMoves, baseFen]);

  /**
   * The step currently shown on the board, derived from the live preview so the
   * scrubber can never disagree with what the board displays. The preview state
   * is the single source of truth: it is also driven by tree-node hover/click.
   */
  const activePlyIndex = useMemo(() => {
    if (!activePreviewFen) return null;
    const matched = variationPlies.findIndex((ply) => ply.fen !== '' && ply.fen === activePreviewFen);
    return matched >= 0 ? matched : null;
  }, [activePreviewFen, variationPlies]);

  const handleSelectPly = (index: number | null) => {
    if (index === null) {
      onPreviewPly(null);
      return;
    }
    const target = variationPlies[index];
    onPreviewPly(target && target.fen ? target.fen : null);
  };

  // Normal Mode Dormant Banner
  if (activeMode === 'normal') {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-xl text-center shadow-lg ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
          <Zap className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Domino Analysis Dormant</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
          Domino effect calculations and step-by-step scenario trees are inactive in Normal Mode.
          Switch to Smart or Expert Mode to explore candidate lines and strategic domino cascades.
        </p>
        {onSwitchMode && (
          <button
            type="button"
            onClick={() => onSwitchMode('smart')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enable Smart Mode</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${className}`}
    >
      {/* Header & View Switcher */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-slate-200 tracking-wide">
            DOMINO EFFECT EXPLORER
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {activeMode}
          </span>
        </div>

        {/* View Toggle Tabs (Causal Chain vs Scenario Tree) */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('causal')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              viewMode === 'causal'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Causal Chain</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              viewMode === 'tree'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTree className="w-3 h-3" />
            <span>Scenario Tree</span>
          </button>
        </div>
      </div>

      {/* Responsive Candidate Move Selector Deck */}
      {candidateMoves.length > 0 && (
        <div className="p-2.5 border-b border-slate-800 bg-slate-800/30 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
              Candidate Moves ({candidateMoves.length})
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Select to view domino line
            </span>
          </div>

          {/* Scroll-snapping carousel container */}
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700 snap-x snap-mandatory touch-pan-x min-w-0">
            {candidateMoves.map((cand) => {
              const isSelected = (selectedCandidateSan ?? candidateMoves[0]?.san) === cand.san;
              const classColor = CLASSIFICATION_COLORS[cand.classification] || '#38bdf8';
              const pointAdvantage = (cand.centipawns / 100).toFixed(1);
              const pointDisplay = cand.centipawns >= 0 ? `+${pointAdvantage} Pts` : `${pointAdvantage} Pts`;

              return (
                <button
                  key={cand.san}
                  type="button"
                  onClick={() => onSelectCandidate(cand.san)}
                  className={`snap-start shrink-0 min-w-[130px] sm:min-w-[150px] p-2 rounded-lg text-left transition-all border select-none flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800/95 text-slate-100 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-800/50 hover:bg-slate-800/80 text-slate-300 border-slate-700/70'
                  }`}
                >
                  {/* Top row: SAN + Dot */}
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono font-bold text-sm text-slate-100">
                      {cand.san}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: classColor }}
                      title={cand.classification}
                    />
                  </div>

                  {/* Bottom row: Score + Classification */}
                  <div className="flex items-center justify-between w-full text-[10px]">
                    <span className="font-mono font-semibold text-slate-300">
                      {pointDisplay}
                    </span>
                    <span className="capitalize text-slate-400 font-medium truncate max-w-[70px]">
                      {cand.classification}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="p-3 overflow-y-auto max-h-[380px] space-y-3">
        {viewMode === 'causal' ? (
          <CausalChainView steps={activeDominoChain || []} />
        ) : (
          <div className="space-y-2">
            {activeScenarioTree ? (
              <TreeNode
                node={activeScenarioTree}
                activePreviewFen={activePreviewFen}
                onPreviewPly={onPreviewPly}
              />
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                Scenario tree computation in progress...
              </div>
            )}
          </div>
        )}

        {/* Variation Scrubber */}
        {variationPlies.length > 0 && (
          <PlyScrubber
            plies={variationPlies}
            activePlyIndex={activePlyIndex}
            onSelectPly={handleSelectPly}
          />
        )}
      </div>
    </div>
  );
};
