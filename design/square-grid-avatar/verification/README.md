# Square-grid avatar integration verification

- `npm run check`: passed.
- `npx vitest run src/shared/protocol.test.ts`: 32 passed, including fifth-character and second-accessory admission.
- `npx tsc --noEmit -p video/tsconfig.json`: passed after updating the video canvas dimensions and foot anchor.
- Rendered and visually inspected Remotion stills for `GameplayPreview` (frame 300) and `CharacterSheet` (frame 0); saved in `video/out/square-grid-gameplay.png` and `video/out/square-grid-characters.png`.
- Exercised 420 renderer combinations (5 characters, 7 accessory states, 4 facings, 3 poses): every drawing operation is a bounded, integer 1 x 1 cell with a valid palette color.
- Compared all 35 front-view character/accessory combinations against approved Python-rendered reference images: exact RGBA pixel equality.
- Browser review at 390 x 844 and 320 x 740: no horizontal overflow, whole-cell integer canvas enlargement, accessible 72px accessory buttons, wrapping options and vertical scrolling.
- Carousel swipe through simulated touch events advances selection. Selecting a third accessory retains the last two; No accessory clears both.
- An isolated local server, separate temporary authentication database and real Colyseus connections confirmed joining from the mobile selector to the controller. The fifth character, headphones and scarf arrived unchanged in the server state and shared-screen rendering.
- Browser checked facing, alternating feet, keyboard movement, stopping and Jump. Controller and arena reported no browser console errors. Local browser testing is not a physical iPhone or event Wi-Fi measurement.
- Message bubbles stay above accessories and follow jump height; checked with a message in the isolated review room.

Screenshots: `selector-390.jpg`, `selector-320.jpg`, `controller-390.jpg`, and `arena.jpg`. Existing shared development servers and production were not restarted or deployed by this task.
