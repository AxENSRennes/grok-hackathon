# Latency investigation, 22 October 2026

Pino JSON diagnostics were deployed to `play.colvenalabs.com`, release `20261022-diagnostics-2232`. The release was built from `13c011b` plus the diagnostic changes only; concurrent interface and question-navigation edits in the shared workspace were excluded. The previous release remains available for rollback. No game connections were active when the service restarted.

## Measurements

All times below are milliseconds. Remote measurements describe this workstation's route to the VPS; they are not a measurement of a user's phone or the event Wi-Fi.

| Probe | Samples / duration | Median | p95 | Maximum |
| --- | --- | ---: | ---: | ---: |
| Workstation to VPS, WebSocket screen ping, first run | 58 / 60 s | 355.2 | 1833.5 | 3059.9 |
| Workstation to VPS, input to simulation acknowledgement, first run | 44 / 60 s | 450.3 | 1616.1 | 1778.3 |
| Workstation to VPS, input to requested-direction state, first run | 42 / 60 s | 396.9 | 1048.2 | 1179.8 |
| Workstation to VPS, WebSocket screen ping, second run | 23 / 25 s | 1272.0 | 3687.2 | 4091.6 |
| VPS to its own game port, WebSocket ping | 30 / 15 s | 0.9 | 1.5 | 4.3 |
| VPS through its own public HTTPS/Caddy endpoint, WebSocket ping | 30 / 15 s | 0.8 | 1.4 | 1.8 |
| Local 50-player connection probe, simulation acknowledgement | 650 / 15 s | 10.8 | 17.4 | 17.4 |

During a ten-second window with 50 local players, simulation duration was 0.5 ms at p95 and 2.4 ms maximum; tick gaps were 17.8 ms at p95. Fifty client reports were accepted in the following summary window. This was a local capacity sample, not a product limit or an event network test.

During the VPS tests, representative ten-second windows showed simulation duration of 0.1 ms at p95, tick gaps around 17 ms at p95, and input receipt to simulation completion below 17 ms. The browser's actual frame intervals were approximately 8.3 ms median and 9.2 ms p95. The second workstation probe's event-loop timer delay was 21.3 ms p95 and 37.8 ms maximum with 20 ms resolution, which does not explain multi-second application pings.

An independent ICMP probe from the workstation received all 15 requests, plus one duplicate reply. Minimum RTT was 138.7 ms, average 253.6 ms and maximum 536.3 ms. ICMP and WebSocket timings are not interchangeable, but both showed variation on the external route. The workstation routed traffic over `en0`; no proxy environment variables or enabled system proxy flags were found. This does not rule out all VPNs or upstream network policies.

Input-to-state samples can be superseded during very long stalls because the probe reverses direction every 1.2 seconds. Their percentiles are therefore not an unbiased description of all commands under severe network congestion. Ping measurements include delayed replies independently and are the stronger evidence for the long stalls.

## Findings

The observed bottleneck is on the external connection path, rather than game simulation or the browser render loop. The public endpoint responds in under 2 ms at p95 when tested from the VPS itself. This does not identify a particular mobile carrier, router or transit provider as the cause.

Geographical distance contributes to the baseline RTT, while distance alone does not explain the observed multi-second variation. A server closer to a European audience should reduce the distance component, but will not necessarily remove mobile-network jitter.

## User-confirmed phone test over 4G

The user confirmed that the controller was open on their phone over 4G at approximately 21:38:46 UTC (22:38:46 Europe/London). Collection continued through 21:41:30 UTC. A previous desktop controller remained connected in the background; its hidden reports were excluded. The active shared screen ran on this workstation. Device identity was established by the user's confirmation and connection timing, not inferred from role alone.

| Ten-second server summary, UTC | Phone RTT median / maximum | Phone simulation acknowledgement median / maximum | Screen RTT median / maximum |
| --- | --- | --- | --- |
| 21:38:40, initial phone connection | 118 / 142 | 136 / 233 | 945 / 1975 |
| 21:39:00 | 140 / 693 | 169 / 627 | 660 / 5261 |
| 21:40:30, after reconnect | 2087 / 3028 | 2390 / 3208 | 2835 / 3511 |
| 21:40:40 | 3680 / 4683 | No retained samples | 3164 / 5118 |
| 21:41:10 | 272 / 2877 | 536 / 2074 | 257 / 1116 |
| 21:41:30 | 316 / 2364 | 372 / 2683 | 388 / 3151 |

These are individual reporting-window percentiles, not a combined population statistic. The server recorded a player close with code 4002, a reconnect, a later abnormal close with code 1006, and another reconnect. The logs do not establish the exact cause of either close. Some windows had no foreground client report. Browser scheduling and background/reconnect transitions can influence application pings; they cannot by themselves identify a carrier fault.

During these windows the server simulation remained at 0.1 ms or less at p95, and sampled input receipt to simulation completion stayed under 17 ms. The shared screen generally rendered every 8.3 ms, although one earlier window preserved a 413 ms frame-gap maximum. That isolated render pause does not explain the repeated multi-second round trips on both client paths.

The phone initially had substantially better latency than the shared screen, then also experienced multi-second stalls. Both external client paths therefore need attention. Prioritize a comparison with a stable connection for the shared screen, then compare phone Wi-Fi versus 4G and test a server closer to the audience. No network or region migration was performed during this investigation.

Sanitized reporting windows and connection-event timestamps are saved in [latency-measurements-2026-10-22.json](latency-measurements-2026-10-22.json). Connection identifiers, player names, cookies and secrets are excluded.

Movement also deliberately accelerates gradually, and the arena smooths positions. These affect response after packets arrive, particularly during reversals. They were left unchanged so the network investigation has a stable gameplay baseline.

## Verification and operations

- Type checking passed for the isolated release and the shared workspace.
- Two diagnostic input-bound tests and the two movement smoke tests passed.
- The isolated integration check passed: sessions, host authorization, movement/bounds, reconnect identity, voting and frozen results.
- Release build passed. Vite reported the existing large Phaser chunk warning.
- The local 50-player diagnostic exercised acknowledgements and aggregated reports.
- Manual browser checks on localhost and the deployed site covered joining, Play, held movement, release and jump. The deployed arena showed the player's position changing; no warning/error console messages were captured from the shared-screen tab during that check.
- The deployed health endpoint returned `ok: true`; the service remained active with no automatic restarts.
- Normal logs remain at one process summary and one summary per room every ten seconds, plus lifecycle/error events. The existing shared journal cap remains 512 MiB. Temporary render traces expire after five minutes; the installed service drop-in sets tracing to zero for subsequent starts.

![Deployed shared screen during the browser check](../design/deployment-checks/diagnostics-vps.png)

See [diagnostics.md](diagnostics.md) for fields, sampling limits, trace caveats and the opt-in connection probe.
