# Latency diagnostics

The server writes Pino JSON to stdout. The existing systemd service collects it in journald; no collector or dashboard is required. The VPS currently caps the shared persistent journal at 512 MiB and its runtime journal at 128 MiB. Those limits cover all services, not only this game.

`deploy/diagnostics.conf` is installed as `/etc/systemd/system/sidequest.service.d/diagnostics.conf`. It explicitly routes stdout/stderr to the journal and bounds log bursts to 1000 messages per 30 seconds. Normal metrics remain well below this rate. A restart applies environment changes and closes in-memory rooms; reload systemd after editing the drop-in.

```sh
ssh dev-vps-admin 'sudo journalctl -u sidequest -f -o cat'
ssh dev-vps-admin 'sudo journalctl -u sidequest --since "10 minutes ago" -o cat' \
  | jq -R 'fromjson? | select(.event == "room_metrics" or .event == "process_metrics")'
```

Every ten seconds, `process_metrics` reports memory, CPU as a percentage of one core, event-loop utilization and event-loop timer delay. The latter has a 20 ms sampling resolution: approximately 20 ms at idle is normal, not 20 ms of game processing.

Each `room_metrics` entry reports active connections by role, joins/leaves, rejected inputs, simulation duration (`tickMs`), intervals between simulation callbacks (`tickGapMs`) and sampled input receipt to simulation completion (`inputWaitMs`). Simulation aims for 60 Hz; patches are sent every 33 ms. Lifecycle and persistence errors are logged immediately. Names, chat messages, cookies, passwords and host keys are not included in diagnostic events.

Client measurements are grouped by `player`, `screen` and `host`:

| Field | Measurement |
| --- | --- |
| `rttMs` | WebSocket application ping round trip, including scheduling at both ends |
| `inputAckMs` | Controller send to acknowledgement after the next server simulation; measured on one client clock |
| `patchGapMs` | Time between state callbacks; includes network and client scheduling |
| `frameMs` | Actual wall-clock interval between arena updates |
| `patchToFrameMs` | Latest state callback to the next arena update; excludes smoothing convergence and physical display latency |

Reports are sent every ten seconds, accepted at most once per eight seconds per connection, and validated against bounded numeric arrays. Each client retains at most 128 recent values per metric and separately preserves the maximum over the entire reporting window. The server retains at most 1024 received values per role and metric. Percentiles describe these retained samples, not every frame or a weighted population percentile. `count` and `retained` describe server samples, not the total number of browser frames. Hidden reports are excluded; hidden/background transitions and client-supplied measurements can affect results. Treat them as diagnostics rather than authoritative gameplay data.

Only one movement input per controller per second requests a simulation acknowledgement. Acknowledgements indicate the next simulation after receipt; a newer input can supersede the sampled command before that simulation. No per-frame log or disk write is added.

## Temporary render traces

Set `MOVEMENT_TRACE_SECONDS` to a value from 1 to 300 before starting the server (default 0). Tracing stops automatically after that many seconds of process uptime. At most one sampled command per room per second is sent to each shared screen/host for correlation with `lastSeq` and its next arena update.

`movement_trace.serverReceiveToRenderEstimateMs` estimates server receipt to the first correlated arena update using the screen's ping-based clock offset. It assumes roughly symmetric network delays. `serverReceiveToRenderAckMs` measures receipt through the screen's render report back to the server using one server clock; it includes the return network leg. Neither is a direct measurement of touch-to-photon latency. The trace is emitted after object positions have been updated, before the browser/GPU presents pixels. Visual smoothing may still be converging.

The existing movement acceleration has a time constant of about 56 ms (about 128 ms to reach 90% speed from rest without collisions). Arena position smoothing has a 28 ms time constant. These are gradual responses, not fixed waits, and their effects cannot simply be added to estimate first visible movement.

## Opt-in connection probe

```sh
TEST_ENDPOINT=wss://play.colvenalabs.com \
DIAGNOSTIC_OPERATOR_FILE="$HOME/.config/grok-hackathon/acces-regie.md" \
DURATION_MS=25000 PLAYERS=1 npm run diagnose:latency
```

Alternatively provide `TEST_HOST_EMAIL` and `TEST_HOST_PASSWORD` through a private environment. Never put passwords in command arguments or logs. The operator file is read locally and is never uploaded. The probe creates a separate room with real authenticated connections and moves its own players. `PLAYERS` is only a probe sample size, not a product player limit. All probe connections are closed afterwards; the empty room follows normal idle cleanup.

The output compares WebSocket RTT, simulation acknowledgement, patch cadence and command send to screen-state receipt. `inputToScreenStateMs` observes the first state carrying the accepted sequence (receipt, not necessarily simulation). `inputToDirectionStateMs` additionally waits for velocity above 15 px/s in the requested direction and captures the acceleration/reversal response. Both use one process clock and exclude browser rendering. The probe measures its own machine and route to the VPS, not event Wi-Fi performance. Use browser reports from actual phones and the actual shared screen to investigate the delay.
