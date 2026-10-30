"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Copy, Download, Palette as PaletteIcon, Check } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Palette } from "@/types";
import { v4 as uuid } from "uuid";
import { LinkedAssets } from "@/components/LinkedAssets";
import { useOpenParam, useStorageVersion } from "@/hooks/useStorage";

const PRESET_PALETTES: { name: string; colors: string[] }[] = [
  {
    name: "Pico-8",
    colors: ["#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8", "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA"],
  },
  {
    name: "Game Boy",
    colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  },
  {
    name: "NES",
    colors: ["#000000", "#fcfcfc", "#f8f8f8", "#bcbcbc", "#7c7c7c", "#a4e4fc", "#3cbcfc", "#0078f8", "#0000fc", "#b8b8f8", "#6888fc", "#0058f8", "#0000bc", "#d8b8f8", "#9878f8", "#6844fc"],
  },
  {
    name: "Endesga 16",
    colors: ["#e4a672", "#b86f50", "#743f39", "#3f2832", "#9e2835", "#e53b44", "#fb922b", "#ffe762", "#63c64d", "#327345", "#193d3f", "#4f6781", "#afbfd2", "#ffffff", "#2ce8f4", "#0484d1"],
  },
  {
    name: "Sweetie 16",
    colors: ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"],
  },
];

export default function PalettesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const version = useStorageVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const palettes = useMemo(() => storage.getAll("palettes", projectId), [projectId, version]);
  const [selected, setSelected] = useState<Palette | null>(null);
  const [newColor, setNewColor] = useState("#7c5cfc");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useOpenParam((id) => {
    const p = storage.getById("palettes", id, projectId);
    if (p) setSelected(p);
  });

  function createPalette(name?: string, colors?: string[]) {
    const p: Palette = {
      id: uuid(),
      projectId,
      name: name || newName.trim() || "Untitled Palette",
      colors: colors || ["#000000", "#ffffff"],
      createdAt: new Date().toISOString(),
    };
    storage.save("palettes", p, projectId);
    setSelected(p);
    setShowNew(false);
    setNewName("");
  }

  function addColor() {
    if (!selected) return;
    const updated = { ...selected, colors: [...selected.colors, newColor] };
    storage.save("palettes", updated, projectId);
    setSelected(updated);
  }

  function removeColor(i: number) {
    if (!selected) return;
    const updated = { ...selected, colors: selected.colors.filter((_, idx) => idx !== i) };
    storage.save("palettes", updated, projectId);
    setSelected(updated);
  }

  function deletePalette(id: string) {
    storage.delete("palettes", id, projectId);
    if (selected?.id === id) setSelected(null);
  }

  function copyColor(hex: string) {
    navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  }

  function exportPalette() {
    if (!selected) return;
    const text = selected.colors.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected.name}.txt`;
    a.click();
  }

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <div
        className="w-60 shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Palettes
            </span>
            <button onClick={() => setShowNew(true)} className="p-1 rounded" style={{ color: "var(--accent)" }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {showNew && (
            <div className="mb-2 space-y-1.5">
              <input
                placeholder="Palette name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createPalette()}
              />
              <button
                onClick={() => createPalette()}
                className="w-full px-2 py-1 rounded text-xs font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                Create
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {palettes.map((p) => (
              <div
                key={p.id}
                className="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer"
                style={{
                  background: selected?.id === p.id ? "var(--bg-hover)" : "transparent",
                  color: "var(--text-primary)",
                }}
                onClick={() => setSelected(p)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex shrink-0">
                    {p.colors.slice(0, 4).map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c, marginLeft: i ? -2 : 0 }} />
                    ))}
                  </div>
                  <span className="truncate">{p.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePalette(p.id); }}
                  className="opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--red)" }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="p-3">
          <span className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>
            Preset Palettes
          </span>
          <div className="space-y-1">
            {PRESET_PALETTES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => createPalette(preset.name, [...preset.colors])}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <div className="flex shrink-0">
                  {preset.colors.slice(0, 4).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c, marginLeft: i ? -2 : 0 }} />
                  ))}
                </div>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-auto p-6">
        {selected ? (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {selected.name}
              </h2>
              <button
                onClick={exportPalette}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>

            {/* Color grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-6">
              {selected.colors.map((color, i) => (
                <div key={i} className="group relative">
                  <button
                    className="w-full aspect-square rounded-lg border-2 transition-all"
                    style={{
                      background: color,
                      borderColor: "var(--border)",
                    }}
                    onClick={() => copyColor(color)}
                    title={color}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {copied === color ? (
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    ) : (
                      <Copy className="w-4 h-4 text-white drop-shadow-md" />
                    )}
                  </div>
                  <button
                    onClick={() => removeColor(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "var(--red)", color: "white" }}
                  >
                    &times;
                  </button>
                  <p className="text-center text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
                    {color}
                  </p>
                </div>
              ))}
            </div>

            {/* Add color */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-10 h-10 rounded border-none cursor-pointer"
                style={{ background: "transparent" }}
              />
              <input
                type="text"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-28 px-2 py-1.5 rounded text-sm font-mono outline-none"
                style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <button
                onClick={addColor}
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                Add Color
              </button>
            </div>

            <div className="mt-8 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <LinkedAssets projectId={projectId} type="palette" id={selected.id} layout="panel" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>
            <PaletteIcon className="w-12 h-12 mb-3" />
            <p>Select or create a palette</p>
            <p className="text-xs mt-1">Use presets or build your own</p>
          </div>
        )}
      </div>
    </div>
  );
}
