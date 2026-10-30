import type { Project, Sprite, SoundEffect, MusicTrack, Diagram, StoryEntry, TilemapData, DialogueTree, Palette, SpriteSheet } from "@/types";

type StorableTypes = {
  projects: Project;
  sprites: Sprite;
  sounds: SoundEffect;
  music: MusicTrack;
  diagrams: Diagram;
  stories: StoryEntry;
  tilemaps: TilemapData;
  dialogues: DialogueTree;
  palettes: Palette;
  spritesheets: SpriteSheet;
};

type CollectionName = keyof StorableTypes;

function getKey(collection: CollectionName, projectId?: string): string {
  if (projectId) return `gds:${projectId}:${collection}`;
  return `gds:${collection}`;
}

function readCollection<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // storage full
  }
}

export const storage = {
  getAll<K extends CollectionName>(collection: K, projectId?: string): StorableTypes[K][] {
    const key = getKey(collection, projectId);
    return readCollection<StorableTypes[K]>(key);
  },

  getById<K extends CollectionName>(collection: K, id: string, projectId?: string): StorableTypes[K] | undefined {
    const items = this.getAll(collection, projectId);
    return items.find((item) => (item as { id: string }).id === id);
  },

  save<K extends CollectionName>(collection: K, item: StorableTypes[K], projectId?: string): void {
    const key = getKey(collection, projectId);
    const items = readCollection<StorableTypes[K]>(key);
    const index = items.findIndex((i) => (i as { id: string }).id === (item as { id: string }).id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    writeCollection(key, items);
  },

  delete<K extends CollectionName>(collection: K, id: string, projectId?: string): void {
    const key = getKey(collection, projectId);
    const items = readCollection<StorableTypes[K]>(key);
    const filtered = items.filter((i) => (i as { id: string }).id !== id);
    writeCollection(key, filtered);
  },

  exportProject(projectId: string): string {
    const data: Record<string, unknown> = {};
    const collections: CollectionName[] = ["sprites", "sounds", "music", "diagrams", "stories", "tilemaps", "dialogues", "palettes", "spritesheets"];
    for (const col of collections) {
      data[col] = this.getAll(col, projectId);
    }
    const project = this.getById("projects", projectId);
    data.project = project;
    return JSON.stringify(data, null, 2);
  },

  importProject(json: string): Project | null {
    try {
      const data = JSON.parse(json);
      if (!data.project) return null;
      const project = data.project as Project;
      this.save("projects", project);
      const collections: CollectionName[] = ["sprites", "sounds", "music", "diagrams", "stories", "tilemaps", "dialogues", "palettes", "spritesheets"];
      for (const col of collections) {
        if (Array.isArray(data[col])) {
          for (const item of data[col]) {
            this.save(col, item, project.id);
          }
        }
      }
      return project;
    } catch {
      return null;
    }
  },
};
