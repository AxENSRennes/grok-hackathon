# Character, accessory and walking proposals

These studies extend the approved square-cell cyan character. They were approved and integrated into `src/client/avatars.ts` and `src/client/avatar-pixels.json`; the old vector renderer was replaced. Run `python3 design/square-grid-avatar/family.py` to reproduce the reference sheets.

- Five characters share the approved body: cyan fringe, pink bun, yellow swept hair, orange curls, violet bob. Hair, skin and hoodie palettes vary deliberately for crowd readability.
- Six optional accessories are authored as square-cell stamps: cap, sprout, headphones, glasses, bow and scarf. Combination previews show one or two accessories.
- Four walking frames alternate neutral, screen-left foot up/right down, neutral, screen-right foot up/left down. Each displacement is exactly one cell. The body remains fixed.

The approved 24 x 24 source is centered in a 32 x 32 transparent export canvas to leave room for accessories and lowered feet. This adds padding, not detail or a different pixel size. Every sprite uses binary alpha, nearest-neighbor integer scaling, and one palette color per cell. GIF export uses a shared palette without dithering.

`characters.png` and `accessories.png` are proposal sheets. `walking.gif` demonstrates accessory combinations and the foot cycle. `foot-poses.png` exposes the animation frames. `walking-atlas.png` contains five rows of characters and four columns of walking frames, with 32 x 32 cells. These sheets are front-view references; the application renderer additionally implements side and back variants for hair and accessories.

Verified row dimensions, binary alpha and uniform square blocks during generation. Visually reviewed the character sheet, accessory sheet, walking keyframes and combination preview. See `../verification/README.md` for the integration checks. No deployment was performed in this task.
