/** RTT is measured for every valid reply; only low-delay samples steer the clock. */
export class ConnectionTiming {
  private pending = new Set<number>();
  private samples: { at: number; rtt: number; offset: number }[] = [];
  private serverOffset?: number;
  sent(now: number) {
    for (const sent of this.pending) if (now - sent > 10_000) this.pending.delete(sent);
    this.pending.add(now);
  }
  received(sent: number, serverTime: number, now: number) {
    if (!this.pending.delete(sent) || !Number.isFinite(serverTime) || now < sent) return;
    const rtt = now - sent;
    this.samples = this.samples.filter(sample => now - sample.at < 30_000);
    // Multi-second stalls remain visible in telemetry, but cannot reset the clock.
    if (rtt <= 1000) this.samples.push({ at: now, rtt, offset: serverTime + rtt / 2 - now });
    const best = this.samples.reduce<(typeof this.samples)[number] | undefined>((best, sample) => !best || sample.rtt < best.rtt ? sample : best, undefined);
    if (best) this.serverOffset = best.offset;
    return rtt;
  }
  serverNow(now: number) { return this.serverOffset === undefined ? undefined : now + this.serverOffset; }
  reset(keepEstimate = false) { this.pending.clear(); this.samples = []; if (!keepEstimate) this.serverOffset = undefined; }
}
