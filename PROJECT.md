# Project: Chess Intelligent Web Application

## Architecture
A modern, decoupled, multi-tier chess training web application built with React, Vite, Tailwind CSS, TypeScript, chess.js, and Stockfish WASM.
The architecture consists of three decoupled layers:
1. **Core Game & Rules Layer (`/src/rules`)**:
   - FIDE-compliant chess rules engine wrapping `chess.js` (castling, en passant, pawn promotion, check/checkmate, stalemate, 50-move rule, threefold repetition).
   - `GameModeManager` coordinating Normal, Smart, and Expert modes. Core game state (`fen`, `history`, `clocks`, `turn`) is completely decoupled from mode policies to allow seamless zero-latency mid-game switching without resets or desynchronization.
   - Attack and square control differential matrices ($\Delta(s) = A_w(s) - A_b(s)$).

2. **Engine, Domino Simulation & Coaching Layer (`/src/engine`)**:
   - Stockfish WASM single-threaded engine running in a dedicated Web Worker (`stockfish.worker.ts`) via UCI protocol.
   - Autonomous pure TypeScript fallback minimax engine (3-4 ply alpha-beta with PeSTO evaluation tables) for 100% offline, zero-crash resilience.
   - Move classification via Lichess sigmoidal win-probability model ($WP(cp) = 100 / (1 + \exp(-0.00368208 \times cp))$): Brilliant, Best, Great, Good, Inaccuracy, Mistake, Blunder.
   - Domino-Effect Analysis Engine: forward simulation over 2–5 plies detecting the 4-stage causal chain: [Cause $\to$ Trigger $\to$ Crisis $\to$ Consequence]. Detects conceded outposts, key square control loss, trapped pieces, forks, pins, skewers, discovered attacks, deflections, and hanging pieces.
   - Branching scenario tree data structure ($\le 6$ nodes per candidate line) with ply navigation.
   - Natural language coach commentary translation engine adapting engine evals into Beginner, Intermediate, and Expert GM personas.

3. **Interactive UI & Visualizations Layer (`/src/components`)**:
   - Modern, responsive application layout (Desktop 3-column, Tablet 2-column, Mobile layout) with Tailwind CSS and Lucide icons.
   - Chessboard component with unified 60fps PointerEvents drag-and-drop & click-to-move, board flipping, and SAN move notation history with time-travel inspection.
   - Zero-asset procedural Web Audio API sound synthesizer (move thock, capture snap, check chime, castling double-tap).
   - Resolution-independent SVG vector overlays (`viewBox="0 0 800 800"`): candidate move arrows with Knight L-routing, threat halos, check pulse, and square control heatmap.
   - Interactive Domino Effect Explorer panel with branching scenario trees, tactical tags, ply scrubber, and live main-board variation preview.
   - Coach commentary panel with dynamic grandmaster advice and evaluation gauge.

---

