/**
 * test/components/coachPanel.test.tsx
 * Unit tests for CoachPanel and EvalBar components.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CoachPanel } from '../../src/components/CoachPanel/CoachPanel';
import { EvalBar } from '../../src/components/CoachPanel/EvalBar';

describe('CoachPanel Component', () => {
  const coachAdvice = {
    beginner: 'Good move! You are developing your knight safely.',
    intermediate: 'Strong positional choice controlling key central outposts.',
    expert: 'Maintains dynamic pressure along the d-file, preserving maximum tension.',
  };

  it('renders persona advice and switches advice on clicking tabs', () => {
    render(
      <CoachPanel
        coachAdvice={coachAdvice}
        classification="best"
        tacticalMotifs={['conceded_outpost']}
        defaultPersona="beginner"
      />
    );

    expect(screen.getByText('GRANDMASTER COACH')).toBeInTheDocument();
    // Beginner advice is visible
    expect(screen.getByText(coachAdvice.beginner)).toBeInTheDocument();

    // Click Intermediate tab
    fireEvent.click(screen.getByText('intermediate'));
    expect(screen.getByText(coachAdvice.intermediate)).toBeInTheDocument();

    // Click Expert tab
    fireEvent.click(screen.getByText('expert'));
    expect(screen.getByText(coachAdvice.expert)).toBeInTheDocument();
  });

  it('renders move classification badges and tactical motif tags', () => {
    render(
      <CoachPanel
        coachAdvice={coachAdvice}
        classification="brilliant"
        tacticalMotifs={['royal_fork', 'pin']}
      />
    );

    expect(screen.getByText('Brilliant Move')).toBeInTheDocument();
    expect(screen.getByText('[!!]')).toBeInTheDocument();
    expect(screen.getByText('royal fork')).toBeInTheDocument();
    expect(screen.getByText('pin')).toBeInTheDocument();
  });

  it('renders checkmate, check, and draw status alert banners', () => {
    const { rerender } = render(
      <CoachPanel
        coachAdvice={coachAdvice}
        isCheck={true}
        isCheckmate={false}
      />
    );

    expect(screen.getByText(/Check! King is under attack/i)).toBeInTheDocument();

    rerender(
      <CoachPanel
        coachAdvice={coachAdvice}
        isCheck={true}
        isCheckmate={true}
      />
    );

    expect(screen.getByText(/Checkmate! Game over/i)).toBeInTheDocument();

    rerender(
      <CoachPanel
        coachAdvice={coachAdvice}
        isDraw={true}
        drawReason="stalemate"
      />
    );

    expect(screen.getByText(/Draw \(stalemate\)/i)).toBeInTheDocument();
  });
});

describe('EvalBar Component', () => {
  it('formats positive centipawns and win probability correctly', () => {
    render(
      <EvalBar
        centipawns={150}
        winProbability={64.5}
        isVertical={true}
      />
    );

    expect(screen.getByText('+1.5')).toBeInTheDocument();
  });

  it('formats negative centipawns correctly for Black advantage', () => {
    render(
      <EvalBar
        centipawns={-240}
        winProbability={28.0}
        isVertical={true}
      />
    );

    expect(screen.getByText('-2.4')).toBeInTheDocument();
  });

  it('formats forced mate scores (M3 and -M2)', () => {
    const { rerender } = render(
      <EvalBar
        centipawns={10000}
        winProbability={99.9}
        mateScore={3}
        isVertical={true}
      />
    );

    expect(screen.getByText('M3')).toBeInTheDocument();

    rerender(
      <EvalBar
        centipawns={-10000}
        winProbability={0.1}
        mateScore={-2}
        isVertical={true}
      />
    );

    expect(screen.getByText('-M2')).toBeInTheDocument();
  });

  it('renders horizontal layout for mobile viewports', () => {
    const { container } = render(
      <EvalBar
        centipawns={50}
        winProbability={55.0}
        isVertical={false}
      />
    );

    const bar = container.querySelector('.h-5');
    expect(bar).toBeInTheDocument();
    expect(screen.getByText('+0.5')).toBeInTheDocument();
    expect(screen.getByText('55% W')).toBeInTheDocument();
  });
});
