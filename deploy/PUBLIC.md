# Self-hosting

Use a Node.js 22.13+ server with HTTPS and WebSocket support. The app runs as a single process; active rooms live in memory.

1. Copy `.env.example` to a private environment file outside the public web root. Set `NODE_ENV=production`, a random `BETTER_AUTH_SECRET` of at least 32 characters, `HOST_EMAILS`, `PUBLIC_URL`, and `DATA_DIR` pointing to persistent storage. Set `HOST=127.0.0.1` behind a local reverse proxy.
2. Run `npm ci`, `npm run check`, and `npm run build`.
3. Provision an organizer with `npm run auth:create-host` using the same environment. Supply the password via stdin, never as a command-line argument. Public email sign-up stays disabled.
4. Start with `NODE_ENV=production npm start`, or adapt the supplied `sidequest.service` systemd template. Keep the environment file readable only by the service account.
5. Adapt `Caddyfile` to your own hostname. Forward HTTPS/WebSockets to the private app port (2567 by default). Expose only HTTPS/HTTP and your management access.
6. Check `/api/health`, organizer sign-in, and joining from a phone. Use the event Wi-Fi for the final latency check.

Only the data directory needs write access. Back up SQLite through its backup API, or stop the service and copy its database and WAL together. Treat the database and backups as private session data. A restart closes active rooms; sessions and aggregate results persist on disk.

Deploy builds to a new release directory, install production dependencies there, then switch the active directory and restart. Keep the previous release for rollback; check database compatibility before rolling back authentication changes. Do not commit environment files, session databases, participant data, or account screenshots.

The Dockerfile provides an alternative deployment. Mount persistent storage at `/app/data` and supply the same private environment variables.
