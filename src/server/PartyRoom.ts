import { Room, ServerError, type Client, type AuthContext } from '@colyseus/core';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PartyState, PlayerState } from './state.js';
import { stepPhysics, type HeldInput } from './physics.js';
import { appearanceSchema, inputSchema, commandSchema, makeZones, zoneAt, TICK_RATE, PATCH_MS, WORLD, type HostCommand, type Question, type RoundResult, type Zone } from '../shared/protocol.js';
import { persistResult } from './results.js';
import { auth, isHost } from './auth.js';
import { loadQuestionDeck, QuestionSequence, type QuestionDeck } from './questions/index.js';
import { logger, RoomDiagnostics, movementTracing } from './diagnostics.js';
import { renderProbeSchema } from '../shared/telemetry.js';
import { InputLeases } from './input-leases.js';
import { storage } from './storage/index.js';

export const rooms = new Map<string, PartyRoom>();
const tokenSchema = z.string().regex(/^[a-zA-Z0-9_-]{32,128}$/);
const joinSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('host'), hostKey: tokenSchema }),
  z.object({ role: z.literal('screen') }),
  z.object({ role: z.literal('player'), token: tokenSchema, name: z.string().trim().min(1).max(18), inputProtocol: z.literal(1).optional(), ...appearanceSchema.shape }),
]);
// Matchmaking serializes auth data; use a string rather than a Headers instance.
type Joined = z.infer<typeof joinSchema> & { userId?: string; sessionCookie?: string };
interface ClientData { role: Joined['role']; playerId?: string; inputLeases?: InputLeases }
type PartyClient = Client & { userData: ClientData };

export class PartyRoom extends Room<{ state: PartyState }> {
  state = new PartyState();
  maxMessagesPerSecond = 60;
  autoDispose = false;
  patchRate = PATCH_MS;
  private hostKey = '';
  private heldInputs = new Map<string, HeldInput>();
  private identities = new Map<string, string>();
  private sessions = new Map<string, string>();
  private offlineSince = new Map<string, number>();
  private chatAt = new Map<string, number>();
  private roundNumber = 0;
  private question: Question | null = null;
  private questionDeck!: QuestionDeck;
  private questions!: QuestionSequence;
  private zones: Zone[] = [];
  private pausedAt = 0;
  private lastOccupied = Date.now();
  private diagnostics!: RoomDiagnostics;
  private pendingProbes = new Map<string, { client: PartyClient; playerId: string; seq: number; receivedMono: number; receivedAt: number }>();
  private probeAt = new Map<string, number>();
  private renderTraces = new Map<string, { playerId: string; seq: number; at: number }>();
  private lastTrace = -Infinity;
  readonly history: RoundResult[] = [];

