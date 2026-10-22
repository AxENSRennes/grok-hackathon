# Square-grid cyan hoodie proposal

An independent proposal retaining the current game's cyan hoodie, dark fringe, navy outline, compact proportions and white shoes.

The drawing is authored as literal character matrices: one character is exactly one colored square. There are no paths, polygons, fractional coordinates, antialiasing or subpixel details. A 16-cell-wide drawing sits in a 24 x 24 transparent canvas. Every view uses this same cell size; the left view mirrors the right.

`proposal.png` compares the identical front sprite with and without a cell overlay, plus four orientations. `turnaround.png` contains four native-resolution views, ordered front, right, back, left. These are still design poses, not integrated walking animations.

Regenerate with `python3 design/square-grid-avatar/generate.py` (Pillow required). Generation verifies dimensions, row lengths, binary alpha, and that every enlarged source cell is a uniform square. The final comparison was visually inspected.

The grid overlay exists specifically to verify the pixel structure. Identical comparison scale and the existing navy/cyan palette keep the review focused on the character. This static art review uses energy 2, rhythm 1, motion 1. Production code is unchanged.
