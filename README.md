# Sidequest Live

A multiplayer game prototype for hackathon audiences: participants join a room by QR code, choose a nickname and character, then use their phone as a controller. Their final positions determine their answers to questions.

An open-source project for the Grok Bot Community Engineering London Hackathon, October 22, 2026. [Public code](https://github.com/AxENSRennes/grok-hackathon) · [Demo instance](https://play.colvenalabs.com).

The demo requires a preconfigured organizer account to create a room; participants then join by QR without signing up. To run your own event, follow the instructions below. This is still a prototype; Grok/Cognee integrations and final sprites remain to be connected.

## Getting started

Node.js 22.13 or later (24 recommended), npm.

```sh
npm ci
npm run dev
```

Configure `HOST_EMAILS` in `.env` and provision an organizer account with `npm run auth:create-host` (supply a password of at least 12 characters through stdin). Production requires `BETTER_AUTH_SECRET`, `HOST_EMAILS`, and an HTTPS `PUBLIC_URL`. Organizer registration is closed to the public.

Open **http://localhost:5173/** and sign in as an organizer: the room and its QR code are created automatically. After Play, use the projector computer's left/right arrow keys to move between questions, or click the small Previous/Next buttons. Next starts the first question from the lobby. Navigating saves an active round's answers and starts the selected question with a fresh timer. Controls are available only in the organizer's room tab; public screens stay read-only. Phones on the same network can join through the QR code (the local address is detected automatically). If the Wi-Fi isolates clients, use public HTTPS hosting.

- `/?room=CODE`: game and QR code; without a code, a new room is created automatically.
- `/host` and `/screen?room=CODE`: compatible legacy links to the same minimal screen.
- `/play?room=CODE`: nickname, character/accessory selection, and touch controller.
- `/preview`: arcade visual proposal with a large question and two local code-drawn characters; arrow keys move the cyan character, space jumps. This preview does not create a room; its QR code opens the player page.
- Test keyboard controls: arrows / WASD / ZQSD, space to jump (outside text fields).

## Working features

- No product player limit. Tests use 50 or 60 connections as sample sizes; actual capacity depends on the machine and network.
- Server simulation at 60 steps/second; synchronization at around 30 updates/second; independently smoothed Phaser rendering.
- Normalized movement, equal-weight collisions, bounded impulses, and map boundaries.
- Visual jumps: ground position and collisions remain unchanged.
- Input stops after 450 ms without a heartbeat and is released when the phone loses focus.
- Better Auth: automatic anonymous sessions for players, email/password accounts for organizers. Reconnection uses the signed session: characters are retained for 90 seconds after disconnecting. Empty rooms expire after 15 minutes.
- Multiple-choice questions with 2–4 zones or a five-band scale, zone reveals, 10–180-second timers, and API controls to finish or pause. No round-management form in the interface.
- Pushing remains active during voting. Results freeze positions. Players outside zones are counted separately; disconnected players do not vote.
- Speech bubbles of up to 80 characters last four seconds; messages have a minimum 2.5-second interval and can be disabled globally through the API.
- Aggregate results are saved as JSONL in `data/rounds.jsonl`, with JSON export through the protected API. Movement and chat are not persisted.

Arcade avatars are drawn in code on a 48 × 48 pixel grid, with distinct hairstyles, clothing palettes, accessories, and walking poses in four directions. The environment, presenter, and large pixel-letter question are also drawn in code. The ten art references are in `design/character-palettes-2026-10-22/index.html`; generated sheets remain references rather than textures loaded by the game.

## Verification

```sh
npm run check
```

This command checks types only. `npm test` runs just two quick movement tests. The full suite never runs automatically at game startup or after each edit. Fifteen seconds is an approximate speed target, not a hard timeout.

| Explicit command | Scope |
| --- | --- |
| `npm test` | Two movement tests: diagonal speed and stopping after controller loss |
| `npm run test:unit` | All unit cases: physics, voting zones, malformed input, and organizer permissions |
| `npm run test:integration` | Temporary server and SQLite database, real Better Auth accounts and multiplayer connections; automatic cleanup |
| `npm run test:all` | Full unit suite and integration |
| `npm run test:load` | 50 simulated players on an existing server; organizer credentials required |

Extended suites remain available for consequential changes and releases. There is no artificial coverage target or systematic rerun after small edits.

Verify affected E2E journeys manually using browser tools: open the game, join by QR/link, choose an avatar, move/jump/send a message, check the shared screen, and reconnect. No automated E2E suite by default.

Builds are reserved for releases and bundling changes. `npm run test:load` is an explicit extra check for networking/physics changes; it requires a running server and is separate from routine checks. By default, it connects 50 players, one screen, and one organizer (a sample, not a product limit), then checks movement, boundaries, identity recovery, permissions, and results. A local test does not measure actual latency on the event Wi-Fi.

## Design guidelines

[AGENTS.md](AGENTS.md) contains project and verification instructions; [DESIGN.md](DESIGN.md) records visual choices. The [anti-slop](docs/anti-slop/README.md) core is vendored locally and applied during interface work. No global plugin or runtime dependency is added.

## Production

```sh
npm run build
NODE_ENV=production npm start
```

A single Node service serves the built client and WebSockets on `PORT` (2567 by default). Keep the server running behind an HTTPS proxy that supports WebSockets. One instance is enough for this prototype; do not distribute the same room across processes without shared presence/driver infrastructure.

A Dockerfile is provided. Mount a volume at `/app/data` to retain results. Active rooms stay in memory and do not survive a server restart.

See `.env.example` for configuration. `ALLOWED_ORIGINS` allows HTTP authentication and WebSocket origins; `DATA_DIR` stores `auth.sqlite` and results. The organizer key is stored in the creator tab's sessionStorage and is never included in the QR code. Commands also require a valid Better Auth organizer session. No round-management form is exposed in the interface.

Self-hosting and updates are documented in [deploy/PUBLIC.md](deploy/PUBLIC.md). For authenticated network testing, provide `TEST_HOST_EMAIL` and `TEST_HOST_PASSWORD` through a private environment file. The test also checks that registration is closed, guests cannot access organizer controls, and commands are rejected after organizer sign-out.

## Preparing Grok / Cognee / Supabase

The game currently calls no external AI or database service. Better Auth uses SQLite on the server. No external service credits are consumed.

The command endpoint for a future Grok adapter already supports server-side validation:

```http
POST /api/rooms/:roomId/commands
Content-Type: application/json
x-host-key: <private organizer key>
Cookie: <Better Auth organizer session>

{"action":"start","question":{"text":"Which workshop?","mode":"choice","labels":["Agents","Robotics"],"duration":30}}
```

Actions: `next`, `previous`, `start`, `finish`, `lobby`, `pause` (`paused`), and `chat` (`enabled`). Never expose the organizer key or cookie to players or in a URL. Schemas and types are in `src/shared/protocol.ts`. The protected export is `GET /api/rooms/:roomId/results`, using the same session and header. A future Grok adapter must use an authorized server boundary.

The six selected questions are in `src/server/questions/hackathon.en.json`, in gameplay order, with a provisional duration of 30 seconds each. Sending `{"action":"next"}` or `{"action":"previous"}` to the command endpoint navigates the selection, finishing and saving an active round before starting the selected question. The first and final questions are navigation boundaries; attempts to move past them leave the current round unchanged. The final question is explicitly marked `closing`; navigating back remains available. `lobby` keeps the current selection position. A new room restarts the selection. `start` commands with custom questions remain available and require any active round to finish first.

`GET /api/rooms/:roomId/questions` returns the room's selection with the same protections as commands. `QuestionSource.load()` in `src/server/questions/index.ts` is the boundary to replace with a Supabase or Grok adapter: its output is validated, then fixed when each room is created. No external access occurs in the physics loop. No configuration panel is added.

Cognee could enrich questions with context and previous results; Supabase could replace local round storage. These integrations remain to be connected and do not participate in the physics simulation.

## License

Code is licensed under [MIT](LICENSE), following the [hackathon's open-source requirement](https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon#tracks): a public repository with an MIT, Apache-2.0, or AGPL-3.0 license. Generated sheets help select the art direction; no franchise assets are included in the game. The anti-slop rules retain their own MIT notice in `docs/anti-slop/LICENSE`.
