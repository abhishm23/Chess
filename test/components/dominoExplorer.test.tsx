/**
 * test/components/dominoExplorer.test.tsx
 * Unit tests for DominoExplorer, TreeNode, CausalChainView, and PlyScrubber.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { DominoExplorer } from '../../src/components/DominoExplorer/DominoExplorer';
import { CausalChainView } from '../../src/components/DominoExplorer/CausalChainView';
import { TreeNode } from '../../src/components/DominoExplorer/TreeNode';
import { PlyScrubber } from '../../src/components/DominoExplorer/PlyScrubber';
import { CandidateMoveEvaluation, DominoCausalStep, ScenarioTreeNode } from '../../src/types/engine';

describe('DominoExplorer Component', () => {
  const candidateMoves: CandidateMoveEvaluation[] = [
    {
      san: 'Nf3',
      from: 'g1',
      to: 'f3',
      centipawns: 35,
      winProbability: 54.2,
      deltaWinProbability: 0,
      classification: 'best',
      tacticalMotifs: ['outpost'],
      pv: ['Nf3', 'd5', 'd4'],
    },
    {
      san: 'e4',
      from: 'e2',
      to: 'e4',
      centipawns: 30,
      winProbability: 53.6,
      deltaWinProbability: 0.6,
      classification: 'great',
      tacticalMotifs: [],
      pv: ['e4', 'e5'],
    },
  ];

  it('renders dormant banner in Normal mode with enable button', () => {
    const onSwitchMode = vi.fn();
    render(
      <DominoExplorer
        activeMode="normal"
        candidateMoves={[]}
        selectedCandidateSan={null}
        onSelectCandidate={() => {}}
        activePreviewFen={null}
        onPreviewPly={() => {}}
        onSwitchMode={onSwitchMode}
      />
    );

    expect(screen.getByText('Domino Analysis Dormant')).toBeInTheDocument();
    const btn = screen.getByText('Enable Smart Mode');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onSwitchMode).toHaveBeenCalledWith('smart');
  });

  it('renders candidate move selection chips in Smart / Expert mode', () => {
    const onSelectCandidate = vi.fn();
    render(
      <DominoExplorer
        activeMode="smart"
        candidateMoves={candidateMoves}
        selectedCandidateSan="Nf3"
        onSelectCandidate={onSelectCandidate}
        activePreviewFen={null}
        onPreviewPly={() => {}}
      />
    );

    expect(screen.getByText('DOMINO EFFECT EXPLORER')).toBeInTheDocument();
    expect(screen.getAllByText('Nf3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('e4')).toBeInTheDocument();

    fireEvent.click(screen.getByText('e4'));
    expect(onSelectCandidate).toHaveBeenCalledWith('e4');
  });

  it('toggles between Causal Chain and Scenario Tree views', () => {
    const mockTree: ScenarioTreeNode = {
      id: 'root',
      san: 'Nf3',
      fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      ply: 1,
      centipawns: 35,
      winProbability: 54.2,
      tacticalTags: ['outpost'],
      dominoExplanation: 'Controls d4 and e5.',
      children: [],
    };

    render(
      <DominoExplorer
        activeMode="expert"
        candidateMoves={candidateMoves}
        selectedCandidateSan="Nf3"
        onSelectCandidate={() => {}}
        activeScenarioTree={mockTree}
        activePreviewFen={null}
        onPreviewPly={() => {}}
      />
    );

    // Default view is causal chain
    expect(screen.getByText('Causal Chain')).toBeInTheDocument();
    expect(screen.getByText('Scenario Tree')).toBeInTheDocument();

    // Click Scenario Tree tab
    fireEvent.click(screen.getByText('Scenario Tree'));
    expect(screen.getByText('Controls d4 and e5.')).toBeInTheDocument();
  });
});

describe('CausalChainView Component', () => {
  const steps: DominoCausalStep[] = [
    {
      ply: 1,
      moveSan: 'Nf3',
      player: 'white',
      stage: 'cause',
      description: 'White develops knight towards center.',
      tacticalTag: 'development',
      squareChanges: ['e5', 'd4'],
    },
    {
      ply: 2,
      moveSan: 'Bg4',
      player: 'black',
      stage: 'trigger',
      description: 'Black pins the knight to Queen on d1.',
      tacticalTag: 'pin',
      squareChanges: ['f3'],
    },
    {
      ply: 3,
      moveSan: 'h3',
      player: 'white',
      stage: 'crisis',
      description: 'White questions the bishop.',
      tacticalTag: 'counterplay',
    },
    {
      ply: 4,
      moveSan: 'Bxf3',
      player: 'black',
      stage: 'consequence',
      description: 'Black trades bishop for knight, weakening pawn structure.',
      tacticalTag: 'trade',
    },
  ];

  it('renders all 4 stages: Cause, Trigger, Crisis, Consequence with natural language explanations', () => {
    const onSelectStep = vi.fn();
    render(<CausalChainView steps={steps} onSelectStep={onSelectStep} />);

    expect(screen.getByText(/STEP 1: CAUSE/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 2: TRIGGER/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 3: CRISIS/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 4: CONSEQUENCE/i)).toBeInTheDocument();

    expect(screen.getByText('White develops knight towards center.')).toBeInTheDocument();
    expect(screen.getByText('Black pins the knight to Queen on d1.')).toBeInTheDocument();

    // Clicking a step triggers callback
    fireEvent.click(screen.getByText(/STEP 2: TRIGGER/i));
    expect(onSelectStep).toHaveBeenCalledWith(steps[1]);
  });
});

describe('TreeNode Component', () => {
  const node: ScenarioTreeNode = {
    id: 'node-1',
    san: 'Bxf7+',
    fen: 'rnbqkbnr/pppp1Bpp/8/4p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 2',
    ply: 2,
    centipawns: 250,
    winProbability: 72.5,
    tacticalTags: ['check', 'sacrifice'],
    dominoExplanation: 'King is forced to e7, losing castling rights.',
    children: [
      {
        id: 'node-2',
        san: 'Kxf7',
        fen: 'rnbq1bnr/pppp1kpp/8/4p3/4P3/8/PPPP1PPP/RNBQK1NR w KQ - 0 3',
        ply: 3,
        centipawns: 240,
        winProbability: 71.8,
        tacticalTags: [],
        dominoExplanation: 'King recaptures on f7.',
        children: [],
      },
    ],
  };

  it('renders node badges and triggers onPreviewPly on hover/click', () => {
    const onPreviewPly = vi.fn();
    render(
      <TreeNode
        node={node}
        activePreviewFen={null}
        onPreviewPly={onPreviewPly}
      />
    );

    expect(screen.getByText('Bxf7+')).toBeInTheDocument();
    expect(screen.getByText('+2.50 Points')).toBeInTheDocument();
    expect(screen.getByText('72.5% Win')).toBeInTheDocument();
    expect(screen.getByText('check')).toBeInTheDocument();
    expect(screen.getByText('sacrifice')).toBeInTheDocument();

    // Hover previews ply
    fireEvent.mouseEnter(screen.getByText('Bxf7+'));
    expect(onPreviewPly).toHaveBeenCalledWith(node.fen);

    // Mouse leave reverts preview
    fireEvent.mouseLeave(screen.getByText('Bxf7+'));
    expect(onPreviewPly).toHaveBeenCalledWith(null);
  });
});

describe('PlyScrubber Component', () => {
  const plies = [
    { ply: 1, san: 'e4', fen: 'fen-1' },
    { ply: 2, san: 'e5', fen: 'fen-2' },
    { ply: 3, san: 'Nf3', fen: 'fen-3' },
  ];

  it('renders variation pills and navigates between plies', () => {
    const onSelectPly = vi.fn();
    render(
      <PlyScrubber
        plies={plies}
        activePlyIndex={1}
        onSelectPly={onSelectPly}
      />
    );

    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3 Forward')).toBeInTheDocument();

    // Click Next Ply
    fireEvent.click(screen.getByTitle('Next Step'));
    expect(onSelectPly).toHaveBeenCalledWith(2);

    // Click Previous Ply
    fireEvent.click(screen.getByTitle('Previous Step'));
    expect(onSelectPly).toHaveBeenCalledWith(0);

    // Return to Live
    fireEvent.click(screen.getByText('Return to Live'));
    expect(onSelectPly).toHaveBeenCalledWith(null);
  });
});
