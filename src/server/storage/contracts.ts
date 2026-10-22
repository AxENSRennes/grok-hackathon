import type { RoundResult } from '../../shared/protocol.js';
import type { QuestionSource } from '../questions/index.js';

export interface RoundResultStore {
  save(result: RoundResult): Promise<void>;
}

// Pino's serialized, redacted JSON record, with a stable export ID.
export interface DiagnosticEvent {
  id: string;
  schemaVersion: 1;
  time: number;
  level: number;
  service: string;
  event?: string;
  roomId?: string;
  [key: string]: unknown;
}

export interface DiagnosticSink {
  // Adapters must honor cancellation and reject on a failed write.
  writeBatch(events: readonly DiagnosticEvent[], signal: AbortSignal): Promise<void>;
}

export interface BackendStorage {
  roundResults: RoundResultStore;
  questions: QuestionSource;
  diagnostics?: DiagnosticSink;
}
