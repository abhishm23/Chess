/**
 * src/components/DominoExplorer/CausalChainView.tsx
 * 4-stage causal domino progression viewer:
 * [CAUSE -> TRIGGER -> CRISIS -> CONSEQUENCE] with plain-English GM explanations.
 */

import React from 'react';
import { DominoCausalStep } from '../../types/engine';
import { Sparkles, Zap, AlertTriangle, Crosshair, Tag, ArrowDown, Flame } from 'lucide-react';

export interface CausalChainViewProps {
  steps: DominoCausalStep[];
  onSelectStep?: (step: DominoCausalStep) => void;
  className?: string;
}

const STAGE_CONFIG: Record<
  DominoCausalStep['stage'],
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; border: string; bg: string }
> = {
  cause: {
    label: 'CAUSE',
    icon: Sparkles,
    color: 'text-cyan-300',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/15',
  },
  trigger: {
    label: 'TRIGGER',
    icon: Zap,
    color: 'text-amber-300',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/15',
  },
  crisis: {
    label: 'CRISIS',
    icon: AlertTriangle,
    color: 'text-orange-300',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/15',
  },
  consequence: {
    label: 'CONSEQUENCE',
    icon: Crosshair,
    color: 'text-red-300',
    border: 'border-red-500/40',
    bg: 'bg-red-500/15',
  },
};

export const CausalChainView: React.FC<CausalChainViewProps> = ({
  steps,
  onSelectStep,
  className = '',
}) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 italic">
        No causal domino chain identified for this position.
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {steps.map((step, idx) => {
        const config = STAGE_CONFIG[step.stage] || STAGE_CONFIG.cause;
        const Icon = config.icon;
        const isWhite = step.player === 'white';
        const isCrisis = step.stage === 'crisis';
        const nextStep = steps[idx + 1];
        const isTriggerToCrisis = step.stage === 'trigger' && nextStep?.stage === 'crisis';

        return (
          <React.Fragment key={`causal-step-${step.ply}-${step.stage}-${idx}`}>
            {/* Causal Step Card */}
            <div
              onClick={() => onSelectStep?.(step)}
              className={`p-3 rounded-lg bg-slate-800/60 border ${config.border} ${
                isCrisis ? 'border-l-4 border-l-orange-500 bg-orange-950/10' : ''
              } shadow-sm flex flex-col gap-1.5 transition-all hover:bg-slate-800 cursor-pointer`}
            >
              {/* Header: Stage Badge + Player & Move SAN */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>
                      STEP {step.ply}: {config.label}
                    </span>
                  </span>

                  {/* Move SAN */}
                  <span className="font-mono font-bold text-xs text-slate-100">
                    {step.moveSan}
                  </span>

                  {/* Player Tag */}
                  <span className="text-[10px] text-slate-400">
                    ({isWhite ? 'White' : 'Black'})
                  </span>
                </div>

                {/* Tactical Tag if present */}
                {step.tacticalTag && (
                  <span className="flex items-center gap-1 text-[9px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded">
                    <Tag className="w-2.5 h-2.5" />
                    <span>{step.tacticalTag.replace('_', ' ')}</span>
                  </span>
                )}
              </div>

              {/* Natural language domino explanation */}
              <p className="text-xs text-slate-300 leading-relaxed pl-1">
                {step.description}
              </p>

              {/* Affected squares */}
              {step.squareChanges && step.squareChanges.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-1">
                  <span className="font-semibold">Key squares:</span>
                  <span className="font-mono text-amber-300/80">
                    {step.squareChanges.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Inter-Step Connector & Visual Flow */}
            {idx < steps.length - 1 && (
              <div className="flex flex-col items-center py-1 select-none">
                {isTriggerToCrisis ? (
                  /* Highlighted Tipping Point between Trigger and Crisis */
                  <div className="flex flex-col items-center w-full my-1">
                    <div className="w-0.5 h-2 bg-gradient-to-b from-amber-500/60 to-orange-500/60" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/25 to-red-500/20 border border-orange-500/50 shadow-sm animate-pulse">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-300">
                        Tipping Point: Escalates to Crisis ⚡
                      </span>
                      <ArrowDown className="w-3 h-3 text-orange-400" />
                    </div>
                    <div className="w-0.5 h-2 bg-gradient-to-b from-orange-500/60 to-orange-500/80" />
                  </div>
                ) : (
                  /* Standard Step Connector Line */
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-2.5 bg-slate-700" />
                    <ArrowDown className="w-3 h-3 text-slate-600 -mt-1" />
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
