# Sidequest Live presentation

## Submitted entry

- Submission confirmed by the hackathon website for Axel Mauroy.
- Reference: `a8244e19`.
- Track: Wildcard / Weird Stuff.
- Submitted video: https://youtu.be/6fxHO0-PZkA (30-second gameplay preview, unlisted).
- Local submitted file: `out/gameplay-preview-v2.mp4`.
- Confirmation screenshot: `out/submission-confirmed.png`.

## Earlier pitch draft

- Length: 75 seconds, 1280 x 720, 30 fps, English on-screen text, no voice-over.
- Submission requires a video under three minutes. Unlisted YouTube is accepted.
- Deadline shown by the organiser: October 22, 2026, 21:50 London time.
- Public MIT repository: https://github.com/AxENSRennes/grok-hackathon
- The video clearly labels illustrated gameplay and concept artwork. Grok, Cognee and Supabase integration are presented as planned/in progress, not as working features.
- No production application files are changed by the video.

## YouTube

Title: Sidequest Live | Play the room | Grok Bot London Hackathon

Description:

Sidequest Live turns a hackathon audience into players. Join a shared room by QR code, choose a character, and use your phone as a controller. Answer questions by moving into zones on the shared screen.

This 75-second hackathon prototype walkthrough uses illustrated gameplay and concept art, labelled on screen. The multiplayer prototype is built with React, Phaser, Colyseus and TypeScript. Grok presenter, Cognee memory, Supabase persistence and final arcade artwork remain in progress.

Open-source MIT repository: https://github.com/AxENSRennes/grok-hackathon
Prototype: https://play.colvenalabs.com

Grok Bot Community Engineering London Hackathon, October 22, 2026.

Visibility: Unlisted.

## Render

```sh
cd video
npm run remotion -- render src/index.jsx SidequestPitch out/sidequest-live-pitch.mp4 --codec=h264 --concurrency=3 --crf=22
```
