/**
 * src/components/Chessboard/Square.tsx
 * Individual board square with light/dark styling (#f0d9b5, #b58863),
 * boundary coordinate labels ('a'-'h', '1'-'8'), and move target indicators.
 */

import React from 'react';
import { Square as ChessSquare } from '../../types/chess';

export interface SquareProps {
  square: ChessSquare;
  isDark: boolean;
  isSelected?: boolean;
  isLastMove?: boolean;
  isLegalTarget?: boolean;
  isCaptureTarget?: boolean;
  isCheck?: boolean;
  showRankLabel?: string;
  showFileLabel?: string;
  children?: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Square: React.FC<SquareProps> = ({
  square,
  isDark,
  isSelected = false,
  isLastMove = false,
  isLegalTarget = false,
  isCaptureTarget = false,
  isCheck = false,
  showRankLabel,
  showFileLabel,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
}) => {
  // Base square colors
  const baseBg = isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]';
  const labelColor = isDark ? 'text-[#f0d9b5]' : 'text-[#b58863]';

  return (
    <div
      data-square={square}
      data-selected={isSelected ? 'true' : undefined}
      data-legal-target={isLegalTarget ? 'true' : undefined}
      className={`relative w-full h-full select-none flex items-center justify-center ${baseBg} transition-colors duration-150`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      style={{ touchAction: 'none' }}
    >
      {/* Selected Square Highlight */}
      {isSelected && (
        <div
          className="absolute inset-0 bg-amber-400/45 ring-2 ring-amber-400/80 z-20 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Last Move Origin / Destination Highlight */}
      {isLastMove && !isSelected && (
        <div
          className="absolute inset-0 bg-yellow-300/35 pointer-events-none z-10"
          aria-hidden="true"
        />
      )}

      {/* King Check Red Glow Accent */}
      {isCheck && (
        <div
          className="absolute inset-0 bg-red-600/35 ring-2 ring-red-500 animate-pulse pointer-events-none z-20"
          aria-hidden="true"
        />
      )}

      {/* Edge Coordinate Labels */}
      {showRankLabel && (
        <span
          className={`absolute top-0.5 left-1 text-[10px] sm:text-xs font-semibold leading-none pointer-events-none select-none ${labelColor}`}
        >
          {showRankLabel}
        </span>
      )}
      {showFileLabel && (
        <span
          className={`absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-semibold leading-none pointer-events-none select-none ${labelColor}`}
        >
          {showFileLabel}
        </span>
      )}

      {/* Legal Move Indicators */}
      {isLegalTarget && !isCaptureTarget && (
        <div
          className="absolute w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-slate-900/30 hover:bg-slate-900/40 pointer-events-none z-20"
          aria-hidden="true"
        />
      )}
      {isCaptureTarget && (
        <div
          className="absolute inset-1 sm:inset-1.5 rounded-full border-4 border-slate-900/30 pointer-events-none z-20"
          aria-hidden="true"
        />
      )}

      {/* Piece Render Slot */}
      {children}
    </div>
  );
};
