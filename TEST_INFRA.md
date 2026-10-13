# Authoritative E2E Test Infrastructure Specification

**Project**: Chess Intelligent Web Application (`c:\Chess`)  
**Document**: `TEST_INFRA.md`  
**Author**: E2E Test Writer  
**Status**: ACTIVE SPECIFICATION  
**Last Updated**: 2026-09-19  

---

## 1. Test Philosophy & Principles

The Chess Intelligent Web Application is an educational, interactive platform combining standard tournament chess play with intelligent guided analysis (**Smart Mode**), grandmaster-grade evaluation (**Expert Mode**), a **Domino Effect Analysis Engine** (projecting downstream cascading consequences over 2–5 plies), and a responsive React/Vite UI.

To guarantee zero regression, complete rule compliance, and mathematical precision across all features, the test suite follows five core principles:

### 1.1 Opaque-Box Contract Verification
Tests exercise the application strictly through public interface contracts and observable state transitions as defined in `PROJECT.md § Interface Contracts`:
- `GameStateDTO`: Complete representation of board state, FEN, active mode, history, candidate moves, domino chains, scenario trees, and coach commentary.
- `GameActions`: Public actions callable by UI or player (`makeMove`, `setGameMode`, `selectCandidateMove`, `previewVariationPly`, `resetGame`, `flipBoard`, `jumpToHistoryPly`).
- `RulesToEngineContract`: Legal move generation, hypothetical move validation, square control computation, and pinned piece detection.
- Internal private implementations are never mocked or tested directly; assertions verify the system's observable behavior against formal specifications.

### 1.2 Authoritative Expected Output Derivation
Every assertion in the test suite is derived from an unassailable external standard:
1. **FIDE Laws of Chess**: Standard move validation, castling rights, en passant capture windows, pawn promotion, check, checkmate, stalemate, 50-move rule, threefold repetition, and insufficient material.
2. **Perft (Performance Test) Benchmark Counts**: Canonical leaf node counts established by Peter McKenzie and the Chess Programming Wiki across depths 1–4.
3. **Lichess Sigmoidal Win-Probability Model**:
   $$WP(cp) = \frac{100}{1 + \exp(-0.00368208 \times cp)}$$
   Win-probability curves and centipawn threshold mappings ($cp \ge +150$ for winning material sacrifices; $\Delta WP \le 0.5\%$ Best, $\le 2.0\%$ Great, $\le 5.0\%$ Good, $\le 10.0\%$ Inaccuracy, $\le 20.0\%$ Mistake, $> 20.0\%$ Blunder).
4. **Historical Grandmaster Games & Tactical Puzzles**: Authoritative PGN game records (Garry Kasparov vs. Veselin Topalov 1999, Paul Morphy's Opera Game 1858, Noah's Ark Trap, Greek Gift Sacrifice, Lucena Endgame).

### 1.3 State Isolation & Independence
- Each test case is completely self-contained.
- Tests set up their own initial positions, FEN strings, or game actions.
- Tests do not rely on side effects, global state leakage, or execution order.
- Tear-down cleans up any allocated memory, timers, or worker references.

### 1.4 Test Integrity & Anti-Cheating Mandate
- **No Facade Tests**: Trivial assertions like `expect(true).toBe(true)` or mocks that return hardcoded true without exercising real chess logic are strictly prohibited.
- **Genuine Verification**: Tests compute real legal moves, evaluate board states, detect actual pins and forks, and track genuine game history.
- An independent forensic auditor verifies test authenticity before sign-off.

---

## 2. Feature Inventory Coverage Matrix

Every feature defined in `PROJECT.md § Feature Inventory` is mapped to its corresponding test tier, validation strategy, and target test file:

