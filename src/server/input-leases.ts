import { randomBytes } from 'node:crypto';
import { INPUT_LEASE_MS, type InputLease } from '../shared/movement.js';

/** One bounded window per negotiated controller connection. Uses monotonic time. */
export class InputLeases {
  private leases = new Map<string, number>();
  private lastIssued = -Infinity;
  issue(now: number): InputLease | undefined {
    if (now - this.lastIssued < 250) return;
    this.lastIssued = now;
    for (const [token, deadline] of this.leases) if (deadline <= now) this.leases.delete(token);
    const token = randomBytes(12).toString('hex');
    this.leases.set(token, now + INPUT_LEASE_MS);
    return { token, lifetimeMs: INPUT_LEASE_MS };
  }
  remaining(token: string | undefined, now: number) {
    return token ? Math.max(0, (this.leases.get(token) ?? now) - now) : 0;
  }
}
