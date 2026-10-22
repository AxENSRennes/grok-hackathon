# Character selector proposal

The user approved the visual layout on 22 October 2026 while exploring another character style. Preserve the selection layout; the current characters remain replaceable.

- Local preview: `http://localhost:5173/selector.html` while Vite is running.
- Production entry: `/selector.html`, included explicitly in the Vite build alongside the main application.
- Component: `src/client/CharacterSelector.tsx`; styles: `src/client/character-selector.css`.
- Existing shared `drawAvatar` renderer supplies every character, accessory thumbnail, direction, and walking pose. No new generated raster art or runtime dependency.
- Carousel: large selected character, smaller neighbors, side buttons, direct-selection dots, keyboard left/right, touch swipe, turn and jump controls.
- Six clothing colors, four existing character presets, and four accessory states. The shared appearance schema is unchanged.
- `onConfirm({name, appearance})` is the integration boundary for the player flow. In the standalone proposal, confirmation only displays a local ready state; it does not connect to a multiplayer room.

Visual intent: the central character is the focal point; dark navy keeps bright arcade sprites readable; the small floor and raised platform put the selector inside the game world. Pixel lettering, square controls, and cyan/pink edges match the chosen arcade direction. Visible copy is limited to identity, choice labels, nickname, and confirmation. Motion serves browsing, walking-pose preview, and jump feedback. Reduced motion disables these animations.

Verified: type checking passed. Manual browser checks covered carousel navigation, direct selection, clothing color, glasses/cap previews, direction rotation, jump activation, required nickname validation, local confirmation and editing. No console errors observed. At a 390 × 844 viewport the document measured 390 × 844 with no page overflow after the box-sizing correction. Touch swipe is implemented but has not been exercised on a physical phone.

Capture: `prototype-checks/character-selector-mobile.jpg`. No unit tests added for this visual proposal.
