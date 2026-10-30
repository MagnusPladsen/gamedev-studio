"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Paintbrush,
  Music,
  Volume2,
  GitBranch,
  BookOpen,
  Grid3X3,
  MessageSquare,
  Palette,
  Package,
  FolderOpen,
  ChevronLeft,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { useState, Suspense } from "react";

const toolNav = [
  { icon: LayoutDashboard, name: "Assets", path: "assets", color: "var(--text-secondary)" },
  { icon: Paintbrush, name: "Pixel Art", path: "pixel-art", color: "var(--accent)" },
  { icon: Music, name: "Music", path: "music", color: "var(--green)" },
  { icon: Volume2, name: "SFX", path: "sfx", color: "var(--yellow)" },
  { icon: Grid3X3, name: "Tilemap", path: "tilemap", color: "var(--blue)" },
  { icon: GitBranch, name: "Diagrams", path: "diagrams", color: "var(--pink)" },
  { icon: BookOpen, name: "Story", path: "story", color: "var(--orange)" },
  { icon: MessageSquare, name: "Dialogue", path: "dialogue", color: "var(--red)" },
  { icon: Palette, name: "Palettes", path: "palettes", color: "var(--green)" },
  { icon: Package, name: "Sprites", path: "sprites", color: "var(--blue)" },
];

function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const projectMatch = pathname.match(/\/project\/([^/]+)/);
  const projectId = projectMatch?.[1];
  const isProjectView = !!projectId;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Mobile toggle */}
      <button
        className="fixed top-3 left-3 z-50 p-2 rounded-lg md:hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-56 flex flex-col border-r transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="h-14 flex items-center px-4 border-b" style={{ borderColor: "var(--border)" }}>
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs"
              style={{ background: "var(--accent)" }}
            >
              GD
            </div>
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              GameDev Studio
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {!isProjectView ? (
            <div className="px-2">
              <Link
                href="/projects"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color: pathname === "/projects" ? "var(--text-primary)" : "var(--text-secondary)",
                  background: pathname === "/projects" ? "var(--bg-hover)" : "transparent",
                }}
              >
                <FolderOpen className="w-4 h-4" />
                Projects
              </Link>
            </div>
          ) : (
            <>
              <div className="px-2 mb-1">
                <Link
                  href="/projects"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <ChevronLeft className="w-3 h-3" />
                  All Projects
                </Link>
              </div>
              <div className="px-2 space-y-0.5">
                {toolNav.map((tool) => {
                  const href = `/project/${projectId}/${tool.path}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={tool.path}
                      href={href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                        background: isActive ? "var(--bg-hover)" : "transparent",
                      }}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <tool.icon className="w-4 h-4" style={{ color: isActive ? tool.color : undefined }} />
                      {tool.name}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs px-2" style={{ color: "var(--text-muted)" }}>
            Free &amp; Open Source
          </div>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm mx-auto mb-3" style={{ background: "var(--accent)" }}>
            GD
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        </div>
      </div>
    }>
      <AppSidebar>{children}</AppSidebar>
    </Suspense>
  );
}
