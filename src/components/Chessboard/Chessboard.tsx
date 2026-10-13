/**
 * src/components/Chessboard/Chessboard.tsx
 * Unified 60fps PointerEvents drag-and-drop & click-to-move Chessboard
 * with hardware-accelerated floating piece overlay, board orientation flipping,
 * and pawn promotion handling.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Square as ChessSquare, Color, PieceSymbol } from '../../types/chess';
import { BoardOrientation } from '../../types/ui';
import { Square } from './Square';
import { Piece } from './Piece';
import { PromotionModal } from './PromotionModal';
import { soundSynthesizer } from '../../audio/soundSynthesizer';
import { Eye, RotateCcw } from 'lucide-react';

export interface ChessboardProps {
  fen: string;
  orientation?: BoardOrientation;
  isInteractive?: boolean;
  lastMove?: { from: ChessSquare; to: ChessSquare } | null;
  onMove?: (from: ChessSquare, to: ChessSquare, promotion?: PieceSymbol) => boolean;
  overlaySlot?: React.ReactNode;
  enableSound?: boolean;
  className?: string;
  isVariationPreview?: boolean;
  onReturnToLive?: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const DRAG_THRESHOLD = 4; // px

export const Chessboard: React.FC<ChessboardProps> = ({
  fen,
  orientation = 'white',
  isInteractive = true,
  lastMove,
  onMove,
  overlaySlot,
  enableSound = true,
  className = '',
  isVariationPreview = false,
  onReturnToLive,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const floatingPieceRef = useRef<HTMLDivElement>(null);

  // Selection & drag state
  const [selectedSquare, setSelectedSquare] = useState<ChessSquare | null>(null);
  const [draggingSquare, setDraggingSquare] = useState<ChessSquare | null>(null);
  const [dragPiece, setDragPiece] = useState<{ type: PieceSymbol; color: Color } | null>(null);

  // Promotion modal state
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: ChessSquare;
    to: ChessSquare;
    color: Color;
  } | null>(null);

  const dragPieceRef = useRef<{ type: PieceSymbol; color: Color } | null>(null);

  // Drag tracking refs (to avoid 60fps React re-renders)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDragActiveRef = useRef(false);
  const currentPointerIdRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Parse FEN into board piece map and validate legality via chess.js
  const chessInstance = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const pieceMap = useMemo(() => {
    const map = new Map<ChessSquare, { type: PieceSymbol; color: Color }>();
    const board = chessInstance.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) {
          map.set(p.square as ChessSquare, { type: p.type as PieceSymbol, color: p.color as Color });
        }
      }
    }
    return map;
  }, [chessInstance]);

  // Legal moves from currently selected square
  const legalTargetMoves = useMemo(() => {
    if (!selectedSquare || !isInteractive) return new Map<ChessSquare, boolean>(); // target -> isCapture
    const moves = chessInstance.moves({ square: selectedSquare, verbose: true });
    const targetMap = new Map<ChessSquare, boolean>();
    for (const m of moves) {
      targetMap.set(m.to as ChessSquare, !!m.captured);
    }
    return targetMap;
  }, [chessInstance, selectedSquare, isInteractive]);

  // King square in check
  const checkedKingSquare = useMemo<ChessSquare | null>(() => {
    if (!chessInstance.inCheck()) return null;
    const turn = chessInstance.turn();
    for (const [sq, piece] of pieceMap.entries()) {
      if (piece.type === 'k' && piece.color === turn) {
        return sq;
      }
    }
    return null;
  }, [chessInstance, pieceMap]);

  // Map 0..7 row, col to Square string based on orientation
  const getSquareAt = useCallback(
    (row: number, col: number): ChessSquare => {
      const f = orientation === 'white' ? col : 7 - col;
      const r = orientation === 'white' ? 7 - row : row;
      return `${FILES[f]}${RANKS[r]}` as ChessSquare;
    },
    [orientation]
  );

  // Execute move and trigger appropriate procedural sound
  const executeMove = useCallback(
    (from: ChessSquare, to: ChessSquare, promotion?: PieceSymbol): boolean => {
      if (!isInteractive) return false;

      // Determine sound effect type before move
      const targetPiece = pieceMap.get(to);
      const movingPiece = pieceMap.get(from);
      const isCastle =
        movingPiece?.type === 'k' &&
        Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2;
      const isCapture = !!targetPiece || (movingPiece?.type === 'p' && from[0] !== to[0]);

      let moveSuccessful = false;
      if (onMove) {
        moveSuccessful = onMove(from, to, promotion);
      } else {
        try {
          const res = chessInstance.move({ from, to, promotion });
          moveSuccessful = !!res;
        } catch {
          moveSuccessful = false;
        }
      }

      if (moveSuccessful && enableSound) {
        // Play appropriate procedural sound
        if (isCastle) {
          soundSynthesizer.playCastle();
        } else if (chessInstance.inCheck()) {
          soundSynthesizer.playCheck();
        } else if (isCapture) {
          soundSynthesizer.playCapture();
        } else {
          soundSynthesizer.playMove();
        }
      }

      // Clear selection and drag state
      setSelectedSquare(null);
      setDraggingSquare(null);
      setDragPiece(null);
      return moveSuccessful;
    },
    [isInteractive, pieceMap, onMove, chessInstance, enableSound]
  );

  // Pointer Down: Start tracking or select piece
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, square: ChessSquare) => {
    if (!isInteractive) return;

    // Left click only
    if (e.button !== 0) return;

    const piece = pieceMap.get(square);
    const turn = chessInstance.turn();

    // If a piece is already selected and clicked on a legal destination target
    if (selectedSquare && legalTargetMoves.has(square)) {
      const movingPiece = pieceMap.get(selectedSquare);
      const isPawn = movingPiece?.type === 'p';
      const isPromotion =
        isPawn &&
        ((movingPiece.color === 'w' && square.endsWith('8')) ||
          (movingPiece.color === 'b' && square.endsWith('1')));

      if (isPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square, color: movingPiece.color });
      } else {
        executeMove(selectedSquare, square);
      }
      return;
    }

    // Only allow initiating drag/selection on current player's piece
    if (!piece || piece.color !== turn) {
      setSelectedSquare(null);
      return;
    }

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    isDragActiveRef.current = false;
    currentPointerIdRef.current = e.pointerId;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignored if unsupported in mock
    }

    setDragPiece(piece);
    dragPieceRef.current = piece;
    setSelectedSquare(square);
  };

  // Click-to-move square click handler
  const handleSquareClick = useCallback(
    (square: ChessSquare) => {
      if (!isInteractive) return;
      if (isDragActiveRef.current) return;

      if (selectedSquare && legalTargetMoves.has(square)) {
        const movingPiece = pieceMap.get(selectedSquare);
        const isPawn = movingPiece?.type === 'p';
        const isPromotion =
          isPawn &&
          ((movingPiece.color === 'w' && square.endsWith('8')) ||
            (movingPiece.color === 'b' && square.endsWith('1')));

        if (isPromotion && movingPiece) {
          setPendingPromotion({ from: selectedSquare, to: square, color: movingPiece.color });
        } else {
          executeMove(selectedSquare, square);
        }
        return;
      }

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      const piece = pieceMap.get(square);
      const turn = chessInstance.turn();
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [isInteractive, selectedSquare, legalTargetMoves, pieceMap, chessInstance, executeMove]
  );

  // Pointer Move: Update hardware-accelerated floating drag preview
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, square: ChessSquare) => {
    if (!pointerStartRef.current || !dragPieceRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (!isDragActiveRef.current && dist > DRAG_THRESHOLD) {
      isDragActiveRef.current = true;
      setDraggingSquare(square);
    }

    if (isDragActiveRef.current && floatingPieceRef.current) {
      const clientX = e.clientX;
      const clientY = e.clientY;

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        if (floatingPieceRef.current && boardRef.current) {
          const rect = boardRef.current.getBoundingClientRect();
          const sqSize = rect.width / 8;
          floatingPieceRef.current.style.transform = `translate3d(${clientX - sqSize / 2}px, ${clientY - sqSize / 2}px, 0)`;
        }
      });
    }
  };

  // Pointer Up: Handle drop or click selection
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (currentPointerIdRef.current !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(currentPointerIdRef.current);
      } catch {
        // Ignored
      }
      currentPointerIdRef.current = null;
    }

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const wasDragging = isDragActiveRef.current;
    pointerStartRef.current = null;
    isDragActiveRef.current = false;

    if (!wasDragging) {
      // It was a click; keep selection active
      setDraggingSquare(null);
      setDragPiece(null);
      dragPieceRef.current = null;
      return;
    }

    // Snapshot drag context before any state mutation: the drop below can
    // synchronously re-render the component, so ref/closure state must be
    // captured first or the move would be committed with a destroyed context.
    const draggedFrom = draggingSquare;
    const draggedPiece = dragPieceRef.current;

    // Evaluate drop location
    if (boardRef.current && draggedFrom) {
      const rect = boardRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const isInside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      if (isInside) {
        const col = Math.floor((clientX - rect.left) / (rect.width / 8));
        const row = Math.floor((clientY - rect.top) / (rect.height / 8));
        const targetSquare = getSquareAt(row, col);

        if (targetSquare !== draggedFrom && legalTargetMoves.has(targetSquare)) {
          const isPawn = draggedPiece?.type === 'p';
          const isPromotion =
            isPawn &&
            ((draggedPiece?.color === 'w' && targetSquare.endsWith('8')) ||
              (draggedPiece?.color === 'b' && targetSquare.endsWith('1')));

          if (isPromotion && draggedPiece) {
            setPendingPromotion({ from: draggedFrom, to: targetSquare, color: draggedPiece.color });
          } else {
            executeMove(draggedFrom, targetSquare);
          }
        }
      }
    }

    setDraggingSquare(null);
    setDragPiece(null);
    dragPieceRef.current = null;
  };

  // Pointer Cancel: Snap-back immediately
  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    isDragActiveRef.current = false;
    currentPointerIdRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setDraggingSquare(null);
    setDragPiece(null);
    dragPieceRef.current = null;
  };

  // Handle promotion modal selection
  const handlePromotionSelect = (piece: PieceSymbol) => {
    if (!pendingPromotion) return;
    executeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  };

  const handlePromotionCancel = () => {
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  // Clear selection on FEN change (new move or time travel)
  useEffect(() => {
    setSelectedSquare(null);
    setDraggingSquare(null);
    setDragPiece(null);
    dragPieceRef.current = null;
    setPendingPromotion(null);
  }, [fen]);

  // Construct 64 visual squares
  const squares: React.ReactNode[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = getSquareAt(row, col);
      const f = square.charCodeAt(0) - 97;
      const r = square.charCodeAt(1) - 49;
      const isDark = (f + r) % 2 === 0;

      const piece = pieceMap.get(square);
      const isSelected = selectedSquare === square;
      const isDragging = draggingSquare === square;
      const isLastMove = lastMove?.from === square || lastMove?.to === square;
      const isLegal = legalTargetMoves.has(square);
      const isCapture = legalTargetMoves.get(square) === true;
      const isKingChecked = checkedKingSquare === square;

      // Coordinate boundary labels
      const showRankLabel = col === 0 ? RANKS[r] : undefined;
      const showFileLabel = row === 7 ? FILES[f] : undefined;

      squares.push(
        <Square
          key={square}
          square={square}
          isDark={isDark}
          isSelected={isSelected}
          isLastMove={isLastMove}
          isLegalTarget={isLegal}
          isCaptureTarget={isCapture}
          isCheck={isKingChecked}
          showRankLabel={showRankLabel}
          showFileLabel={showFileLabel}
          onPointerDown={(e) => handlePointerDown(e, square)}
          onPointerMove={(e) => handlePointerMove(e, square)}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={() => handleSquareClick(square)}
        >
          {piece && (
            <div
              className={`w-full h-full flex items-center justify-center p-1 sm:p-1.5 transition-opacity ${
                isDragging ? 'opacity-30' : 'opacity-100'
              }`}
            >
              <Piece type={piece.type} color={piece.color} />
            </div>
          )}
        </Square>
      );
    }
  }

  return (
    <div
      ref={boardRef}
      className={`relative aspect-square w-full max-w-[640px] select-none rounded-lg shadow-2xl overflow-hidden touch-none border-2 sm:border-4 border-slate-700/80 bg-[#b58863] ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* Persistent Variation Preview Banner across the Chessboard */}
      {isVariationPreview && onReturnToLive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReturnToLive();
          }}
          aria-label="Return to Live Game"
          className="absolute top-2 left-2 right-2 z-40 flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-2xl border border-amber-300 backdrop-blur-xs transition-all duration-150 cursor-pointer pointer-events-auto animate-in fade-in slide-in-from-top-2 group select-none ring-2 ring-amber-400/40"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-950 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="tracking-wide">
              PREVIEWING VARIATION — Click to Return to Live Game
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] bg-slate-950 text-amber-400 px-2.5 py-0.5 rounded font-mono font-bold shrink-0 shadow-xs">
            <RotateCcw className="w-3 h-3 group-hover:-rotate-45 transition-transform" />
            <span>Return</span>
          </span>
        </button>
      )}

      {/* 8x8 Chessboard Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">{squares}</div>

      {/* Vector Overlays Layer (Arrows, Heatmap, Threat Halos) */}
      {overlaySlot && (
        <div className="absolute inset-0 pointer-events-none z-30">{overlaySlot}</div>
      )}

      {/* Floating Dragged Piece (Hardware Accelerated 60fps translate3d) */}
      {draggingSquare && dragPiece && (
        <div
          ref={floatingPieceRef}
          className="fixed top-0 left-0 w-16 h-16 pointer-events-none z-50 will-change-transform drop-shadow-2xl"
          style={{
            transform: 'translate3d(-9999px, -9999px, 0)',
          }}
        >
          <Piece type={dragPiece.type} color={dragPiece.color} />
        </div>
      )}

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <PromotionModal
          color={pendingPromotion.color}
          isOpen={true}
          onSelect={handlePromotionSelect}
          onCancel={handlePromotionCancel}
        />
      )}
    </div>
  );
};
