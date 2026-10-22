import { metricNames, Samples, type MetricName, type MovementProbe, type TelemetryReport } from '../shared/telemetry';
import type { PlayerView } from '../shared/protocol';

export class ClientTelemetry {
  private metrics = Object.fromEntries(metricNames.map(name => [name, new Samples()])) as Record<MetricName, Samples>;
  private pending = new Map<number, number>();
  private lastProbe = -Infinity;
  private lastPatch = 0;
  private patchPendingFrame = false;
  private trace?: MovementProbe;
  private reconnects = 0;
  private lastFrame = 0;
  add(name: MetricName, value: number) { this.metrics[name].add(value); }
  probe(seq: number) {
    const now = performance.now();
    if (document.hidden || now - this.lastProbe < 1000) return false;
    this.lastProbe = now;
    for (const [key, sent] of this.pending) if (now - sent > 10_000) this.pending.delete(key);
    this.pending.set(seq, now);
    return true;
  }
  ack(seq: number) {
    const sent = this.pending.get(seq);
    if (sent !== undefined) { this.add('inputAckMs', performance.now() - sent); this.pending.delete(seq); }
  }
  patch() {
    const now = performance.now();
    if (!document.hidden && this.lastPatch) this.add('patchGapMs', now - this.lastPatch);
    this.lastPatch = document.hidden ? 0 : now;
    this.patchPendingFrame = !document.hidden;
  }
  movementProbe(probe: MovementProbe) { this.trace = probe; }
  frame(_delta: number, players: PlayerView[], offset: number, report: (data: object) => void) {
    if (document.hidden) { this.lastFrame = 0; this.patchPendingFrame = false; this.trace = undefined; return; }
    const now = performance.now();
    if (this.lastFrame) this.add('frameMs', now - this.lastFrame);
    this.lastFrame = now;
    if (this.patchPendingFrame) { this.add('patchToFrameMs', now - this.lastPatch); this.patchPendingFrame = false; }
    if (this.trace && players.some(player => player.id === this.trace!.playerId && player.lastSeq >= this.trace!.seq)) {
      const estimate = Date.now() + offset - this.trace.receivedAt;
      if (estimate >= 0 && estimate <= 60_000) report({ playerId: this.trace.playerId, seq: this.trace.seq, serverReceiveToRenderEstimateMs: Math.round(estimate) });
      this.trace = undefined;
    }
  }
  reset(reconnected = false) {
    this.pending.clear(); this.lastProbe = -Infinity; this.lastPatch = 0; this.lastFrame = 0; this.trace = undefined; this.patchPendingFrame = false;
    for (const name of metricNames) this.metrics[name].drain();
    if (reconnected) this.reconnects++;
  }
  report(): TelemetryReport {
    const maxima = Object.fromEntries(metricNames.map(name => [name, this.metrics[name].maximum()])) as Record<MetricName, number | null>;
    const values = Object.fromEntries(metricNames.map(name => [name, this.metrics[name].drain()])) as Record<MetricName, number[]>;
    const reconnects = this.reconnects; this.reconnects = 0;
    return { ...values, maxima, reconnects, hidden: document.hidden };
  }
}