  async onCreate(options: unknown) {
    const parsed = joinSchema.safeParse(options);
    if (!parsed.success || parsed.data.role !== 'host') throw new ServerError(400, 'Create the room from the host screen.');
    // Snapshot the source once so external edits cannot change an ongoing session.
    this.questionDeck = await loadQuestionDeck(storage.questions);
    this.questions = new QuestionSequence(this.questionDeck);
    if (rooms.size >= Number(process.env.MAX_ROOMS || 5)) throw new ServerError(429, 'The maximum number of rooms has been reached.');
    this.hostKey = parsed.data.hostKey;
    this.roomId = randomBytes(4).toString('hex').toUpperCase();
    rooms.set(this.roomId, this);
    this.diagnostics = new RoomDiagnostics(this.roomId);
    logger.info({ event: 'room_created', roomId: this.roomId });
    this.setMetadata({ title: 'Sidequest Live' });
    this.onMessage('input', (client, value) => {
      const player = this.getPlayer(client);
      const input = inputSchema.safeParse(value);
      if (!player || !input.success) { this.diagnostics.inputRejected(false); return; }
      if (input.data.seq <= player.lastSeq) { this.diagnostics.inputRejected(true); return; }
      player.lastSeq = input.data.seq;
      const leases = (client as PartyClient).userData.inputLeases;
      const remaining = leases?.remaining(input.data.lease, performance.now());
      // A neutral input always stops movement, even when its lease has expired.
      if (remaining === 0 && (input.data.x !== 0 || input.data.y !== 0)) {
        this.diagnostics.inputRejected(true, true);
        return;
      }
      const receivedAt = Date.now();
      this.heldInputs.set(player.id, { ...input.data, at: receivedAt,
        ...(remaining !== undefined ? { expiresAt: receivedAt + remaining } : {}),
      });
      const now = performance.now();
      if (input.data.probe && now - (this.probeAt.get(client.sessionId) ?? -Infinity) >= 900) {
        this.probeAt.set(client.sessionId, now);
        this.pendingProbes.set(client.sessionId, { client: client as PartyClient, playerId: player.id, seq: input.data.seq, receivedMono: now, receivedAt: Date.now() });
      }
    });
    this.onMessage('jump', client => {
      const player = this.getPlayer(client), now = Date.now();
      if (player && !this.state.paused && now - player.jumpAt > 750) player.jumpAt = now;
    });
    this.onMessage('chat', (client, value) => {
      const player = this.getPlayer(client), now = Date.now();
      const message = z.string().trim().min(1).max(80).safeParse(value);
      if (!player || !message.success || !this.state.chatEnabled || now - (this.chatAt.get(player.id) || 0) < 2500) return;
      this.chatAt.set(player.id, now);
      player.message = message.data.replace(/[\u0000-\u001f\u007f]/g, '');
      player.messageUntil = now + 4000;
    });
    this.onMessage('ping', (client, sent) => {
      if (typeof sent === 'number' && Number.isFinite(sent)) {
        const lease = (client as PartyClient).userData?.inputLeases?.issue(performance.now());
        client.send('pong', { sent, serverTime: Date.now(), ...(lease ? { lease } : {}) });
      }
    });
    this.onMessage('telemetry', (client, report) => {
      const role = (client as PartyClient).userData?.role;
      if (role) this.diagnostics.report(client.sessionId, role, report);
    });
    this.onMessage('renderProbe', (client, raw) => {
      const pending = this.renderTraces.get(client.sessionId);
      if (!pending || performance.now() - pending.at > 5000) return;
      const parsed = renderProbeSchema.safeParse(raw);
      if (!parsed.success || parsed.data.seq !== pending.seq || parsed.data.playerId !== pending.playerId) return;
      this.renderTraces.delete(client.sessionId);
      logger.info({ event: 'movement_trace', roomId: this.roomId, screenConnectionId: client.sessionId, ...parsed.data,
        serverReceiveToRenderAckMs: Math.round(performance.now() - pending.at),
      });
    });
    this.onMessage('whoami', client => {
      const player = this.getPlayer(client);
      if (player) client.send('identity', { playerId: player.id });
    });
    this.onMessage('command', (client, command) => {
      if ((client as PartyClient).userData?.role !== 'host') return;
      const parsedCommand = commandSchema.safeParse(command);
      if (!parsedCommand.success) { client.send('notice', 'Check the question and its answers.'); return; }
      // Recheck the durable session so signing out also revokes a live host connection.
      void auth.api.getSession({ headers: new Headers({ cookie: (client.auth as Joined).sessionCookie || '' }) }).then(session => {
        if (!isHost(session?.user)) { client.send('notice', 'Sign in again as a host.'); return; }
        try { this.command(parsedCommand.data); } catch (error) { client.send('notice', (error as Error).message); }
      }).catch(() => client.send('notice', 'Unable to verify your host session.'));
    });
    this.setSimulationInterval(() => this.tick(), 1000 / TICK_RATE);
    this.clock.setInterval(() => this.cleanup(), 5000);
    this.clock.setInterval(() => this.diagnostics.flush(this.clients as PartyClient[], [...this.state.players.values()].filter(p => p.online).length, this.state.phase), 10_000);
  }

  static async onAuth(_token: string, options: unknown, context: AuthContext): Promise<Joined> {
    const result = joinSchema.safeParse(options);
    if (!result.success) throw new ServerError(400, 'Invalid nickname or character.');
    if (result.data.role === 'screen') return result.data;
    const session = await auth.api.getSession({ headers: context.headers });
    if (!session) throw new ServerError(401, 'Session required. Join the room using the player link.');
    if (result.data.role === 'host' && !isHost(session.user)) throw new ServerError(403, 'Host sign-in required.');
    return { ...result.data, userId: session.user.id, sessionCookie: context.headers.get('cookie') || '' };
  }

