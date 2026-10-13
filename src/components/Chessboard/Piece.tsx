/**
 * src/components/Chessboard/Piece.tsx
 * High-resolution SVG vector chess pieces (King, Queen, Rook, Bishop, Knight, Pawn)
 * for both White and Black sides.
 */

import React from 'react';
import { Color, PieceSymbol } from '../../types/chess';

export interface PieceProps {
  type: PieceSymbol;
  color: Color;
  className?: string;
  style?: React.CSSProperties;
}

export const Piece: React.FC<PieceProps> = ({ type, color, className = '', style }) => {
  const isWhite = color === 'w';

  // Crisp standard SVG piece vectors (viewBox 0 0 45 45)
  switch (type) {
    case 'p':
      return (
        <svg
          viewBox="0 0 45 45"
          className={`w-full h-full select-none pointer-events-none drop-shadow-sm ${className}`}
          style={style}
          aria-label={`${isWhite ? 'White' : 'Black'} Pawn`}
        >
          {isWhite ? (
            <path
              d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
              fill="#262626"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          )}
        </svg>
      );

    case 'n':
      return (
        <svg
          viewBox="0 0 45 45"
          className={`w-full h-full select-none pointer-events-none drop-shadow-sm ${className}`}
          style={style}
          aria-label={`${isWhite ? 'White' : 'Black'} Knight`}
        >
          {isWhite ? (
            <g
              fill="#ffffff"
              fillRule="evenodd"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,28 9,26 6,18 c -0.5,-1.5 0.5,-3.5 2,-3.5 1.5,0 3,1 3.5,2.5 0.5,1.5 2.5,2.5 4.5,1.5 2,-1 4,-5 6.5,-8.5 z" />
              <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 c -1.5,1 -4,1 -4,1 l -2.5,-3.5 c 2,-1.5 5,-4 6.5,-5.5 1.5,-1.5 3,-2.5 4,-1 z" />
              <circle cx="9.5" cy="25.5" r="1" fill="#000000" stroke="none" />
              <circle cx="15" cy="15.5" r="1.2" fill="#000000" stroke="none" />
            </g>
          ) : (
            <g
              fill="#262626"
              fillRule="evenodd"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,28 9,26 6,18 c -0.5,-1.5 0.5,-3.5 2,-3.5 1.5,0 3,1 3.5,2.5 0.5,1.5 2.5,2.5 4.5,1.5 2,-1 4,-5 6.5,-8.5 z" />
              <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 c -1.5,1 -4,1 -4,1 l -2.5,-3.5 c 2,-1.5 5,-4 6.5,-5.5 1.5,-1.5 3,-2.5 4,-1 z" />
              <circle cx="9.5" cy="25.5" r="1" fill="#ffffff" stroke="none" />
              <circle cx="15" cy="15.5" r="1.2" fill="#ffffff" stroke="none" />
            </g>
          )}
        </svg>
      );

    case 'b':
      return (
        <svg
          viewBox="0 0 45 45"
          className={`w-full h-full select-none pointer-events-none drop-shadow-sm ${className}`}
          style={style}
          aria-label={`${isWhite ? 'White' : 'Black'} Bishop`}
        >
          {isWhite ? (
            <g
              fill="#ffffff"
              fillRule="evenodd"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
              <path d="M 12,36 C 12.27,34.01 12,28.38 16.5,23.5 C 17,23 18.5,21.5 18,20 C 17.5,18.5 17,16 17,14 C 17,8.5 21,5 22.5,5 C 24,5 28,8.5 28,14 C 28,16 27.5,18.5 27,20 C 26.5,21.5 28,23 28.5,23.5 C 33,28.38 32.73,34.01 33,36 z" />
              <circle cx="22.5" cy="4.5" r="1.5" fill="#000000" stroke="none" />
              <path d="m 17.5,18 10,0 M 22.5,13 l 0,10" stroke="#000000" strokeWidth="1.5" />
            </g>
          ) : (
            <g
              fill="#262626"
              fillRule="evenodd"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
              <path d="M 12,36 C 12.27,34.01 12,28.38 16.5,23.5 C 17,23 18.5,21.5 18,20 C 17.5,18.5 17,16 17,14 C 17,8.5 21,5 22.5,5 C 24,5 28,8.5 28,14 C 28,16 27.5,18.5 27,20 C 26.5,21.5 28,23 28.5,23.5 C 33,28.38 32.73,34.01 33,36 z" />
              <circle cx="22.5" cy="4.5" r="1.5" fill="#ffffff" stroke="none" />
              <path d="m 17.5,18 10,0 M 22.5,13 l 0,10" stroke="#ffffff" strokeWidth="1.2" />
            </g>
          )}
        </svg>
      );

    case 'r':
      return (
        <svg
          viewBox="0 0 45 45"
          className={`w-full h-full select-none pointer-events-none drop-shadow-sm ${className}`}
          style={style}
          aria-label={`${isWhite ? 'White' : 'Black'} Rook`}
        >
          {isWhite ? (
            <g
              fill="#ffffff"
              fillRule="evenodd"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
              <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
              <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
              <path d="M 12,32 L 14,14 L 31,14 L 33,32 z" />
              <path d="M 14,29 L 31,29" />
              <path d="M 14,16.5 L 31,16.5" />
            </g>
          ) : (
            <g
              fill="#262626"
              fillRule="evenodd"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
              <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
              <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
              <path d="M 12,32 L 14,14 L 31,14 L 33,32 z" />
              <path d="M 14,29 L 31,29" />
              <path d="M 14,16.5 L 31,16.5" />
            </g>
          )}
        </svg>
      );

    case 'q':
      return (
        <svg
          viewBox="0 0 45 45"
          className={`w-full h-full select-none pointer-events-none drop-shadow-sm ${className}`}
          style={style}
          aria-label={`${isWhite ? 'White' : 'Black'} Queen`}
        >
          {isWhite ? (
            <g
              fill="#ffffff"
              fillRule="evenodd"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="12" r="2" />
              <circle cx="14" cy="9" r="2" />
              <circle cx="22.5" cy="8" r="2" />
              <circle cx="31" cy="9" r="2" />
              <circle cx="39" cy="12" r="2" />
              <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.5 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.5 L 14,25 L 6.5,13.5 z" />
              <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 11.5,36.5 13.5,36.5 14.5,36.5 C 16,36.5 17.5,36.5 19,36.5 C 20.5,36.5 22,36.5 22.5,36.5 C 23,36.5 24.5,36.5 26,36.5 C 27.5,36.5 29,36.5 30.5,36.5 C 31.5,36.5 33.5,36.5 34.5,36 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 z" />
              <path d="M 11.5,30 C 15,29 30,29 33.5,30" fill="none" />
              <path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" fill="none" />
            </g>
          ) : (
            <g
              fill="#262626"
              fillRule="evenodd"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="12" r="2" />
              <circle cx="14" cy="9" r="2" />
              <circle cx="22.5" cy="8" r="2" />
              <circle cx="31" cy="9" r="2" />
              <circle cx="39" cy="12" r="2" />
              <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.5 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.5 L 14,25 L 6.5,13.5 z" />
              <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 11.5,36.5 13.5,36.5 14.5,36.5 C 16,36.5 17.5,36.5 19,36.5 C 20.5,36.5 22,36.5 22.5,36.5 C 23,36.5 24.5,36.5 26,36.5 C 27.5,36.5 29,36.5 30.5,36.5 C 31.5,36.5 33.5,36.5 34.5,36 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 z" />
              <path d="M 11.5,30 C 15,29 30,29 33.5,30" fill="none" stroke="#ffffff" />
              <path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" fill="none" stroke="#ffffff" />
            </g>
          )}
        </svg>
      );

    case 'k':
      return (
        <svg
          viewBox="0 0 45 45"
          className={`w-full h-full select-none pointer-events-none drop-shadow-sm ${className}`}
          style={style}
          aria-label={`${isWhite ? 'White' : 'Black'} King`}
        >
          {isWhite ? (
            <g
              fill="#ffffff"
              fillRule="evenodd"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 22.5,11.63 L 22.5,6" stroke="#000000" strokeWidth="1.5" />
              <path d="M 20,8 L 25,8" stroke="#000000" strokeWidth="1.5" />
              <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,25 z" />
              <path d="M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 38.5,25.5 36,14 C 33.5,14.5 33,16 31,16 C 29,16 28.5,14.5 28.5,14.5 C 27,17.5 22.5,25 22.5,25 C 22.5,25 18,17.5 16.5,14.5 C 16.5,14.5 16,16 14,16 C 12,16 11.5,14.5 9,14 C 6.5,25.5 12.5,30 12.5,30 L 11.5,37 z" />
              <path d="M 11.5,30 C 17,27 28,27 33.5,30" fill="none" />
              <path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5" fill="none" />
              <path d="M 11.5,37 C 17,34 28,34 33.5,37" fill="none" />
            </g>
          ) : (
            <g
              fill="#262626"
              fillRule="evenodd"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 22.5,11.63 L 22.5,6" stroke="#ffffff" strokeWidth="1.5" />
              <path d="M 20,8 L 25,8" stroke="#ffffff" strokeWidth="1.5" />
              <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,25 z" />
              <path d="M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 38.5,25.5 36,14 C 33.5,14.5 33,16 31,16 C 29,16 28.5,14.5 28.5,14.5 C 27,17.5 22.5,25 22.5,25 C 22.5,25 18,17.5 16.5,14.5 C 16.5,14.5 16,16 14,16 C 12,16 11.5,14.5 9,14 C 6.5,25.5 12.5,30 12.5,30 L 11.5,37 z" />
              <path d="M 11.5,30 C 17,27 28,27 33.5,30" fill="none" stroke="#ffffff" />
              <path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5" fill="none" stroke="#ffffff" />
              <path d="M 11.5,37 C 17,34 28,34 33.5,37" fill="none" stroke="#ffffff" />
            </g>
          )}
        </svg>
      );

    default:
      return null;
  }
};
