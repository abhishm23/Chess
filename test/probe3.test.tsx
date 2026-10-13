import React from 'react';
import { it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Chessboard } from '../src/components/Chessboard/Chessboard';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function mockBoardRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect);
}
it('debug3', () => {
  const onMove = vi.fn(() => true);
  const { container } = render(<Chessboard fen={START_FEN} onMove={onMove} />);
  mockBoardRect(container.firstElementChild as HTMLElement);
  const e2 = container.querySelector('[data-square="e2"]') as HTMLElement;
  const e4 = container.querySelector('[data-square="e4"]') as HTMLElement;
  const board = container.firstElementChild as HTMLElement;
  const log: string[] = [];
  board.addEventListener('pointerup', (e: any) => log.push(`up currentTarget=${(e.currentTarget as HTMLElement).tagName} has-raf=${!!(window as any).__raf}`));
  fireEvent.pointerDown(e2, { clientX: 450, clientY: 650, pointerId: 1, button: 0 });
  fireEvent.pointerMove(e2, { clientX: 450, clientY: 550, pointerId: 1 });
  console.log('selected after move:', e2.getAttribute('data-selected'));
  console.log('floating visible:', !!container.querySelector('.fixed.top-0.left-0'));
  fireEvent.pointerUp(e4, { clientX: 450, clientY: 450, pointerId: 1 });
  console.log('calls:', JSON.stringify(onMove.mock.calls));
  console.log('log:', log.join(' | '));
});
