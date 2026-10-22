# Project instructions

## Product

Read `DESIGN.md` before changing the interface. Preserve the user's simple game-first direction. Do not add dashboards, round configuration panels, marketing sections, or explanatory copy without a request. There is no product player limit: 50 or 60 players are load-test samples only.

## Verification

- No CI for now. Keep GitHub Actions disabled and do not add workflows or automatic PR/push checks unless the user explicitly asks to enable them. Prioritize rapid local development.
- Optimize for development speed. Do not run tests after every small edit. Batch related work and verify only the affected behavior at meaningful milestones or before delivery.
- `npm run check` checks types only. `npm test` runs just two movement smoke tests. The larger suites are opt-in: `test:unit`, `test:integration`, `test:all`, and `test:load`. Never silently run all suites by default or add them to dev/build hooks.
- Fifteen seconds is an approximate speed target, not a hard timeout. A justified integration or release check may take longer; avoid repeating successful checks without a new reason.
- Keep unit tests for consequential behavior: authoritative movement, bounded collisions, disconnected input, and spatial vote counting. Add a test only for a meaningful new risk or regression, not to mirror implementation or reach coverage targets.
- Verify affected user journeys manually with browser use when changing UI or multiplayer behavior. Exercise only the relevant controls and states. Do not add an automated E2E suite by default.
- Build for release or when changing bundling/dependencies; run load tests only when changing networking, synchronization, physics, or capacity. Both are explicit extra checks, separate from routine type checking.
- No full build, load run, or browser walkthrough for documentation-only edits. Avoid repeating checks that already passed unless a new edit or failure justifies it. A timeout is incomplete verification, never a pass.
- Report the result briefly; distinguish local measurements from event Wi-Fi performance.

<!-- antislop:start -->
## Anti-slop

For interface or product-copy work, read `DESIGN.md` for the user's direction, then `docs/anti-slop/antislop.md` for the filter. Only the core is installed; there are no optional skills to fetch.

Project integration policy: apply the filter during implementation. This local policy supersedes the upstream install wizard, mode-selection question, global settings lookup, and mandatory verbose delivery report. Do not ask those setup questions on every task or change global preferences. Keep the craft review proportional to the change and report only useful findings and actual verification. User-authorized assets and reversible edits need no repeated approval. Never claim an unperformed visual or browser check passed.

The filter does not authorize a redesign or override the user's brief. Its purpose is to prevent generic decoration, invented content, dead controls, and unnecessary UI. Pixel art, directional arrow controls, multiple avatar colors, and game animation have a direct product purpose here.

Source, pinned version, and license: `docs/anti-slop/README.md`.
<!-- antislop:end -->
