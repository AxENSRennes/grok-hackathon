import { Client, type Room } from '@colyseus/sdk';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import type { PartyState } from '../src/server/state';
import type { InputLease } from '../src/shared/movement';
import { MovementSender } from '../src/client/movement-sender';

// Opt-in real-server comparison. Delays are injected at the application wire boundary,
// not a simulation of TCP congestion. Observations are screen state, not physical pixels.
const baseline = process.env.MOVEMENT_BASELINE === '1';
const endpoint = process.env.TEST_ENDPOINT!;
const http = endpoint.replace(/^ws/, 'http');
const origin = { Origin: http };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, label: string, limit = 6000) {
  const deadline = performance.now() + limit;
  while (!check()) { assert(performance.now() < deadline, label); await wait(4); }
}
async function login(path: string, body: object) {
  const response = await fetch(`${http}/api/auth/${path}`, { method: 'POST', headers: { ...origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert(response.ok, `Login failed: ${response.status}`);
  return response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}
const connect = (cookie = '') => new Client(endpoint, { headers: { ...origin, Cookie: cookie } });
const rooms: Room<PartyState>[] = [];
const scheduled = new Set<ReturnType<typeof setTimeout>>();
function later(fn: () => void, ms: number) {
  const timer = setTimeout(() => { scheduled.delete(timer); fn(); }, ms);
  scheduled.add(timer);
}
function listen(room: Room<PartyState>) {
  rooms.push(room); room.reconnection.enabled = false;
  room.onMessage('identity', () => {}); room.onMessage('notice', () => {});
  room.onMessage('inputAck', () => {}); room.onMessage('movementProbe', () => {});
  return room;
}
let pingTimer: ReturnType<typeof setInterval> | undefined;
let moveTimer: ReturnType<typeof setInterval> | undefined;
let flushTimer: ReturnType<typeof setInterval> | undefined;
try {
  const hostCookie = await login('sign-in/email', { email: process.env.TEST_HOST_EMAIL, password: process.env.TEST_HOST_PASSWORD });
  const host = listen(await connect(hostCookie).create<PartyState>('party', { role: 'host', hostKey: randomBytes(24).toString('hex') }));
  const screen = listen(await connect().joinById<PartyState>(host.roomId, { role: 'screen' }));
  const cookie = await login('sign-in/anonymous', {});
  const player = listen(await connect(cookie).joinById<PartyState>(host.roomId, { role: 'player', inputProtocol: 1, token: randomBytes(24).toString('hex'), name: 'Network check', color: 0, hair: 0, accessory: 'none' }));
  const sender = new MovementSender();
  let view = { x: 0, vx: 0, seq: -1 };
  screen.onStateChange(state => {
    const p = [...state.players.values()][0];
    if (p) { const snapshot = { x: p.x, vx: p.vx, seq: p.lastSeq }; later(() => { view = snapshot; }, 60); }
  });
  let lease: InputLease | undefined;
  player.onMessage('pong', (data: { sent: number; lease?: InputLease }) => later(() => {
    if (data.lease) { lease = data.lease; sender.renew(lease, performance.now() - data.sent, performance.now()); }
  }, 60));
  const ping = () => { const sent = performance.now(); later(() => player.send('ping', sent), 60); };
  pingTimer = setInterval(ping, 500); ping();
  await until(() => view.x > 0 && (baseline || !!lease), 'Initial state/lease missing');
  let seq = 0, held = 0, sentPackets = 0, bufferedBytes = 0;
  const send = (input: { x: number; y: number; lease?: string }, delay = 60) => {
    const packet = { ...input, seq: ++seq }; sentPackets++;
    later(() => player.send('input', packet), delay);
  };
  const flush = () => {
    const input = sender.take(performance.now(), bufferedBytes, true);
    if (input) send(input);
  };
  const input = (x: number) => {
    held = x;
    if (baseline) send({ x, y: 0 }); else { sender.set(x, 0); flush(); }
  };
  moveTimer = setInterval(() => input(held), 150);
  flushTimer = setInterval(flush, 25);
  const samples: { start90Ms: number; reverse90Ms: number; stopMs: number; stopDistancePx: number }[] = [];
  for (let i = 0; i < 5; i++) {
    let at = performance.now(); input(1);
    await until(() => view.vx >= 171, 'Forward movement did not reach 90% speed');
    const start90Ms = performance.now() - at;
    at = performance.now(); input(-1);
    await until(() => view.vx <= -171, 'Reverse movement did not reach 90% speed');
    const reverse90Ms = performance.now() - at;
    const x = view.x; at = performance.now(); input(0);
    await until(() => Math.abs(view.vx) < 1, 'Stop did not settle');
    samples.push({ start90Ms, reverse90Ms, stopMs: performance.now() - at, stopDistancePx: Math.abs(view.x - x) });
    await wait(100);
  }
  clearInterval(moveTimer); held = 0; sender.reset();
  await wait(600);
  // A previously valid non-zero packet arrives after a two-second uplink stall.
  const startX = view.x;
  send({ x: 1, y: 0, ...(lease ? { lease: lease.token } : {}) }, 2000);
  send({ x: 0, y: 0, ...(lease ? { lease: lease.token } : {}) }, 2120);
  await wait(2800);
  const staleMovementPx = Math.abs(view.x - startX);
  if (!baseline) assert(staleMovementPx < 0.1, 'Expired movement moved the player');
  else assert(staleMovementPx > 5, 'Baseline failed to reproduce stale movement');
  // Model a browser send buffer that cannot drain. Only the final state should survive.
  const beforePackets = sentPackets;
  bufferedBytes = 1024;
  for (let i = 0; i < 12; i++) { input(i % 2 ? -1 : 1); await wait(30); }
  input(0); bufferedBytes = 0; flush();
  const blockedPackets = sentPackets - beforePackets;
  if (!baseline) assert.equal(blockedPackets, 1);
  await wait(700);
  // A connection change invalidates old leases. Fresh input must work after rejoin.
  const oldLease = lease;
  await player.leave();
  const rejoined = listen(await connect(cookie).joinById<PartyState>(host.roomId, { role: 'player', inputProtocol: 1, token: randomBytes(24).toString('hex'), name: 'Network check', color: 0, hair: 0, accessory: 'none' }));
  clearInterval(pingTimer); clearInterval(flushTimer);
  await wait(150);
  const reconnectX = view.x;
  rejoined.send('input', { x: 1, y: 0, seq: 1, ...(oldLease ? { lease: oldLease.token } : {}) });
  await wait(250);
  if (!baseline) assert(Math.abs(view.x - reconnectX) < 0.1, 'Old connection lease was reused');
  let renewed: InputLease | undefined;
  rejoined.onMessage('pong', (data: { lease?: InputLease }) => { renewed = data.lease; });
  rejoined.send('ping', performance.now());
  await until(() => baseline || !!renewed, 'Rejoined connection did not obtain a lease');
  rejoined.send('input', { x: 1, y: 0, seq: 2, ...(renewed ? { lease: renewed.token } : {}) });
  await until(() => view.vx > 15, 'Fresh movement after reconnect failed');
  rejoined.send('input', { x: 0, y: 0, seq: 3 });
  const median = (key: keyof typeof samples[number]) => [...samples].map(s => s[key]).sort((a, b) => a - b)[2];
  const result = { mode: baseline ? 'baseline' : 'corrected', artificialOneWayMs: 60, samples: samples.length,
    start90MedianMs: median('start90Ms'), reverse90MedianMs: median('reverse90Ms'), stopMedianMs: median('stopMs'), stopDistanceMedianPx: median('stopDistancePx'), staleMovementPx, blockedPackets,
    note: 'Real server and WebSockets; injected application delays, screen-state observations, not rendered pixels or real mobile network performance.' };
  console.log(JSON.stringify(result, null, 2));
  if (process.env.MOVEMENT_RESULT_FILE) await writeFile(process.env.MOVEMENT_RESULT_FILE, JSON.stringify(result, null, 2) + '\n');
} finally {
  clearInterval(pingTimer); clearInterval(moveTimer); clearInterval(flushTimer);
  for (const timer of scheduled) clearTimeout(timer);
  await Promise.allSettled(rooms.filter(room => room.connection.isOpen).map(room => room.leave()));
}
