import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { anonymous } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const directory = resolve(process.env.DATA_DIR || './data');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const database = new DatabaseSync(resolve(directory, 'auth.sqlite'));
database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
const production = process.env.NODE_ENV === 'production';
const baseURL = process.env.PUBLIC_URL || 'http://localhost:5173';
const devOrigins = production ? [] : [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  `http://localhost:${process.env.PORT || 2567}`, `http://127.0.0.1:${process.env.PORT || 2567}`,
  ...Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i!.address}:5173`),
];
if (production && (!process.env.BETTER_AUTH_SECRET || !process.env.HOST_EMAILS || !baseURL.startsWith('https://'))) {
  throw new Error('Production requires BETTER_AUTH_SECRET, HOST_EMAILS and an HTTPS PUBLIC_URL.');
}

// Only the local provisioning command enables sign-up. The public server never does.
function authOptions(allowSignUp = false) {
  return {
    appName: 'Sidequest Live',
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET || 'sidequest-local-development-only-change-for-production',
    database,
    trustedOrigins: [...new Set([...devOrigins, ...(process.env.ALLOWED_ORIGINS || baseURL).split(',').map(s => s.trim()).filter(Boolean)])],
    emailAndPassword: { enabled: true, disableSignUp: !allowSignUp, minPasswordLength: 12 },
    plugins: [anonymous()],
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 180, customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      // An event can have many phones behind the same Wi-Fi IP.
      '/sign-in/anonymous': { window: 60, max: 180 },
    } },
    advanced: { useSecureCookies: production, ipAddress: { ipAddressHeaders: ['x-forwarded-for'] } },
  };
}
export function createAuth(allowSignUp = false) { return betterAuth(authOptions(allowSignUp)); }
export async function migrateAuth() {
  const { runMigrations } = await getMigrations(authOptions());
  await runMigrations();
}
// Fresh databases must be migrated before Better Auth validates its schema.
await migrateAuth();
export const auth = createAuth();
export { isHost } from './host-policy.js';
