/**
 * src/components/CoachPanel/CoachPanel.tsx
 * Plain-English grandmaster coach commentary panel adapting advice
 * across Beginner, Intermediate, and Expert personas.
 */

import React, { useState } from 'react';
import { MoveClassification } from '../../types/engine';
import { Bot, Sparkles, Tag, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

export type CoachingPersona = 'beginner' | 'intermediate' | 'expert';

export interface CoachPanelProps {
  coachAdvice: {
    beginner: string;
    intermediate: string;
    expert: string;
  };
  classification?: MoveClassification | null;
  tacticalMotifs?: string[];
  isCheck?: boolean;
  isCheckmate?: boolean;
  isDraw?: boolean;
  drawReason?: string;
  defaultPersona?: CoachingPersona;
  className?: string;
}

const CLASSIFICATION_BADGES: Record<
  MoveClassification,
  { label: string; badgeClass: string; symbol: string }
> = {
  brilliant: { label: 'Brilliant Move', badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', symbol: '!!' },
  best: { label: 'Best Move', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', symbol: '!' },
  great: { label: 'Great Move', badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40', symbol: '!' },
  good: { label: 'Good Move', badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40', symbol: '' },
  inaccuracy: { label: 'Inaccuracy', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40', symbol: '?!' },
  mistake: { label: 'Mistake', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40', symbol: '?' },
  blunder: { label: 'Blunder', badgeClass: 'bg-red-500/20 text-red-400 border-red-500/40', symbol: '??' },
};

export const CoachPanel: React.FC<CoachPanelProps> = ({
  coachAdvice,
  classification,
  tacticalMotifs = [],
  isCheck = false,
  isCheckmate = false,
  isDraw = false,
  drawReason,
  defaultPersona = 'beginner',
  className = '',
}) => {
  const [selectedPersona, setSelectedPersona] = useState<CoachingPersona>(defaultPersona);

  const activeAdvice = coachAdvice[selectedPersona] || coachAdvice.beginner || 'Analyzing position...';
  const classBadge = classification ? CLASSIFICATION_BADGES[classification] : null;

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${className}`}
    >
      {/* Header & Persona Selector */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-slate-200 tracking-wide">GRANDMASTER COACH</span>
        </div>

        {/* Persona Tabs */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
          {(['beginner', 'intermediate', 'expert'] as const).map((persona) => (
            <button
              key={persona}
              type="button"
              onClick={() => setSelectedPersona(persona)}
              className={`px-2 py-0.5 rounded-md font-medium capitalize text-[11px] transition-all ${
                selectedPersona === persona
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {persona}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-3 space-y-2.5">
        {/* Game Status Alert Banners */}
        {isCheckmate && (
          <div className="flex items-center gap-2 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-xs font-bold">
            <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
            <span>Checkmate! Game over.</span>
          </div>
        )}

        {isCheck && !isCheckmate && (
          <div className="flex items-center gap-2 p-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Check! King is under attack.</span>
          </div>
        )}

        {isDraw && (
          <div className="flex items-center gap-2 p-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Draw ({drawReason || 'stalemate'}).</span>
          </div>
        )}

        {/* Classification & Tactical Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {classBadge && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${classBadge.badgeClass}`}
            >
              <span>{classBadge.label}</span>
              {classBadge.symbol && <span className="font-mono">[{classBadge.symbol}]</span>}
            </span>
          )}

          {tacticalMotifs.map((motif) => (
            <span
              key={motif}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>{motif.replace('_', ' ')}</span>
            </span>
          ))}
        </div>

        {/* Speech Bubble with Plain-English Advice */}
        <div className="relative p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-1 text-xs text-slate-200 leading-relaxed">
              <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                {selectedPersona} Persona Advice
              </div>
              <p>{activeAdvice}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
