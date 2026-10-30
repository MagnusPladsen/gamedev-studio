"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Search,
  Trash2,
  User,
  MapPin,
  Box,
  Zap,
  Scroll,
  Flag,
  FileText,
  Link as LinkIcon,
  X,
  Network,
  ChevronDown,
  ChevronRight,
  Tag,
  Save,
  BookOpen,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import { storage } from "@/lib/storage";
import type { StoryEntry, AssetLink } from "@/types";

const ENTRY_TYPES = [
  { value: "character" as const, label: "Character", icon: User, color: "#a78bfa" },
  { value: "location" as const, label: "Location", icon: MapPin, color: "#60a5fa" },
  { value: "item" as const, label: "Item", icon: Box, color: "#fbbf24" },
  { value: "event" as const, label: "Event", icon: Zap, color: "#f87171" },
  { value: "lore" as const, label: "Lore", icon: Scroll, color: "#fb923c" },
  { value: "quest" as const, label: "Quest", icon: Flag, color: "#34d399" },
  { value: "note" as const, label: "Note", icon: FileText, color: "#8888a0" },
] as const;

type EntryType = (typeof ENTRY_TYPES)[number]["value"];

const ASSET_TYPES = [
  { value: "sprite" as const, label: "Sprite", collection: "sprites" as const },
  { value: "sound" as const, label: "Sound", collection: "sounds" as const },
  { value: "music" as const, label: "Music", collection: "music" as const },
  { value: "diagram" as const, label: "Diagram", collection: "diagrams" as const },
  { value: "tilemap" as const, label: "Tilemap", collection: "tilemaps" as const },
  { value: "dialogue" as const, label: "Dialogue", collection: "dialogues" as const },
] as const;

function getTypeMeta(type: string) {
  return ENTRY_TYPES.find((t) => t.value === type) ?? ENTRY_TYPES[6];
}

