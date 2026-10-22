import { z } from 'zod';

export const TELEMETRY_MS = 10_000;
export const metricNames = ['rttMs', 'patchGapMs', 'inputAckMs', 'frameMs', 'patchToFrameMs'] as const;
export type MetricName = typeof metricNames[number];
const samples = z.array(z.number().finite().min(0).max(60_000)).max(128);
const maximum = z.number().finite().min(0).max(60_000).nullable();
export const telemetrySchema = z.object({
  rttMs: samples, patchGapMs: samples, inputAckMs: samples, frameMs: samples, patchToFrameMs: samples,
  hidden: z.boolean(), reconnects: z.number().int().min(0).max(1000),
  maxima: z.object({ rttMs: maximum, patchGapMs: maximum, inputAckMs: maximum, frameMs: maximum, patchToFrameMs: maximum }),
});
export type TelemetryReport = z.infer<typeof telemetrySchema>;
export interface MovementProbe { playerId: string; seq: number; receivedAt: number }
export const renderProbeSchema = z.object({
  playerId: z.string().max(64), seq: z.number().int().nonnegative(),
  serverReceiveToRenderEstimateMs: z.number().finite().min(0).max(60_000),
});

// A bounded window prevents a stalled client or a busy room from accumulating samples.
export class Samples {
  private values: number[] = [];
  private cursor = 0;
  private count = 0;
  private max: number | null = null;
  constructor(private capacity = 128) {}
  add(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 60_000) return;
    const rounded = Math.round(value * 10) / 10;
    if (this.values.length < this.capacity) this.values.push(rounded);
    else { this.values[this.cursor] = rounded; this.cursor = (this.cursor + 1) % this.capacity; }
    this.count++;
    this.max = Math.max(this.max ?? 0, rounded);
  }
  maximum() { return this.max; }
  drain() {
    const values = this.values;
    this.values = []; this.cursor = 0; this.count = 0; this.max = null;
    return values;
  }
  summary() {
    if (!this.values.length) return null;
    const ordered = [...this.values].sort((a, b) => a - b);
    const at = (p: number) => ordered[Math.max(0, Math.ceil(ordered.length * p) - 1)];
    const summary = { count: this.count, retained: ordered.length, p50: at(0.5), p95: at(0.95), max: this.max! };
    this.drain();
    return summary;
  }
}
