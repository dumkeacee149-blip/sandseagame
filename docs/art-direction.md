# Sandsea Privateers Art Direction

## Core Look

Sandsea Privateers is a pixelated, blocky low-poly sand fantasy game. The world should feel like ocean piracy translated into a mythic desert, but rendered through voxel-like chunky forms, hard edges, and pixel-texture color blocks.

## Visual Pillars

1. **Readable Pixel / Voxel Shapes**
   - Chunky silhouettes.
   - Boxy construction, stepped surfaces, hard edges.
   - Large pixel-like color regions.
   - Avoid smooth toy-like surfaces, noisy realism, and tiny surface details.

2. **Sandsea, Not Wasteland**
   - Warm dunes and salt flats instead of rusty apocalypse junk.
   - Cloth, brass, carved stone, palm greens, and cyan relic glow.
   - No modern military, no sci-fi chrome, no pure Mad Max car language.

3. **Pirate Logic Translated To Desert**
   - Ships become wind-sail sand skiffs.
   - Ports become oasis markets.
   - Sea monsters become sandsea leviathans.
   - Treasure becomes relic cores, water maps, brass chests, and rune keys.

4. **Game-Ready Asset Discipline**
   - The approved baseline is the local voxel asset board, built from chunky cuboids.
   - Hunyuan outputs are concept references unless they keep the same block-built silhouette.
   - Each external generation should be one clear subject.
   - Later pipeline: approve voxel shape, export or rebuild as optimized GLB for Three.js.

## Palette

| Role | Colors |
| --- | --- |
| Sand | ochre, warm gold, pale salt white |
| Stone | limestone, black basalt, weathered gray |
| Wood | dark walnut, sunburned brown |
| Metal | brass, black iron |
| Cloth | deep crimson, dusty indigo |
| Magic/Ancient Tech | cyan, teal, soft turquoise |
| Night/Storm | blue violet, charcoal, desaturated purple |

## Reject Conditions

- Looks like a normal ocean pirate asset with no desert conversion.
- Looks like realistic post-apocalyptic junk.
- Looks too smooth, plastic, or toy-like instead of pixelated/blocky.
- Too many tiny details for browser gameplay readability.
- Single asset contains a full scene instead of one usable model.
- No strong silhouette from a 3/4 camera angle.
- Character or vehicle feels modern military or hard sci-fi.

## First Review Batch

Start with the mixed review board at `/asset-viewer.html?sheet=1`. A01-A10 now have Hunyuan candidates loaded through the local Three.js asset viewer, with local voxel backups available by adding `&source=local` to an individual asset URL. A01 v1 from Hunyuan remains only a silhouette reference because it is too smooth; A01 v2 is the preferred skiff candidate.