  onJoin(rawClient: Client, _options: unknown, auth: Joined) {
    const client = rawClient as PartyClient;
    if (!auth || (auth.role !== 'screen' && !auth.userId)) throw new ServerError(401, 'Session required.');
    if (auth.role === 'host' && !this.authorize(auth.hostKey)) throw new ServerError(403, 'Invalid host key.');
    client.userData = { role: auth.role };
    this.diagnostics.joined();
    logger.info({ event: 'connection_join', roomId: this.roomId, connectionId: client.sessionId, role: auth.role });
    if (auth.role !== 'player') return;
    if (auth.inputProtocol === 1) client.userData.inputLeases = new InputLeases();
    let id = this.identities.get(auth.userId!);
    let player = id ? this.state.players.get(id) : undefined;
    if (!player) {
      id = randomUUID();
      player = new PlayerState();
      Object.assign(player, { id, name: auth.name, color: auth.color, hair: auth.hair, accessory: auth.accessory, accessory2: auth.accessory2 || 'none' });
      const slot = this.state.players.size;
      player.x = WORLD.left + 60 + (slot % 12) * 90;
      player.y = WORLD.top + 50 + (Math.floor(slot / 12) % 6) * 70;
      this.state.players.set(id, player);
      this.identities.set(auth.userId!, id);
    }
    const previousSession = this.sessions.get(player.id);
    this.sessions.set(player.id, client.sessionId);
    if (previousSession) this.clients.find(c => c.sessionId === previousSession)?.leave(4001);
    client.userData.playerId = player.id;
    player.online = true; player.vx = 0; player.vy = 0; player.lastSeq = -1;
    this.heldInputs.delete(player.id); this.offlineSince.delete(player.id);
    client.send('identity', { playerId: player.id });
  }

  onLeave(rawClient: Client, code?: number) {
    const client = rawClient as PartyClient;
    // Colyseus 0.18 records this counter internally before closing a rate-limited socket.
    const messagesInWindow = (client as Client & { _numMessagesLastSecond?: number })._numMessagesLastSecond ?? 0;
    this.diagnostics.left(client.sessionId);
    this.pendingProbes.delete(client.sessionId); this.probeAt.delete(client.sessionId); this.renderTraces.delete(client.sessionId);
    logger.info({ event: 'connection_leave', roomId: this.roomId, connectionId: client.sessionId, role: client.userData?.role, code,
      messagesInWindow, messageLimit: this.maxMessagesPerSecond,
      rateLimitExceeded: messagesInWindow > this.maxMessagesPerSecond,
    });
    const id = client.userData?.playerId;
    if (!id || this.sessions.get(id) !== client.sessionId) return;
    this.sessions.delete(id); this.heldInputs.delete(id);
    this.offlineSince.set(id, Date.now());
    const player = this.state.players.get(id);
    if (player) { player.online = false; player.vx = 0; player.vy = 0; }
  }
  onDispose() { rooms.delete(this.roomId); logger.info({ event: 'room_disposed', roomId: this.roomId }); }

  getQuestions() { return structuredClone(this.questionDeck); }

