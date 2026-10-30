# GameDev Studio <sup>beta</sup>

[![Live site](https://img.shields.io/badge/live-gamedev--studio.pladsen.dev-7c5cfc?style=flat-square)](https://gamedev-studio.pladsen.dev)
[![Status: beta](https://img.shields.io/badge/status-beta-fbbf24?style=flat-square)](#)
[![Latest release](https://img.shields.io/github/v/release/MagnusPladsen/gamedev-studio?include_prereleases&style=flat-square&label=release)](https://github.com/MagnusPladsen/gamedev-studio/releases)
[![License: MIT](https://img.shields.io/github/license/MagnusPladsen/gamedev-studio?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/MagnusPladsen/gamedev-studio?style=flat-square)](https://github.com/MagnusPladsen/gamedev-studio/stargazers)
[![Forks](https://img.shields.io/github/forks/MagnusPladsen/gamedev-studio?style=flat-square)](https://github.com/MagnusPladsen/gamedev-studio/forks)
[![Open issues](https://img.shields.io/github/issues/MagnusPladsen/gamedev-studio?style=flat-square)](https://github.com/MagnusPladsen/gamedev-studio/issues)
[![Last commit](https://img.shields.io/github/last-commit/MagnusPladsen/gamedev-studio?style=flat-square)](https://github.com/MagnusPladsen/gamedev-studio/commits/main)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-34d399?style=flat-square)](#contributing)

A free, open source game development toolkit. Create pixel art, music, sound effects, tilemaps, dialogue trees, story worlds and logic diagrams, all in one app where everything links together.

**No watermarks. No paywalls. No account required.** Everything you make is yours.

**[Open the app →](https://gamedev-studio.pladsen.dev)** &nbsp;·&nbsp; [Download the latest release](https://github.com/MagnusPladsen/gamedev-studio/releases/latest) &nbsp;·&nbsp; [Report a bug](https://github.com/MagnusPladsen/gamedev-studio/issues/new)

> **Beta:** GameDev Studio is under active development. Features may change and bugs are expected.
> Use *Export project* now and then to keep a backup, and please [open an issue](https://github.com/MagnusPladsen/gamedev-studio/issues) if something breaks.

## Tools

| Tool | What it does |
| --- | --- |
| **Task Board** | Jira-style sprints: To Do, In Progress, Testing, Done (columns are yours to change), backlog, issue notes, links to assets |
| **Pixel Art** | Sprites with layers, animation frames, onion skinning, project palettes, PNG, sprite sheet and animated GIF export |
| **Music** | Piano-roll composer with melody, harmony, bass and drum channels, zoomable. WAV export |
| **SFX** | Retro sound effect generator (jump, laser, coin, explosion…) with sliders and WAV export |
| **Tilemap** | Paint levels with the sprites you drew, on multiple layers. PNG export |
| **Diagrams** | Flow charts and state machines for game logic. Nodes can point at any asset |
| **Story** | Obsidian-style wiki: `[[links]]`, hover summaries, backlinks, graph view, templates |
| **Dialogue** | Branching conversations with choices, conditions and a play-through preview. JSON export |
| **Palettes** | Shared colour palettes with PICO-8, Game Boy, NES and more presets |
| **Sprite sheets** | Pack sprites and their animation frames into one PNG plus a JSON atlas |
| **Voxels** | Build chunky 3D models with add, erase, paint, eyedropper, fill and box tools and X/Y/Z mirror. Turn a sprite into voxels. Export .glb, .obj + .mtl, MagicaVoxel .vox and .png. Free, no watermark |
| **Notebook** | Ideas, to-do lists, design docs and bug lists, with clickable checklists and `[[links]]` |

Everything saves automatically. New projects can start with **Pip's Quest**, a small sample game spread across every
tool that you can learn from, edit, or remove in one click.

Undo and redo work everywhere: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd> and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>
(or <kbd>Ctrl</kbd>+<kbd>Y</kbd>), plus buttons in every toolbar.

**Everything connects.** Any asset can link to any other: a character's story entry links to their sprite and voice
sound, a tilemap shows which sprites it uses, a diagram node opens the dialogue it describes. The project page
lists every asset with its links.

Every tool ships with small hand-made examples to edit, so what you export is your own work.

## Where your work is saved

| Mode | How |
| --- | --- |
| **This browser** (default) | No account needed. Saved in the browser's local storage |
| **Your account** | Sign in with GitHub or an email link to sync across devices. The first time you sign in, projects already in the browser are moved into your account |
| **A folder on your computer** | *Save to a local folder* writes every project as JSON files (Chrome/Edge). Great for self-hosting and for keeping projects in git |
| **Export file** | *Export project* downloads one `.gamedev.json` you can import anywhere |

## Run it yourself

You need [Node.js](https://nodejs.org) 20.9 or newer.

**With git**

```bash
git clone https://github.com/MagnusPladsen/gamedev-studio.git
cd gamedev-studio
npm install
npm run build
npm start
```

**Without git:** download the source zip from the [latest release](https://github.com/MagnusPladsen/gamedev-studio/releases/latest),
unzip it, and run the same `npm install`, `npm run build`, `npm start` commands inside the folder.

Open <http://localhost:3000>. It works without any configuration. Use *Save to a local folder* to keep your
projects on disk. (Use `npm run dev` instead of build + start if you want to change the code.)

**Your own online copy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMagnusPladsen%2Fgamedev-studio)

### Optional: cloud sync with Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. Run the migration in `supabase/migrations/` in the SQL editor, or `npx supabase db push`, or connect the repo
   with Supabase's GitHub integration so migrations apply automatically.
3. `cp .env.example .env.local` and fill in your project URL and anon/publishable key.
4. In Supabase → **Authentication → URL Configuration**, set the Site URL to your domain and add
   `https://your-domain/auth/callback` (and `http://localhost:3000/auth/callback`) to the redirect URLs.
5. For GitHub sign-in: **Authentication → Sign In / Providers → GitHub**, using a GitHub OAuth app whose
   callback URL is `https://<project-ref>.supabase.co/auth/v1/callback`.

Each user can only read and write their own rows (row level security).

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Web Audio API · Canvas · Supabase (optional) · Vercel Analytics

## Contributing

Issues and pull requests are welcome. `npm run build` must pass.

## License

MIT. Do whatever you want with it.