| # | Feature | Target Milestone | Test Tier | Validation Strategy | Test Suite File |
|---|---------|------------------|-----------|---------------------|-----------------|
| 1 | FIDE Rules & Move Legality | M1 | Tier 1, 2 | Castling, en passant, promotion, checkmate, stalemate, draws | `tier1_features.test.ts`, `tier2_boundaries.test.ts` |
| 2 | Multi-Tier Mode Architecture | M1 | Tier 1, 3 | Seamless switching Normal ↔ Smart ↔ Expert; state preservation | `tier1_features.test.ts`, `tier3_combinatorial.test.ts` |
| 3 | Perft & Rules Verification | M1 | Tier 1, 2 | Leaf node counting on standard initial & Kiwipete positions | `tier1_features.test.ts`, `tier2_boundaries.test.ts` |
| 4 | Project Toolchain Scaffold | M1 | Tier 1 | Build, configuration, and runner execution | Vitest test runner configuration |
| 5 | Stockfish WASM Client | M2 | Tier 1, 2 | UCI protocol handshake, MultiPV parsing, cancellation | `tier1_features.test.ts`, `tier2_boundaries.test.ts` |
| 6 | Fallback Minimax Engine | M2 | Tier 1 | Pure TS alpha-beta search, PeSTO tables, 100% offline resilience | `tier1_features.test.ts` |
| 7 | Win Probability & Move Classifier | M2 | Tier 1, 2 | Sigmoidal formula, mate-in-N mapping, move quality classifications | `tier1_features.test.ts`, `tier2_boundaries.test.ts` |
| 8 | Tactical & Positional Detectors | M2 | Tier 1, 2 | Absolute/relative pins, forks, skewers, discovered attacks, outposts | `tier1_features.test.ts`, `tier2_boundaries.test.ts` |
| 9 | Domino-Effect Causal Simulation | M2 | Tier 1, 3 | 4-stage causal chain: [Cause → Trigger → Crisis → Consequence] | `tier1_features.test.ts`, `tier3_combinatorial.test.ts` |
| 10 | Scenario Tree Data Structure | M2 | Tier 1, 3 | Multi-ply branching tree, node IDs, evaluation deltas | `tier1_features.test.ts`, `tier3_combinatorial.test.ts` |
| 11 | Coach Commentary Logic | M2 | Tier 1 | Plain English GM advice for Beginner, Intermediate, Expert personas | `tier1_features.test.ts` |
| 12 | Tactical Detection Benchmarks | M2 | Tier 1, 4 | Detection accuracy on canonical benchmark positions | `tier1_features.test.ts`, `tier4_realworld.test.ts` |
| 13 | Interactive Chessboard UI State | M3 | Tier 1, 3 | Selection, move input, board flip, SAN notation history | `tier1_features.test.ts`, `tier3_combinatorial.test.ts` |
| 14 | Procedural Audio Synthesizer | M3 | Tier 1 | Web Audio API sound event dispatch (move, capture, check, castle) | `tier1_features.test.ts` |
| 15 | Visual Overlays Layer Data | M3 | Tier 1 | Candidate arrows (Knight L-bends), square control heatmap matrices | `tier1_features.test.ts` |
| 16 | Domino Effect Explorer Panel | M3 | Tier 1, 3 | Tree navigation, ply stepping, live board variation preview | `tier1_features.test.ts`, `tier3_combinatorial.test.ts` |
| 17 | Coach Commentary UI Panel | M3 | Tier 1 | Persona switching, sentiment cards, evaluation gauges | `tier1_features.test.ts` |
| 18 | E2E Requirement Test Suite | E2E | Tiers 1-4 | Comprehensive opaque-box test suite across all 4 tiers | `test/e2e/*.test.ts` |
| 19 | 100% E2E Pass & Hardening | M4 | All Tiers | Verification across all 4 tiers without failure | Master test runner |
| 20 | Clean Build & Dev Server | M4 | Infra | Zero TypeScript errors, zero bundler warnings | Toolchain verification |

---

## 3. Systematic 4-Tier Test Architecture

The E2E test suite is organized into 4 systematic, progressively challenging tiers:

```
test/e2e/
├── tier1_features.test.ts     # Tier 1: Core Feature Verification (≥5 tests per feature)
├── tier2_boundaries.test.ts   # Tier 2: Boundary & Corner Cases (≥5 tests per feature)
├── tier3_combinatorial.test.ts# Tier 3: Pairwise & Combinatorial Interactions
└── tier4_realworld.test.ts    # Tier 4: Grandmaster Games & Tactical Benchmarks
```

