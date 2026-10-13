/**
 * test/components/chessboard.test.tsx
 * Unit tests for Chessboard component, PointerEvents interaction,
 * Promotion modal, and MoveHistory navigation.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Chessboard } from '../../src/components/Chessboard/Chessboard';
import { MoveHistory } from '../../src/components/Chessboard/MoveHistory';
import { PromotionModal } from '../../src/components/Chessboard/PromotionModal';

describe('Chessboard Component', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('renders all 64 squares with alternating light and dark styling', () => {
    const { container } = render(<Chessboard fen={startFen} />);
    const squares = container.querySelectorAll('[data-square]');
    expect(squares.length).toBe(64);

    // a1 is dark (#b58863), h1 is light (#f0d9b5)
    const a1 = container.querySelector('[data-square="a1"]');
    const h1 = container.querySelector('[data-square="h1"]');
    expect(a1?.className).toContain('bg-[#b58863]');
    expect(h1?.className).toContain('bg-[#f0d9b5]');
  });

  it('renders coordinate boundary labels on rank 1 and file a', () => {
    const { container } = render(<Chessboard fen={startFen} orientation="white" />);

    // In White perspective, rank numbers are on col 0 (file 'a')
    const a1 = container.querySelector('[data-square="a1"]');
    expect(a1?.textContent).toContain('1');

    // File letters are on row 7 (rank '1')
    expect(a1?.textContent).toContain('a');
  });

  it('selects friendly piece on click and displays legal destination indicators', () => {
    const { container } = render(<Chessboard fen={startFen} />);

    const e2 = container.querySelector('[data-square="e2"]');
    expect(e2).toBeInTheDocument();

    // Click e2 (white pawn)
    fireEvent.click(e2!);

    // e2 should now have data-selected="true"
    expect(e2).toHaveAttribute('data-selected', 'true');

    // Legal destinations e3 and e4 should have move indicators
    const e3 = container.querySelector('[data-square="e3"]');
    const e4 = container.querySelector('[data-square="e4"]');
    expect(e3).toHaveAttribute('data-legal-target', 'true');
    expect(e4).toHaveAttribute('data-legal-target', 'true');
  });

  it('executes a legal move via click-to-move', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(<Chessboard fen={startFen} onMove={onMove} />);

    const e2 = container.querySelector('[data-square="e2"]');
    const e4 = container.querySelector('[data-square="e4"]');

    // Click e2 then e4
    fireEvent.click(e2!);
    fireEvent.click(e4!);

    expect(onMove).toHaveBeenCalledWith('e2', 'e4', undefined);
  });

  it('flips visual orientation to Black perspective', () => {
    const { container } = render(<Chessboard fen={startFen} orientation="black" />);

    // In Black orientation, top-left is h1 (row 0, col 0)
    const allSquares = container.querySelectorAll('[data-square]');
    expect(allSquares[0]).toHaveAttribute('data-square', 'h1');
    expect(allSquares[63]).toHaveAttribute('data-square', 'a8');
  });

  it('triggers promotion modal when pawn reaches 8th rank', () => {
    // White pawn on e7 ready to promote to e8
    const promoFen = '8/4P3/8/8/8/8/8/k3K3 w - - 0 1';
    const onMove = vi.fn().mockReturnValue(true);
    const { container } = render(<Chessboard fen={promoFen} onMove={onMove} />);

    const e7 = container.querySelector('[data-square="e7"]');
    const e8 = container.querySelector('[data-square="e8"]');

    // Click e7 then e8
    fireEvent.click(e7!);
    fireEvent.click(e8!);

    // Promotion modal dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Pawn Promotion')).toBeInTheDocument();
  });
});

describe('PromotionModal Component', () => {
  it('renders Queen, Knight, Rook, and Bishop options', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    render(
      <PromotionModal
        color="w"
        isOpen={true}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('Knight')).toBeInTheDocument();
    expect(screen.getByText('Rook')).toBeInTheDocument();
    expect(screen.getByText('Bishop')).toBeInTheDocument();
  });

  it('promotes to Queen on clicking Queen button', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    render(
      <PromotionModal
        color="w"
        isOpen={true}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByLabelText(/Promote to Queen/i));
    expect(onSelect).toHaveBeenCalledWith('q');
  });

  it('promotes to Knight on pressing N key', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    render(
      <PromotionModal
        color="w"
        isOpen={true}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'n' });
    expect(onSelect).toHaveBeenCalledWith('n');
  });

  it('cancels on Escape key', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    render(
      <PromotionModal
        color="w"
        isOpen={true}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('MoveHistory Component', () => {
  const history = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];

  it('renders paired White and Black turns in SAN notation', () => {
    const onJumpToPly = vi.fn();
    render(
      <MoveHistory
        history={history}
        activePly={5}
        onJumpToPly={onJumpToPly}
      />
    );

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Bb5')).toBeInTheDocument();
  });

  it('highlights the active ply and calls onJumpToPly on clicking a move', () => {
    const onJumpToPly = vi.fn();
    render(
      <MoveHistory
        history={history}
        activePly={2}
        onJumpToPly={onJumpToPly}
      />
    );

    const moveE5 = screen.getByText('e5');
    expect(moveE5).toHaveAttribute('data-active-ply', 'true');

    fireEvent.click(screen.getByText('Nf3'));
    expect(onJumpToPly).toHaveBeenCalledWith(3);
  });

  it('supports time-travel scrubbing buttons (First, Prev, Next, Last)', () => {
    const onJumpToPly = vi.fn();
    render(
      <MoveHistory
        history={history}
        activePly={3}
        onJumpToPly={onJumpToPly}
      />
    );

    fireEvent.click(screen.getByLabelText('Jump to Start'));
    expect(onJumpToPly).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByLabelText('Previous Move'));
    expect(onJumpToPly).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByLabelText('Next Move'));
    expect(onJumpToPly).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByLabelText('Jump to Current Position'));
    expect(onJumpToPly).toHaveBeenCalledWith(5);
  });

  it('renders collapsible Board Setup Code with FEN in MoveHistory', () => {
    const testFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    render(
      <MoveHistory
        history={history}
        activePly={2}
        onJumpToPly={() => {}}
        currentFen={testFen}
      />
    );

    expect(screen.getByText('Board Setup Code')).toBeInTheDocument();
    expect(screen.getByText(testFen)).toBeInTheDocument();
  });
});

describe('Chessboard Variation Preview Banner', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('renders persistent variation preview banner when isVariationPreview is true and calls onReturnToLive', () => {
    const onReturn = vi.fn();
    render(
      <Chessboard
        fen={startFen}
        isVariationPreview={true}
        onReturnToLive={onReturn}
      />
    );

    const banner = screen.getByRole('button', { name: /Return to Live Game/i });
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('PREVIEWING VARIATION — Click to Return to Live Game');

    fireEvent.click(banner);
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('does not render variation preview banner when isVariationPreview is false', () => {
    render(
      <Chessboard
        fen={startFen}
        isVariationPreview={false}
        onReturnToLive={() => {}}
      />
    );

    expect(screen.queryByText(/PREVIEWING VARIATION/i)).not.toBeInTheDocument();
  });
});

