/**
 * src/rules/chessGame.ts
 * FIDE-compliant chess game wrapper over chess.js.
 */

import { Chess } from 'chess.js';
import {
  Color,
  PieceSymbol,
  Square,
  BoardSquare,
  MoveDTO,
  HistoryMove,
  DrawReason,
  Piece,
} from '../types/chess';
import {
  IChessGame,
  MoveExecutionResult,
  SimulatedMoveResult,
} from '../types/rules';

interface InternalHistorySnapshot {
  move: MoveDTO;
  fenBefore: string;
  fenAfter: string;
  ply: number;
}

export class ChessGame implements IChessGame {
  private engine: Chess;
  private historyStack: InternalHistorySnapshot[] = [];
  private redoStack: InternalHistorySnapshot[] = [];

  constructor(fen?: string) {
    this.engine = fen ? new Chess(fen) : new Chess();
  }

  public getFen(): string {
    return this.engine.fen();
  }

  public getTurn(): Color {
    return this.engine.turn() as Color;
  }

  public getBoard(): (BoardSquare | null)[][] {
    const rawBoard = this.engine.board();
    return rawBoard.map((row) =>
      row.map((cell) => {
        if (!cell) return null;
        return {
          square: cell.square as Square,
          type: cell.type as PieceSymbol,
          color: cell.color as Color,
        };
      })
    );
  }

  public getPiece(square: Square): Piece | null {
    const p = this.engine.get(square);
    if (!p) return null;
    return {
      type: p.type as PieceSymbol,
      color: p.color as Color,
    };
  }

  public getLegalMoves(square?: Square): MoveDTO[] {
    const options: { verbose: true; square?: Square } = { verbose: true };
    if (square) {
      options.square = square;
    }
    const rawMoves = this.engine.moves(options);
    return rawMoves.map((m) => ({
      from: m.from as Square,
      to: m.to as Square,
      promotion: m.promotion as PieceSymbol | undefined,
      san: m.san,
      piece: m.piece as PieceSymbol,
      color: m.color as Color,
      captured: m.captured as PieceSymbol | undefined,
      flags: m.flags,
    }));
  }

  public isLegalMove(from: Square, to: Square, promotion?: PieceSymbol): boolean {
    const moves = this.getLegalMoves(from);
    return moves.some(
      (m) => m.to === to && (!promotion || m.promotion === promotion)
    );
  }

  public makeMove(
    from: Square,
    to: Square,
    promotion?: PieceSymbol
  ): boolean {
    try {
      const moveResult = this.engine.move({
        from,
        to,
        promotion: promotion || undefined,
      });

      if (!moveResult) {
        return false;
      }

      const moveDTO: MoveDTO = {
        from: moveResult.from as Square,
        to: moveResult.to as Square,
        promotion: moveResult.promotion as PieceSymbol | undefined,
        san: moveResult.san,
        piece: moveResult.piece as PieceSymbol,
        color: moveResult.color as Color,
        captured: moveResult.captured as PieceSymbol | undefined,
        flags: moveResult.flags,
      };

      const snapshot: InternalHistorySnapshot = {
        move: moveDTO,
        fenBefore: moveResult.before,
        fenAfter: moveResult.after,
        ply: this.historyStack.length + 1,
      };

      this.historyStack.push(snapshot);
      this.redoStack = []; // Flush redo branch on new move

      return true;
    } catch {
      return false;
    }
  }

  public makeMoveVerbose(
    from: Square,
    to: Square,
    promotion?: PieceSymbol
  ): MoveExecutionResult {
    try {
      const moveResult = this.engine.move({
        from,
        to,
        promotion: promotion || undefined,
      });

      if (!moveResult) {
        return {
          success: false,
          isCheck: this.isCheck(),
          isCheckmate: false,
          isDraw: false,
          fen: this.engine.fen(),
          error: 'Illegal move',
        };
      }

      const moveDTO: MoveDTO = {
        from: moveResult.from as Square,
        to: moveResult.to as Square,
        promotion: moveResult.promotion as PieceSymbol | undefined,
        san: moveResult.san,
        piece: moveResult.piece as PieceSymbol,
        color: moveResult.color as Color,
        captured: moveResult.captured as PieceSymbol | undefined,
        flags: moveResult.flags,
      };

      const snapshot: InternalHistorySnapshot = {
        move: moveDTO,
        fenBefore: moveResult.before,
        fenAfter: moveResult.after,
        ply: this.historyStack.length + 1,
      };

      this.historyStack.push(snapshot);
      this.redoStack = [];

      return {
        success: true,
        san: moveResult.san,
        captured: moveResult.captured as PieceSymbol | undefined,
        promotion: moveResult.promotion as PieceSymbol | undefined,
        isCheck: this.isCheck(),
        isCheckmate: this.engine.isCheckmate(),
        isDraw: this.engine.isDraw(),
        drawReason: this.getDrawReason(),
        fen: moveResult.after,
      };
    } catch (err) {
      return {
        success: false,
        isCheck: this.isCheck(),
        isCheckmate: false,
        isDraw: false,
        fen: this.engine.fen(),
        error: (err as Error).message || 'Invalid move execution',
      };
    }
  }

