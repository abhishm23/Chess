/**
 * src/components/Chessboard/PromotionModal.tsx
 * Pawn promotion modal selector (Queen, Knight, Rook, Bishop)
 * with keyboard shortcuts (Q, N, R, B, Escape).
 */

import React, { useEffect } from 'react';
import { Color, PieceSymbol } from '../../types/chess';
import { Piece } from './Piece';

export interface PromotionModalProps {
  color: Color;
  isOpen: boolean;
  onSelect: (piece: PieceSymbol) => void;
  onCancel: () => void;
}

interface PromotionOption {
  symbol: PieceSymbol;
  label: string;
  key: string;
  numKey: string;
}

const PROMOTION_OPTIONS: PromotionOption[] = [
  { symbol: 'q', label: 'Queen', key: 'q', numKey: '1' },
  { symbol: 'n', label: 'Knight', key: 'n', numKey: '2' },
  { symbol: 'r', label: 'Rook', key: 'r', numKey: '3' },
  { symbol: 'b', label: 'Bishop', key: 'b', numKey: '4' },
];

export const PromotionModal: React.FC<PromotionModalProps> = ({
  color,
  isOpen,
  onSelect,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      const match = PROMOTION_OPTIONS.find(
        (opt) => opt.key === key || opt.numKey === key
      );
      if (match) {
        e.preventDefault();
        onSelect(match.symbol);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSelect, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Pawn Promotion Selector"
      aria-modal="true"
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-4 max-w-xs w-full mx-4 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-base font-bold text-slate-100">Pawn Promotion</h3>
          <p className="text-xs text-slate-400">Choose a promotion piece (or press Q/N/R/B)</p>
        </div>

        <div className="grid grid-cols-4 gap-2 w-full pt-1">
          {PROMOTION_OPTIONS.map((opt) => (
            <button
              key={opt.symbol}
              type="button"
              onClick={() => onSelect(opt.symbol)}
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:border-amber-400/60 border border-slate-700 transition-all group focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              aria-label={`Promote to ${opt.label} (${opt.key.toUpperCase()})`}
            >
              <div className="w-12 h-12 flex items-center justify-center transition-transform group-hover:scale-110">
                <Piece type={opt.symbol} color={color} />
              </div>
              <span className="text-[11px] font-semibold text-slate-300 group-hover:text-amber-300 mt-1">
                {opt.label}
              </span>
              <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                [{opt.key.toUpperCase()}]
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors pt-1"
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
};
