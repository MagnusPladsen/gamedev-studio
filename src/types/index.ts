export interface Project {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sprite {
  id: string;
  projectId: string;
  name: string;
  width: number;
  height: number;
  frames: SpriteFrame[];
  fps: number;
  paletteId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SpriteFrame {
  id: string;
  pixels: string; // base64 encoded pixel data
  duration: number; // ms
}

export interface Palette {
  id: string;
  projectId: string;
  name: string;
  colors: string[];
  createdAt: string;
}

export interface SoundEffect {
  id: string;
  projectId: string;
  name: string;
  params: SfxParams;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SfxParams {
  waveType: "square" | "sawtooth" | "sine" | "triangle" | "noise";
  frequency: number;
  frequencySlide: number;
  repeatSpeed: number;
  sustainTime: number;
  decayTime: number;
  attackTime: number;
  hpFilterCutoff: number;
  lpFilterCutoff: number;
  lpFilterResonance: number;
  volume: number;
  vibratoDepth: number;
  vibratoSpeed: number;
}

export interface MusicTrack {
  id: string;
  projectId: string;
  name: string;
  bpm: number;
  channels: MusicChannel[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MusicChannel {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  patterns: MusicPattern[];
}

export interface MusicPattern {
  id: string;
  notes: MusicNote[];
}

export interface MusicNote {
  pitch: number; // MIDI note number
  start: number; // beat position
  duration: number; // beats
  velocity: number;
}

export interface DiagramNode {
  id: string;
  type: "state" | "action" | "condition" | "event" | "note" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
  data?: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: "arrow" | "line" | "dashed";
}

export interface Diagram {
  id: string;
  projectId: string;
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryEntry {
  id: string;
  projectId: string;
  title: string;
  content: string; // markdown
  type: "character" | "location" | "item" | "event" | "lore" | "quest" | "note";
  links: AssetLink[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetLink {
  targetId: string;
  targetType: "sprite" | "sound" | "music" | "diagram" | "story" | "tilemap" | "dialogue" | "palette";
  label?: string;
}

export interface TilemapData {
  id: string;
  projectId: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  layers: TilemapLayer[];
  tilesetSpriteIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TilemapLayer {
  id: string;
  name: string;
  visible: boolean;
  tiles: (number | null)[][]; // row x col, value = tile index or null
}

export interface DialogueTree {
  id: string;
  projectId: string;
  name: string;
  nodes: DialogueNode[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DialogueNode {
  id: string;
  type: "dialogue" | "choice" | "condition" | "action" | "start" | "end";
  x: number;
  y: number;
  speaker?: string;
  text?: string;
  choices?: { text: string; targetId: string }[];
  nextId?: string;
  condition?: string;
}

export interface SpriteSheet {
  id: string;
  projectId: string;
  name: string;
  spriteIds: string[];
  padding: number;
  powerOfTwo: boolean;
  createdAt: string;
}

export type AssetType = "sprite" | "sound" | "music" | "diagram" | "story" | "tilemap" | "dialogue" | "palette" | "spritesheet";