  public makeMoveSan(san: string): boolean {
    try {
      const moveResult = this.engine.move(san);
      if (!moveResult) {
        return false;
      }

      const moveDTO: MoveDTO = {
        from: moveResult.from as Square,
        to: moveResult.to as Square,
        promotion: moveResult.promotion as PieceSymbol | undefined,
        san: moveResult.san,
        piece: moveResult.piece as PieceSymbol,
        color: moveResult.color as Color,
        captured: moveResult.captured as PieceSymbol | undefined,
        flags: moveResult.flags,
      };

      this.historyStack.push({
        move: moveDTO,
        fenBefore: moveResult.before,
        fenAfter: moveResult.after,
        ply: this.historyStack.length + 1,
      });
      this.redoStack = [];

      return true;
    } catch {
      return false;
    }
  }

  public undo(): boolean {
    if (this.historyStack.length === 0) return false;

    const last = this.historyStack.pop()!;
    this.redoStack.push(last);
    this.engine.undo();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;

    const next = this.redoStack.pop()!;
    try {
      const res = this.engine.move({
        from: next.move.from,
        to: next.move.to,
        promotion: next.move.promotion || undefined,
      });

      if (!res) {
        this.engine.load(next.fenAfter);
      }
    } catch {
      this.engine.load(next.fenAfter);
    }

    this.historyStack.push(next);
    return true;
  }

  public canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getHistory(): HistoryMove[] {
    return this.historyStack.map((s) => ({
      ...s.move,
      fenBefore: s.fenBefore,
      fenAfter: s.fenAfter,
      ply: s.ply,
    }));
  }

  public getHistorySan(): string[] {
    return this.historyStack.map((s) => s.move.san);
  }

  public isCheck(): boolean {
    return this.engine.inCheck();
  }

  public isCheckmate(): boolean {
    return this.engine.isCheckmate();
  }

  public isStalemate(): boolean {
    return this.engine.isStalemate();
  }

  public isDraw(): boolean {
    return this.engine.isDraw();
  }

  public isThreefoldRepetition(): boolean {
    return this.engine.isThreefoldRepetition();
  }

  public isInsufficientMaterial(): boolean {
    return this.engine.isInsufficientMaterial();
  }

  public getDrawReason(): DrawReason | undefined {
    if (this.isStalemate()) return 'stalemate';
    if (this.isThreefoldRepetition()) return 'threefold';
    if (this.isInsufficientMaterial()) return 'insufficient';
    if (this.engine.isDraw()) return '50-move';
    return undefined;
  }

  public isGameOver(): boolean {
    return this.engine.isGameOver();
  }

  public getWinner(): Color | 'draw' | null {
    if (!this.isGameOver()) return null;
    if (this.isCheckmate()) {
      return this.getTurn() === 'w' ? 'b' : 'w';
    }
    if (this.isDraw()) {
      return 'draw';
    }
    return null;
  }

  public loadFen(fen: string): boolean {
    try {
      this.engine.load(fen);
      this.historyStack = [];
      this.redoStack = [];
      return true;
    } catch {
      return false;
    }
  }

  public exportFen(): string {
    return this.engine.fen();
  }

  public loadPgn(pgn: string): boolean {
    try {
      this.engine.loadPgn(pgn);
      this.historyStack = [];
      this.redoStack = [];
      // Rebuild history stack from loaded PGN
      const moves = this.engine.history({ verbose: true });
      const tempGame = new Chess();
      moves.forEach((m, idx) => {
        const fenBefore = tempGame.fen();
        const applied = tempGame.move(m);
        const fenAfter = tempGame.fen();
        if (applied) {
          this.historyStack.push({
            move: {
              from: applied.from as Square,
              to: applied.to as Square,
              promotion: applied.promotion as PieceSymbol | undefined,
              san: applied.san,
              piece: applied.piece as PieceSymbol,
              color: applied.color as Color,
              captured: applied.captured as PieceSymbol | undefined,
              flags: applied.flags,
            },
            fenBefore,
            fenAfter,
            ply: idx + 1,
          });
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  public exportPgn(): string {
    return this.engine.pgn();
  }

  public reset(startingFen?: string): void {
    if (startingFen) {
      this.loadFen(startingFen);
    } else {
      this.engine.reset();
      this.historyStack = [];
      this.redoStack = [];
    }
  }

  public simulateMove(
    from: Square,
    to: Square,
    promotion?: PieceSymbol
  ): SimulatedMoveResult | null {
    const sim = new Chess(this.engine.fen());
    try {
      const res = sim.move({
        from,
        to,
        promotion: promotion || undefined,
      });
      if (!res) return null;

      return {
        valid: true,
        san: res.san,
        fen: sim.fen(),
        captured: res.captured as PieceSymbol | undefined,
        promotion: res.promotion as PieceSymbol | undefined,
        isCheck: sim.inCheck(),
        isCheckmate: sim.isCheckmate(),
        isDraw: sim.isDraw(),
        turn: sim.turn() as Color,
      };
    } catch {
      return null;
    }
  }
}
