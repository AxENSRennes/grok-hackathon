# Hackathon video

Remotion runs independently from the multiplayer application.

`GameplayPreview` is a 30-second choreographed simulation using the actual avatar and arcade renderers, the server movement/collision solver, and three questions from the playable English question bank. Scripted inputs replace phone input. This is not a recording of live participants. The game source is imported directly, so later game changes can change future renders.

From this directory:

```sh
npm install
npm run check:versions
npm run browser:ensure
npm run remotion -- studio src/index.jsx
```

Render the gameplay preview:

```sh
npm run remotion -- render src/index.jsx GameplayPreview out/gameplay-preview-v2.mp4 --codec=h264 --concurrency=3 --crf=20
```

`SidequestPitch` keeps the earlier 75-second illustrated pitch draft for comparison. Neither composition publishes anything.
