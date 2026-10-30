import Link from "next/link";
import { BetaBadge } from "@/components/BetaBadge";
import { supabaseEnabled } from "@/lib/supabase";
import {
  Box,
  Paintbrush,
  Music,
  Volume2,
  GitBranch,
  BookOpen,
  Grid3X3,
  MessageSquare,
  Palette,
  Package,
  ArrowRight,
  Sparkles,
  Download,
  Globe,
  NotebookPen,
  SquareKanban,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function ToolCard({ icon: Icon, name, description }: { icon: React.ComponentType<{ className?: string }>; name: string; description: string }) {
  return (
    <div className="group p-5 rounded-xl border transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-hover)]" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
        {name}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </div>
  );
}

const tools = [
  { icon: Paintbrush, name: "Pixel Art Editor", description: "Draw sprites with layers, frames, and onion skinning. Create animations and export sprite sheets." },
  { icon: Box, name: "Voxel Models", description: "Build chunky 3D props and characters with your palettes. Export to Blender, Godot and Unity." },
  { icon: Music, name: "Music Composer", description: "Pattern-based music creation with multiple channels and instruments. Think BeepBox meets FL Studio." },
  { icon: Volume2, name: "SFX Generator", description: "Generate retro and modern sound effects with presets for explosions, lasers, pickups, and more." },
  { icon: Grid3X3, name: "Tilemap Editor", description: "Paint game levels using your own sprites. Multiple layers, auto-tiling, and collision maps." },
  { icon: GitBranch, name: "Logic Diagrams", description: "Plan game systems with flow charts, state machines, and behavior trees. Like draw.io for games." },
  { icon: BookOpen, name: "Story & Worldbuilding", description: "Write lore, create characters, and link everything together. Wiki-style connections like Obsidian." },
  { icon: MessageSquare, name: "Dialogue Trees", description: "Visual branching dialogue editor for RPGs and adventure games. Connect speakers and choices." },
  { icon: Palette, name: "Color Palettes", description: "Manage and share color palettes across all your tools. Built-in game-ready palette presets." },
  { icon: Package, name: "Sprite Sheet Packer", description: "Combine multiple sprites into optimized sprite sheets ready for any game engine." },
  { icon: SquareKanban, name: "Task Board", description: "Plan sprints like Jira: To Do, In Progress, Testing, Done. Issues link to the assets they're about." },
  { icon: NotebookPen, name: "Notebook", description: "Ideas, to-do lists, design docs and bug lists, with checklists and links to any asset." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md" style={{ borderColor: "var(--border)", background: "rgba(10,10,15,0.8)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: "var(--accent)" }}>
              GD
            </div>
            <span className="font-semibold text-base sm:text-lg whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              GameDev Studio
            </span>
            <BetaBadge className="max-[380px]:hidden" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <a
              href="https://github.com/magnuspladsen/gamedev-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-colors hover:opacity-80 hidden sm:block"
              style={{ color: "var(--text-secondary)" }}
              aria-label="GitHub repository"
            >
              <GithubIcon className="w-5 h-5" />
            </a>
            {supabaseEnabled && (
              <Link href="/projects?signin=1" className="px-2 sm:px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                Sign in
              </Link>
            )}
            <Link
              href="/projects"
              className="px-3 sm:px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all hover:opacity-90"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Open Studio
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full animate-glow"
            style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 70%)" }}
          />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 animate-fade-in"
            style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(124,92,252,0.2)" }}
          >
            <Sparkles className="w-3 h-3" />
            Public beta · Free &amp; open source · No watermarks
          </div>
          <h1
            className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight mb-6 text-balance animate-fade-in stagger-1 opacity-0"
            style={{ color: "var(--text-primary)" }}
          >
            Everything you need to
            <br />
            <span style={{ color: "var(--accent)" }}>make your game</span>
          </h1>
          <p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 animate-fade-in stagger-2 opacity-0 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Pixel art, music, sound effects, tilemaps, dialogue, story &amp;
            worldbuilding, logic diagrams — all connected in one free toolkit.
            Create, link, and export everything for your game.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in stagger-3 opacity-0">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Start Creating
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/magnuspladsen/gamedev-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:opacity-80"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              <GithubIcon className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              One toolkit. Every asset.
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Stop switching between a dozen apps. Create all your game assets
              in one place, and they automatically connect to each other.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <ToolCard key={tool.name} {...tool} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6" style={{ background: "var(--bg-secondary)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                <Download className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
                Free Downloads, No Watermarks
              </h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Export everything you create as PNG, WAV, JSON, or sprite
                sheets. No limitations, no sign-up required.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(52,211,153,0.15)", color: "var(--green)" }}>
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
                Works Everywhere
              </h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Works without an account. Sign in to sync across devices, or
                self-host and save straight to a folder on your computer.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(244,114,182,0.15)", color: "var(--pink)" }}>
                <GithubIcon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
                Open Source
              </h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                MIT licensed. View the source, contribute features, or fork
                it. Built by game devs, for game devs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Ready to build your game?
          </h2>
          <p className="text-lg mb-8" style={{ color: "var(--text-secondary)" }}>
            Create a project and start making assets. Everything links
            together — sprites connect to tilemaps, dialogue references
            characters, and notes tie it all together.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-medium text-lg transition-all hover:opacity-90"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Open Studio
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs" style={{ background: "var(--accent)" }}>
              GD
            </div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              GameDev Studio — Free &amp; Open Source
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
            <a
              href="https://github.com/magnuspladsen/gamedev-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "var(--text-secondary)" }}
            >
              GitHub
            </a>
            <span>MIT License</span>
            <span>Beta</span>
            <a
              href="https://pladsen.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "var(--text-secondary)" }}
            >
              pladsen.dev
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