function makeExamples(projectId: string): StoryEntry[] {
  const heroId = uuid();
  const villageId = uuid();
  const swordId = uuid();
  const now = new Date().toISOString();
  return [
    {
      id: heroId,
      projectId,
      title: "Hero",
      content:
        "The protagonist of the story. A young adventurer from [[Starting Village]] who discovers the legendary [[Magic Sword]].\n\n## Backstory\nRaised by the village elder after being orphaned. Has a natural talent for combat.\n\n## Personality\n- Brave but impulsive\n- Loyal to friends\n- Driven by justice",
      type: "character",
      links: [],
      tags: ["protagonist", "main-cast"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: villageId,
      projectId,
      title: "Starting Village",
      content:
        "A peaceful hamlet at the edge of the kingdom. Home to [[Hero]] and roughly 200 villagers.\n\n## Description\nNestled between rolling green hills and a sparkling river. Thatched-roof cottages line cobblestone streets.\n\n## Key Locations\n- Elder's Hut\n- Blacksmith (where [[Magic Sword]] was forged)\n- Market Square\n- Training Grounds",
      type: "location",
      links: [],
      tags: ["starting-area", "safe-zone"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: swordId,
      projectId,
      title: "Magic Sword",
      content:
        "A legendary blade forged in [[Starting Village]] and destined to be wielded by [[Hero]].\n\n## Properties\n- Glows blue in the presence of enemies\n- +50 Attack Power\n- Can break magical barriers\n\n## Lore\nForged centuries ago by a master blacksmith using ore from a fallen star.",
      type: "item",
      links: [],
      tags: ["weapon", "legendary", "key-item"],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export default function StoryPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [entries, setEntries] = useState<StoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<EntryType>("character");
  const [showGraph, setShowGraph] = useState(false);
  const [showAssetLinker, setShowAssetLinker] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let loaded = storage.getAll("stories", projectId);
    if (loaded.length === 0) {
      const examples = makeExamples(projectId);
      for (const ex of examples) storage.save("stories", ex, projectId);
      loaded = examples;
    }
    setEntries(loaded);
    if (loaded.length > 0) setSelectedId(loaded[0].id);
  }, [projectId]);

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);

  const grouped = useMemo(() => {
    const groups: Record<string, StoryEntry[]> = {};
    for (const t of ENTRY_TYPES) groups[t.value] = [];
    for (const entry of entries) {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!entry.title.toLowerCase().includes(q) && !entry.tags.some((t) => t.toLowerCase().includes(q))) continue;
      }
      (groups[entry.type] ??= []).push(entry);
    }
    return groups;
  }, [entries, searchQuery]);

  const saveEntry = useCallback(
    (patch: Partial<StoryEntry>) => {
      if (!selected) return;
      const updated = { ...selected, ...patch, updatedAt: new Date().toISOString() };
      storage.save("stories", updated, projectId);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setDirty(false);
    },
    [selected, projectId],
  );

  function createEntry() {
    if (!newTitle.trim()) return;
    const entry: StoryEntry = {
      id: uuid(),
      projectId,
      title: newTitle.trim(),
      content: "",
      type: newType,
      links: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.save("stories", entry, projectId);
    setEntries((prev) => [...prev, entry]);
    setSelectedId(entry.id);
    setShowNewForm(false);
    setNewTitle("");
  }

  function deleteEntry(id: string) {
    storage.delete("stories", id, projectId);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(entries.find((e) => e.id !== id)?.id ?? null);
  }

  function toggleGroup(type: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function addTag() {
    if (!tagInput.trim() || !selected) return;
    const tag = tagInput.trim().toLowerCase();
    if (!selected.tags.includes(tag)) {
      saveEntry({ tags: [...selected.tags, tag] });
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    if (!selected) return;
    saveEntry({ tags: selected.tags.filter((t) => t !== tag) });
  }

  function addAssetLink(targetType: AssetLink["targetType"], targetId: string) {
    if (!selected) return;
    if (selected.links.some((l) => l.targetId === targetId)) return;
    saveEntry({ links: [...selected.links, { targetId, targetType }] });
    setShowAssetLinker(false);
  }

  function removeAssetLink(targetId: string) {
    if (!selected) return;
    saveEntry({ links: selected.links.filter((l) => l.targetId !== targetId) });
  }

  function renderContent(content: string) {
    const parts = content.split(/(\[\[[^\]]+\]\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[\[([^\]]+)\]\]$/);
      if (match) {
        const name = match[1];
        const target = entries.find((e) => e.title.toLowerCase() === name.toLowerCase());
        if (target) {
          const meta = getTypeMeta(target.type);
          return (
            <button
              key={i}
              onClick={() => setSelectedId(target.id)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-sm font-medium transition-colors"
              style={{ background: `${meta.color}20`, color: meta.color }}
            >
              <meta.icon className="w-3 h-3" />
              {target.title}
            </button>
          );
        }
        return (
          <span key={i} className="inline px-1 py-0.5 rounded text-sm" style={{ background: "var(--bg-hover)", color: "var(--red)" }}>
            [[{name}]]
          </span>
        );
      }
      return part.split("\n").map((line, li) => (
        <span key={`${i}-${li}`}>
          {li > 0 && <br />}
          {line.startsWith("## ") ? (
            <strong className="block text-lg mt-4 mb-2" style={{ color: "var(--text-primary)" }}>{line.slice(3)}</strong>
          ) : line.startsWith("- ") ? (
            <span className="block pl-4">• {line.slice(2)}</span>
          ) : (
            line
          )}
        </span>
      ));
    });
  }

  // Build graph data from [[links]]
  const graphData = useMemo(() => {
    const nodes: { id: string; title: string; type: string; x: number; y: number }[] = [];
    const edges: { from: string; to: string }[] = [];
    const entryMap = new Map(entries.map((e) => [e.title.toLowerCase(), e]));

    entries.forEach((entry, i) => {
      const angle = (2 * Math.PI * i) / Math.max(entries.length, 1);
      const radius = Math.min(180, 60 + entries.length * 15);
      nodes.push({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        x: 250 + Math.cos(angle) * radius,
        y: 200 + Math.sin(angle) * radius,
      });
      const linkMatches = entry.content.matchAll(/\[\[([^\]]+)\]\]/g);
      for (const m of linkMatches) {
        const target = entryMap.get(m[1].toLowerCase());
        if (target && target.id !== entry.id) {
          edges.push({ from: entry.id, to: target.id });
        }
      }
    });
    return { nodes, edges };
  }, [entries]);

  if (showGraph) {
    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg-primary)" }}>
        <div className="h-12 flex items-center justify-between px-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Connection Graph</h2>
          <button onClick={() => setShowGraph(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <svg viewBox="0 0 500 400" className="w-full max-w-2xl" style={{ maxHeight: "70vh" }}>
            {graphData.edges.map((edge, i) => {
              const from = graphData.nodes.find((n) => n.id === edge.from);
              const to = graphData.nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--border-hover)" strokeWidth="1.5" />;
            })}
            {graphData.nodes.map((node) => {
              const meta = getTypeMeta(node.type);
              return (
                <g key={node.id} onClick={() => { setSelectedId(node.id); setShowGraph(false); }} className="cursor-pointer">
                  <circle cx={node.x} cy={node.y} r="22" fill={`${meta.color}30`} stroke={meta.color} strokeWidth="1.5" />
                  <text x={node.x} y={node.y + 3} textAnchor="middle" fill={meta.color} fontSize="9" fontWeight="600">
                    {node.title.length > 10 ? node.title.slice(0, 9) + "…" : node.title}
                  </text>
                  <text x={node.x} y={node.y + 36} textAnchor="middle" fill="var(--text-muted)" fontSize="8">
                    {meta.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="p-3 border-b space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search entries…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
            <button onClick={() => setShowGraph(true)} className="p-1.5 rounded-md" style={{ color: "var(--text-secondary)", background: "var(--bg-primary)", border: "1px solid var(--border)" }} title="View graph">
              <Network className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Entry
          </button>
        </div>

        {showNewForm && (
          <div className="p-3 border-b space-y-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <input
              type="text"
              placeholder="Entry title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md text-xs outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && createEntry()}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as EntryType)}
              className="w-full px-2 py-1.5 rounded-md text-xs outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <button onClick={createEntry} className="flex-1 py-1 rounded-md text-xs font-medium" style={{ background: "var(--accent)", color: "white" }}>
                Create
              </button>
              <button onClick={() => setShowNewForm(false)} className="px-3 py-1 rounded-md text-xs" style={{ color: "var(--text-secondary)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {ENTRY_TYPES.map((type) => {
            const items = grouped[type.value] ?? [];
            const collapsed = collapsedGroups.has(type.value);
            return (
              <div key={type.value}>
                <button
                  onClick={() => toggleGroup(type.value)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                  style={{ color: type.color }}
                >
                  {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <type.icon className="w-3 h-3" />
                  {type.label}
                  <span className="ml-auto text-[10px] opacity-60">{items.length}</span>
                </button>
                {!collapsed &&
                  items.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className="w-full text-left flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs transition-colors"
                      style={{
                        color: selectedId === entry.id ? "var(--text-primary)" : "var(--text-secondary)",
                        background: selectedId === entry.id ? "var(--bg-hover)" : "transparent",
                      }}
                    >
                      <span className="truncate">{entry.title}</span>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const meta = getTypeMeta(selected.type);
                return (
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${meta.color}20`, color: meta.color }}>
                    <meta.icon className="w-4 h-4" />
                  </div>
                );
              })()}
              <input
                type="text"
                value={selected.title}
                onChange={(e) => { saveEntry({ title: e.target.value }); }}
                className="text-lg font-semibold bg-transparent outline-none min-w-0"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={selected.type}
                onChange={(e) => saveEntry({ type: e.target.value as EntryType })}
                className="px-2 py-1 rounded-md text-xs outline-none"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAssetLinker(true)}
                className="p-1.5 rounded-md"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                title="Link asset"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteEntry(selected.id)}
                className="p-1.5 rounded-md"
                style={{ color: "var(--red)", border: "1px solid var(--border)" }}
                title="Delete entry"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 px-5 py-2 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
            <Tag className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
            {selected.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:opacity-70">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              className="bg-transparent outline-none text-[11px] w-20"
              style={{ color: "var(--text-secondary)" }}
            />
          </div>

          {/* Asset links */}
          {selected.links.length > 0 && (
            <div className="flex items-center gap-1.5 px-5 py-2 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
              <LinkIcon className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
              {selected.links.map((link) => (
                <span key={link.targetId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: "var(--accent)15", color: "var(--accent)" }}>
                  {link.targetType}:{link.targetId.slice(0, 6)}
                  <button onClick={() => removeAssetLink(link.targetId)}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Content area - side by side edit / preview */}
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 flex flex-col border-r" style={{ borderColor: "var(--border)" }}>
              <div className="px-5 py-1.5 text-[10px] font-medium flex items-center justify-between" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <span>EDIT (Markdown — use [[Entry Name]] to link)</span>
                {dirty && (
                  <button onClick={() => saveEntry({ content: selected.content })} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--accent)" }}>
                    <Save className="w-3 h-3" /> Save
                  </button>
                )}
              </div>
              <textarea
                value={selected.content}
                onChange={(e) => {
                  const updated = { ...selected, content: e.target.value, updatedAt: new Date().toISOString() };
                  setEntries((prev) => prev.map((en) => (en.id === updated.id ? updated : en)));
                  setDirty(true);
                }}
                onBlur={() => { if (dirty) saveEntry({ content: selected.content }); }}
                className="flex-1 resize-none p-5 text-sm leading-relaxed outline-none font-mono"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
                placeholder="Write your entry content here. Use [[Entry Name]] to link to other entries…"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-5 py-1.5 text-[10px] font-medium" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                PREVIEW
              </div>
              <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {renderContent(selected.content)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select an entry or create a new one</p>
          </div>
        </div>
      )}

      {/* Asset linker modal */}
      {showAssetLinker && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-96 rounded-xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Link Asset</h3>
              <button onClick={() => setShowAssetLinker(false)}><X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ASSET_TYPES.map((assetType) => {
                const items = storage.getAll(assetType.collection, projectId);
                if (items.length === 0) return null;
                return (
                  <div key={assetType.value}>
                    <div className="text-[10px] font-medium px-1 py-1" style={{ color: "var(--text-muted)" }}>{assetType.label.toUpperCase()}</div>
                    {items.map((item) => {
                      const id = (item as { id: string }).id;
                      const name = (item as { name: string }).name;
                      return (
                        <button
                          key={id}
                          onClick={() => addAssetLink(assetType.value, id)}
                          className="w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {ASSET_TYPES.every((at) => storage.getAll(at.collection, projectId).length === 0) && (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                  No assets in this project yet. Create sprites, sounds, or other assets first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
