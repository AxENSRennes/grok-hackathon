# Arcade characters: proposed asset pipeline

Status: technical recommendation, not implemented or validated with production sprites yet. The selected character reference is `character-palettes-2026-10-22/06-arcade-community-night.png`.

## Small initial scope

Use five predefined characters from the selected family. Each keeps its recognizable skin tone, hair, and silhouette. Offer clothing-palette changes and one optional accessory. Do not start with an independently configurable wardrobe, every hairstyle on every head, or multiple stacked hats.

Represent a choice with validated IDs: `characterId`, `outfitPalette`, `accessoryId`. Keep skin tone separate from hair/color selections if those become independently configurable later. Current prototype appearance fields are placeholders and still need migration.

## Animation contract

- Fixed 48 × 48 transparent cells, nearest-neighbor rendering; final character scale must be checked in the arena before producing the full library.
- Four rows: down, left, right, up. Three columns: neutral, step A, step B. This is 12 unique cells, on a 144 × 192 sheet per character/layer.
- Moving sequence: neutral, step A, neutral, step B, initially around 8 animation frames/second. Idle holds neutral. Adjust cadence visually; screen rendering remains independent of sprite-animation cadence.
- Every cell shares one foot anchor, bounding grid, outline thickness, and palette. Do not trim individual frames. Head/accessory anchors follow the same pose offsets.
- The existing server direction and velocity choose facing and walk/idle locally. Do not send animation frames over the network.
- Jump uses the existing visual height offset and grounded shadow. It does not require another direction-dependent set of jump drawings.

## Source and export

1. Generate one character's pose sheet using imagegen and the selected reference. Treat it as draft source art, not as a guaranteed pixel-perfect asset.
2. Check identity from the back and sides, exact grid placement, fixed scale, feet, clean transparency, palette, and loop continuity. Generated frames can drift; recut/retouch and align them before engine use. Aseprite is an optional editor/exporter, not an added game dependency or an assumed installed tool.
3. Validate this one character walking in all four directions and jumping in the actual arena. Produce the other four only after that loop reads correctly.
4. Keep editable source layers for base/skin, recolorable clothing, and foreground details. Export aligned transparent sheets plus frame/anchor metadata. Define a small explicit source-to-target clothing palette; recolor those pixels only, so changing a hoodie never tints skin, hair, or outlines.
5. Add direction-aware accessory overlays. Match their anchor and small walking offsets to the same pose table. Hats may need a hair mask; defer incompatible combinations instead of allowing visibly broken overlaps.
6. Compose the selected base, clothing palette, and accessory into a cached sheet when an appearance is first used. Reuse that sheet for the carousel, controller preview, and arena. Change frames rather than redrawing pixel art every render tick.

## Why this scope

One reusable pose contract keeps the implementation ordinary: load a sheet, select a direction row, and play frame indices. The art remains the main production effort. Layers and palette swaps avoid generating a new set of walking poses for every cosmetic combination. Adding fully interchangeable hair can come later if the initial five-character selector feels too restrictive.

## References

- [Phaser frame animations](https://docs.phaser.io/phaser/concepts/animations)
- [Aseprite sprite sheets](https://www.aseprite.org/docs/sprite-sheet/)
- [Aseprite layer, sheet and JSON export](https://www.aseprite.org/docs/cli/)
