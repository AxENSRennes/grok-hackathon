import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Opt-in only: real Better Auth, isolated SQLite, and real multiplayer connections.
const directory = await mkdtemp(join(tmpdir(), 'sidequest-integration-'));
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const password = randomBytes(24).toString('hex');
const env = { ...process.env, NODE_ENV: 'test', PORT: String(port), HOST: '127.0.0.1',
  PUBLIC_URL: `http://127.0.0.1:${port}`, ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
  DATA_DIR: directory, HOST_EMAILS: 'host@example.test', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  TEST_ENDPOINT: `ws://127.0.0.1:${port}`, TEST_HOST_EMAIL: 'host@example.test', TEST_HOST_PASSWORD: password,
  PLAYERS: '2', DURATION_MS: '400', DOTENV_CONFIG_PATH: '/dev/null',
};
let server;
let serverLog = '';
async function run(script, input) {
  const child = spawn(process.execPath, ['--import', 'tsx', script], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.stdin.end(input);
  const timeout = setTimeout(() => child.kill('SIGKILL'), 60_000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    if (code !== 0) throw new Error(`${script} failed (${code}):\n${output.slice(-6000)}`);
    process.stdout.write(output);
  } finally { clearTimeout(timeout); }
}
try {
  await run('scripts/create-host.ts', password);
  server = spawn(process.execPath, ['--import', 'tsx', 'src/server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.on('error', error => { serverLog += error.message; });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog = (serverLog + chunk).slice(-6000); });
  const deadline = Date.now() + 12_000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Test server exited:\n${serverLog}`);
    try { if ((await fetch(`${env.PUBLIC_URL}/api/health`, { signal: AbortSignal.timeout(500) })).ok) break; } catch {}
    if (Date.now() >= deadline) throw new Error(`Test server did not become ready:\n${serverLog}`);
    await delay(100);
  }
  await run('scripts/load-test.ts');
} finally {
  if (server && server.exitCode === null) {
    const stopped = new Promise(resolve => server.once('close', resolve));
    server.kill('SIGTERM');
    await Promise.race([stopped, delay(1500)]);
    if (server.exitCode === null) { server.kill('SIGKILL'); await stopped; }
  }
  await rm(directory, { recursive: true, force: true });
}
