# GameDev Studio <sup>beta</sup>

A free, open source game development toolkit. Create pixel art, music, sound effects, tilemaps, dialogue trees, story worlds and logic diagrams, all in one app where everything links together.

**No watermarks. No paywalls. No account required.** Everything you make is yours.

Live at **[gamedev-studio.pladsen.dev](https://gamedev-studio.pladsen.dev)**

> **Beta:** GameDev Studio is under active development. Features may change and bugs are expected.
> Use *Export project* now and then to keep a backup, and please [open an issue](https://github.com/MagnusPladsen/gamedev-studio/issues) if something breaks.

## Tools

| Tool | What it does |
| --- | --- |
| **Pixel Art** | Sprites with layers, animation frames, onion skinning, undo/redo, PNG and sprite sheet export |
| **Music** | Piano-roll composer with melody, harmony, bass and drum channels. WAV export |
| **SFX** | Retro sound effect generator (jump, laser, coin, explosion…) with sliders and WAV export |
| **Tilemap** | Paint levels with the sprites you drew, on multiple layers. PNG export |
| **Diagrams** | Flow charts and state machines for game logic. Nodes can point at any asset |
| **Story** | Obsidian-style wiki: `[[links]]`, hover summaries, backlinks, graph view, templates |
| **Dialogue** | Branching conversations with choices, conditions and a play-through preview. JSON export |
| **Palettes** | Shared colour palettes with PICO-8, Game Boy, NES and more presets |
| **Sprite sheets** | Pack sprites and their animation frames into one PNG plus a JSON atlas |

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

```bash
git clone https://github.com/MagnusPladsen/gamedev-studio.git
cd gamedev-studio
npm install
npm run dev
```

Open <http://localhost:3000>. It works without any configuration. Use *Save to a local
folder* to keep your projects on disk.

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
