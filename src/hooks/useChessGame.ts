/**
 * src/hooks/useChessGame.ts
 * Unified reactive state coordinator binding ChessGame, GameModeManager,
 * StockfishClient / FallbackMinimax, DominoEngine, soundSynthesizer,
 * and presentation states adhering to GameStateDTO and GameActions.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Square, PieceSymbol, Color } from '../types/chess';
import { GameMode, SquareControlMap } from '../types/rules';
import {
  CandidateMoveEvaluation,
  ScenarioTreeNode,
  DominoCausalStep,
  MoveClassification,
} from '../types/engine';
import {
  GameStateDTO,
  GameActions,
  BoardOrientation,
  SvgArrow,
  ThreatIndicator,
} from '../types/ui';

import { ChessGame } from '../rules/chessGame';
import { GameModeManager } from '../rules/gameModeManager';
import { calculateSquareControl, findPinnedPieces } from '../rules/squareControl';
import { detectAllTacticalMotifs, detectHangingPieces } from '../engine/tacticalDetectors';
import { centipawnsToWinProbability, classifyMoveDelta } from '../engine/winProbability';
import { DominoEngine } from '../engine/dominoEngine';
import { buildScenarioTree } from '../engine/scenarioTree';
import { generateCoachAdvice } from '../engine/coachCommentary';
import { StockfishClient } from '../engine/stockfishClient';
import { FallbackMinimaxEngine } from '../engine/fallbackMinimax';
import { soundSynthesizer } from '../audio/soundSynthesizer';
import { CLASSIFICATION_COLORS, isKnightMove } from '../components/Overlays/SvgOverlay';

export interface UseChessGameOptions {
  initialFen?: string;
  initialMode?: GameMode;
  initialOrientation?: BoardOrientation;
}

export function useChessGame(options: UseChessGameOptions = {}) {
  // Core game and mode coordinator instances
  const gameRef = useRef<ChessGame>(new ChessGame(options.initialFen));
  const modeManagerRef = useRef<GameModeManager>(new GameModeManager(options.initialMode || 'normal'));
  const dominoEngineRef = useRef<DominoEngine>(new DominoEngine());
  const engineRef = useRef<StockfishClient | FallbackMinimaxEngine | null>(null);

  // Core state
  const [fen, setFen] = useState<string>(() => gameRef.current.getFen());
  const [historySan, setHistorySan] = useState<string[]>(() => gameRef.current.getHistorySan());
  const [historyFens, setHistoryFens] = useState<string[]>([gameRef.current.getFen()]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number>(0);

  const [activeMode, setActiveMode] = useState<GameMode>(options.initialMode || 'normal');
  const [orientation, setOrientation] = useState<BoardOrientation>(options.initialOrientation || 'white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Inspection states
  const [previewFen, setPreviewFen] = useState<string | null>(null);
  const [selectedCandidateSan, setSelectedCandidateSan] = useState<string | null>(null);

  // Visual toggles
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(() => options.initialMode === 'expert');
  const [showArrows, setShowArrows] = useState<boolean>(() => options.initialMode !== 'normal');

  // Engine evaluation states
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [engineStatus, setEngineStatus] = useState<'stockfish' | 'minimax' | 'dormant'>('dormant');
  const [candidateMoves, setCandidateMoves] = useState<CandidateMoveEvaluation[]>([]);
  const [activeScenarioTree, setActiveScenarioTree] = useState<ScenarioTreeNode | undefined>(undefined);
  const [activeDominoChain, setActiveDominoChain] = useState<DominoCausalStep[] | undefined>(undefined);
  const [coachAdvice, setCoachAdvice] = useState<{ beginner: string; intermediate: string; expert: string }>({
    beginner: 'Welcome! Make your first move to begin.',
    intermediate: 'Welcome! Make your first move to begin.',
    expert: 'Welcome! Make your first move to begin.',
  });

  const evalJobIdRef = useRef<number>(0);
  // Actual engine implementation backing the analysis (keeps the status badge honest)
  const engineKindRef = useRef<'stockfish' | 'minimax'>('minimax');
  // Latest mode, readable from async callbacks that must not close over stale state
  const activeModeRef = useRef<GameMode>(options.initialMode || 'normal');

  // Initialize engine on mount
  useEffect(() => {
    const client = new StockfishClient();
    client
      .init()
      .then(() => {
        engineRef.current = client;
        engineKindRef.current = client.engineType === 'stockfish_wasm' ? 'stockfish' : 'minimax';
        if (activeModeRef.current !== 'normal') {
          setEngineStatus(engineKindRef.current);
        }
      })
      .catch(() => {
        const fallback = new FallbackMinimaxEngine();
        fallback.init().then(() => {
          engineRef.current = fallback;
          engineKindRef.current = 'minimax';
          if (activeModeRef.current !== 'normal') {
            setEngineStatus('minimax');
          }
        });
      });

    return () => {
      engineRef.current?.terminate();
    };
  }, []);

  // Sync soundSynthesizer mute state
  useEffect(() => {
    soundSynthesizer.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Mode policies sync
  const handleSetMode = useCallback((mode: GameMode) => {
    modeManagerRef.current.setMode(mode);
    activeModeRef.current = mode;
    setActiveMode(mode);
    if (mode === 'normal') {
      setEngineStatus('dormant');
      setShowHeatmap(false);
      setShowArrows(false);
    } else if (mode === 'smart') {
      setEngineStatus(engineKindRef.current);
      setShowHeatmap(false);
      setShowArrows(true);
    } else if (mode === 'expert') {
      setEngineStatus(engineKindRef.current);
      setShowHeatmap(true);
      setShowArrows(true);
    }
  }, []);

  // Compute display FEN
  const isPreviewing = previewFen !== null;
  const isHistorical = !isPreviewing && activeHistoryIndex < historySan.length;
  const displayFen = isPreviewing
    ? previewFen
    : isHistorical
    ? historyFens[activeHistoryIndex] || fen
    : fen;

  const displayChess = useMemo(() => {
    try {
      return new Chess(displayFen);
    } catch {
      return new Chess();
    }
  }, [displayFen]);

  // Square control differential
  const squareControl = useMemo<SquareControlMap>(() => {
    return calculateSquareControl(displayChess);
  }, [displayChess]);

  // Evaluator function for Smart / Expert modes
  const runAnalysis = useCallback(
    async (targetFen: string, mode: GameMode) => {
      if (mode === 'normal') {
        setIsEvaluating(false);
        setCandidateMoves([]);
        setActiveScenarioTree(undefined);
        setActiveDominoChain(undefined);
        setCoachAdvice({
          beginner: 'Playing in Normal Mode without real-time coaching assistance.',
          intermediate: 'Normal mode active. Candidate analysis is disabled.',
          expert: 'Normal mode active. Engine analysis dormant.',
        });
        return;
      }

      const jobId = ++evalJobIdRef.current;
      setIsEvaluating(true);

      const chess = new Chess(targetFen);
      if (chess.isGameOver()) {
        setIsEvaluating(false);
        let reason = 'Game over.';
        if (chess.isCheckmate()) {
          reason = `Checkmate! ${chess.turn() === 'w' ? 'Black' : 'White'} wins.`;
        } else if (chess.isDraw()) {
          reason = 'Game ended in a draw.';
        }
        setCoachAdvice({
          beginner: reason,
          intermediate: reason,
          expert: reason,
        });
        setCandidateMoves([]);
        setActiveScenarioTree(undefined);
        setActiveDominoChain(undefined);
        return;
      }

      const engine = engineRef.current || new FallbackMinimaxEngine();
      const isFallback = !engineRef.current || engine.engineType === 'fallback_minimax';
      const depth = isFallback ? 3 : (mode === 'expert' ? 14 : 10);
      const multiPV = isFallback ? (mode === 'expert' ? 3 : 2) : (mode === 'expert' ? 5 : 3);

      try {
        const result = await engine.evaluate(targetFen, { depth, multiPV });
        if (evalJobIdRef.current !== jobId) return; // Discard stale job

        const legalMoves = chess.moves({ verbose: true });
        const candidates: CandidateMoveEvaluation[] = [];

        for (let i = 0; i < result.lines.length; i++) {
          const line = result.lines[i];
          if (!line.pv || line.pv.length === 0) continue;

          const firstUci = line.pv[0];
          const from = firstUci.slice(0, 2) as Square;
          const to = firstUci.slice(2, 4) as Square;
          const promo = firstUci.length > 4 ? (firstUci[4] as PieceSymbol) : undefined;

          // Find matching legal move for SAN
          const matchedMove = legalMoves.find(
            (m) => m.from === from && m.to === to && (!promo || m.promotion === promo)
          );
          const san = matchedMove ? matchedMove.san : firstUci;

          const cp = line.score.type === 'mate'
            ? line.score.value > 0 ? 10000 - line.score.value * 100 : -10000 - line.score.value * 100
            : line.score.value;

          const wp = centipawnsToWinProbability(cp);

          let motifs: string[] = [];
          try {
            const simChess = new Chess(targetFen);
            simChess.move({ from, to, promotion: promo });
            const summary = detectAllTacticalMotifs(simChess, chess.turn() as Color, {
              chessBefore: chess,
              lastMove: { from, to },
            });
            motifs = summary.motifs;
          } catch {
            motifs = [];
          }

          const topWp = candidates[0] ? candidates[0].winProbability : wp;
          const topCp = candidates[0] ? candidates[0].centipawns : cp;
          const deltaWp = Math.abs(topWp - wp);
          const deltaCp = Math.abs(topCp - cp);
          const classification = i === 0 ? 'best' : classifyMoveDelta(deltaWp, deltaCp, false, cp);

          candidates.push({
            san,
            from,
            to,
            promotion: promo,
            centipawns: cp,
            winProbability: wp,
            deltaWinProbability: deltaWp,
            classification,
            tacticalMotifs: motifs,
            pv: line.sanPv || [san],
          });
        }

        // Ensure at least 1 candidate move exists if lines are empty
        if (candidates.length === 0 && legalMoves.length > 0) {
          const first = legalMoves[0];
          candidates.push({
            san: first.san,
            from: first.from,
            to: first.to,
            promotion: first.promotion,
            centipawns: 0,
            winProbability: 50.0,
            deltaWinProbability: 0,
            classification: 'good',
            tacticalMotifs: [],
            pv: [first.san],
          });
        }

        setCandidateMoves(candidates);

        // Generate Domino Causal Chain for top or selected candidate
        const selected = candidates.find((c) => c.san === selectedCandidateSan) || candidates[0];
        let dominoSteps: DominoCausalStep[] = [];
        if (selected) {
          try {
            dominoSteps = dominoEngineRef.current.simulateDominoChain(
              chess,
              {
                from: selected.from as Square,
                to: selected.to as Square,
                promotion: selected.promotion as PieceSymbol | undefined,
                san: selected.san,
              },
              {
                maxPlies: mode === 'expert' ? 5 : 3,
                continuationPv: selected.pv,
              }
            );
          } catch {
            dominoSteps = [];
          }
        }
        setActiveDominoChain(dominoSteps);

        // Build Scenario Tree
        try {
          const tree = buildScenarioTree(targetFen, candidates, {
            maxCandidateBranches: mode === 'expert' ? 4 : 2,
            maxNodesPerBranch: 6,
            maxDepth: mode === 'expert' ? 4 : 2,
            userSelectedMoveSan: selectedCandidateSan,
            activeDominoChain: dominoSteps,
          });
          setActiveScenarioTree(tree);
        } catch {
          setActiveScenarioTree(undefined);
        }

        // Generate Grandmaster Coach Advice
        if (selected) {
          const advice = generateCoachAdvice({
            classification: selected.classification,
            motifs: selected.tacticalMotifs,
            san: selected.san,
            evalData: {
              centipawns: selected.centipawns,
              winProbability: selected.winProbability,
            },
            dominoSteps,
            turn: chess.turn(),
            isCheck: chess.inCheck(),
            isCheckmate: chess.isCheckmate(),
            isDraw: chess.isDraw(),
          });
          setCoachAdvice(advice);
        }

        setIsEvaluating(false);
      } catch {
        if (evalJobIdRef.current === jobId) {
          setIsEvaluating(false);
        }
      }
    },
    [selectedCandidateSan]
  );

  // Trigger evaluation when FEN or Mode changes
  useEffect(() => {
    runAnalysis(fen, activeMode);
  }, [fen, activeMode, runAnalysis]);

  // Execute a move on the live board
  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      // Dismiss any active variation preview
      setPreviewFen(null);

      const movingColor = gameRef.current.getTurn();
      const targetPiece = gameRef.current.getPiece(to as Square);
      const movingPiece = gameRef.current.getPiece(from as Square);

      const isCastle =
        movingPiece?.type === 'k' &&
        Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2;
      const isCapture = !!targetPiece || (movingPiece?.type === 'p' && from[0] !== to[0]);

      const success = gameRef.current.makeMove(
        from as Square,
        to as Square,
        promotion as PieceSymbol | undefined
      );

      if (success) {
        const nextFen = gameRef.current.getFen();
        const nextHistorySan = gameRef.current.getHistorySan();
        const nextHistoryFens = [...historyFens.slice(0, activeHistoryIndex + 1), nextFen];

        setFen(nextFen);
        setHistorySan(nextHistorySan);
        setHistoryFens(nextHistoryFens);
        setActiveHistoryIndex(nextHistorySan.length);
        setLastMove({ from: from as Square, to: to as Square });
        setSelectedCandidateSan(null);

        // Trigger procedural sound
        if (soundEnabled) {
          if (isCastle) {
            soundSynthesizer.playCastle();
          } else if (gameRef.current.isCheck()) {
            soundSynthesizer.playCheck();
          } else if (isCapture) {
            soundSynthesizer.playCapture();
          } else {
            soundSynthesizer.playMove();
          }
        }
        return true;
      }
      return false;
    },
    [activeHistoryIndex, historyFens, soundEnabled]
  );

  // Undo move
  const undo = useCallback(() => {
    if (!gameRef.current.canUndo()) return;
    setPreviewFen(null);
    gameRef.current.undo();
    const nextFen = gameRef.current.getFen();
    const nextHistorySan = gameRef.current.getHistorySan();
    const nextHistoryFens = historyFens.slice(0, -1);

    setFen(nextFen);
    setHistorySan(nextHistorySan);
    setHistoryFens(nextHistoryFens.length > 0 ? nextHistoryFens : [nextFen]);
    setActiveHistoryIndex(nextHistorySan.length);
    setLastMove(null);
    setSelectedCandidateSan(null);
  }, [historyFens]);

  // Reset game
  const resetGame = useCallback((startingFen?: string) => {
    gameRef.current.reset(startingFen);
    const initialFen = gameRef.current.getFen();
    setFen(initialFen);
    setHistorySan([]);
    setHistoryFens([initialFen]);
    setActiveHistoryIndex(0);
    setPreviewFen(null);
    setLastMove(null);
    setSelectedCandidateSan(null);
  }, []);

  // Board flipping
  const flipBoard = useCallback(() => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  }, []);

  // Candidate move selection
  const selectCandidateMove = useCallback((san: string | null) => {
    // Switching analysis lines invalidates any preview of the previous variation
    setPreviewFen(null);
    setSelectedCandidateSan(san);
  }, []);

  // Variation ply preview (non-destructive)
  const previewVariationPly = useCallback((targetPreviewFen: string | null) => {
    setPreviewFen(targetPreviewFen);
  }, []);

  // History time travel jump
  const jumpToHistoryPly = useCallback(
    (plyIndex: number) => {
      if (plyIndex >= 0 && plyIndex <= historySan.length) {
        setPreviewFen(null);
        setActiveHistoryIndex(plyIndex);
      }
    },
    [historySan.length]
  );

  // Derived Svg Arrows
  const arrows = useMemo<SvgArrow[]>(() => {
    if (!showArrows || activeMode === 'normal') return [];
    return candidateMoves.slice(0, 3).map((cand, idx) => ({
      id: `cand-${cand.san}-${idx}`,
      from: cand.from as Square,
      to: cand.to as Square,
      color: CLASSIFICATION_COLORS[cand.classification] || '#38bdf8',
      classification: cand.classification,
      isKnight: isKnightMove(cand.from as Square, cand.to as Square),
      opacity: idx === 0 ? 0.88 : 0.65,
    }));
  }, [candidateMoves, showArrows, activeMode]);

  // Derived Threats (Pinned and Hanging pieces)
  const threats = useMemo<ThreatIndicator[]>(() => {
    if (activeMode === 'normal') return [];
    const indicators: ThreatIndicator[] = [];
    const turn = displayChess.turn();

    // Pinned pieces
    try {
      const pins = findPinnedPieces(displayChess, turn);
      for (const pin of pins) {
        indicators.push({
          square: pin.pinnedSquare,
          type: 'pinned',
        });
      }
    } catch {
      // Ignored
    }

    // Hanging pieces
    try {
      const hanging = detectHangingPieces(displayChess, turn);
      for (const h of hanging) {
        indicators.push({
          square: h.square,
          type: 'hanging',
        });
      }
    } catch {
      // Ignored
    }

    return indicators;
  }, [displayChess, activeMode]);

  // King in check
  const checkedKingSquare = useMemo<Square | null>(() => {
    if (!displayChess.inCheck()) return null;
    const turn = displayChess.turn();
    const board = displayChess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          return p.square as Square;
        }
      }
    }
    return null;
  }, [displayChess]);

  // Construct GameStateDTO adhering strictly to PROJECT.md § Interface Contracts
  const gameState: GameStateDTO = useMemo(() => {
    let drawReason: 'stalemate' | 'threefold' | '50-move' | 'insufficient' | undefined;
    if (displayChess.isStalemate()) drawReason = 'stalemate';
    else if (displayChess.isThreefoldRepetition()) drawReason = 'threefold';
    else if (displayChess.isInsufficientMaterial()) drawReason = 'insufficient';
    else if (displayChess.isDraw()) drawReason = '50-move';

    return {
      fen: displayFen,
      turn: displayChess.turn() as 'w' | 'b',
      isCheck: displayChess.inCheck(),
      isCheckmate: displayChess.isCheckmate(),
      isDraw: displayChess.isDraw(),
      drawReason,
      history: historySan,
      activeMode,
      candidateMoves,
      activeScenarioTree,
      activeDominoChain,
      squareControl,
      coachAdvice,
    };
  }, [
    displayFen,
    displayChess,
    historySan,
    activeMode,
    candidateMoves,
    activeScenarioTree,
    activeDominoChain,
    squareControl,
    coachAdvice,
  ]);

  // Construct GameActions adhering strictly to PROJECT.md § Interface Contracts
  const actions: GameActions = useMemo(
    () => ({
      makeMove,
      setGameMode: handleSetMode,
      selectCandidateMove,
      previewVariationPly,
      resetGame,
      flipBoard,
      jumpToHistoryPly,
    }),
    [
      makeMove,
      handleSetMode,
      selectCandidateMove,
      previewVariationPly,
      resetGame,
      flipBoard,
      jumpToHistoryPly,
    ]
  );

  return {
    gameState,
    actions,
    // Board state
    displayFen,
    liveFen: fen,
    orientation,
    setOrientation,
    lastMove,
    checkedKingSquare,
    // UI controls
    soundEnabled,
    setSoundEnabled,
    toggleSound: () => setSoundEnabled((v) => !v),
    showHeatmap,
    setShowHeatmap,
    toggleHeatmap: () => setShowHeatmap((v) => !v),
    showArrows,
    setShowArrows,
    toggleArrows: () => setShowArrows((v) => !v),
    // Time travel & inspection
    previewFen,
    selectedCandidateSan,
    activeHistoryIndex,
    isHistoricalPreview: isHistorical || isPreviewing,
    canUndo: gameRef.current.canUndo(),
    undo,
    // Overlays & Engine
    arrows,
    threats,
    isEvaluating,
    engineStatus,
  };
}