  authorize(key: string) {
    const provided = Buffer.from(key), expected = Buffer.from(this.hostKey);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
  command(command: HostCommand) {
    const now = Date.now();
    switch (command.action) {
      case 'next':
      case 'previous': {
        const entry = command.action === 'next' ? this.questions.next() : this.questions.previous();
        this.finish();
        this.command({ action: 'start', question: entry.question });
        this.state.hasPreviousQuestion = this.questions.hasPrevious;
        this.state.hasNextQuestion = this.questions.hasNext;
        break;
      }
      case 'start': {
        if (this.state.phase === 'question') throw new Error('Finish the current round before starting another.');
        this.question = command.question;
        this.zones = makeZones(command.question);
        this.state.questionJson = JSON.stringify(command.question);
        this.state.zonesJson = JSON.stringify(this.zones);
        this.state.resultJson = '';
        this.state.phase = 'question'; this.state.paused = false;
        this.state.endsAt = now + command.question.duration * 1000;
        this.roundNumber++;
        break;
      }
      case 'finish': this.finish(); break;
      case 'lobby': {
        if (this.state.phase === 'question') this.finish();
        this.state.phase = 'lobby'; this.state.endsAt = 0;
        this.state.questionJson = ''; this.state.zonesJson = '[]'; this.state.resultJson = '';
        this.question = null; this.zones = []; break;
      }
      case 'chat':
        this.state.chatEnabled = command.enabled;
        if (!command.enabled) this.state.players.forEach(p => { p.message = ''; p.messageUntil = 0; });
        break;
      case 'pause': {
        if (command.paused && !this.state.paused) { this.pausedAt = now; this.state.paused = true; this.heldInputs.clear(); }
        else if (!command.paused && this.state.paused) {
          if (this.state.phase === 'question') this.state.endsAt += now - this.pausedAt;
          this.state.paused = false; this.heldInputs.clear();
        }
        break;
      }
    }
  }

  private getPlayer(client: Client) {
    const data = (client as PartyClient).userData;
    if (data?.role !== 'player' || !data.playerId || this.sessions.get(data.playerId) !== client.sessionId) return undefined;
    return this.state.players.get(data.playerId);
  }
  private tick() {
    const started = this.diagnostics.tickStart();
    const now = Date.now(); this.state.serverTime = now;
    // Take the final snapshot before simulating another frame past the deadline.
    if (!this.state.paused && this.state.phase === 'question' && now >= this.state.endsAt) this.finish();
    if (!this.state.paused && this.state.phase !== 'results') stepPhysics([...this.state.players.values()], this.heldInputs, 1 / TICK_RATE, now);
    else this.state.players.forEach(p => { p.vx = 0; p.vy = 0; });
    for (const probe of this.pendingProbes.values()) {
      this.diagnostics.inputWaitMs.add(performance.now() - probe.receivedMono);
      const applied = !this.state.paused && this.state.phase !== 'results';
      probe.client.send('inputAck', { seq: probe.seq, applied });
      if (applied && movementTracing() && started - this.lastTrace >= 1000) {
        this.lastTrace = started;
        for (const viewer of this.clients as PartyClient[]) if (viewer.userData?.role !== 'player') {
          this.renderTraces.set(viewer.sessionId, { playerId: probe.playerId, seq: probe.seq, at: probe.receivedMono });
          viewer.send('movementProbe', { playerId: probe.playerId, seq: probe.seq, receivedAt: probe.receivedAt });
        }
      }
    }
    this.pendingProbes.clear();
    this.diagnostics.tickMs.add(performance.now() - started);
  }
  private finish() {
    if (this.state.phase !== 'question' || !this.question) return;
    const counts = this.zones.map(zone => ({ id: zone.id, label: zone.label, count: 0 }));
    let outside = 0, participants = 0;
    this.state.players.forEach(player => {
      if (!player.online) return;
      participants++;
      const zone = zoneAt(this.zones, player.x, player.y);
      if (zone) counts.find(count => count.id === zone.id)!.count++;
      else outside++;
    });
    const result: RoundResult = { id: `${this.roomId}-${this.roundNumber}`, roomId: this.roomId,
      question: this.question, endedAt: new Date().toISOString(), counts, outside, participants };
    this.history.push(result);
    this.state.resultJson = JSON.stringify(result);
    this.state.phase = 'results'; this.state.endsAt = 0; this.state.paused = false; this.heldInputs.clear();
    void persistResult(result).catch(error => {
      logger.error({ event: 'result_persistence_failed', roomId: this.roomId, err: error }, 'Result persistence failed');
      this.clients.filter(c => (c as PartyClient).userData?.role === 'host').forEach(c => c.send('notice', 'The result is visible, but saving it failed. Export it from the host screen.'));
    });
  }
  private cleanup() {
    const now = Date.now();
    if (this.clients.length) this.lastOccupied = now;
    else if (now - this.lastOccupied > 15 * 60_000) { void this.disconnect(); return; }
    for (const [id, since] of this.offlineSince) if (now - since > 90_000) {
      this.state.players.delete(id); this.offlineSince.delete(id); this.chatAt.delete(id);
      for (const [key, value] of this.identities) if (value === id) this.identities.delete(key);
    }
    this.state.players.forEach(p => { if (p.messageUntil < now && p.message) p.message = ''; });
  }
}
