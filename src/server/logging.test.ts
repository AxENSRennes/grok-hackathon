import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagnosticLogger } from './logging.js';
import type { DiagnosticEvent, DiagnosticSink } from './storage/contracts.js';

afterEach(() => { vi.useRealTimers(); });

const capture = () => {
  const lines: string[] = [];
  return { lines, write(line: string) { lines.push(line); } };
};

describe('optional diagnostic export isolation', () => {
  it('exports the same redacted record as stdout and isolates provider failures', async () => {
    const stdout = capture();
    const exported: DiagnosticEvent[] = [];
    const output = createDiagnosticLogger({ async writeBatch(events) {
      exported.push(...events);
      throw new Error('Provider failure containing a private credential');
    } }, stdout);
    try {
      output.logger.error({ event: 'example_failure', roomId: 'ROOM', password: 'private', token: 'private',
        cookie: 'private', hostKey: 'private', authorization: 'private', err: new Error('Example error') });
      await output.flush();
      expect(exported).toHaveLength(1);
      expect(exported[0]).toEqual(JSON.parse(stdout.lines[0]));
      expect(exported[0]).toMatchObject({ id: expect.any(String), schemaVersion: 1, time: expect.any(Number),
        level: 50, event: 'example_failure', roomId: 'ROOM', password: '[Redacted]', token: '[Redacted]',
        cookie: '[Redacted]', hostKey: '[Redacted]', authorization: '[Redacted]', err: { message: 'Example error' } });
      expect(stdout.lines.map(line => JSON.parse(line).event)).toEqual(['example_failure', 'diagnostic_export_failed']);
      expect(stdout.lines.join('')).not.toContain('private credential');
    } finally { await output.close(); }
  });

  it('bounds the waiting queue during an in-flight export and preserves every stdout record', async () => {
    const stdout = capture();
    const batches: (readonly DiagnosticEvent[])[] = [];
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const sink: DiagnosticSink = { async writeBatch(events) { batches.push(events); if (batches.length === 1) await blocked; } };
    const output = createDiagnosticLogger(sink, stdout);
    try {
      output.logger.info({ event: 'first' });
      const first = output.flush();
      for (let i = 0; i < 1100; i++) output.logger.info({ event: 'queued', index: i });
      expect(output.flush()).toBe(first);
      release();
      await first;
      await output.close();
      expect(batches.map(batch => batch.length)).toEqual([1, 1000]);
      const localEvents = stdout.lines.map(line => JSON.parse(line));
      expect(localEvents.filter(record => record.event === 'queued')).toHaveLength(1100);
      expect(localEvents.find(record => record.event === 'diagnostic_export_dropped')).toMatchObject({ count: 100 });
    } finally { release(); await output.close(); }
  });

  it('cancels a hung export after three seconds without rejecting the caller', async () => {
    vi.useFakeTimers();
    const stdout = capture();
    let signal: AbortSignal | undefined;
    const output = createDiagnosticLogger({ writeBatch(_events, cancellation) {
      signal = cancellation;
      return new Promise<void>(() => {});
    } }, stdout);
    try {
      output.logger.info({ event: 'example' });
      const flushed = output.flush();
      await vi.advanceTimersByTimeAsync(3000);
      await flushed;
      expect(signal?.aborted).toBe(true);
      expect(stdout.lines.map(line => JSON.parse(line).event)).toEqual(['example', 'diagnostic_export_failed']);
    } finally { await output.close(); }
  });
});
