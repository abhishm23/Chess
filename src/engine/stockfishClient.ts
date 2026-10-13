/**
 * src/engine/stockfishClient.ts
 * Single-threaded Stockfish WASM Web Worker client with UCI protocol handling,
 * MultiPV line streaming, timeout failover to pure TS minimax, and search cancellation.
 */

import {
  IChessEngine,
  EngineAnalysisResult,
  SearchOptions,
  MultiPVLine,
  EngineScore,
} from '../types/engine';
import { FallbackMinimaxEngine } from './fallbackMinimax';

export interface StockfishClientOptions {
  workerUrl?: string;
  initTimeoutMs?: number;
  fallbackEngine?: IChessEngine;
}

interface ActiveJob {
  jobId: number;
  fen: string;
  depth: number;
  lines: Map<number, MultiPVLine>;
  startTime: number;
  resolve: (result: EngineAnalysisResult) => void;
  reject: (reason: any) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class StockfishClient implements IChessEngine {
  /**
   * Effective engine implementation. Reports `fallback_minimax` whenever the WASM
   * worker was unavailable (or failed later), so callers can choose a search budget
   * that the active engine can actually honour instead of hanging the UI thread.
   */
  public get engineType(): 'stockfish_wasm' | 'fallback_minimax' {
    return this.activeDelegate ? 'fallback_minimax' : 'stockfish_wasm';
  }

  private worker: Worker | null = null;
  private readonly workerUrl: string;
  private readonly initTimeoutMs: number;
  private readonly fallbackEngine: IChessEngine;
  private activeDelegate: IChessEngine | null = null;

  private isInitialized = false;
  private isReadyState = false;
  private initPromise: Promise<void> | null = null;

  private currentJobId = 0;
  private activeJob: ActiveJob | null = null;
  private currentMultiPV = 3;
  private ignoredBestMovesCount = 0;

  constructor(options: StockfishClientOptions = {}) {
    this.workerUrl = options.workerUrl || '/engine/stockfish.js';
    this.initTimeoutMs = options.initTimeoutMs ?? 2500;
    this.fallbackEngine = options.fallbackEngine || new FallbackMinimaxEngine();
  }

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve) => {
      // 1. Guard against non-browser environments (e.g. Node/Vitest)
      if (typeof Worker === 'undefined') {
        this.activateFallback('Worker API unavailable in this environment');
        resolve();
        return;
      }

      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        this.worker = new Worker(this.workerUrl);
      } catch (err) {
        this.activateFallback(`Failed to instantiate Worker at ${this.workerUrl}: ${err}`);
        resolve();
        return;
      }

      // 2. Set failover timeout
      timeoutTimer = setTimeout(() => {
        if (!this.isReadyState) {
          this.activateFallback(`Stockfish worker initialization timed out after ${this.initTimeoutMs}ms`);
          resolve();
        }
      }, this.initTimeoutMs);

      // 3. Setup message and error handlers
      this.worker.onmessage = (event: MessageEvent) => {
        const line = typeof event.data === 'string' ? event.data.trim() : '';
        if (!line) return;

        if (line === 'uciok') {
          this.sendCommand('setoption name Threads value 1');
          this.sendCommand('setoption name Hash value 16');
          this.sendCommand(`setoption name MultiPV value ${this.currentMultiPV}`);
          this.sendCommand('isready');
        } else if (line === 'readyok') {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          this.isReadyState = true;
          this.isInitialized = true;
          resolve();
        } else {
          this.handleWorkerMessage(line);
        }
      };

      this.worker.onerror = (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        this.activateFallback(`Worker error encountered: ${err.message || err}`);
        resolve();
      };

