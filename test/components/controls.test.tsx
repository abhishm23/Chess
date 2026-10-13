/**
 * test/components/controls.test.tsx
 * Unit tests for ModeSelector and GameControls components.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ModeSelector } from '../../src/components/Controls/ModeSelector';
import { GameControls } from '../../src/components/Controls/GameControls';

describe('ModeSelector Component', () => {
  it('renders Normal, Smart, and Expert mode options', () => {
    const onSelectMode = vi.fn();
    render(<ModeSelector activeMode="normal" onSelectMode={onSelectMode} />);

    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Smart')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('indicates active mode and calls onSelectMode on click', () => {
    const onSelectMode = vi.fn();
    render(<ModeSelector activeMode="smart" onSelectMode={onSelectMode} />);

    const smartBtn = screen.getByRole('button', { name: /smart/i });
    expect(smartBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByText('Expert'));
    expect(onSelectMode).toHaveBeenCalledWith('expert');
  });
});

describe('GameControls Component', () => {
  it('triggers flip, reset, and undo callbacks', () => {
    const onFlipBoard = vi.fn();
    const onResetGame = vi.fn();
    const onUndoMove = vi.fn();

    render(
      <GameControls
        onFlipBoard={onFlipBoard}
        onResetGame={onResetGame}
        onUndoMove={onUndoMove}
        canUndo={true}
        soundEnabled={true}
        onToggleSound={() => {}}
        showHeatmap={false}
        onToggleHeatmap={() => {}}
        showArrows={true}
        onToggleArrows={() => {}}
      />
    );

    fireEvent.click(screen.getByLabelText('Flip Board'));
    expect(onFlipBoard).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Reset Game'));
    expect(onResetGame).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Undo Move'));
    expect(onUndoMove).toHaveBeenCalled();
  });

  it('disables undo button when canUndo is false', () => {
    render(
      <GameControls
        onFlipBoard={() => {}}
        onResetGame={() => {}}
        onUndoMove={() => {}}
        canUndo={false}
        soundEnabled={true}
        onToggleSound={() => {}}
        showHeatmap={false}
        onToggleHeatmap={() => {}}
        showArrows={true}
        onToggleArrows={() => {}}
      />
    );

    expect(screen.getByLabelText('Undo Move')).toBeDisabled();
  });

  it('toggles sound, heatmap, and arrows visual overlays', () => {
    const onToggleSound = vi.fn();
    const onToggleHeatmap = vi.fn();
    const onToggleArrows = vi.fn();

    render(
      <GameControls
        onFlipBoard={() => {}}
        onResetGame={() => {}}
        onUndoMove={() => {}}
        canUndo={true}
        soundEnabled={true}
        onToggleSound={onToggleSound}
        showHeatmap={false}
        onToggleHeatmap={onToggleHeatmap}
        showArrows={true}
        onToggleArrows={onToggleArrows}
      />
    );

    fireEvent.click(screen.getByLabelText('Toggle Sound'));
    expect(onToggleSound).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Toggle Heatmap'));
    expect(onToggleHeatmap).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Toggle Candidate Arrows'));
    expect(onToggleArrows).toHaveBeenCalled();
  });

  it('displays engine status indicator badge', () => {
    const { rerender } = render(
      <GameControls
        onFlipBoard={() => {}}
        onResetGame={() => {}}
        onUndoMove={() => {}}
        canUndo={true}
        soundEnabled={true}
        onToggleSound={() => {}}
        showHeatmap={false}
        onToggleHeatmap={() => {}}
        showArrows={true}
        onToggleArrows={() => {}}
        engineStatus="stockfish"
      />
    );

    expect(screen.getByText('Stockfish WASM')).toBeInTheDocument();

    rerender(
      <GameControls
        onFlipBoard={() => {}}
        onResetGame={() => {}}
        onUndoMove={() => {}}
        canUndo={true}
        soundEnabled={true}
        onToggleSound={() => {}}
        showHeatmap={false}
        onToggleHeatmap={() => {}}
        showArrows={true}
        onToggleArrows={() => {}}
        engineStatus="dormant"
      />
    );

    expect(screen.getByText('Engine Dormant')).toBeInTheDocument();
  });
});
