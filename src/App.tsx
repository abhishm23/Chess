/**
 * src/App.tsx
 * Full responsive application layout (Desktop 3-column, Tablet 2-column, Mobile tabbed)
 * with dark slate Tailwind theme, integrating all Milestone 3 components.
 */

import React, { useState } from 'react';
import { useChessGame } from './hooks/useChessGame';
import { Chessboard } from './components/Chessboard/Chessboard';
import { MoveHistory } from './components/Chessboard/MoveHistory';
import { SvgOverlay } from './components/Overlays/SvgOverlay';
import { HeatmapOverlay } from './components/Overlays/HeatmapOverlay';
import { DominoExplorer } from './components/DominoExplorer/DominoExplorer';
import { CoachPanel } from './components/CoachPanel/CoachPanel';
import { EvalBar } from './components/CoachPanel/EvalBar';
import { ModeSelector } from './components/Controls/ModeSelector';
import { GameControls } from './components/Controls/GameControls';
import {
  Crown,
  Eye,
  RotateCcw,
  Sparkles,
  LayoutDashboard,
  GitBranch,
  Bot,
  History,
} from 'lucide-react';

export default function App() {
  const {
    gameState,
    actions,
    displayFen,
    liveFen,
    orientation,
    lastMove,
    checkedKingSquare,
    soundEnabled,
    toggleSound,
    showHeatmap,
    toggleHeatmap,
    showArrows,
    toggleArrows,
    previewFen,
    selectedCandidateSan,
    activeHistoryIndex,
    isHistoricalPreview,
    canUndo,
    undo,
    arrows,
    threats,
    isEvaluating,
    engineStatus,
  } = useChessGame({
    initialMode: 'smart',
    initialOrientation: 'white',
  });

  // Mobile active tab switcher: 'board' | 'domino' | 'coach' | 'history'
  const [mobileTab, setMobileTab] = useState<'board' | 'domino' | 'coach' | 'history'>('board');

  // Top candidate evaluation metrics for EvalBar
  const topCandidate = gameState.candidateMoves[0];
  const centipawns = topCandidate ? topCandidate.centipawns : 0;
  const winProbability = topCandidate ? topCandidate.winProbability : 50.0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Global Application Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 shadow-md">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>CHESS INTELLIGENT</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  TRAINER
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Standard Play, Domino-Effect Simulation & Grandmaster Coaching
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Mode Indicator Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-slate-200 capitalize">
                {gameState.activeMode} Mode
              </span>
            </div>

            {/* Turn Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono">
              <span
                className={`w-3 h-3 rounded-full border ${
                  gameState.turn === 'w'
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-900 border-slate-600'
                }`}
              />
              <span className="text-slate-300">
                {gameState.turn === 'w' ? 'White to move' : 'Black to move'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Variation / Historical Preview Banner */}
      {isHistoricalPreview && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between max-w-7xl mx-auto w-full animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-medium">
            <Eye className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {previewFen
                ? 'PREVIEW MODE: Viewing hypothetical variation line.'
                : `HISTORICAL MODE: Inspecting position at move ${activeHistoryIndex}.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              actions.previewVariationPly(null);
              actions.jumpToHistoryPly(gameState.history.length);
            }}
            className="flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-md hover:bg-amber-400 transition-colors shadow-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Return to Live Game</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6">
        {/* Desktop & Large Tablet 3-Column Layout */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (col-span-3): Mode, Controls, Move History */}
          <div className="col-span-3 space-y-4">
            <ModeSelector
              activeMode={gameState.activeMode}
              onSelectMode={actions.setGameMode}
            />

            <GameControls
              onFlipBoard={actions.flipBoard}
              onResetGame={() => actions.resetGame()}
              onUndoMove={undo}
              canUndo={canUndo}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
              showHeatmap={showHeatmap}
              onToggleHeatmap={toggleHeatmap}
              showArrows={showArrows}
              onToggleArrows={toggleArrows}
              engineStatus={engineStatus}
              isEvaluating={isEvaluating}
            />

            <MoveHistory
              history={gameState.history}
              activePly={activeHistoryIndex}
              onJumpToPly={actions.jumpToHistoryPly}
              currentFen={displayFen}
            />
          </div>

          {/* Center Column (col-span-5): EvalBar + Chessboard + Overlays */}
          <div className="col-span-5 flex flex-col items-center gap-3">
            <div className="flex items-stretch gap-3 w-full justify-center">
              {/* Vertical Evaluation Bar */}
              <EvalBar
                centipawns={centipawns}
                winProbability={winProbability}
                orientation={orientation}
                isVertical={true}
              />

              {/* Main Interactive Chessboard with Overlays Slot */}
              <Chessboard
                fen={displayFen}
                orientation={orientation}
                isInteractive={!isHistoricalPreview}
                lastMove={lastMove}
                onMove={actions.makeMove}
                enableSound={false} // Handled by useChessGame hook
                isVariationPreview={Boolean(previewFen)}
                onReturnToLive={() => {
                  actions.previewVariationPly(null);
                  actions.jumpToHistoryPly(gameState.history.length);
                }}
                overlaySlot={
                  <>
                    <HeatmapOverlay
                      orientation={orientation}
                      squareControl={gameState.squareControl}
                      showHeatmap={showHeatmap}
                    />
                    <SvgOverlay
                      orientation={orientation}
                      arrows={arrows}
                      threats={threats}
                      isCheck={gameState.isCheck}
                      kingSquare={checkedKingSquare || undefined}
                    />
                  </>
                }
              />
            </div>
          </div>

          {/* Right Column (col-span-4): Coach Panel + Domino Effect Explorer */}
          <div className="col-span-4 space-y-4">
            <CoachPanel
              coachAdvice={gameState.coachAdvice}
              classification={topCandidate?.classification}
              tacticalMotifs={topCandidate?.tacticalMotifs}
              isCheck={gameState.isCheck}
              isCheckmate={gameState.isCheckmate}
              isDraw={gameState.isDraw}
              drawReason={gameState.drawReason}
            />

            <DominoExplorer
              activeMode={gameState.activeMode}
              candidateMoves={gameState.candidateMoves}
              selectedCandidateSan={selectedCandidateSan}
              onSelectCandidate={actions.selectCandidateMove}
              activeScenarioTree={gameState.activeScenarioTree}
              activeDominoChain={gameState.activeDominoChain}
              activePreviewFen={previewFen}
              onPreviewPly={actions.previewVariationPly}
              onSwitchMode={actions.setGameMode}
              baseFen={liveFen}
            />
          </div>
        </div>

        {/* Mobile & Small Tablet Viewport with Navigation Tabs */}
        <div className="flex flex-col gap-4 lg:hidden">
          {/* Mobile EvalBar (Horizontal) */}
          <EvalBar
            centipawns={centipawns}
            winProbability={winProbability}
            orientation={orientation}
            isVertical={false}
          />

          {/* Mobile Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMobileTab('board')}
              className={`flex flex-col items-center py-2 rounded-lg text-xs font-semibold transition-all ${
                mobileTab === 'board'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 mb-0.5" />
              <span>Board</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('domino')}
              className={`flex flex-col items-center py-2 rounded-lg text-xs font-semibold transition-all ${
                mobileTab === 'domino'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-4 h-4 mb-0.5" />
              <span>Domino</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('coach')}
              className={`flex flex-col items-center py-2 rounded-lg text-xs font-semibold transition-all ${
                mobileTab === 'coach'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-4 h-4 mb-0.5" />
              <span>Coach</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('history')}
              className={`flex flex-col items-center py-2 rounded-lg text-xs font-semibold transition-all ${
                mobileTab === 'history'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4 mb-0.5" />
              <span>History</span>
            </button>
          </div>

          {/* Tab 1: Board & Controls View */}
          {mobileTab === 'board' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Chessboard
                  fen={displayFen}
                  orientation={orientation}
                  isInteractive={!isHistoricalPreview}
                  lastMove={lastMove}
                  onMove={actions.makeMove}
                  enableSound={false}
                  isVariationPreview={Boolean(previewFen)}
                  onReturnToLive={() => {
                    actions.previewVariationPly(null);
                    actions.jumpToHistoryPly(gameState.history.length);
                  }}
                  overlaySlot={
                    <>
                      <HeatmapOverlay
                        orientation={orientation}
                        squareControl={gameState.squareControl}
                        showHeatmap={showHeatmap}
                      />
                      <SvgOverlay
                        orientation={orientation}
                        arrows={arrows}
                        threats={threats}
                        isCheck={gameState.isCheck}
                        kingSquare={checkedKingSquare || undefined}
                      />
                    </>
                  }
                />
              </div>

              <ModeSelector
                activeMode={gameState.activeMode}
                onSelectMode={actions.setGameMode}
              />

              <GameControls
                onFlipBoard={actions.flipBoard}
                onResetGame={() => actions.resetGame()}
                onUndoMove={undo}
                canUndo={canUndo}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                showHeatmap={showHeatmap}
                onToggleHeatmap={toggleHeatmap}
                showArrows={showArrows}
                onToggleArrows={toggleArrows}
                engineStatus={engineStatus}
                isEvaluating={isEvaluating}
              />
            </div>
          )}

          {/* Tab 2: Domino Explorer View */}
          {mobileTab === 'domino' && (
            <DominoExplorer
              activeMode={gameState.activeMode}
              candidateMoves={gameState.candidateMoves}
              selectedCandidateSan={selectedCandidateSan}
              onSelectCandidate={actions.selectCandidateMove}
              activeScenarioTree={gameState.activeScenarioTree}
              activeDominoChain={gameState.activeDominoChain}
              activePreviewFen={previewFen}
              onPreviewPly={actions.previewVariationPly}
              onSwitchMode={actions.setGameMode}
              baseFen={liveFen}
            />
          )}

          {/* Tab 3: Coach Advice View */}
          {mobileTab === 'coach' && (
            <CoachPanel
              coachAdvice={gameState.coachAdvice}
              classification={topCandidate?.classification}
              tacticalMotifs={topCandidate?.tacticalMotifs}
              isCheck={gameState.isCheck}
              isCheckmate={gameState.isCheckmate}
              isDraw={gameState.isDraw}
              drawReason={gameState.drawReason}
            />
          )}

          {/* Tab 4: History View */}
          {mobileTab === 'history' && (
            <MoveHistory
              history={gameState.history}
              activePly={activeHistoryIndex}
              onJumpToPly={actions.jumpToHistoryPly}
              currentFen={displayFen}
            />
          )}
        </div>
      </main>

      {/* Global Application Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500/70" />
            <span>Chess Intelligent Web Application — FIDE Rules Compliant</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>Stockfish WASM + Fallback Minimax</span>
            <span>•</span>
            <span>Web Audio Procedural Synthesis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
