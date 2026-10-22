import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PartyRoom, rooms } from './PartyRoom.js';
import { commandSchema } from '../shared/protocol.js';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth, isHost } from './auth.js';
import { logger, startProcessDiagnostics, closeDiagnostics } from './diagnostics.js';

const port = Number(process.env.PORT || 2567);
const host = process.env.HOST || '0.0.0.0';
const app = express();
app.disable('x-powered-by');
// The production reverse proxy connects over loopback; never trust arbitrary peers.
app.set('trust proxy', 'loopback');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// Better Auth must receive the unparsed body, before express.json().
app.all('/api/auth/*splat', toNodeHandler(auth));
app.get('/api/me', async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  res.set('Cache-Control', 'no-store').json({ authenticated: !!session, host: isHost(session?.user) });
});
app.use(express.json({ limit: '12kb' }));
const limiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', limiter);
app.get('/api/health', (_req, res) => res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) }));
app.get('/api/config', (_req, res) => {
  const clientPort = process.env.NODE_ENV === 'production' ? port : 5173;
  const lanUrls = process.env.NODE_ENV === 'production' ? [] : Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i!.address}:${clientPort}`);
  res.json({ publicUrl: process.env.PUBLIC_URL || '', lanUrls });
});

// The host panel and a future Grok adapter share this exact command boundary.
app.use('/api/rooms', async (req, res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!isHost(session?.user)) { res.status(403).json({ error: 'Host sign-in required.' }); return; }
  next();
});
app.get('/api/rooms/:roomId/questions', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
  if (!room.authorize(req.get('x-host-key') || '')) { res.status(403).json({ error: 'Host key required.' }); return; }
  res.set('Cache-Control', 'no-store').json(room.getQuestions());
});
app.post('/api/rooms/:roomId/commands', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
  if (!room.authorize(req.get('x-host-key') || '')) { res.status(403).json({ error: 'Host key required.' }); return; }
  const command = commandSchema.safeParse(req.body);
  if (!command.success) { res.status(400).json({ error: 'Invalid command.', details: command.error.flatten() }); return; }
  try { room.command(command.data); res.json({ ok: true }); }
  catch (error) { res.status(409).json({ error: (error as Error).message }); }
});
app.get('/api/rooms/:roomId/results', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
  if (!room.authorize(req.get('x-host-key') || '')) { res.status(403).json({ error: 'Host key required.' }); return; }
  res.json(room.history);
});
const clientDir = resolve('dist/client');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/matchmake')) { next(); return; }
    res.sendFile(resolve(clientDir, 'index.html'));
  });
}
const http = createServer(app);
const origins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
const game = new Server({ transport: new WebSocketTransport({
  server: http, maxPayload: 16 * 1024,
  pingInterval: 5000, pingMaxRetries: 2,
  ...(origins?.length ? { verifyClient: (info: { origin: string }) => origins.includes(info.origin) } : {}),
}) });
game.define('party', PartyRoom);
await game.listen(port, host);
const stopDiagnostics = startProcessDiagnostics(() => rooms.size);
game.onShutdown(async () => { stopDiagnostics(); await closeDiagnostics(); });
logger.info({ event: 'server_ready', port, host }, 'Sidequest server ready');
