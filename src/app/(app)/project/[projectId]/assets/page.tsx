"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowRight,
} from "lucide-react";
import { storage } from "@/lib/storage";
import type { Project } from "@/types";

const sections = [
  { icon: Paintbrush, name: "Pixel Art", path: "pixel-art", color: "var(--accent)", collection: "sprites" as const, desc: "Draw sprites and animations" },
  { icon: Music, name: "Music", path: "music", color: "var(--green)", collection: "music" as const, desc: "Compose game music" },
  { icon: Volume2, name: "SFX", path: "sfx", color: "var(--yellow)", collection: "sounds" as const, desc: "Generate sound effects" },
  { icon: Grid3X3, name: "Tilemap", path: "tilemap", color: "var(--blue)", collection: "tilemaps" as const, desc: "Paint game levels" },
  { icon: GitBranch, name: "Diagrams", path: "diagrams", color: "var(--pink)", collection: "diagrams" as const, desc: "Plan game logic" },
  { icon: BookOpen, name: "Story", path: "story", color: "var(--orange)", collection: "stories" as const, desc: "Write lore and worldbuilding" },
  { icon: MessageSquare, name: "Dialogue", path: "dialogue", color: "var(--red)", collection: "dialogues" as const, desc: "Create branching dialogue" },
  { icon: Palette, name: "Palettes", path: "palettes", color: "var(--green)", collection: "palettes" as const, desc: "Manage color palettes" },
  { icon: Package, name: "Sprite Sheets", path: "sprites", color: "var(--blue)", collection: "spritesheets" as const, desc: "Pack sprites into sheets" },
];

export default function AssetsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const p = storage.getById("projects", projectId);
    setProject(p || null);
    const c: Record<string, number> = {};
    for (const s of sections) {
      c[s.collection] = storage.getAll(s.collection, projectId).length;
    }
    setCounts(c);
  }, [projectId]);

  if (!project) {
    return (
      <div className="p-10 text-center" style={{ color: "var(--text-secondary)" }}>
        Project not found
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {project.name}
        </h1>
        {project.description && (
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {project.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map((section) => (
          <button
            key={section.path}
            onClick={() => router.push(`/project/${projectId}/${section.path}`)}
            className="group flex items-start gap-3 p-4 rounded-xl border text-left transition-all"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = section.color;
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--bg-card)";
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${section.color}20`, color: section.color }}
            >
              <section.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                  {section.name}
                </span>
                <ArrowRight
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: section.color }}
                />
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {section.desc}
              </p>
              {(counts[section.collection] ?? 0) > 0 && (
                <span
                  className="inline-block text-xs mt-1.5 px-2 py-0.5 rounded-full"
                  style={{ background: `${section.color}15`, color: section.color }}
                >
                  {counts[section.collection]} asset{counts[section.collection] !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