## Feature Inventory
Every feature from user requirements and the survey phase is assigned to an authoritative milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | FIDE Rules & Move Legality | Castling, en passant, promotion, check, mate, stalemate, 50-move, threefold repetition | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Multi-Tier Mode Architecture | Decoupled state coordinator for Normal, Smart, Expert modes with seamless mid-game switching | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Perft & Rules Test Suite | Automated verification of move generation and edge-case FENs | M1, E2E | ORIGINAL_REQUEST §Acceptance |
| 4 | Project Build & Toolchain Scaffold | React, Vite, Tailwind CSS, TypeScript, Vitest configuration | M1 | ORIGINAL_REQUEST §Acceptance |
| 5 | Stockfish WASM Worker | Web Worker UCI communication, MultiPV parsing, cancellation | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Fallback Minimax Engine | Pure TypeScript offline alpha-beta engine with PeSTO tables | M2 | Survey 2 |
| 7 | Win Probability & Move Classifier | Sigmoidal WP mapping, classifications (Brilliant, Best, Great, Good, Inaccuracy, Mistake, Blunder) | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Tactical & Positional Detectors | Forks, pins, skewers, discovered attacks, deflections, hanging pieces, outposts, square control | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Domino-Effect Causal Simulation | 4-stage causal simulation (Cause -> Trigger -> Crisis -> Consequence) across 2–5 plies | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Scenario Tree Data Structure | Multi-ply branching trees with evaluation badges and tactical tags | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Coach Commentary Logic | Plain-English grandmaster advice generator for Beginner, Intermediate, Expert personas | M2 | ORIGINAL_REQUEST §R3 |
| 12 | Tactical Detection Benchmarks | Automated test suite verifying detection of known forks, pins, and blunders | M2, E2E | ORIGINAL_REQUEST §Acceptance |
| 13 | Interactive Chessboard UI | PointerEvents 60fps drag-and-drop, click-to-move, board flip, SAN notation history | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Procedural Audio Synthesizer | Web Audio API sound effects (move, capture, check, castle) with zero external assets | M3 | Survey 3 |
| 15 | Visual Overlays Layer | SVG candidate move arrows (Knight L-paths), square control heatmap, threat halos | M3 | ORIGINAL_REQUEST §R3 |
| 16 | Domino Effect Explorer Panel | Branching scenario tree UI, ply stepping/scrubbing, live main-board variation preview | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Coach Commentary UI Panel | Persona commentary presentation, evaluation gauges, game mode switcher | M3 | ORIGINAL_REQUEST §R3 |
| 18 | E2E Requirement Test Suite | Comprehensive opaque-box test suite (Tiers 1–4) covering all features and boundary cases | E2E | ORIGINAL_REQUEST §Acceptance |
| 19 | 100% E2E Pass & Hardening | Implementation passes 100% E2E tests + Tier 5 adversarial coverage hardening | M4 | Project Pattern |
| 20 | Clean Build & Dev Server | Zero compilation/lint errors (`npm run build`) and operational dev server | M4 | ORIGINAL_REQUEST §Acceptance |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite | Independent opaque-box test runner & Tiers 1-4 test cases (Feature, Boundary, Combinatorial, Real-World) | none | DONE |
| M1 | Core Chess Rules & Project Foundation | Toolchain setup, `chess.js` wrapper, GameModeManager (Normal/Smart/Expert), square control calculator, Perft unit tests | none | DONE |
| M2 | Engine & Domino Analysis Layer | Stockfish WASM Web Worker, fallback minimax engine, win-probability classifier, tactical detectors, domino causal engine, scenario trees, coach commentary logic, benchmark tests | M1 | DONE |
| M3 | Interactive Learning & Visualization UI | Responsive layout, PointerEvents chessboard, procedural audio, SVG overlays, Domino Explorer panel, Coach Commentary panel | M1, M2 | DONE |
| M4 | Final E2E Verification & Adversarial Hardening | Phase 1: 100% pass on E2E test suite (Tiers 1-4); Phase 2: Tier 5 adversarial hardening; clean build (`npm run build`) and dev server verification | E2E, M3 | DONE (100% verified) |

---

## Interface Contracts

### 1. Rules ↔ Engine (`/src/types/rules.ts` & `/src/types/engine.ts`)
```typescript
export type GameMode = 'normal' | 'smart' | 'expert';
export type MoveClassification = 'brilliant' | 'best' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface SquareControlMap {
  white: number[]; // 64-length array of attacker counts
  black: number[]; // 64-length array of attacker counts
  differential: number[]; // white - black
}

export interface CandidateMoveEvaluation {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  centipawns: number;
  winProbability: number;
  deltaWinProbability: number;
  classification: MoveClassification;
  tacticalMotifs: string[]; // e.g. 'fork', 'pin', 'hanging_piece', 'conceded_outpost'
  pv: string[]; // principal variation line
}

export interface DominoCausalStep {
  ply: number;
  moveSan: string;
  player: 'white' | 'black';
  stage: 'cause' | 'trigger' | 'crisis' | 'consequence';
  description: string;
  tacticalTag?: string;
  squareChanges?: string[];
}

export interface ScenarioTreeNode {
  id: string;
  san: string;
  fen: string;
  ply: number;
  centipawns: number;
  winProbability: number;
  tacticalTags: string[];
  dominoExplanation: string;
  children: ScenarioTreeNode[];
}
```

