# Cyan hoodie refinements

Three isolated proposals based on the existing `src/client/avatars.ts` cyan hoodie character. Nothing is imported by the application.

- A: closest to the current proportions and pointed fringe.
- B: slightly calmer crown and more open face.
- C: broader pixel clusters and fewer shading details.

Each version retains the cyan hoodie, dark hair, navy outline and white sneakers. Profiles use a narrower torso and one visible arm so facing direction reads more clearly. Four directions each contain idle and two walking frames.

All sprites are drawn on a 48 by 48 integer pixel grid, with binary alpha and nearest-neighbor enlargement. The PNG atlases are native resolution: three columns (idle, step A, step B) by four rows (front, right, back, left). Left views mirror right views.

Run `python3 design/arcade-refinement-proposals/generate.py` to regenerate the contact sheet, transparent atlases, enlarged sheets and walking comparison GIF. Pillow is required.

## Design and review

This is an arcade character comparison for the game owner, with energy 2, rhythm 1, motion 2. A shared palette and identical display scales isolate the differences; the four-view rows make directional consistency visible. The navy background matches the game environment, while cyan retains the existing character identity. Monospaced labels belong to this development sheet only.

Verified the comparison and the B pose sheet visually. Generation checks binary alpha for every exported pose. No production source edits or deployment; no application tests needed for these independent design artifacts.
