# Project instructions

## Product

Read `DESIGN.md` before changing the interface. Preserve the user's simple game-first direction. Do not add dashboards, round configuration panels, marketing sections, or explanatory copy without a request. There is no product player limit: 50 or 60 players are load-test samples only.

## Verification

- Run `npm run check` once after relevant code changes: type checking plus the small unit suite, within a single 15-second budget. `npm test` runs just the unit suite under the same budget.
- Keep unit tests for consequential behavior: authoritative movement, bounded collisions, disconnected input, and spatial vote counting. Add a test only for a meaningful new risk or regression, not to mirror implementation or reach coverage targets.
- Verify affected user journeys manually with browser use when changing UI or multiplayer behavior. Exercise only the relevant controls and states. Do not add an automated E2E suite by default.
- Build for release or when changing bundling/dependencies; run load tests only when changing networking, synchronization, physics, or capacity. Both are explicit extra checks, outside the routine 15-second command. If either would exceed the user's testing budget, report the remaining verification instead of silently running a long check.
- No full build, load run, or browser walkthrough for documentation-only edits. Avoid repeating checks that already passed unless a new edit or failure justifies it. A timeout is incomplete verification, never a pass.
- Report the result briefly; distinguish local measurements from event Wi-Fi performance.

<!-- antislop:start -->
## Anti-slop

For interface or product-copy work, read `DESIGN.md` for the user's direction, then `docs/anti-slop/antislop.md` for the filter. Only the core is installed; there are no optional skills to fetch.

Project integration policy: apply the filter during implementation. This local policy supersedes the upstream install wizard, mode-selection question, global settings lookup, and mandatory verbose delivery report. Do not ask those setup questions on every task or change global preferences. Keep the craft review proportional to the change and report only useful findings and actual verification. User-authorized assets and reversible edits need no repeated approval. Never claim an unperformed visual or browser check passed.

The filter does not authorize a redesign or override the user's brief. Its purpose is to prevent generic decoration, invented content, dead controls, and unnecessary UI. Pixel art, directional arrow controls, multiple avatar colors, and game animation have a direct product purpose here.

Source, pinned version, and license: `docs/anti-slop/README.md`.
<!-- antislop:end -->