### 2. Engine ↔ UI (`/src/types/ui.ts`)
```typescript
export interface GameStateDTO {
  fen: string;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  drawReason?: 'stalemate' | 'threefold' | '50-move' | 'insufficient';
  history: string[]; // SAN moves
  activeMode: GameMode;
  candidateMoves: CandidateMoveEvaluation[];
  activeScenarioTree?: ScenarioTreeNode;
  activeDominoChain?: DominoCausalStep[];
  squareControl: SquareControlMap;
  coachAdvice: {
    beginner: string;
    intermediate: string;
    expert: string;
  };
}

export interface GameActions {
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  setGameMode: (mode: GameMode) => void;
  selectCandidateMove: (san: string | null) => void;
  previewVariationPly: (fen: string | null) => void;
  resetGame: () => void;
  flipBoard: () => void;
  jumpToHistoryPly: (plyIndex: number) => void;
}
```

---

## Code Layout
The workspace adheres to strict module boundaries:
```
c:\Chess\
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
├── public/
│   └── engine/
│       ├── stockfish.js
│       └── stockfish.wasm
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   ├── chess.ts
│   │   ├── rules.ts
│   │   ├── engine.ts
│   │   └── ui.ts
│   ├── rules/
│   │   ├── chessGame.ts          # Core game coordinator
│   │   ├── gameModeManager.ts    # Normal / Smart / Expert mode coordinator
│   │   └── squareControl.ts      # Square control & attack matrices
│   ├── engine/
│   │   ├── stockfishClient.ts    # Web Worker UCI client
│   │   ├── fallbackMinimax.ts    # Pure TS alpha-beta fallback engine
│   │   ├── winProbability.ts     # Sigmoidal WP model & move classifier
│   │   ├── tacticalDetectors.ts  # Forks, pins, skewers, outposts, hanging
│   │   ├── dominoEngine.ts       # 4-stage causal domino simulator
│   │   ├── scenarioTree.ts       # Branching tree builder
│   │   └── coachCommentary.ts    # Persona advice generator
│   ├── components/
│   │   ├── Chessboard/
│   │   │   ├── Chessboard.tsx     # PointerEvents DnD & click-to-move
│   │   │   ├── Square.tsx
│   │   │   ├── Piece.tsx
│   │   │   └── MoveHistory.tsx
│   │   ├── Overlays/
│   │   │   ├── SvgOverlay.tsx     # Arrows, Knight L-paths, threat halos
│   │   │   └── HeatmapOverlay.tsx # Square control heatmap
│   │   ├── DominoExplorer/
│   │   │   ├── DominoExplorer.tsx # Scenario tree view & ply scrubber
│   │   │   └── TreeNode.tsx
│   │   ├── CoachPanel/
│   │   │   ├── CoachPanel.tsx     # Grandmaster persona advice
│   │   │   └── EvalBar.tsx        # Centipawn / WP gauge
│   │   └── Controls/
│   │       ├── ModeSelector.tsx   # Normal / Smart / Expert switcher
│   │       └── GameControls.tsx   # Flip, reset, undo
│   └── audio/
│       └── soundSynthesizer.ts   # Web Audio API procedural synthesis
└── test/
    ├── e2e/                      # Opaque-box E2E test suite (Tiers 1-4)
    ├── rules/                    # Perft & core rules tests
    ├── engine/                   # Tactical benchmark & eval tests
    └── components/               # UI & interaction tests
```