      // 4. Start UCI handshake
      this.sendCommand('uci');
    });

    return this.initPromise;
  }

  private activateFallback(reason: string): void {
    console.warn(`[StockfishClient] ${reason}. Failing over to FallbackMinimaxEngine.`);
    this.terminateWorker();
    this.activeDelegate = this.fallbackEngine;
    this.isReadyState = true;
    this.isInitialized = true;
  }

  public async evaluate(fen: string, options?: SearchOptions): Promise<EngineAnalysisResult> {
    if (!this.isInitialized) {
      await this.init();
    }

    // Route to fallback delegate if active
    if (this.activeDelegate) {
      return this.activeDelegate.evaluate(fen, options);
    }

    // Cancel any ongoing search before launching new one
    this.stop();

    const jobId = ++this.currentJobId;
    const depth = options?.depth || 12;
    const multiPV = options?.multiPV || this.currentMultiPV;

    if (multiPV !== this.currentMultiPV) {
      this.currentMultiPV = multiPV;
      this.sendCommand(`setoption name MultiPV value ${multiPV}`);
    }

    return new Promise<EngineAnalysisResult>((resolve, reject) => {
      // Setup AbortSignal listener if provided
      if (options?.signal) {
        if (options.signal.aborted) {
          reject(new DOMException('Search aborted before dispatch', 'AbortError'));
          return;
        }
        options.signal.addEventListener('abort', () => {
          if (this.activeJob?.jobId === jobId) {
            this.stop();
            reject(new DOMException('Search aborted by signal', 'AbortError'));
          }
        }, { once: true });
      }

      this.activeJob = {
        jobId,
        fen,
        depth,
        lines: new Map<number, MultiPVLine>(),
        startTime: performance.now(),
        resolve,
        reject,
      };

      // Set hard timeout guard
      const maxTimeMs = (options?.movetimeMs || 6000) + 2000;
      this.activeJob.timer = setTimeout(() => {
        if (this.activeJob?.jobId === jobId) {
          this.stop();
          this.settleActiveJob();
        }
      }, maxTimeMs);

      // Dispatch UCI commands
      this.sendCommand(`position fen ${fen}`);
      let goCmd = 'go';
      if (options?.depth) goCmd += ` depth ${options.depth}`;
      if (options?.movetimeMs) goCmd += ` movetime ${options.movetimeMs}`;
      if (!options?.depth && !options?.movetimeMs) goCmd += ` depth ${depth}`;
      this.sendCommand(goCmd);
    });
  }

  private handleWorkerMessage(line: string): void {
    if (this.ignoredBestMovesCount > 0) {
      if (line.startsWith('bestmove ')) {
        this.ignoredBestMovesCount--;
      }
      return;
    }

    if (!this.activeJob) return;

    if (line.startsWith('info ') && line.includes(' score ')) {
      this.parseInfoLine(line);
    } else if (line.startsWith('bestmove ')) {
      const parts = line.split(/\s+/);
      const bestMove = parts[1] || '';
      this.settleActiveJob(bestMove);
    }
  }

  private parseInfoLine(line: string): void {
    if (!this.activeJob) return;

    // Extract MultiPV index (default to 1)
    const mpvMatch = line.match(/multipv\s+(\d+)/);
    const multipv = mpvMatch ? parseInt(mpvMatch[1], 10) : 1;

    const depthMatch = line.match(/depth\s+(\d+)/);
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : this.activeJob.depth;

    let score: EngineScore = { type: 'cp', value: 0 };
    const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
    const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);

    if (cpMatch) {
      score = { type: 'cp', value: parseInt(cpMatch[1], 10) };
    } else if (mateMatch) {
      score = { type: 'mate', value: parseInt(mateMatch[1], 10) };
    }

    const nodesMatch = line.match(/nodes\s+(\d+)/);
    const nodes = nodesMatch ? parseInt(nodesMatch[1], 10) : undefined;

    const npsMatch = line.match(/nps\s+(\d+)/);
    const nps = npsMatch ? parseInt(npsMatch[1], 10) : undefined;

    const pvMatch = line.match(/\spv\s+(.+)$/);
    const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

    const pvLine: MultiPVLine = {
      multipv,
      depth,
      score,
      pv,
      nodes,
      nps,
    };

    this.activeJob.lines.set(multipv, pvLine);
  }

  private settleActiveJob(bestMoveFallback?: string): void {
    if (!this.activeJob) return;

    const job = this.activeJob;
    this.activeJob = null;

    if (job.timer) clearTimeout(job.timer);

    const sortedLines = Array.from(job.lines.values()).sort((a, b) => a.multipv - b.multipv);
    const bestMove = bestMoveFallback || sortedLines[0]?.pv[0] || '';
    const durationMs = Math.round(performance.now() - job.startTime);

    job.resolve({
      jobId: job.jobId,
      fen: job.fen,
      depth: job.depth,
      lines: sortedLines,
      bestMove,
      durationMs,
    });
  }

  public stop(): void {
    if (this.activeDelegate) {
      this.activeDelegate.stop();
      return;
    }

    if (this.worker && this.activeJob) {
      this.ignoredBestMovesCount++;
      this.sendCommand('stop');
      this.settleActiveJob();
    }
  }

  public terminate(): void {
    this.stop();
    this.terminateWorker();
    if (this.fallbackEngine) {
      this.fallbackEngine.terminate();
    }
    this.isReadyState = false;
    this.isInitialized = false;
  }

  private terminateWorker(): void {
    this.ignoredBestMovesCount = 0;
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Silently handle termination of disposed worker
      }
      this.worker = null;
    }
  }

  public isReady(): boolean {
    return this.isReadyState;
  }

  private sendCommand(cmd: string): void {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }
}
