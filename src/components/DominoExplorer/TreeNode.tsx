/**
 * src/components/DominoExplorer/TreeNode.tsx
 * Branching scenario tree node component with centipawn/WP badges,
 * tactical tags, and live board variation preview on hover/click.
 */

import React, { useState } from 'react';
import { ScenarioTreeNode } from '../../types/engine';
import { ChevronDown, ChevronRight, Sparkles, Tag } from 'lucide-react';

export interface TreeNodeProps {
  node: ScenarioTreeNode;
  activePreviewFen: string | null;
  onPreviewPly: (fen: string | null) => void;
  onSelectNode?: (node: ScenarioTreeNode) => void;
  depth?: number;
}

export const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  activePreviewFen,
  onPreviewPly,
  onSelectNode,
  depth = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isSelected = activePreviewFen === node.fen;
  const hasChildren = node.children && node.children.length > 0;

  // Format evaluation (centipawns to pawn score)
  const cpScore = (node.centipawns / 100).toFixed(2);
  const cpDisplay = node.centipawns >= 0 ? `+${cpScore}` : cpScore;
  const isPositive = node.centipawns >= 0;

  return (
    <div className={`flex flex-col ${depth > 0 ? 'ml-3 sm:ml-4 border-l-2 border-slate-700/60 pl-2' : ''}`}>
      {/* Node Row Header */}
      <div
        className={`group flex items-center gap-2 p-1.5 rounded-lg text-xs transition-all cursor-pointer select-none ${
          isSelected
            ? 'bg-amber-500/20 border border-amber-400/60 text-amber-300 font-semibold'
            : 'bg-slate-800/40 hover:bg-slate-800 border border-transparent text-slate-200'
        }`}
        onMouseEnter={() => onPreviewPly(node.fen)}
        onMouseLeave={() => {
          if (!isSelected) {
            onPreviewPly(null);
          }
        }}
        onClick={() => {
          if (isSelected) {
            onPreviewPly(null);
          } else {
            onPreviewPly(node.fen);
            onSelectNode?.(node);
          }
        }}
      >
        {/* Branch Expand/Collapse Toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 text-slate-400 hover:text-slate-200"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-3.5 h-3.5" />
        )}

        {/* Move SAN */}
        <span className="font-mono font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
          {node.san || 'Start'}
        </span>

        {/* Point Advantage Badge (No raw Centipawns) */}
        <span
          title={`Point Advantage: ${cpDisplay} Pawns`}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
            isPositive
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {cpDisplay} Points
        </span>

        {/* Win Probability Badge */}
        <span
          title="Estimated Win Chance"
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30"
        >
          {node.winProbability.toFixed(1)}% Win
        </span>

        {/* Tactical Motif Tags */}
        {node.tacticalTags && node.tacticalTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-hidden">
            {node.tacticalTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30"
              >
                <Tag className="w-2.5 h-2.5" />
                <span>{tag.replace('_', ' ')}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Explanation text (shown when selected or hovered) */}
      {node.dominoExplanation && (
        <div className="text-[11px] text-slate-400 pl-6 pr-2 py-0.5 italic">
          {node.dominoExplanation}
        </div>
      )}

      {/* Children Branches */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-1 mt-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              activePreviewFen={activePreviewFen}
              onPreviewPly={onPreviewPly}
              onSelectNode={onSelectNode}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
