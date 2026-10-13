/**
 * src/components/Overlays/SvgOverlay.tsx
 * Resolution-independent SVG vector overlay for candidate moves,
 * Knight L-routing with rounded fillets and center avoidance,
 * threat halos (hanging/pinned), and king check alert pulse.
 */

import React from 'react';
import { Square } from '../../types/chess';
import { BoardOrientation, SvgArrow, ThreatIndicator } from '../../types/ui';
import { MoveClassification } from '../../types/engine';

export interface ExtendedThreatIndicator extends ThreatIndicator {
  pinnerSquare?: Square;
}

export interface SvgOverlayProps {
  orientation: BoardOrientation;
  arrows: SvgArrow[];
  threats: ExtendedThreatIndicator[];
  isCheck?: boolean;
  kingSquare?: Square;
  selectedArrowId?: string | null;
}

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  brilliant: '#06b6d4',
  best: '#10b981',
  great: '#3b82f6',
  good: '#94a3b8',
  inaccuracy: '#f59e0b',
  mistake: '#f97316',
  blunder: '#ef4444',
};

export function squareToCoords(square: Square, orientation: BoardOrientation): { x: number; y: number } {
  const f = square.charCodeAt(0) - 97;
  const r = square.charCodeAt(1) - 49;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

export function squareToTopLeft(square: Square, orientation: BoardOrientation): { x: number; y: number } {
  const f = square.charCodeAt(0) - 97;
  const r = square.charCodeAt(1) - 49;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  return { x: col * 100, y: row * 100 };
}

export function isKnightMove(from: Square, to: Square): boolean {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(from.charCodeAt(1) - to.charCodeAt(1));
  return df * dr === 2;
}

export function computeStraightArrowPath(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { d: string; endX: number; endY: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / (len || 1);
  const uy = dy / (len || 1);

  const startX = p1.x + ux * 18;
  const startY = p1.y + uy * 18;
  const endX = p2.x - ux * 10;
  const endY = p2.y - uy * 10;

  return {
    d: `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`,
    endX,
    endY,
  };
}

export function computeKnightLPath(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { d: string; endX: number; endY: number } {
  // Option H: Horizontal first -> Corner K_H = (p2.x, p1.y)
  const kh = { x: p2.x, y: p1.y };
  // Option V: Vertical first -> Corner K_V = (p1.x, p2.y)
  const kv = { x: p1.x, y: p2.y };

  // Center avoidance heuristic (board center is 400, 400)
  const dh = Math.hypot(kh.x - 400, kh.y - 400);
  const dv = Math.hypot(kv.x - 400, kv.y - 400);

  let corner = kh;
  let isHFirst = true;

  if (dh > dv + 0.5) {
    corner = kh;
    isHFirst = true;
  } else if (dv > dh + 0.5) {
    corner = kv;
    isHFirst = false;
  } else {
    // Symmetrical: prefer long leg first
    isHFirst = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y);
    corner = isHFirst ? kh : kv;
  }

  // Vector 1: p1 -> corner
  const dx1 = corner.x - p1.x;
  const dy1 = corner.y - p1.y;
  const len1 = Math.hypot(dx1, dy1) || 1;
  const u1x = dx1 / len1;
  const u1y = dy1 / len1;

  // Vector 2: corner -> p2
  const dx2 = p2.x - corner.x;
  const dy2 = p2.y - corner.y;
  const len2 = Math.hypot(dx2, dy2) || 1;
  const u2x = dx2 / len2;
  const u2y = dy2 / len2;

  const R = 24; // Fillet radius
  const startX = p1.x + u1x * 18;
  const startY = p1.y + u1y * 18;

  const entryX = corner.x - u1x * R;
  const entryY = corner.y - u1y * R;

  const exitX = corner.x + u2x * R;
  const exitY = corner.y + u2y * R;

  const endX = p2.x - u2x * 10;
  const endY = p2.y - u2y * 10;

  const d = `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${entryX.toFixed(1)} ${entryY.toFixed(1)} Q ${corner.x.toFixed(1)} ${corner.y.toFixed(1)} ${exitX.toFixed(1)} ${exitY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  return { d, endX, endY };
}

export const SvgOverlay: React.FC<SvgOverlayProps> = ({
  orientation,
  arrows,
  threats,
  isCheck = false,
  kingSquare,
  selectedArrowId,
}) => {
  return (
    <svg
      viewBox="0 0 800 800"
      className="absolute inset-0 w-full h-full pointer-events-none z-40"
      aria-label="Chess Visual Overlays"
    >
      <defs>
        {/* Move Classification Arrowheads */}
        {Object.entries(CLASSIFICATION_COLORS).map(([classification, color]) => (
          <marker
            key={classification}
            id={`arrowhead-${classification}`}
            markerWidth="24"
            markerHeight="24"
            refX="18"
            refY="12"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 2 4 L 18 12 L 2 20 L 6 12 Z" fill={color} />
          </marker>
        ))}
        {/* Default / Fallback Arrowhead */}
        <marker
          id="arrowhead-default"
          markerWidth="24"
          markerHeight="24"
          refX="18"
          refY="12"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 2 4 L 18 12 L 2 20 L 6 12 Z" fill="#38bdf8" />
        </marker>

        {/* King Check Radial Glow */}
        <radialGradient id="checkGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#dc2626" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#991b1b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Layer 1: Check Pulse Glow on King */}
      {isCheck && kingSquare && (() => {
        const coords = squareToCoords(kingSquare, orientation);
        const tl = squareToTopLeft(kingSquare, orientation);
        return (
          <g key="check-pulse-group">
            <circle cx={coords.x} cy={coords.y} r={46} fill="url(#checkGlow)" className="animate-pulse" />
            <rect
              x={tl.x + 3}
              y={tl.y + 3}
              width={94}
              height={94}
              rx={8}
              fill="rgba(239, 68, 68, 0.15)"
              stroke="#ef4444"
              strokeWidth="3.5"
              className="animate-pulse"
            />
          </g>
        );
      })()}

      {/* Layer 2: Threat Indicators (Hanging & Pinned) */}
      {threats.map((threat, idx) => {
        const coords = squareToCoords(threat.square, orientation);
        if (threat.type === 'hanging') {
          return (
            <circle
              key={`threat-hanging-${threat.square}-${idx}`}
              cx={coords.x}
              cy={coords.y}
              r={42}
              fill="rgba(245, 158, 11, 0.12)"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
          );
        }
        if (threat.type === 'pinned') {
          return (
            <g key={`threat-pinned-${threat.square}-${idx}`}>
              {/* Optional Pin Ray */}
              {threat.pinnerSquare && (() => {
                const pinnerCoords = squareToCoords(threat.pinnerSquare, orientation);
                return (
                  <line
                    x1={pinnerCoords.x}
                    y1={pinnerCoords.y}
                    x2={coords.x}
                    y2={coords.y}
                    stroke="#a855f7"
                    strokeWidth="6"
                    strokeDasharray="8 6"
                    opacity="0.45"
                    strokeLinecap="round"
                  />
                );
              })()}
              <circle
                cx={coords.x}
                cy={coords.y}
                r={42}
                fill="rgba(168, 85, 247, 0.12)"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />
            </g>
          );
        }
        return null;
      })}

      {/* Layer 3: Candidate Move Arrows */}
      {arrows.map((arrow) => {
        const p1 = squareToCoords(arrow.from, orientation);
        const p2 = squareToCoords(arrow.to, orientation);
        const isKnight = arrow.isKnight ?? isKnightMove(arrow.from, arrow.to);
        const pathData = isKnight ? computeKnightLPath(p1, p2) : computeStraightArrowPath(p1, p2);

        const isSelected = selectedArrowId === arrow.id;
        const color =
          arrow.color ||
          (arrow.classification ? CLASSIFICATION_COLORS[arrow.classification] : '#38bdf8');
        const markerId = arrow.classification
          ? `arrowhead-${arrow.classification}`
          : 'arrowhead-default';
        const strokeWidth = isSelected ? 16 : 13;
        const opacity = isSelected ? 0.95 : (arrow.opacity ?? 0.8);

        return (
          <path
            key={arrow.id}
            d={pathData.d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#${markerId})`}
            opacity={opacity}
            fill="none"
          />
        );
      })}
    </svg>
  );
};
