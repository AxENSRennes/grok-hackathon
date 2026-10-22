# Backend storage adapters

No Supabase connection, SDK, credentials, or migration is installed. The default backend still uses local JSONL results, bundled questions, stdout diagnostics, and SQLite authentication.

## Wiring

`src/server/storage/index.ts` is the server-only composition root. Select adapters there once at startup; rooms and clients cannot select a storage provider. Contracts live in `src/server/storage/contracts.ts`.

| Data | Contract | Current adapter | Call site |
| --- | --- | --- | --- |
| Completed round aggregates | `RoundResultStore.save(result)` | `JsonlRoundResultStore` | `persistResult()` after results freeze |
| Question deck | `QuestionSource.load()` | `localQuestionSource` | Room creation, before simulation starts |
| Structured diagnostics | `DiagnosticSink.writeBatch(events, signal)` | No external sink; stdout always enabled | Background batches, approximately once per second |

Game code depends on these contracts rather than database clients. `RoundResult` remains the existing shared payload, without player identities, chat, or position history. `loadQuestionDeck()` validates every source and snapshots it for the room.

## Adding Supabase later

1. Add a server-only adapter module, such as `src/server/storage/supabase.ts`, implementing `RoundResultStore` and/or `DiagnosticSink`. A question source can be added independently. Keep provider-specific table names, row mapping, SDK calls, and errors in that module.
2. Configure the adapter's URL and private credentials on the server. Validate required configuration at startup when selecting it. Never use client environment variables, room options, QR links, or shared protocol types for private credentials.
3. Import and select the adapter in `src/server/storage/index.ts`: replace `roundResults`, set `diagnostics`, and optionally replace `questions`. No change to physics, room commands, telemetry collection, or client code is needed.
4. Apply the provider's database schema and access policies before enabling the adapter. Verify a completed round and an exported diagnostic batch against an isolated database.

Suggested row mapping for that future adapter:

| Table | Identity | Useful query fields | JSON payload |
| --- | --- | --- | --- |
| `round_results` | Existing `RoundResult.id` | `roomId`, `endedAt` | Complete `RoundResult` |
| `diagnostic_events` | `DiagnosticEvent.id` (UUID) | `time`, `level`, `event`, `roomId`, `service`, `schemaVersion` | Complete redacted `DiagnosticEvent` |

Use unique IDs for duplicate-safe remote writes; preserve IDs across retries rather than generating new ones in the adapter. Reject failed writes, including failures returned as values by a provider SDK. Honor the diagnostic cancellation signal in the underlying request. Do not log provider credentials, request bodies, or raw provider errors.

## Failure and retention behavior

Round saving runs asynchronously after the authoritative result is frozen. A rejected save produces `result_persistence_failed` and a host notice; the current room still holds its result for export. The local adapter retains the existing `DATA_DIR/rounds.jsonl` format. There is no automatic retry or durable outbox. A future remote-only result store must choose its outage and local-backup policy explicitly.

Pino always writes diagnostics to stdout for journald. When an optional sink is selected, the exact same serialized and redacted records also enter a background queue. Records include an export UUID and `schemaVersion: 1`, alongside Pino's millisecond timestamp and numeric level. Existing redaction covers the configured top-level credential fields; it is not a general-purpose scrubber for arbitrary message text or nested data. Keep diagnostic producers free of personal data and secrets.

There is at most one export in flight, containing up to 1000 events, plus 1000 waiting events. Overflow drops new remote events and reports a count to stdout. Exports time out and signal cancellation after three seconds; failed batches are discarded without retry. Failure warnings bypass the sink to prevent recursion. Adapters must honor cancellation so underlying requests also terminate. Graceful shutdown stops intake and drains the in-flight and waiting batches, taking at most approximately six seconds for export waits. An abrupt stop can lose queued remote diagnostics; stdout remains the operational log source.

Authentication remains in Better Auth's SQLite database. The result HTTP endpoint still exports the active room's in-memory history; this refactor does not add historical queries, room recovery, or remote authentication.
