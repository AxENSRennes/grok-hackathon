# Pixel character studies

Standalone proposals, not integrated into the game or deployment.

- A / Pocket: 16x24 pixels, separate head and torso, short walking legs.
- B / Capsule: 16x20 pixels, connected hood/body and a small human face.
- C / Block: 16x20 pixels, wider torso and a smaller, square head.
- D / Mini: 12x16 pixels, reduced face and clothing detail.

Each family has five looks in the approved cyan, pink, yellow, orange and violet palette. Every sprite uses integer coordinates on its native grid and a one-cell outline. No smoothing, gradients, vector curves or resampling with blended pixels. Enlargements use nearest-neighbour scaling by an integer factor.

`proposals.png` compares all families. The smaller samples underneath show each sprite at 2x. `jump-preview.gif` uses integer vertical offsets on the same pixel grid. Individual native transparent PNGs are in `sprites/`. These are front views for choosing a silhouette; directional walking cycles are not yet designed.

Regenerate with `python3 generate.py` (Pillow required). No application code or production configuration is imported or changed.
