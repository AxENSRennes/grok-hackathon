import { afterEach, expect, it, vi } from 'vitest';
import type { Room } from '@colyseus/sdk';
import type { PartyState } from '../server/state';
import { Session } from './session';

vi.mock('./auth', () => ({ ensureGuestSession: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('eventually sends telemetry when the reporting deadline coincides with a buffered ping', () => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
  const ws = { bufferedAmount: 0 };
  const send = vi.fn(() => {
    ws.bufferedAmount = 64;
    setTimeout(() => { ws.bufferedAmount = 0; }, 1);
  });
  const room = {
    reconnection: { enabled: true }, connection: { isOpen: true, transport: { ws } },
    onStateChange() {}, onMessage() {}, onError() {}, onLeave() {}, send, leave: async () => {},
  } as unknown as Room<PartyState>;
  const session = new Session(room, { role: 'player', inputProtocol: 1 });
  try {
    vi.advanceTimersByTime(10_050);
    expect(send.mock.calls.filter(args => (args as unknown[])[0] === 'telemetry')).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(send.mock.calls.filter(args => (args as unknown[])[0] === 'telemetry')).toHaveLength(2);
  } finally { session.close(); }
});
