/**
 * src/components/Controls/ModeSelector.tsx
 * Multi-tier gameplay mode switcher (Normal, Smart, Expert)
 * allowing seamless mid-game switching without state loss.
 */

import React from 'react';
import { GameMode } from '../../types/chess';
import { Swords, Sparkles, Brain } from 'lucide-react';

export interface ModeSelectorProps {
  activeMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  className?: string;
}

const MODES: {
  id: GameMode;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'normal',
    label: 'Normal',
    sublabel: 'Standard FIDE play',
    icon: Swords,
  },
  {
    id: 'smart',
    label: 'Smart',
    sublabel: 'Guided domino coaching',
    icon: Sparkles,
  },
  {
    id: 'expert',
    label: 'Expert',
    sublabel: 'GM deep analysis trees',
    icon: Brain,
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  onSelectMode,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col gap-1.5 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-lg ${className}`}
    >
      <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-1">
        GAMEPLAY MODE
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = activeMode === m.id;

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMode(m.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center select-none ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md ring-1 ring-amber-400'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="w-4 h-4 mb-1 shrink-0" />
              <span className="text-xs font-bold leading-tight">{m.label}</span>
              <span
                className={`text-[9px] mt-0.5 leading-tight line-clamp-1 ${
                  isActive ? 'text-slate-900 font-medium' : 'text-slate-400'
                }`}
              >
                {m.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