### 3.1 Tier 1: Core Feature Verification (`tier1_features.test.ts`)
Validates the primary "happy path" and functional contracts for each assigned feature, requiring at least 5 test cases per feature area:
1. **FIDE Rules & Standard Moves (≥5 tests)**:
   - Initial position pawn pushes (single vs double step).
   - Minor and major piece movement (Knights jumping, Bishops on diagonals, Rooks on files/ranks, Queen 8 directions).
   - Standard kingside ($O-O$) and queenside ($O-O-O$) castling.
   - En passant capture execution and pawn removal.
   - Pawn promotion to Queen on 8th rank.
   - Standard checkmate delivery (e.g. Scholar's Mate).
2. **Multi-Tier Mode Switching (≥5 tests)**:
   - Initial game mode default configuration.
   - Switching from Normal to Smart mode preserves FEN, clocks, and move history.
   - Switching from Smart to Expert mode activates multi-ply scenario trees and GM commentary.
   - Switching from Expert back to Normal mode disables coaching and clears analysis overlays without resetting the board.
   - Rapid multi-toggle cycle (Normal → Smart → Expert → Normal) with zero state drift.
3. **Engine Evaluation & Win-Probability Mapping (≥5 tests)**:
   - Exact mathematical evaluation of $WP(0) = 50.0\%$, $WP(+100) \approx 59.1\%$, $WP(+300) \approx 75.1\%$, $WP(-300) \approx 24.9\%$.
   - Mate score mapping ($M > 0 \implies \ge 99.0\%$, $M < 0 \implies \le 1.0\%$).
   - Move classification: Best ($\Delta WP \le 0.5\%$).
   - Move classification: Inaccuracy ($5.0\% < \Delta WP \le 10.0\%$).
   - Move classification: Blunder ($\Delta WP > 20.0\%$ or drop from winning to losing).
4. **Domino-Effect Causal Simulation (≥5 tests)**:
   - 4-stage causal sequence structure: Cause (Ply 1), Trigger (Ply 2), Crisis (Ply 3), Consequence (Ply 4–5).
   - Consequence detection: Conceded outpost on central square (`d5`/`e4`).
   - Consequence detection: Lost control of key square in King's shelter.
   - Consequence detection: Trapped piece with 0 safe escape squares.
   - Consequence detection: Tactical fork sequence unfolding over 3 plies.
5. **Tactical & Positional Motifs (≥5 tests)**:
   - Royal fork detection (Knight attacking King + Queen).
   - Absolute pin detection (Bishop pinning Knight to King).
   - Relative pin detection (Bishop pinning Knight to Queen).
   - Skewer detection (Rook attacking King with Rook behind).
   - Discovered check detection (Knight moves exposing Rook attack on King).
6. **UI State & Action Contracts (≥5 tests)**:
   - `GameStateDTO` integrity across turns.
   - `SquareControlMap` computation ($\Delta(s) = A_w(s) - A_b(s)$) for all 64 squares.
   - SAN move history appending and ply count tracking.
   - Board flipping toggles perspective without mutating board model.
   - Jump to history ply and restoration to live position.

### 3.2 Tier 2: Boundary & Corner Cases (`tier2_boundaries.test.ts`)
Stress-tests boundary conditions, edge cases, and legal subtleties:
1. **Horizontal En Passant Discovered Check**:
   - FEN `8/8/8/K2pP2r/8/8/8/8 w - d6 0 1`.
   - Capturing `exd6` e.p. removes both pawns from rank 5, exposing King on $a5$ to Rook on $h5$.
   - Must be invalidated as strictly illegal.
2. **Castling Path Invalidation**:
   - King in check cannot castle.
   - King cannot castle through an attacked transit square ($f1/f8$ for $O-O$, $d1/d8$ for $O-O-O$).
   - King cannot castle into check ($g1/g8$ or $c1/c8$).
   - Rook's path attacked on $b1$ does NOT prevent Queenside castling ($O-O-O$) because King only transits $e1 \to d1 \to c1$.
   - Prior King move permanently revokes both castling rights.
3. **Pinned Piece Edge Cases**:
   - Absolutely pinned piece cannot move off the pin line.
   - Absolutely pinned piece CAN move along the pin line (e.g. pinned Rook capturing attacker on the same file).
   - Pinned piece STILL exerts square control and prevents enemy King from entering attacked squares.
4. **Underpromotions for Avoidance of Stalemate & Immediate Mate**:
   - FEN `7k/P7/5N1K/8/8/8/8/8 w - - 0 1`: Promoting to Queen ($a8=Q$) causes immediate stalemate (0 legal moves, not in check).
   - Underpromoting to Knight ($a8=N\#$) gives immediate checkmate.
   - Underpromoting to Rook ($=R$) or Bishop ($=B$) to avoid unintended queen stalemate in endgame.
5. **Draw Boundary Conditions**:
   - 50-move rule: Exactly 100 halfmoves without pawn push or capture permits draw claim; reset on pawn push.
   - Threefold repetition: Requires identical position, turn, castling rights, and en passant square. If castling rights changed between occurrences, threefold repetition does NOT trigger.
   - Insufficient material: $K$ vs $K$, $K+N$ vs $K$, $K+B$ vs $K$, $K+B$ vs $K+B$ (same color bishops).
   - Stalemate detection: Active player not in check, zero legal moves available.
6. **Engine Timeout & Asynchronous Cancellation**:
   - Rapid search cancellation via `stop` signal when user moves or switches candidate previews.
   - Correlated `jobId` ensures outdated engine evaluations are discarded without corrupting active position state.

### 3.3 Tier 3: Combinatorial & Pairwise Interactions (`tier3_combinatorial.test.ts`)
Validates pairwise interactions between independent subsystems:
1. **Mid-Game Mode Switch During Active Domino Calculation**:
   - Switch mode from Smart to Expert while domino simulation is running.
   - System updates analysis profile seamlessly without race conditions or memory corruption.
2. **Pawn Promotion with Simultaneous Discovered Check & Domino Evaluation**:
   - Moving pawn delivers promotion check while unmasking a discovered attack from a Rook.
   - Evaluator registers promotion, check, and discovered attack motifs concurrently.
3. **Fast Time-Travel History Scrubbing During Live Engine Evaluation**:
   - User rapidly scrubs backward and forward through move history while engine is calculating.
   - Board displays exact historical FEN at each step; engine cancels active searches and synchronizes with the selected ply.
4. **Board Flipping During Active Candidate Move Preview**:
   - Flip board while hovering over a candidate move arrow.
   - Visual overlay coordinates invert cleanly while underlying candidate evaluation remains intact.
5. **Threefold Repetition Boundary During Deep Scenario Tree Generation**:
   - Position repeated twice; candidate move tree explores 3rd repetition line.
   - Scenario tree correctly flags the terminal node as draw by threefold repetition.

### 3.4 Tier 4: Real-World Scenarios & Grandmaster Benchmarks (`tier4_realworld.test.ts`)
Executes complete historical games move-by-move and validates canonical tactical puzzles:
1. **Garry Kasparov vs. Veselin Topalov (Wijk aan Zee 1999 — "Kasparov's Immortal")**:
   - 44-move masterwork featuring the famous rook sacrifice `24. Rxd4!!` and King hunt.
   - Tests complete move sequence, check delivery, complex King retreat, and final resignation.
2. **Paul Morphy vs. Duke of Brunswick and Count Isouard (Paris Opera 1858 — "The Opera Game")**:
   - 17-move classic demonstration of development, open lines, and the Queen sacrifice `16. Qb8+!` leading to `17. Rd8#`.
3. **The Noah's Ark Trap (Ruy Lopez)**:
   - Opening sequence `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 d6 5. d4 b5 6. Bb3 Nxd4 7. Nxd4 exd4 8. Qxd4 c5 9. Qd5 Be6 10. Qc6+ Bd7 11. Qd5 c4!`.
   - Verifies White's light-squared Bishop on `b3` is detected as **trapped** with 0 safe escape squares.
4. **The Greek Gift Sacrifice (Classical Bishop Sacrifice on h7)**:
   - Canonical motif `Bxh7+!` followed by `Ng5+` and `Qh5` mating attack.
   - Verifies sacrifice recognition, King shelter destruction, and tactical checkmate progression.
5. **The Lucena Position (Rook Endgame Foundation)**:
   - Essential King and Rook endgame technique ("building a bridge" with `4. Rd4!` and `5. Re4+`).
   - Verifies rook cut-off, king march, and forced pawn promotion against active rook checks.

---

## 4. Real-World Application Scenarios

The test infrastructure validates five end-to-end player journeys:

### Scenario A: The Beginner Journey in Smart Mode
1. Player starts in Smart Mode.
2. Makes opening moves `1. e4 e5 2. Bc4`.
3. Hovers candidate move `2... f6?!`.
4. Smart Mode engine flags inaccuracy: warns that pushing the f-pawn weakens the $e8-h5$ diagonal.
5. Player ignores warning and plays `2... f6?!`.
6. Coach panel displays: *"Weakens King shelter: opens the dangerous diagonal against your King."*
7. Domino Explorer displays opponent's refutation `3. Qh5+` leading to lost castling rights.

### Scenario B: The Club Player in Expert Mode
1. Player switches to Expert Mode mid-game at Move 15.
2. Board state, move history, and clocks remain 100% intact.
3. System displays multi-ply scenario tree with top 3 candidate moves, centipawn evaluations, and win probabilities.
4. Player hovers candidate sacrifice: overlay renders Knight L-arrow and displays tactical tags `[Sacrifice]`, `[Outpost Conceded]`.
5. Player clicks variation node to preview the 3-ply consequence on the board.
6. Player clicks *"Exit Preview"* and returns to the active game without losing position.

### Scenario C: Tactical Refutation & Blunder Alert
1. In equal position, player makes blunder `12. Nxd5??` allowing a devastating back-rank checkmate or royal fork.
2. Win probability drops by $>25\%$.
3. Move classifier automatically assigns `blunder (??)`.
4. Coach panel displays danger alert explaining the 3-step domino chain:
   - Step 1: Knight leaves defensive post on $f3$.
   - Step 2: Opponent strikes with `12... Ne2+` royal fork.
   - Step 3: King must move, Queen is captured on next turn.

---

## 5. Coverage Thresholds & Quality Gates

The test suite enforces the following quantitative quality thresholds:

| Metric | Required Threshold | Verification Command |
|---|---|---|
| **Tier 1 Feature Tests** | $\ge 30$ genuine test cases ($\ge 5$ per feature area) | `npx vitest run test/e2e/tier1_features.test.ts` |
| **Tier 2 Boundary Tests** | $\ge 35$ genuine test cases ($\ge 5$ per boundary area) | `npx vitest run test/e2e/tier2_boundaries.test.ts` |
| **Tier 3 Combinatorial Tests** | $\ge 15$ pairwise interaction test cases | `npx vitest run test/e2e/tier3_combinatorial.test.ts` |
| **Tier 4 Real-World Tests** | $\ge 5$ complete historical games / grandmaster benchmarks | `npx vitest run test/e2e/tier4_realworld.test.ts` |
| **Total Test Cases** | $\ge 85$ executable tests | `npm test` or `npx vitest run test/e2e` |
| **Pass Rate** | **100.0%** (Zero failures, zero skipped, zero unhandled errors) | Automated CI runner |
| **Execution Time** | $\le 10$ seconds total runtime | Vitest test runner |

---

## 6. Test Runner Configuration & Commands

The test suite is executable via standard npm commands:

```bash
# Run all E2E test suites (Tiers 1–4)
npm test

# Run via vitest CLI directly
npx vitest run test/e2e

# Run individual tiers
npx vitest run test/e2e/tier1_features.test.ts
npx vitest run test/e2e/tier2_boundaries.test.ts
npx vitest run test/e2e/tier3_combinatorial.test.ts
npx vitest run test/e2e/tier4_realworld.test.ts
```

All test outputs produce standardized TAP / JUnit compatible reports for downstream CI validation.
