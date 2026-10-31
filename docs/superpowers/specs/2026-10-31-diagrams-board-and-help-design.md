# Diagrams board (Milanote-style) and page help — design

## Why

Diagrams only drew flow-chart boxes on a canvas. Game makers also collect references, plan levels and lay out story
beats on a free board, the way Milanote works. The owner asked for a much more capable Diagrams tool and a short help
panel on every tool page.

## Milanote, in short

Boards hold free-placed cards: rich-text notes, images, link cards that expand into a preview (videos play inline),
to-do lists, columns that stack and group cards, labelled lines and arrows between cards, colour swatches and nested
boards (a board card opens another board).

## What fits a game-dev board (built)

| Card | Stored as | Notes |
| --- | --- | --- |
| Note | `note` node, multi-line `label`, `color` | Old one-line notes keep working; text now wraps and the card grows. |
| To-do list | `checklist`, `data.items: {id,text,done}[]`, title in `label` | Tick boxes work without entering edit mode. |
| Image | `image`, `data.src` (data URL, downscaled to 1600 px) `data.aspect`, caption in `label` | Upload, paste or drag-drop. Stored in the diagram, so it syncs like every other asset. |
| Link | `link`, `data.url`, `data.preview` | YouTube, Spotify, Vimeo, SoundCloud play inline via their embed players; other links show title, description, image from `/api/link-preview` (server fetch of Open Graph tags and free oEmbed endpoints; blocks private hosts, size and time capped). No paid APIs. |
| Studio asset | `asset`, `data.asset` | Any project asset; shows its colour, kind, thumbnail; opens it. A diagram asset acts as a nested board. "Add to diagram" from the asset menu now makes these. |
| Group | `group`, `label` title, `color`, explicit size | Drawn under cards; dragging it moves the cards inside; "Stack as column" lines them up like a Milanote column. |
| Flow shapes | `state` `action` `condition` `event` `custom` | Unchanged data; can still link an asset. |

Every card can take a colour from a fixed swatch list (`node.color`). Lines keep `arrow` / `dashed` / `line` and
labels; they now attach to card edges. New ways to connect: drag the dot on a selected card onto another card.

## Rendering

The editor moves from one `<canvas>` to DOM cards in a panned/zoomed layer with an SVG layer for lines, so text wraps,
images and embeds render natively and inputs work in place. PNG export draws the board to a canvas with a small
renderer (remote thumbnails are skipped when the host blocks CORS).

## Compatibility

`Diagram`, `DiagramNode`, `DiagramEdge` keep their shape; only the node `type` union grows. Old diagrams render with
the same positions and labels. JSON export is unchanged.

## Help

`HelpButton` (`src/components/HelpButton.tsx`) opens a dialog with "What you can do", "Quick start" and "Tips" from
`src/lib/help-content.ts`, one entry per tool plus the dashboard. It sits in each tool's toolbar next to Export.

## Calls made without the owner (autonomous run)

- Images live inside the diagram body as downscaled data URLs instead of a new collection (no migration needed).
- Columns are Group cards with a "Stack as column" action rather than auto-layout containers.
- Nested boards are asset cards that point at another diagram.
