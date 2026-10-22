# Arcade controller references

Open `http://localhost:5173/controller-preview` with Vite running for an interactive local preview. It uses the same `src/client/RemoteControl.tsx` component as the player controller on `/play`, without joining a multiplayer room or sending server messages.

These screenshots preserve earlier controller iterations. The current controller has since been updated to show the selected square-grid character and accessories on the central jump button, as recorded in `DESIGN.md`.

## Visual choices

- Navy background and pixel borders connect the controller to the arcade arena.
- Four large cyan directional targets surround the pink jump button.
- The message field uses a speech-bubble corner to suggest its destination on the shared screen.
- Text stays minimal, with no organizer panel or map on the phone.
- All interface text, including accessibility labels and connection states, is in English.

## Screenshots

- `05-remote-jump-only-390x844.jpg`: earlier JUMP-only button with English text.
- `04-remote-portrait-390x844.jpg`: earlier portrait proposal with a character.
- `03-remote-landscape-844x390.jpg`: landscape adaptation.
- `01-telecommande-390x844.jpg` and `02-message-390x844.jpg`: intermediate states before the interface text was standardized in English.

## Recorded verification

Type checking passed for these iterations. Browser checks covered holding and releasing all four directions, jump animation, message entry, send-button activation, field clearing and local confirmation. No horizontal overflow was observed at 390 × 844 or 844 × 390; 320 × 740 was inspected visually. These local preview checks do not constitute a network test on a physical phone.
