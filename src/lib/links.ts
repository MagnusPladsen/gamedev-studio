import { v4 as uuid } from "uuid";
import type { AssetRef, AssetType, StoryEntry } from "@/types";
import { storage } from "./storage";
import { getAsset, type AssetSummary } from "./assets";

export type LinkSource = "link" | "story" | "wiki";

export interface RelatedAsset extends AssetSummary {
  source: LinkSource;
}

const WIKI_LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

export function wikiTargets(content: string): string[] {
  return [...content.matchAll(WIKI_LINK)].map((m) => m[1].trim().toLowerCase());
}

/**
 * Everything connected to an asset, in either direction:
 * explicit links, story entries' asset links, and [[wiki links]] between story entries.
 */
export function getRelated(projectId: string, type: AssetType, id: string): RelatedAsset[] {
  const found = new Map<string, RelatedAsset>();
  const add = (ref: AssetRef, source: LinkSource) => {
    const key = `${ref.type}:${ref.id}`;
    if (found.has(key) || (ref.type === type && ref.id === id)) return;
    const summary = getAsset(projectId, ref.type, ref.id);
    if (summary) found.set(key, { ...summary, source });
  };

  for (const rel of storage.getAll("links", projectId)) {
    if (rel.from.id === id) add(rel.to, "link");
    else if (rel.to.id === id) add(rel.from, "link");
  }

  const stories = storage.getAll("stories", projectId);
  for (const entry of stories) {
    if (type === "story" && entry.id === id) {
      for (const l of entry.links ?? []) add({ type: l.targetType, id: l.targetId }, "story");
    } else if ((entry.links ?? []).some((l) => l.targetId === id)) {
      add({ type: "story", id: entry.id }, "story");
    }
  }

  if (type === "story") {
    const self = stories.find((s) => s.id === id);
    if (self) {
      const byTitle = new Map(stories.map((s) => [s.title.trim().toLowerCase(), s]));
      for (const t of wikiTargets(self.content)) {
        const target = byTitle.get(t);
        if (target) add({ type: "story", id: target.id }, "wiki");
      }
      const selfTitle = self.title.trim().toLowerCase();
      for (const s of stories) if (wikiTargets(s.content).includes(selfTitle)) add({ type: "story", id: s.id }, "wiki");
    }
  }

  return [...found.values()];
}

export function addLink(projectId: string, from: AssetRef, to: AssetRef) {
  const exists = storage
    .getAll("links", projectId)
    .some((l) => (l.from.id === from.id && l.to.id === to.id) || (l.from.id === to.id && l.to.id === from.id));
  if (exists) return;
  const now = new Date().toISOString();
  storage.save("links", { id: uuid(), projectId, from, to, createdAt: now, updatedAt: now }, projectId);
}

export function removeLink(projectId: string, a: AssetRef, b: AssetRef) {
  for (const l of storage.getAll("links", projectId)) {
    if ((l.from.id === a.id && l.to.id === b.id) || (l.from.id === b.id && l.to.id === a.id)) {
      storage.delete("links", l.id, projectId);
    }
  }
  for (const [story, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (story.type !== "story") continue;
    const entry = storage.getById("stories", story.id, projectId) as StoryEntry | undefined;
    if (!entry?.links?.some((l) => l.targetId === other.id)) continue;
    storage.save(
      "stories",
      { ...entry, links: entry.links.filter((l) => l.targetId !== other.id), updatedAt: new Date().toISOString() },
      projectId
    );
  }
}
