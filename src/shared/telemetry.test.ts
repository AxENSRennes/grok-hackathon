import { describe, expect, it } from 'vitest';
import { Samples, telemetrySchema } from './telemetry';

describe('diagnostic input bounds', () => {
  it('bounds retained samples while preserving a spike outside the retained window', () => {
    const samples = new Samples(3);
    samples.add(500);
    for (let i = 0; i < 1000; i++) samples.add(10);
    expect(samples.summary()).toEqual({ count: 1001, retained: 3, p50: 10, p95: 10, max: 500 });
    expect(samples.summary()).toBeNull();
  });
  it('rejects oversized or non-finite client reports', () => {
    const report = { rttMs: [], patchGapMs: [], inputAckMs: [], frameMs: [], patchToFrameMs: [], hidden: false, reconnects: 0,
      maxima: { rttMs: null, patchGapMs: null, inputAckMs: null, frameMs: null, patchToFrameMs: null } };
    expect(telemetrySchema.safeParse(report).success).toBe(true);
    expect(telemetrySchema.safeParse({ ...report, rttMs: Array(129).fill(1) }).success).toBe(false);
    expect(telemetrySchema.safeParse({ ...report, rttMs: [Infinity] }).success).toBe(false);
    expect(telemetrySchema.safeParse({ ...report, rttMs: [-1] }).success).toBe(false);
  });
});
