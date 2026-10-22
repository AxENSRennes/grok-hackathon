# Movement corrections, 22 October 2026

## Behavior

- New controllers negotiate `inputProtocol: 1`. Each connection receives opaque, server-issued movement leases through a ping every 500 ms. A lease lasts one second on the server's monotonic clock. The server rejects non-zero movement with an expired, missing, or foreign lease. This bounds the age of accepted movement without trusting phone wall clocks. It is a conservative freshness bound, not an exact measurement of input age.
- Accepted movement expires at the earlier of the normal 450 ms input timeout and the lease deadline. A higher-sequence neutral input can always stop movement. Leases belong to one connection and cannot survive a reconnect. Legacy controllers remain compatible; reload existing phone pages to enable the new protection.
- The client retains one pending direction, replaces it with each button change, and waits while the WebSocket send buffer is non-empty. It flushes on a 25 ms timer, with ordinary movement capped at 40 sends/second; stops bypass this local timing gate. Keyboard repeats no longer resend an unchanged direction. Bytes already handed to the network cannot be withdrawn.
- Clock estimates use the lowest-RTT sample in a rolling 30-second window. Replies exceeding one second still contribute to diagnostics but cannot steer the clock. Reply tracking resets across visibility and connection changes, so background replies cannot contaminate new measurements. Monotonic local time advances the estimate; hiding the page preserves the last estimate while clearing outstanding probes.
- Steering's exponential response coefficient changes from 18 to 30 per second. Top speed, collision solver, arena bounds and vote authority stay the same. Display extrapolation remains capped at 45 ms; no additional extrapolation or prediction is introduced.
- Room summaries include `expiredInputs`. Close logs include the Colyseus message counter and whether it exceeded the existing 60-message limit. The protection is not disabled or raised. Counter access is specific to the installed Colyseus 0.18 implementation and should be checked during upgrades.
- Diagnostic reports have one pending flag and retry after the send buffer drains. This avoids permanently skipping every ten-second report when its timer coincides with the periodic ping. Reports are still aggregated; no unbounded export queue is added.

One-second leases intentionally prefer stopping to replaying old motion during a long stall. A persistently slow link can therefore become temporarily unresponsive until fresh leases arrive. No code here removes the phone-to-server-to-screen propagation delay, and a healthy browser send buffer does not prove a healthy network.

## Controlled comparison

Baseline: `bc497e0`. Corrected version: the same revision plus the movement changes, isolated from concurrent storage work. Both variants ran real Colyseus servers, authentication and WebSockets. The script injected 60 ms before controller messages reached the server and 60 ms before screen state became observable. Five start/reverse/stop cycles were collected per variant.

| Measurement | Baseline | Corrected |
| --- | ---: | ---: |
| Start to 90% speed, median | 265.9 ms | 205.3 ms |
| Reverse to 90% opposite speed, median | 301.5 ms | 233.8 ms |
| Release to speed below 1 px/s, median | 436.3 ms | 332.3 ms |
| Movement caused by an expired command after a two-second stall | 22.17 px | 0 px |
| Packets submitted during a modeled blocked send buffer: 12 direction changes then release | 13 | 1 |

These observations end at synchronized screen state, not physical display pixels. Delays were injected at application boundaries, not with a TCP packet-loss emulator. The blocked-buffer case explicitly supplies a nonzero buffer size to the production sender. The stale-command case delivers the press after 2,000 ms and release after 2,120 ms. It demonstrates one harmful delayed-input scenario, not every possible TCP burst pattern. Five samples are a regression comparison, not a population performance estimate or a measurement of event Wi-Fi/4G.

Raw results: [movement-comparison-2026-10-22.json](movement-comparison-2026-10-22.json).

## Verification

- Type checking passed.
- Eight focused tests passed: movement speed/diagonal normalization, disconnect stopping, overlapping/crowded collisions, spatial votes, lease expiry/connection isolation, buffered-command replacement and clock stability/background replies.
- An additional session regression test passed for diagnostic delivery when pings occupy the send buffer exactly at the reporting deadline.
- Both controlled comparison runs completed successfully. The first attempt collected measurements but its wrapper incorrectly expected vote exports from a movement-only scenario; the wrapper was corrected and both full runs repeated successfully.
- The opt-in integration/load run with 50 controllers passed authentication, movement/bounds, reconnect identity, host restrictions, spatial vote totals, frozen results, question navigation and result persistence. Local screen ping median was 1 ms, p95 4 ms; patch gaps were 33 ms median and 35 ms p95. Fifty is a load sample, not a player limit.
- The isolated release build passed with the existing large Phaser chunk warning.
- Manual browser verification used the built client and a dedicated local server: join, Play, hold/release right, hold left, jump, reload/rejoin, then movement again. The shared screen visibly moved the avatar and the controller showed Connected after rejoining. No warning/error entries were captured on the controller during the check.

The shared workspace was committed and published concurrently as `e2067ec`, which includes these corrections and the separate storage work. The isolated archive prepared for this task was not activated over that newer deployment.

Production verification confirmed the new input-lease and expired-input counters in the running release, and the same client bundle used in the local browser check. A separate production room (`60DA2FC4`) was used to join and move right/down through the real VPS connection. This was a desktop browser controller, not a user's phone/4G test. No warning/error entries were captured on either tab. The final telemetry scheduling fix was published as client bundle `main-8hYIFurp.js` by adding hashed assets and atomically replacing `dist/client/index.html`, without restarting the server. Previous assets and `index.before-movement-telemetry-fix.html` remain available in the release for rollback.

## Reproduction

Use the isolated integration runner with the movement scenario:

```sh
INTEGRATION_SCRIPT=scripts/test-movement-network.ts node scripts/test-integration.mjs
PLAYERS=50 DURATION_MS=6000 node scripts/test-integration.mjs
npx vitest run src/client/movement-connection.test.ts src/server/physics.test.ts
```

For the baseline comparison, use the old server/physics revision and copy the scenario, its runner and the sender/shared movement modules into an isolated checkout; set `MOVEMENT_BASELINE=1`. Setting that variable against the corrected server does not recreate old physics and is not a valid before/after comparison. `MOVEMENT_RESULT_FILE` optionally writes the scenario's JSON results. These checks are opt-in and are not added to CI or routine development hooks.
