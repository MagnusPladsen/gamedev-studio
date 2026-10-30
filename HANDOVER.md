# Handover — GameDev Studio

Status as of 30 Oct 2026, written at the end of the cloud session that built the app, for continuing in a local
Claude Code session. Project rules and architecture are in `CLAUDE.md` (loaded automatically).

## Pick up locally

```bash
git clone https://github.com/MagnusPladsen/gamedev-studio.git
cd gamedev-studio
npm install
cp .env.example .env.local   # add the Supabase anon/publishable key to enable sign-in locally
npm run dev
```

Then start Claude Code in the folder and point it at this file, e.g. "Read HANDOVER.md and continue with the next
steps."

For local sign-in, add `http://localhost:3000/auth/callback` to Supabase → Authentication → URL Configuration →
Redirect URLs (already listed in `supabase/config.toml`).

## What exists (all on `main`, deployed by Vercel)

| Tool | Highlights |
| --- | --- |
| Task Board | Board / Backlog / All issues; editable columns (default To Do, In Progress, Testing, Done); sprints; finished issues archived off the board but searchable; issue notes live in the Notebook (folder "Issues"); CSV/JSON export |
| Pixel Art | Layers, frames, onion skin with opacity, canvas resize, project palettes (`?palette=`), tool shortcuts, PNG / sprite sheet / animated GIF export |
| Music | 4-channel piano roll, note length + drag, zoom, listening volume, WAV export |
| SFX | sfxr-style generator, waveform, listening volume, WAV export |
| Tilemap | Paints with project sprites, layers, fill, PNG + Tiled-style JSON export |
| Diagrams | State machines/flow charts, nodes can point at any asset, PNG/JSON export |
| Story | Obsidian-style `[[links]]`, hover summaries, backlinks, graph, templates |
| Notebook | Folders, pins, checklists, templates, `[[links]]` to notes and story |
| Dialogue | Branching nodes, preview, JSON + Yarn Spinner export |
| Palettes | Presets, "Use in Pixel Art", .txt / .gpl export |
| Voxels | 3D voxel editor (three.js): add/erase/paint/eyedropper/fill/box, X/Y/Z mirror, grid 8-64, sprite to voxels import, .glb / .obj + .mtl / .vox / .png export (1 voxel = 0.1 m, Y-up), Pip's Quest models |
| Sprite Sheets | Packs all frames, PNG + atlas JSON |

Across the app: projects, dashboard listing every asset with its links, linking between any assets, autosave,
undo/redo everywhere, "Pip's Quest" example assets (add/remove per tool or for the whole project, opt-in checkbox
on new projects), per-tool colours, phone layouts, beta badge, sign-in modal (GitHub or email link), browser /
cloud / local-folder storage, Vercel Analytics.

## Owner to-dos outside the code

- GitHub repo **About** → website `https://gamedev-studio.pladsen.dev` and topics (the cloud session couldn't change
  repo settings).
- **Release** `v0.1.0-beta` as a pre-release using the `0.1.0-beta` section of `CHANGELOG.md` (the README badge
  shows a release once it exists).
- Voxels: hand-check the `.vox` export in MagicaVoxel (upright, not mirrored, colours right) and try touch editing
  on a real phone.
- Supabase: the new migration `20261031090000_add_models_collection.sql` (the 4th) must run so `models` is allowed.
- Supabase: confirm all three older migrations in `supabase/migrations/` ran (tables `projects`, `assets`; the
  `assets_collection_check` constraint must include `notes`, `boards`, `issues`). For GitHub sign-in, create a
  GitHub OAuth app with callback `https://lznqrdbvamheoisjaoqr.supabase.co/auth/v1/callback` and enable the GitHub
  provider. Cloud sign-in has not been tested end to end yet (the cloud session could not reach supabase.co).

## Known gaps

- Task Board: dragging cards on touch screens uses a "Move to…" menu instead of drag; undoing a deleted issue
  doesn't restore its links.
- Dialogue condition nodes have one exit (no "else" path) because of the data model.
- Projects created before the examples system may still contain the old untagged story examples
  ("Hero", "Starting Village", "Magic Sword"); "Remove examples" deliberately doesn't delete those.
- `npm run lint` still reports a few older `react-hooks` findings (setState in effects, a ref read in render).
- Voxels: OBJ `Kd` is written in linear colour (Blender reads it that way), so OBJ colours look noticeably dark in
  Godot, Unity and three.js — use `.glb` for engines.
- vitest unit tests cover `src/lib/voxels` and the examples (`npm test`); UI changes are still verified by hand, see Testing in `CLAUDE.md`.

## Suggested next steps

From the competitor research (Aseprite, LDtk, Sprite Fusion, TexturePacker, articy/Arcweave, World Anvil, FamiStudio,
HacknPlan/Codecks), ranked by value for beginners vs effort. Done so far: task board, GIF export.

1. Pixel Art: named animation tags (idle/run/jump in one sprite) and per-frame durations.
2. Tilemap: auto-tiling rules and a collision layer.
3. One-click engine exports: Godot TileMap/SpriteFrames, Unity and Phaser sprite-sheet JSON, Tiled TMX.
4. Pixel Art tools: mirror/symmetry, pixel-perfect pencil, dither brush; Lospec palette import.
5. Tilemap objects layer (spawn points, enemies) with custom properties.
6. Dialogue variables, "else" branches and localisation CSV.
7. Story timeline and a world map with pins.
8. Music: songs made of several patterns, instrument envelopes, MIDI import/export.
9. Bitmap/pixel font maker.
10. Read-only share links for a project; a "play this level" preview that walks Pip across a tilemap.

Also worth doing: an automated Playwright smoke test (create project with examples → open every tool → check for
errors and phone overflow) run in CI.
