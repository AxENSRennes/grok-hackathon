# QR welcome screen

The live room connects before the welcome screen appears. Play changes only the screen presentation, keeping the room session and join URL intact. The display remembers launch in session storage for that room; it does not advance questions.

The large centered QR makes scanning the first action. The navy background and cyan Play button reuse the approved arcade palette. Sparse spacing keeps the QR dominant, with no arena or additional controls before launch.

## Local verification

- `npm run check` passed.
- `/preview?welcome=1`: Play works with Enter and a pointer, reveals the arena on the same URL, and preserves the QR link in the corner.
- The QR link opens the player entry form. This preview has no live room code; live screens include their connected room code in the link.
- At 390 x 844, the welcome screen and launched view have no horizontal overflow (document width: 390 pixels).
- No browser console errors were recorded during the desktop preview transition.

These checks cover the local presentation flow. A fresh authenticated multiplayer session and event Wi-Fi were not exercised for this UI-only change. Nothing was deployed from this chat.
