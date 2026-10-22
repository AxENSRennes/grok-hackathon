import { randomUUID } from 'node:crypto';
import pino, { type DestinationStream } from 'pino';
import type { DiagnosticEvent, DiagnosticSink } from './storage/contracts.js';

const MAX_PENDING_EVENTS = 1000;
const EXPORT_TIMEOUT_MS = 3000;

export function createDiagnosticLogger(sink?: DiagnosticSink, destination: DestinationStream = pino.destination(1)) {
  const options = {
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'sidequest', schemaVersion: 1 },
    mixin: () => ({ id: randomUUID() }),
    redact: ['cookie', 'password', 'token', 'hostKey', 'authorization'],
  };
  // Export failures only go to stdout, never back into the failing sink.
  const localLogger = pino(options, destination);
  if (!sink) return { logger: localLogger, flush: async () => {}, close: async () => {} };

  let pending: DiagnosticEvent[] = [];
  let dropped = 0;
  let closed = false;
  let inFlight: Promise<void> | undefined;
  const stream: DestinationStream = {
    write(line: string) {
      if (closed) return;
      if (pending.length >= MAX_PENDING_EVENTS) { dropped++; return; }
      // Pino applies redaction and error serialization before reaching this stream.
      pending.push(JSON.parse(line) as DiagnosticEvent);
    },
  };
  const flush = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (dropped) {
      localLogger.warn({ event: 'diagnostic_export_dropped', count: dropped }, 'Diagnostic export queue full');
      dropped = 0;
    }
    if (!pending.length) return Promise.resolve();
    const batch = pending;
    pending = [];
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Diagnostic export timed out.'));
      }, EXPORT_TIMEOUT_MS);
      timeout.unref();
    });
    inFlight = Promise.race([
      Promise.resolve().then(() => sink.writeBatch(batch, controller.signal)), deadline,
    ]).catch(() => {
      // Do not log provider errors: they may contain credentials or request bodies.
      localLogger.warn({ event: 'diagnostic_export_failed', count: batch.length }, 'Diagnostic export failed; stdout retained');
    }).finally(() => { clearTimeout(timeout); inFlight = undefined; });
    return inFlight;
  };
  const timer = setInterval(() => { void flush(); }, 1000);
  timer.unref();
  const logger = pino(options, pino.multistream([
    { level: 'trace', stream: destination }, { level: 'trace', stream },
  ]));
  return {
    logger, flush,
    async close() {
      closed = true;
      clearInterval(timer);
      await flush();
      // A batch may have been waiting behind an export that was already in flight.
      await flush();
    },
  };
}
