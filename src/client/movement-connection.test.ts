import { describe, it, expect } from 'vitest';
import { ConnectionTiming } from './connection-timing';
import { MovementSender } from './movement-sender';
import { InputLeases } from '../server/input-leases';
import { stepPhysics, SPEED, type Body } from '../server/physics';

describe('movement under delayed delivery', () => {
  it('rejects expired or foreign leases and bounds movement near expiry', () => {
    const leases = new InputLeases(), otherConnection = new InputLeases();
    const lease = leases.issue(0)!;
    expect(leases.remaining(lease.token, 2000)).toBe(0);
    expect(otherConnection.remaining(lease.token, 20)).toBe(0);
    expect(leases.remaining(undefined, 20)).toBe(0);
    const p: Body = { id: 'a', x: 200, y: 400, vx: SPEED, vy: 0, online: true, facing: 'right' };
    const inputs = new Map([['a', { x: 1, y: 0, at: 950, expiresAt: 1000 }]]);
    for (let now = 1000; now < 1300; now += 1000 / 60) stepPhysics([p], inputs, 1 / 60, now);
    expect(p.x - 200).toBeLessThan(6);
    expect(p.vx).toBeLessThan(1);
  });
  it('coalesces a blocked press, reversal and release into one neutral command', () => {
    const sender = new MovementSender();
    sender.renew({ token: 'lease', lifetimeMs: 1000 }, 100, 100);
    sender.set(1, 0); expect(sender.take(100, 100, true)).toBeUndefined();
    sender.set(-1, 0); expect(sender.take(200, 100, true)).toBeUndefined();
    sender.set(0, 0);
    expect(sender.take(2000, 0, true)).toMatchObject({ x: 0, y: 0 });
    expect(sender.take(2025, 0, true)).toBeUndefined();
    sender.set(1, 0); expect(sender.take(2050, 0, true)).toBeUndefined();
    sender.renew({ token: 'new', lifetimeMs: 1000 }, 100, 2100);
    expect(sender.take(2100, 0, true)).toMatchObject({ x: 1, lease: 'new' });
    sender.reset(); expect(sender.take(2125, 0, true)).toBeUndefined();
  });
  it('keeps clock estimates stable through asymmetric stalls and discards background replies', () => {
    const timing = new ConnectionTiming();
    timing.sent(100); expect(timing.received(100, 10_150, 200)).toBe(100);
    expect(timing.serverNow(300)).toBe(10_300);
    timing.sent(300); expect(timing.received(300, 10_350, 5300)).toBe(5000);
    expect(timing.serverNow(5300)).toBe(15_300);
    timing.sent(5400); timing.reset();
    expect(timing.received(5400, 15_450, 5500)).toBeUndefined();
    expect(timing.serverNow(5500)).toBeUndefined();
  });
});
