import { Client, type Room } from '@colyseus/sdk';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import type { PartyState } from '../src/server/state';
import { WORLD } from '../src/shared/protocol';

const endpoint = process.env.TEST_ENDPOINT || 'ws://127.0.0.1:2567';
const count = Number(process.env.PLAYERS || 50);
const duration = Number(process.env.DURATION_MS || 6000);
const httpEndpoint = endpoint.replace(/^ws/, 'http');
const headers: Record<string, string> = { Origin: process.env.TEST_ORIGIN || httpEndpoint };
const makeClient = (cookie = '') => new Client(endpoint, { headers: { ...headers, Cookie: cookie } });
async function signIn(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${httpEndpoint}/api/auth/${path}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200, `Authentication failed: ${path} (${response.status})`);
  const cookies = response.headers.getSetCookie();
  assert(cookies.length > 0, 'Authentication did not issue a session cookie.');
  if (httpEndpoint.startsWith('https:')) {
    assert(cookies.some(cookie => /HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=Lax/i.test(cookie)), 'Production session cookie must be protected.');
  }
  return cookies.map(cookie => cookie.split(';')[0]).join('; ');
}
const connections: Room<PartyState>[] = [];
const key = () => randomBytes(24).toString('hex');
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, message: string, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (!check()) { if (Date.now() > deadline) throw new Error(message); await wait(30); }
}
function listen(room: Room<PartyState>) {
  room.reconnection.enabled = false;
  room.onMessage('identity', () => {});
  room.onMessage('notice', () => {});
  connections.push(room); return room;
}
let movementTimer: ReturnType<typeof setInterval> | undefined;
try {
  assert(process.env.TEST_HOST_EMAIL && process.env.TEST_HOST_PASSWORD, 'Set TEST_HOST_EMAIL and TEST_HOST_PASSWORD for a provisioned organizer.');
  const hostKey = key();
  const healthBefore = await (await fetch(`${httpEndpoint}/api/health`)).json();
  await assert.rejects(() => makeClient().create('party', { role: 'host', hostKey }));
  const guestCookie = await signIn('sign-in/anonymous', {});
  await assert.rejects(() => makeClient(guestCookie).create('party', { role: 'host', hostKey }));
  const healthAfter = await (await fetch(`${httpEndpoint}/api/health`)).json();
  assert.equal(healthAfter.rooms, healthBefore.rooms, 'Unauthorized creation must not allocate a room.');
  const signup = await fetch(`${httpEndpoint}/api/auth/sign-up/email`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'intruder@example.test', password: key(), name: 'Intruder' }) });
  assert(!signup.ok, 'Public organizer registration must be disabled.');
  const hostCookie = await signIn('sign-in/email', { email: process.env.TEST_HOST_EMAIL, password: process.env.TEST_HOST_PASSWORD });
  const host = listen(await makeClient(hostCookie).create<PartyState>('party', { role: 'host', hostKey }));
  const screen = listen(await makeClient().joinById<PartyState>(host.roomId, { role: 'screen' }));
  const tokens = Array.from({ length: count }, key);
  const cookies = await Promise.all(tokens.map(() => signIn('sign-in/anonymous', {})));
  const playerOptions = (i: number) => ({ role: 'player', token: tokens[i], name: `Test ${i + 1}`, color: i % 8, hair: i % 4, accessory: 'none' });
  await assert.rejects(() => makeClient().joinById(host.roomId, playerOptions(0)));
  await assert.rejects(() => makeClient(guestCookie).joinById(host.roomId, { role: 'host', hostKey }));
  await assert.rejects(() => makeClient(hostCookie).joinById(host.roomId, { role: 'host', hostKey: key() }));
  const players = await Promise.all(tokens.map(async (_token, i) => listen(await makeClient(cookies[i]).joinById<PartyState>(host.roomId, playerOptions(i)))));
  await until(() => screen.state?.players?.size === count, 'All players did not synchronize.');
  console.log(`Room ${host.roomId}: ${count} controllers + host + screen connected.`);
  const denied = await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': 'not-the-secret' }, body: JSON.stringify({ action: 'finish' }) });
  assert.equal(denied.status, 403);
  const stolenKey = await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/commands`, { method: 'POST', headers: { ...headers, Cookie: guestCookie, 'content-type': 'application/json', 'x-host-key': hostKey }, body: JSON.stringify({ action: 'finish' }) });
  assert.equal(stolenKey.status, 403, 'A guest with the host key must still be rejected.');
  const wrongKey = await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/results`, { headers: { Cookie: hostCookie, 'x-host-key': key() } });
  assert.equal(wrongKey.status, 403);
  const rtts: number[] = [], patches: number[] = [];
  let previousPatch = performance.now();
  screen.onStateChange(() => { const now = performance.now(); patches.push(now - previousPatch); previousPatch = now; });
  screen.onMessage('pong', ({ sent }: { sent: number }) => rtts.push(performance.now() - sent));
  let seq = 0;
  movementTimer = setInterval(() => {
    seq++;
    players.forEach((player, i) => { player.send('input', { x: Math.sin(seq / 8 + i), y: Math.cos(seq / 8 + i), seq }); if (seq % 10 === 0) player.send('jump'); });
    screen.send('ping', performance.now());
  }, 150);
  await wait(duration);
  clearInterval(movementTimer); movementTimer = undefined;
  for (const p of screen.state.players.values()) {
    assert(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert(p.x >= WORLD.left && p.x <= WORLD.right && p.y >= WORLD.top && p.y <= WORLD.bottom);
  }
  // Identity comes from the Better Auth cookie, even if the old client token changes.
  const initialIds = new Set(screen.state.players.keys());
  await players[0].leave();
  await until(() => [...screen.state.players.values()].some(p => !p.online), 'Disconnect not propagated.');
  listen(await makeClient(cookies[0]).joinById<PartyState>(host.roomId, { ...playerOptions(0), token: key() }));
  await until(() => [...screen.state.players.values()].filter(p => p.online).length === count, 'Reconnect failed.');
  assert.deepEqual(new Set(screen.state.players.keys()), initialIds);
  // Copying another player's local token cannot take over their avatar.
  const secondPlayerId = players[1].state.players.size;
  await players[1].leave();
  await until(() => [...screen.state.players.values()].some(p => !p.online), 'Second disconnect not propagated.');
  players[1] = listen(await makeClient(cookies[1]).joinById<PartyState>(host.roomId, { ...playerOptions(1), token: tokens[0] }));
  await until(() => [...screen.state.players.values()].filter(p => p.online).length === count, 'Cookie identity was stolen by a copied token.');
  assert.equal(screen.state.players.size, secondPlayerId);
  assert.deepEqual(new Set(screen.state.players.keys()), initialIds);
  // Spectators cannot start a round, even with a well-formed command.
  const question = { text: 'Test de vote', mode: 'choice', labels: ['A', 'B', 'C', 'D'], duration: 10 };
  screen.send('command', { action: 'start', question });
  await wait(100); assert.equal(screen.state.phase, 'lobby');
  host.send('command', { action: 'start', question });
  await until(() => screen.state.phase === 'question', 'Question failed to start.');
  host.send('command', { action: 'finish' });
  await until(() => screen.state.phase === 'results', 'Vote did not finish.');
  const result = JSON.parse(screen.state.resultJson);
  assert.equal(result.participants, count);
  assert.equal(result.counts.reduce((sum: number, zone: { count: number }) => sum + zone.count, 0) + result.outside, count);
  const frozen = [...screen.state.players.values()].map(p => [p.x, p.y]);
  players[1].send('input', { x: 1, y: 0, seq: 99999 }); await wait(250);
  assert.deepEqual([...screen.state.players.values()].map(p => [p.x, p.y]), frozen);
  const exported = await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/results`, { headers: { Cookie: hostCookie, 'x-host-key': hostKey } });
  assert.equal(exported.status, 200); assert.equal((await exported.json()).length, 1);
  // Navigating an active round saves its final spatial vote and resets the timer.
  const deckResponse = await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/questions`, { headers: { Cookie: hostCookie, 'x-host-key': hostKey } });
  assert.equal(deckResponse.status, 200);
  const deck = await deckResponse.json() as { questions: { question: typeof question }[] };
  screen.send('command', { action: 'next' });
  players[1].send('command', { action: 'next' });
  await wait(100); assert.equal(screen.state.phase, 'results');
  host.send('command', { action: 'next' });
  await until(() => screen.state.questionJson === JSON.stringify(deck.questions[0].question), 'First question did not synchronize.');
  assert.equal(screen.state.hasPreviousQuestion, false);
  assert.equal(screen.state.hasNextQuestion, true);
  const firstDeadline = screen.state.endsAt;
  host.send('command', { action: 'previous' });
  await wait(100);
  assert.equal(screen.state.endsAt, firstDeadline, 'A boundary command must not restart or finish the round.');
  host.send('command', { action: 'next' });
  await until(() => screen.state.questionJson === JSON.stringify(deck.questions[1].question), 'Next did not save and replace the active question.');
  assert.equal(screen.state.hasPreviousQuestion, true);
  host.send('command', { action: 'pause', paused: true });
  await until(() => screen.state.paused, 'Pause did not synchronize.');
  host.send('command', { action: 'previous' });
  await until(() => screen.state.questionJson === JSON.stringify(deck.questions[0].question), 'Previous did not restore the first question.');
  assert.equal(screen.state.paused, false);
  assert(screen.state.endsAt > firstDeadline, 'Returning to a question must start a fresh timer.');
  assert.equal(screen.state.resultJson, '');
  for (const entry of deck.questions.slice(1)) {
    host.send('command', { action: 'next' });
    await until(() => screen.state.questionJson === JSON.stringify(entry.question), 'Deck order changed after navigating back.');
  }
  assert.equal(screen.state.hasNextQuestion, false);
  const finalDeadline = screen.state.endsAt;
  host.send('command', { action: 'next' });
  await wait(100); assert.equal(screen.state.endsAt, finalDeadline);
  host.send('command', { action: 'finish' });
  await until(() => screen.state.phase === 'results', 'Final question did not finish.');
  const navigationResults = await (await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/results`, { headers: { Cookie: hostCookie, 'x-host-key': hostKey } })).json();
  assert.equal(navigationResults.length, deck.questions.length + 3, 'Navigation must save each completed attempt once.');
  for (const saved of navigationResults) {
    assert.equal(saved.participants, count);
    assert.equal(saved.counts.reduce((sum: number, zone: { count: number }) => sum + zone.count, 0) + saved.outside, count);
  }
  const logout = await fetch(`${httpEndpoint}/api/auth/sign-out`, { method: 'POST', headers: { ...headers, Cookie: hostCookie, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(logout.status, 200);
  host.send('command', { action: 'lobby' });
  await wait(500); assert.equal(screen.state.phase, 'results', 'Signing out must revoke live host commands.');
  const revoked = await fetch(`${httpEndpoint}/api/rooms/${host.roomId}/results`, { headers: { Cookie: hostCookie, 'x-host-key': hostKey } });
  assert.equal(revoked.status, 403);
  const percentile = (values: number[], pct: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * pct))];
  console.log(JSON.stringify({ players: count, durationMs: duration, samples: rtts.length, rttMedianMs: Math.round(percentile(rtts, 0.5)), rttP95Ms: Math.round(percentile(rtts, 0.95)), patchMedianMs: Math.round(percentile(patches, 0.5)), patchP95Ms: Math.round(percentile(patches, 0.95)), checks: ['anonymous sessions', 'closed registration', 'unauthorized creation allocates no room', 'movement and bounds', 'cookie-based reconnect identity', 'host authorization', 'spectator restrictions', 'vote totals', 'frozen results', 'result export', 'question navigation and boundaries', 'navigation preserves vote totals', 'host sign-out revokes live commands'] }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  clearInterval(movementTimer);
  await Promise.race([Promise.allSettled(connections.map(room => room.leave())), wait(2000)]);
}
