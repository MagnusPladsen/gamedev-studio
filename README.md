# GameDev Studio

A free, open source game development toolkit. Create pixel art, music, sound effects, tilemaps, dialogue trees, story worlds, and logic diagrams — all in one connected app.

**No watermarks. No paywalls. No sign-up required.**

Live at [gamedev.pladsen.dev](https://gamedev.pladsen.dev)

## Tools

- **Pixel Art Editor** — Draw sprites with layers, frames, animation, and onion skinning
- **Music Composer** — Pattern-based music creation with multiple channels and instruments
- **SFX Generator** — Generate retro and modern sound effects with presets and parameter control
- **Tilemap Editor** — Paint game levels using your sprites with multiple layers
- **Logic Diagrams** — Plan game systems with flow charts and state machines
- **Story & Worldbuilding** — Wiki-style linked notes for characters, locations, items, lore
- **Dialogue Trees** — Visual branching dialogue editor for RPGs
- **Color Palettes** — Manage and share palettes with game-ready presets
- **Sprite Sheet Packer** — Combine sprites into optimized sprite sheets

Everything links together — sprites connect to tilemaps, dialogue references characters, notes tie it all together.

## Getting Started

### Use Online

Visit [gamedev.pladsen.dev](https://gamedev.pladsen.dev) and start creating. No account needed.

### Self-Host

```bash
git clone https://github.com/magnuspladsen/gamedev-studio.git
cd gamedev-studio
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### With Supabase (optional)

For cloud storage and auth, create a Supabase project and add your keys:

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
```

## Tech Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Web Audio API (music & SFX)
- HTML5 Canvas (pixel art, tilemaps, diagrams)
- Supabase (optional auth + storage)
- Vercel Analytics

## License

MIT — do whatever you want with it.
