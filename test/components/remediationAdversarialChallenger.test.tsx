/**
 * test/components/remediationAdversarialChallenger.test.tsx
 * Empirical Adversarial Test Harness for UI Remediation Features:
 * 1. Variation Preview Banner & Live Game Return State Invariance
 * 2. Layman Score Formatting (+0.4 Pts / +2.50 Points, elimination of raw cp/plies)
 * 3. Responsive Candidate Move Cards & Causal Step Visual Transitions
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { Chessboard } from '../../src/components/Chessboard/Chessboard';
import { DominoExplorer } from '../../src/components/DominoExplorer/DominoExplorer';
import { CausalChainView } from '../../src/components/DominoExplorer/CausalChainView';
import { TreeNode } from '../../src/components/DominoExplorer/TreeNode';
import { PlyScrubber } from '../../src/components/DominoExplorer/PlyScrubber';
import { MoveHistory } from '../../src/components/Chessboard/MoveHistory';
import { useChessGame } from '../../src/hooks/useChessGame';
import {
  CandidateMoveEvaluation,
  DominoCausalStep,
  ScenarioTreeNode,
} from '../../src/types/engine';

describe('Adversarial Challenge: Variation Preview Banner & State Invariance', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const previewVariationFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';

  it('renders exact banner text "[PREVIEWING VARIATION — Click to Return to Live Game]" with Eye and RotateCcw icons', () => {
    const onReturnToLive = vi.fn();
    const { container } = render(
      <Chessboard
        fen={previewVariationFen}
        isVariationPreview={true}
        onReturnToLive={onReturnToLive}
      />
    );

    const banner = screen.getByRole('button', { name: /Return to Live Game/i });
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('PREVIEWING VARIATION — Click to Return to Live Game');
    expect(banner.textContent).toContain('Return');

    // Check high-contrast amber styling
    expect(banner.className).toContain('bg-amber-500');
    expect(banner.className).toContain('absolute');
    expect(banner.className).toContain('z-40');

    // Click triggers onReturnToLive exactly once
    fireEvent.click(banner);
    expect(onReturnToLive).toHaveBeenCalledTimes(1);
  });

  it('does NOT render banner when isVariationPreview is false or onReturnToLive is undefined', () => {
    const { rerender } = render(
      <Chessboard
        fen={startFen}
        isVariationPreview={false}
        onReturnToLive={() => {}}
      />
    );
    expect(screen.queryByText(/PREVIEWING VARIATION/i)).not.toBeInTheDocument();

    rerender(
      <Chessboard
        fen={startFen}
        isVariationPreview={true}
        onReturnToLive={undefined}
      />
    );
    expect(screen.queryByText(/PREVIEWING VARIATION/i)).not.toBeInTheDocument();
  });

  it('disables piece interaction when previewing variation (immutability guard)', () => {
    const onMove = vi.fn();
    const { container } = render(
      <Chessboard
        fen={previewVariationFen}
        isInteractive={false} // Hook sets isInteractive = !isHistoricalPreview where isHistoricalPreview includes previewFen
        isVariationPreview={true}
        onMove={onMove}
        onReturnToLive={() => {}}
      />
    );

    // Click white pawn on e4
    const e4 = container.querySelector('[data-square="e4"]');
    expect(e4).toBeInTheDocument();
    fireEvent.click(e4!);

    // Should NOT be selected
    expect(e4).not.toHaveAttribute('data-selected', 'true');

    // Attempt to click destination e5
    const e5 = container.querySelector('[data-square="e5"]');
    fireEvent.click(e5!);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('preserves complete live game state across rapid variation preview toggling (useChessGame Hook)', () => {
    const { result } = renderHook(() => useChessGame({ initialMode: 'smart' }));

    // 1. Play 3 live moves: 1.e4 e5 2.Nf3
    act(() => {
      result.current.actions.makeMove('e2', 'e4');
    });
    act(() => {
      result.current.actions.makeMove('e7', 'e5');
    });
    act(() => {
      result.current.actions.makeMove('g1', 'f3');
    });

    const liveFen = result.current.liveFen;
    const liveHistory = [...result.current.gameState.history];
    const liveTurn = result.current.gameState.turn;
    expect(liveHistory).toEqual(['e4', 'e5', 'Nf3']);
    expect(liveTurn).toBe('b');

    // 2. Perform 20 rapid preview variations and cancellations
    const branchFens = [
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    ];

    for (let i = 0; i < 20; i++) {
      const fenTarget = branchFens[i % branchFens.length];
      act(() => {
        result.current.actions.previewVariationPly(fenTarget);
      });
      expect(result.current.isHistoricalPreview).toBe(true);
      expect(result.current.displayFen).toBe(fenTarget);
      expect(result.current.liveFen).toBe(liveFen);

      // Cancel preview via null
      act(() => {
        result.current.actions.previewVariationPly(null);
      });
      expect(result.current.isHistoricalPreview).toBe(false);
      expect(result.current.displayFen).toBe(liveFen);
      expect(result.current.liveFen).toBe(liveFen);
      expect(result.current.gameState.history).toEqual(liveHistory);
      expect(result.current.gameState.turn).toBe(liveTurn);
    }

    // 3. Make another live move: 2... Nc6
    let moveRes = false;
    act(() => {
      moveRes = result.current.actions.makeMove('b8', 'c6');
    });
    expect(moveRes).toBe(true);
    expect(result.current.gameState.history).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });
});

describe('Adversarial Challenge: Layman Score Formatting & Jargon Sanitization', () => {
  const candidateScores: CandidateMoveEvaluation[] = [
    {
      san: 'e4',
      from: 'e2',
      to: 'e4',
      centipawns: 40,
      winProbability: 55.4,
      deltaWinProbability: 0,
      classification: 'best',
      tacticalMotifs: [],
      pv: ['e4', 'e5'],
    },
    {
      san: 'd4',
      from: 'd2',
      to: 'd4',
      centipawns: 250,
      winProbability: 72.0,
      deltaWinProbability: -0.2,
      classification: 'great',
      tacticalMotifs: [],
      pv: ['d4', 'd5'],
    },
    {
      san: 'Nf3',
      from: 'g1',
      to: 'f3',
      centipawns: 0,
      winProbability: 50.0,
      deltaWinProbability: -0.5,
      classification: 'good',
      tacticalMotifs: [],
      pv: ['Nf3'],
    },
    {
      san: 'f3',
      from: 'f2',
      to: 'f3',
      centipawns: -120,
      winProbability: 38.0,
      deltaWinProbability: -12.5,
      classification: 'blunder',
      tacticalMotifs: [],
      pv: ['f3', 'e5'],
    },
    {
      san: 'g4',
      from: 'g2',
      to: 'g4',
      centipawns: -450,
      winProbability: 15.0,
      deltaWinProbability: -35.0,
      classification: 'blunder',
      tacticalMotifs: [],
      pv: ['g4', 'd5'],
    },
  ];

  it('formats candidate move cards with "+X.X Pts" and "-X.X Pts" without raw "cp" leaks', () => {
    render(
      <DominoExplorer
        activeMode="smart"
        candidateMoves={candidateScores}
        selectedCandidateSan="e4"
        onSelectCandidate={() => {}}
        activePreviewFen={null}
        onPreviewPly={() => {}}
      />
    );

    // Check positive scores
    expect(screen.getByText('+0.4 Pts')).toBeInTheDocument();
    expect(screen.getByText('+2.5 Pts')).toBeInTheDocument();
    expect(screen.getByText('+0.0 Pts')).toBeInTheDocument();

    // Check negative scores
    expect(screen.getByText('-1.2 Pts')).toBeInTheDocument();
    expect(screen.getByText('-4.5 Pts')).toBeInTheDocument();

    // Verify absence of raw 'cp' or 'centipawn' in candidate cards container
    const cardsSection = screen.getByText(/Candidate Moves/i).parentElement;
    expect(cardsSection?.textContent).not.toMatch(/\bcp\b/);
    expect(cardsSection?.textContent).not.toMatch(/centipawn/i);
  });

  it('formats TreeNode with "+X.XX Points" / "-X.XX Points" and "% Win" without raw "cp" or "WP"', () => {
    const rootNode: ScenarioTreeNode = {
      id: 'root',
      san: 'd4',
      fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
      ply: 1,
      centipawns: 250,
      winProbability: 72.5,
      tacticalTags: ['outpost'],
      dominoExplanation: 'Seizes center.',
      children: [
        {
          id: 'child-1',
          san: 'f6',
          fen: 'rnbqkbnr/ppppp1pp/5p2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2',
          ply: 2,
          centipawns: -150,
          winProbability: 35.2,
          tacticalTags: ['weakness'],
          dominoExplanation: 'Weakens king shelter.',
          children: [],
        },
      ],
    };

    render(
      <TreeNode
        node={rootNode}
        activePreviewFen={null}
        onPreviewPly={() => {}}
      />
    );

    expect(screen.getByText('+2.50 Points')).toBeInTheDocument();
    expect(screen.getByText('72.5% Win')).toBeInTheDocument();

    expect(screen.getByText('-1.50 Points')).toBeInTheDocument();
    expect(screen.getByText('35.2% Win')).toBeInTheDocument();

    // Verify neither 'cp' nor 'WP' are rendered as raw text tokens
    const allText = screen.getByText('+2.50 Points').parentElement?.textContent || '';
    expect(allText).not.toMatch(/\bcp\b/);
    expect(allText).not.toMatch(/\bWP\b/);
  });

  it('formats PlyScrubber with layman steps ("Step X of Y Forward") and friendly titles', () => {
    const plies = [
      { ply: 1, san: 'e4', fen: 'fen-1' },
      { ply: 2, san: 'e5', fen: 'fen-2' },
      { ply: 3, san: 'Nf3', fen: 'fen-3' },
      { ply: 4, san: 'Nc6', fen: 'fen-4' },
    ];

    render(
      <PlyScrubber
        plies={plies}
        activePlyIndex={2}
        onSelectPly={() => {}}
      />
    );

    expect(screen.getByText('Step 3 of 4 Forward')).toBeInTheDocument();
    expect(screen.getByTitle('First Step')).toBeInTheDocument();
    expect(screen.getByTitle('Previous Step')).toBeInTheDocument();
    expect(screen.getByTitle('Next Step')).toBeInTheDocument();
    expect(screen.getByTitle('Last Step')).toBeInTheDocument();
    expect(screen.getByTitle(/Variation Line Timeline/i)).toBeInTheDocument();
  });

  it('verifies MoveHistory collapsible "Board Setup Code" and moves counter', () => {
    const history = ['e4', 'e5', 'Nf3', 'Nc6'];
    const currentFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

    render(
      <MoveHistory
        history={history}
        activePly={4}
        onJumpToPly={() => {}}
        currentFen={currentFen}
      />
    );

    expect(screen.getByText('GAME MOVES (MOVE LIST)')).toBeInTheDocument();
    expect(screen.getByText('4 moves')).toBeInTheDocument();
    expect(screen.getByText('Board Setup Code')).toBeInTheDocument();
    expect(screen.getByText(currentFen)).toBeInTheDocument();
  });
});

describe('Adversarial Challenge: Responsive Candidate Layout & Causal Transitions', () => {
  const stepsStandard: DominoCausalStep[] = [
    {
      ply: 1,
      moveSan: 'd5',
      player: 'black',
      stage: 'cause',
      description: '12... d5 vacates square e5 and opens the e-file.',
      tacticalTag: 'pawn_break',
      squareChanges: ['d5', 'e5'],
    },
    {
      ply: 2,
      moveSan: 'exd5',
      player: 'white',
      stage: 'trigger',
      description: 'White replies with 13. exd5 attacking the c6 knight.',
      tacticalTag: 'fork',
      squareChanges: ['d5', 'c6'],
    },
    {
      ply: 3,
      moveSan: 'Ne5',
      player: 'black',
      stage: 'crisis',
      description: "Black's c6 knight is forced to retreat, conceding central control.",
      tacticalTag: 'retreat',
      squareChanges: ['e5'],
    },
    {
      ply: 4,
      moveSan: 'Nxe5',
      player: 'white',
      stage: 'consequence',
      description: 'White dominates the d4 and e5 outposts with a +1.8 point advantage.',
      tacticalTag: 'domination',
      squareChanges: ['e5', 'd4'],
    },
  ];

  it('renders "Tipping Point: Escalates to Crisis ⚡" between Trigger and Crisis stages', () => {
    render(<CausalChainView steps={stepsStandard} />);

    // Check that Tipping Point badge is rendered
    const tippingPoint = screen.getByText(/Tipping Point: Escalates to Crisis ⚡/i);
    expect(tippingPoint).toBeInTheDocument();
    expect(tippingPoint.className).toContain('text-orange-300');

    // Crisis card has accentuated border styling
    const crisisText = screen.getByText(/Black's c6 knight is forced to retreat/i);
    const crisisCard = crisisText.closest('div[class*="border"]');
    expect(crisisCard?.className).toContain('border-l-4');
    expect(crisisCard?.className).toContain('border-l-orange-500');
  });

  it('handles abnormal and edge-case step configurations in CausalChainView without crashing', () => {
    // 1. Empty steps
    const { rerender } = render(<CausalChainView steps={[]} />);
    expect(screen.getByText(/No causal domino chain identified/i)).toBeInTheDocument();

    // 2. Single cause step only
    const singleStep: DominoCausalStep[] = [
      {
        ply: 1,
        moveSan: 'e4',
        player: 'white',
        stage: 'cause',
        description: 'Opening pawn move.',
      },
    ];
    rerender(<CausalChainView steps={singleStep} />);
    expect(screen.getByText(/STEP 1: CAUSE/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tipping Point/i)).not.toBeInTheDocument();

    // 3. Trigger without Crisis (e.g. Cause -> Trigger -> Consequence)
    const noCrisis: DominoCausalStep[] = [
      {
        ply: 1,
        moveSan: 'e4',
        player: 'white',
        stage: 'cause',
        description: 'Cause step.',
      },
      {
        ply: 2,
        moveSan: 'd5',
        player: 'black',
        stage: 'trigger',
        description: 'Trigger step.',
      },
      {
        ply: 3,
        moveSan: 'exd5',
        player: 'white',
        stage: 'consequence',
        description: 'Direct consequence without crisis.',
      },
    ];
    rerender(<CausalChainView steps={noCrisis} />);
    expect(screen.getByText(/STEP 2: TRIGGER/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 3: CONSEQUENCE/i)).toBeInTheDocument();
    // Tipping point should NOT appear since Trigger is not followed by Crisis
    expect(screen.queryByText(/Tipping Point/i)).not.toBeInTheDocument();

    // 4. Consecutive Crisis steps
    const multiCrisis: DominoCausalStep[] = [
      {
        ply: 1,
        moveSan: 'Qh5',
        player: 'white',
        stage: 'trigger',
        description: 'Threatens checkmate.',
      },
      {
        ply: 2,
        moveSan: 'g6',
        player: 'black',
        stage: 'crisis',
        description: 'Forced defence.',
      },
      {
        ply: 3,
        moveSan: 'Qf3',
        player: 'white',
        stage: 'crisis',
        description: 'Renewed crisis threat.',
      },
    ];
    rerender(<CausalChainView steps={multiCrisis} />);
    expect(screen.getByText(/Tipping Point: Escalates to Crisis ⚡/i)).toBeInTheDocument();
    expect(screen.getAllByText(/STEP \d+: CRISIS/).length).toBe(2);
  });

  it('verifies responsive container classes on candidate moves deck in DominoExplorer', () => {
    const { container } = render(
      <DominoExplorer
        activeMode="smart"
        candidateMoves={[
          {
            san: 'e4',
            from: 'e2',
            to: 'e4',
            centipawns: 30,
            winProbability: 54.0,
            deltaWinProbability: 0,
            classification: 'best',
            tacticalMotifs: [],
            pv: ['e4'],
          },
        ]}
        selectedCandidateSan="e4"
        onSelectCandidate={() => {}}
        activePreviewFen={null}
        onPreviewPly={() => {}}
      />
    );

    // Find candidate carousel
    const carousel = container.querySelector('.overflow-x-auto');
    expect(carousel).toBeInTheDocument();
    expect(carousel?.className).toContain('snap-x');
    expect(carousel?.className).toContain('snap-mandatory');
    expect(carousel?.className).toContain('touch-pan-x');

    // Find candidate card button
    const card = carousel?.querySelector('button');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain('snap-start');
    expect(card?.className).toContain('min-w-[130px]');
    expect(card?.className).toContain('sm:min-w-[150px]');
  });
});

describe('Adversarial Challenge: Deep Variation Tree, Scrubber & Full Jargon Audit', () => {
  it('prevents click-through to underlying squares when banner is clicked', () => {
    const onReturnToLive = vi.fn();
    const onMove = vi.fn();
    const { container } = render(
      <Chessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        isVariationPreview={true}
        onReturnToLive={onReturnToLive}
        onMove={onMove}
      />
    );

    const banner = screen.getByRole('button', { name: /Return to Live Game/i });
    fireEvent.click(banner);

    expect(onReturnToLive).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();

    // Check that squares underneath remain unselected
    const squares = container.querySelectorAll('[data-selected="true"]');
    expect(squares.length).toBe(0);
  });

  it('renders banner seamlessly in Black board orientation', () => {
    const onReturnToLive = vi.fn();
    render(
      <Chessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        orientation="black"
        isVariationPreview={true}
        onReturnToLive={onReturnToLive}
      />
    );

    const banner = screen.getByRole('button', { name: /Return to Live Game/i });
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('PREVIEWING VARIATION — Click to Return to Live Game');
  });

  it('navigates a 5-ply deep branching scenario tree with zero jargon and accurate point formatting', () => {
    const onPreviewPly = vi.fn();
    const deepTree: ScenarioTreeNode = {
      id: 'root-1',
      san: 'e4',
      fen: 'fen-ply-1',
      ply: 1,
      centipawns: 35,
      winProbability: 54.2,
      tacticalTags: ['center_control'],
      dominoExplanation: 'Controls center.',
      children: [
        {
          id: 'child-2',
          san: 'e5',
          fen: 'fen-ply-2',
          ply: 2,
          centipawns: 30,
          winProbability: 53.8,
          tacticalTags: ['open_game'],
          dominoExplanation: 'Claims central space.',
          children: [
            {
              id: 'child-3',
              san: 'Nf3',
              fen: 'fen-ply-3',
              ply: 3,
              centipawns: 45,
              winProbability: 55.6,
              tacticalTags: ['development'],
              dominoExplanation: 'Attacks e5.',
              children: [
                {
                  id: 'child-4',
                  san: 'Nc6',
                  fen: 'fen-ply-4',
                  ply: 4,
                  centipawns: 40,
                  winProbability: 54.9,
                  tacticalTags: ['defense'],
                  dominoExplanation: 'Defends e5.',
                  children: [
                    {
                      id: 'child-5',
                      san: 'Bc4',
                      fen: 'fen-ply-5',
                      ply: 5,
                      centipawns: 60,
                      winProbability: 57.2,
                      tacticalTags: ['italian_game'],
                      dominoExplanation: 'Targets f7.',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TreeNode
        node={deepTree}
        activePreviewFen="fen-ply-3"
        onPreviewPly={onPreviewPly}
      />
    );

    // Verify all 5 plies are rendered in tree
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(screen.getByText('Nc6')).toBeInTheDocument();
    expect(screen.getByText('Bc4')).toBeInTheDocument();

    // Verify formatted points
    expect(screen.getByText('+0.35 Points')).toBeInTheDocument();
    expect(screen.getByText('+0.30 Points')).toBeInTheDocument();
    expect(screen.getByText('+0.45 Points')).toBeInTheDocument();
    expect(screen.getByText('+0.40 Points')).toBeInTheDocument();
    expect(screen.getByText('+0.60 Points')).toBeInTheDocument();

    // Verify activePreviewFen highlights ply 3 (Nf3)
    const activeRow = screen.getByText('Nf3').closest('.group');
    expect(activeRow?.className).toContain('bg-amber-500/20');

    // Click ply 5
    fireEvent.click(screen.getByText('Bc4'));
    expect(onPreviewPly).toHaveBeenCalledWith('fen-ply-5');

    // Audit entire rendered tree for forbidden jargon
    const treeText = container.textContent || '';
    expect(treeText).not.toMatch(/\bcp\b/);
    expect(treeText).not.toMatch(/\bWP\b/);
    expect(treeText).not.toMatch(/centipawn/i);
    expect(treeText).not.toMatch(/\bply\b/i);
  });

  it('audits coach commentary across all 7 move classifications and all motifs for total absence of jargon', async () => {
    const { generateCoachAdvice } = await import('../../src/engine/coachCommentary');
    const classifications = [
      'blunder',
      'mistake',
      'inaccuracy',
      'brilliant',
      'great',
      'best',
      'good',
    ] as const;

    const motifs = [
      'royal_fork',
      'fork',
      'absolute_pin',
      'pin',
      'skewer',
      'trapped_piece',
      'hanging_piece',
      'conceded_outpost',
      'discovered_attack',
      'deflection',
      '',
    ];

    for (const cls of classifications) {
      for (const motif of motifs) {
        const motifList = motif ? [motif as any] : [];
        const advice = generateCoachAdvice(cls, motifList, 'Qh5', { centipawns: 180, winProbability: 58.5 });

        for (const persona of ['beginner', 'intermediate', 'expert'] as const) {
          const text = advice[persona];
          // Must not contain raw centipawn abbreviations
          expect(text).not.toMatch(/\bcp\b/i);
          expect(text).not.toMatch(/centipawn/i);
          // Must not contain raw technical abbreviations
          expect(text).not.toMatch(/\bSEE\b/);
          expect(text).not.toMatch(/Static Exchange Evaluation/i);
          expect(text).not.toMatch(/\bprincipal variation\b/i);
          expect(text).not.toMatch(/\bPeSTO\b/);
          expect(text).not.toMatch(/\bQuiescence\b/i);
          expect(text).not.toMatch(/\bPVS\b/);
        }
      }
    }
  });
});

