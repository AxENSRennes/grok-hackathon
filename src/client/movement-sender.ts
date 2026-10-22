import type { InputLease } from '../shared/movement';

/** Retain at most the current button state, never a history of unsent movement. */
export class MovementSender {
  private pending?: { x: number; y: number };
  private lease?: { token: string; expires: number };
  private lastSent = -Infinity;
  set(x: number, y: number) { this.pending = { x, y }; }
  renew(lease: InputLease, rtt: number, now: number) {
    // Subtract the full RTT conservatively; the server checks its own deadline.
    this.lease = { token: lease.token, expires: now + Math.max(0, lease.lifetimeMs - rtt - 25) };
  }
  take(now: number, bufferedAmount: number, requiresLease: boolean) {
    if (!this.pending || bufferedAmount > 0) return;
    const stopped = this.pending.x === 0 && this.pending.y === 0;
    // Stops may bypass the rate gate. Normal movement is capped at 40 Hz.
    if (!stopped && now - this.lastSent < 25) return;
    if (!stopped && requiresLease && (!this.lease || this.lease.expires <= now)) return;
    const input = { ...this.pending, ...(requiresLease && this.lease ? { lease: this.lease.token } : {}) };
    this.pending = undefined;
    this.lastSent = now;
    return input;
  }
  reset() { this.pending = undefined; this.lease = undefined; this.lastSent = -Infinity; }
}
