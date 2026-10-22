import { Client, type Room } from '@colyseus/sdk';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { PartyState } from '../src/server/state';
import { Samples, metricNames, type MetricName } from '../src/shared/telemetry';

// Opt-in diagnostic: real connections and movement, without changing existing rooms.
const endpoint = process.env.TEST_ENDPOINT || 'ws://127.0.0.1:2567';
const httpEndpoint = endpoint.replace(/^ws/, 'http');
const headers = { Origin: process.env.TEST_ORIGIN || httpEndpoint };
const duration = Math.max(5000, Math.min(60_000, Number(process.env.DURATION_MS) || 25_000));
const count = Math.max(1, Math.min(100, Number(process.env.PLAYERS) || 1));
const localEventLoop = monitorEventLoopDelay({ resolution: 20 });
localEventLoop.enable();
let email = process.env.TEST_HOST_EMAIL, password = process.env.TEST_HOST_PASSWORD;
if (process.env.DIAGNOSTIC_OPERATOR_FILE) {
  const contents = await readFile(process.env.DIAGNOSTIC_OPERATOR_FILE, 'utf8');
  email = contents.match(/[\w.+-]+@[\w.-]+\.[a-z]+/i)?.[0];
  password = contents.match(/(?:mot de passe|password)[^:\n]*:\s*([^\n]+)/i)?.[1]?.replace(/^[\s*`]+|[\s*`]+$/g, '');
}
assert(email && password, 'Provide TEST_HOST_EMAIL and TEST_HOST_PASSWORD, or DIAGNOSTIC_OPERATOR_FILE.');
async function login(path: string, body: object) {
  const response = await fetch(`${httpEndpoint}/api/auth/${path}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert(response.ok, `Authentication failed (${response.status}).`);
  return response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
}
const makeClient = (cookie = '') => new Client(endpoint, { headers: { ...headers, Cookie: cookie } });
const connections: Room<PartyState>[] = [];
const timers: ReturnType<typeof setInterval>[] = [];
const all = { screenRttMs: new Samples(1024), controllerRttMs: new Samples(1024), inputAckMs: new Samples(1024), inputToScreenStateMs: new Samples(1024), inputToDirectionStateMs: new Samples(1024), patchGapMs: new Samples(2048) };
const clientMetrics = new Map<Room<PartyState>, Record<MetricName, Samples>>();
function listen(room: Room<PartyState>) {
  room.reconnection.enabled = false;
  room.onMessage('identity', () => {}); room.onMessage('notice', () => {});
  room.onMessage('movementProbe', () => {});
  connections.push(room);
  clientMetrics.set(room, Object.fromEntries(metricNames.map(name => [name, new Samples()])) as Record<MetricName, Samples>);
  return room;
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!check()) { assert(Date.now() < deadline, 'Room synchronization timed out.'); await wait(30); }
}
try {
  const hostCookie = await login('sign-in/email', { email, password });
  password = undefined;
  const host = listen(await makeClient(hostCookie).create<PartyState>('party', { role: 'host', hostKey: randomBytes(24).toString('hex') }));
  const screen = listen(await makeClient().joinById<PartyState>(host.roomId, { role: 'screen' }));
  const players: Room<PartyState>[] = [];
  for (let i = 0; i < count; i++) {
    const cookie = await login('sign-in/anonymous', {});
    players.push(listen(await makeClient(cookie).joinById<PartyState>(host.roomId, {
      role: 'player', token: randomBytes(24).toString('hex'), name: `Latency probe ${i + 1}`, color: i % 8, hair: i % 4, accessory: 'none',
    })));
  }
  await until(() => screen.state.players.size === count);
  const playerIds = [...screen.state.players.keys()];
  const pending = new Map<string, number>();
  const movement = new Map<string, { seq: number; sent: number; direction: number; received: boolean }>();
  let previousPatch = performance.now();
  screen.onStateChange(state => {
    const now = performance.now(), gap = now - previousPatch;
    previousPatch = now; all.patchGapMs.add(gap); clientMetrics.get(screen)!.patchGapMs.add(gap);
    for (const [id, probe] of movement) {
      const player = state.players.get(id);
      if (player && player.lastSeq >= probe.seq) {
        if (!probe.received) { all.inputToScreenStateMs.add(now - probe.sent); probe.received = true; }
        if (player.vx * probe.direction > 15) { all.inputToDirectionStateMs.add(now - probe.sent); movement.delete(id); }
      }
    }
  });
  for (const room of [screen, ...players]) room.onMessage('pong', (data: { sent: number }) => {
    const rtt = performance.now() - data.sent;
    (room === screen ? all.screenRttMs : all.controllerRttMs).add(rtt);
    clientMetrics.get(room)!.rttMs.add(rtt);
  });
  players.forEach((room, i) => room.onMessage('inputAck', (data: { seq: number; applied: boolean }) => {
    const key = `${i}:${data.seq}`, sent = pending.get(key);
    if (sent !== undefined && data.applied) { const ms = performance.now() - sent; all.inputAckMs.add(ms); clientMetrics.get(room)!.inputAckMs.add(ms); }
    pending.delete(key);
  }));
  timers.push(setInterval(() => { for (const room of [screen, ...players]) room.send('ping', performance.now()); }, 1000));
  timers.push(setInterval(() => {
    for (const room of [screen, ...players]) {
      const metrics = clientMetrics.get(room)!;
      const maxima = Object.fromEntries(metricNames.map(name => [name, metrics[name].maximum()]));
      room.send('telemetry', { ...Object.fromEntries(metricNames.map(name => [name, metrics[name].drain()])), maxima, hidden: false, reconnects: 0 });
    }
  }, 10_000));
  let seq = 0;
  timers.push(setInterval(() => {
    seq++;
    players.forEach((room, i) => {
      const probe = seq % 8 === 1;
      if (probe) {
        const sent = performance.now(); pending.set(`${i}:${seq}`, sent);
        movement.set(playerIds[i], { seq, sent, direction: Math.floor((seq - 1) / 8) % 2 ? -1 : 1, received: false });
      }
      room.send('input', { x: Math.floor((seq - 1) / 8) % 2 ? -1 : 1, y: 0, seq, ...(probe ? { probe: true } : {}) });
    });
  }, 150));
  console.log(JSON.stringify({ event: 'diagnostic_started', endpoint, roomId: host.roomId, players: count, durationMs: duration }));
  await wait(duration);
  assert(all.screenRttMs.maximum() !== null && all.inputAckMs.maximum() !== null && all.inputToScreenStateMs.maximum() !== null, 'Diagnostic did not collect all required measurements.');
  console.log(JSON.stringify({ event: 'diagnostic_result', endpoint, roomId: host.roomId, players: count, durationMs: duration,
    probeEventLoopDelayP95Ms: Math.round(localEventLoop.percentile(95) / 1e5) / 10,
    probeEventLoopDelayMaxMs: Math.round(localEventLoop.max / 1e5) / 10,
    ...Object.fromEntries(Object.entries(all).map(([name, samples]) => [name, samples.summary()])),
    note: 'Screen-state timing observes the accepted sequence; direction-state timing also waits for velocity in the requested direction (>15 px/s). Both use this machine clock and exclude displayed pixels and event Wi-Fi. Percentiles use bounded retained samples.',
  }, null, 2));
} finally {
  localEventLoop.disable();
  timers.forEach(clearInterval);
  await Promise.race([Promise.allSettled(connections.map(room => room.leave())), wait(2000)]);
}
