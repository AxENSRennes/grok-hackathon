import { Client, type Room } from '@colyseus/sdk';
import type { Snapshot, PlayerView, HostCommand } from '../shared/protocol';
import type { PartyState } from '../server/state';
import { ensureGuestSession } from './auth';
import { ClientTelemetry } from './telemetry';
import { TELEMETRY_MS, type MovementProbe } from '../shared/telemetry';
import { CONTROLLER_PING_MS, type InputLease } from '../shared/movement';
import { ConnectionTiming } from './connection-timing';
import { MovementSender } from './movement-sender';

const endpoint = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${import.meta.env.DEV ? '/socket' : ''}`;
export const emptySnapshot: Snapshot = { players: [], phase: 'lobby', question: null, zones: [], result: null, endsAt: 0, serverTime: Date.now(), paused: false, chatEnabled: true, hasPreviousQuestion: false, hasNextQuestion: true };
export function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join(''); }
export function guestToken(roomId: string) {
  const key = `sidequest:guest:${roomId}`;
  let token = localStorage.getItem(key);
  if (!token) { token = randomToken(); localStorage.setItem(key, token); }
  return token;
}
export type Status = 'connecting' | 'connected' | 'reconnecting' | 'closed';
export class Session {
  room: Room<PartyState>;
  snapshot = emptySnapshot;
  status: Status = 'connected';
  playerId = '';
  rtt = 0;
  private timing = new ConnectionTiming();
  private movement = new MovementSender();
  get offset() { return (this.timing.serverNow(performance.now()) ?? Date.now()) - Date.now(); }
  notice = '';
  readonly telemetry = new ClientTelemetry();
  private listeners = new Set<() => void>();
  private pingTimer: ReturnType<typeof setInterval>;
  private telemetryTimer: ReturnType<typeof setInterval>;
  private movementTimer: ReturnType<typeof setInterval>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private alive = true;
  private attempts = 0;
  private seq = 0;
  private visibilityChanged = () => {
    this.telemetry.reset(); this.timing.reset(true); this.movement.reset();
    this.input(0, 0);
    if (!document.hidden) this.ping();
  };
  constructor(room: Room<PartyState>, private options: Record<string, unknown>) {
    this.room = room;
    this.bind(room);
    this.pingTimer = setInterval(() => this.ping(), options.role === 'player' ? CONTROLLER_PING_MS : 1000);
    this.movementTimer = setInterval(() => this.flushMovement(), 25);
    this.telemetryTimer = setInterval(() => {
      if (this.status === 'connected' && this.bufferedAmount() === 0) this.room.send('telemetry', this.telemetry.report());
    }, TELEMETRY_MS);
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get isHost() { return this.options.role === 'host'; }
  private emit() { this.listeners.forEach(listener => listener()); }
  private bind(room: Room<PartyState>) {
    // Rejoin with our stable guest token; do not replay old movement packets.
    room.reconnection.enabled = false;
    room.onStateChange(state => {
      this.telemetry.patch();
      this.snapshot = {
        players: [...state.players.values()].map(p => ({ ...p.toJSON() } as PlayerView)),
        phase: state.phase as Snapshot['phase'], question: state.questionJson ? JSON.parse(state.questionJson) : null,
        zones: JSON.parse(state.zonesJson || '[]'), result: state.resultJson ? JSON.parse(state.resultJson) : null,
        endsAt: state.endsAt, serverTime: state.serverTime, paused: state.paused, chatEnabled: state.chatEnabled,
        hasPreviousQuestion: state.hasPreviousQuestion, hasNextQuestion: state.hasNextQuestion,
      };
      this.emit();
    });
    room.onMessage('identity', (data: { playerId: string }) => { this.playerId = data.playerId; this.emit(); });
    room.onMessage('notice', (notice: string) => { this.notice = notice; this.emit(); });
    room.onMessage('pong', (data: { sent: number; serverTime: number; lease?: InputLease }) => {
      if (room !== this.room || document.hidden) return;
      const now = performance.now();
      const rtt = this.timing.received(data.sent, data.serverTime, now);
      if (rtt === undefined) return;
      this.rtt = Math.round(rtt);
      this.telemetry.add('rttMs', this.rtt);
      if (data.lease) { this.movement.renew(data.lease, rtt, now); this.flushMovement(); }
      this.emit();
    });
    room.onMessage('inputAck', (data: { seq: number; applied: boolean }) => { if (data.applied) this.telemetry.ack(data.seq); });
    room.onMessage('movementProbe', (data: MovementProbe) => this.telemetry.movementProbe(data));
    room.onError((_code, message) => { this.notice = message || 'Connection interrupted.'; this.emit(); });
    room.onLeave(code => {
      if (!this.alive) return;
      if (code === 4001 || code === 1000) { this.status = 'closed'; this.notice = code === 4001 ? 'This character is connected in another tab.' : 'The room is closed.'; this.emit(); return; }
      this.status = 'reconnecting'; this.emit(); this.retry();
    });
    room.send('whoami');
    this.ping();
  }
  private retry() {
    if (!this.alive) return;
    this.retryTimer = setTimeout(async () => {
      try {
        const room = await new Client(endpoint()).joinById<PartyState>(this.room.roomId, this.options);
        if (!this.alive) { void room.leave(); return; }
        this.room = room; this.seq = 0; this.attempts = 0; this.status = 'connected'; this.notice = ''; this.telemetry.reset(true);
        this.timing.reset(); this.movement.reset();
        this.bind(room); this.emit();
      } catch {
        this.attempts++;
        if (this.attempts >= 10) { this.status = 'closed'; this.notice = 'Room unavailable. Reload to try again.'; this.emit(); }
        else this.retry();
      }
    }, Math.min(500 * 2 ** this.attempts, 5000));
  }
  input(x: number, y: number) {
    if (this.status !== 'connected' || this.options.role !== 'player') return;
    this.movement.set(x, y);
    this.flushMovement();
  }
  private bufferedAmount() {
    // Colyseus 0.18 exposes the native socket on its WebSocket transport.
    const transport = this.room.connection.transport as { ws?: { bufferedAmount: number } };
    return transport.ws?.bufferedAmount ?? 0;
  }
  private ping() {
    if (this.status !== 'connected' || document.hidden || this.bufferedAmount() > 0) return;
    const now = performance.now(); this.timing.sent(now); this.room.send('ping', now);
  }
  private flushMovement() {
    if (this.status !== 'connected' || !this.room.connection.isOpen) return;
    const input = this.movement.take(performance.now(), this.bufferedAmount(), this.options.inputProtocol === 1);
    if (!input) return;
    const seq = ++this.seq;
    this.room.send('input', { ...input, seq, ...(this.telemetry.probe(seq) ? { probe: true } : {}) });
  }
  recordFrame(delta: number) {
    this.telemetry.frame(delta, this.snapshot.players, this.offset, data => {
      if (this.status === 'connected') this.room.send('renderProbe', data);
    });
  }
  jump() { if (this.status === 'connected') this.room.send('jump'); }
  chat(text: string) { if (this.status === 'connected') this.room.send('chat', text); }
  command(command: HostCommand) { if (this.status === 'connected') this.room.send('command', command); }
  close() {
    this.alive = false; clearInterval(this.pingTimer); clearInterval(this.telemetryTimer); clearInterval(this.movementTimer); clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    void this.room.leave();
  }
}
export async function joinSession(roomId: string, options: Record<string, unknown>) {
  if (options.role === 'player') { await ensureGuestSession(); options = { ...options, inputProtocol: 1 }; }
  const room = await new Client(endpoint()).joinById<PartyState>(roomId.toUpperCase(), options);
  return new Session(room, options);
}
export async function createSession(hostKey: string) {
  const options = { role: 'host', hostKey };
  const room = await new Client(endpoint()).create<PartyState>('party', options);
  sessionStorage.setItem(`sidequest:host:${room.roomId}`, hostKey);
  return new Session(room, options);
}
