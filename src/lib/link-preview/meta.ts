import type { LinkPreview } from "@/lib/diagrams/cards";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    result[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return result;
}

function clean(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  const value = decodeEntities(text).replace(/\s+/g, " ").trim();
  return value ? value.slice(0, max) : undefined;
}

function absoluteHttpUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Reads the Open Graph / Twitter / plain HTML tags that describe a page. */
export function parsePageMeta(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 200_000);
  const meta: Record<string, string> = {};
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content !== undefined && !(key in meta)) meta[key] = attrs.content;
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag, 200),
    description: clean(meta["og:description"] ?? meta["twitter:description"] ?? meta.description, 300),
    image: absoluteHttpUrl(meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"], pageUrl),
    siteName: clean(meta["og:site_name"], 80),
  };
}
