export type EmbedProvider = "youtube" | "spotify" | "vimeo" | "soundcloud";

export interface Embed {
  provider: EmbedProvider;
  /** Player URL for an iframe. */
  src: string;
  /** Video players keep this width/height ratio. */
  aspect?: number;
  /** Audio players have a fixed height in px. */
  height?: number;
  thumbnail?: string;
}

export const PROVIDER_NAMES: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  vimeo: "Vimeo",
  soundcloud: "SoundCloud",
};

/** Accepts what people paste ("youtube.com/watch?v=…", " https://… ") and returns a clean http(s) URL. */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isImageUrl(url: string): boolean {
  try {
    return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

const YOUTUBE_ID = /^[\w-]{11}$/;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/);
  return match ? match[1] : null;
}

function youtube(url: URL): Embed | null {
  const id = youtubeId(url);
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const start = parseInt(url.searchParams.get("t") ?? url.searchParams.get("start") ?? "", 10);
  const params = new URLSearchParams({ autoplay: "1" });
  if (start > 0) params.set("start", String(start));
  return {
    provider: "youtube",
    src: `https://www.youtube-nocookie.com/embed/${id}?${params}`,
    aspect: 16 / 9,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

const SPOTIFY_KINDS = ["track", "album", "playlist", "episode", "show", "artist"];

function spotify(url: URL): Embed | null {
  if (url.hostname !== "open.spotify.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift();
  const [kind, id] = parts;
  if (!SPOTIFY_KINDS.includes(kind) || !id || !/^[A-Za-z0-9]+$/.test(id)) return null;
  return {
    provider: "spotify",
    src: `https://open.spotify.com/embed/${kind}/${id}`,
    height: kind === "track" || kind === "episode" ? 152 : 352,
  };
}

function vimeo(url: URL): Embed | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const match = url.pathname.match(/(?:^|\/)(\d{5,})(?:\/|$)/);
  if (!match) return null;
  return { provider: "vimeo", src: `https://player.vimeo.com/video/${match[1]}?autoplay=1`, aspect: 16 / 9 };
}

function soundcloud(url: URL): Embed | null {
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host !== "soundcloud.com") return null;
  if (url.pathname.split("/").filter(Boolean).length < 2) return null;
  const track = `https://soundcloud.com${url.pathname}`;
  return {
    provider: "soundcloud",
    src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(track)}&auto_play=true&visual=false`,
    height: 166,
  };
}

/** A playable embed for links from video and music sites; null for any other link. */
export function embedFor(link: string): Embed | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  return youtube(url) ?? spotify(url) ?? vimeo(url) ?? soundcloud(url);
}
