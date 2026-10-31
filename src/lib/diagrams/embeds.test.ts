import { describe, expect, it } from "vitest";
import { embedFor, isImageUrl, normalizeUrl } from "./embeds";

describe("normalizeUrl", () => {
  it("adds https to bare domains", () => {
    expect(normalizeUrl(" youtube.com/watch?v=abc ")).toBe("https://youtube.com/watch?v=abc");
  });

  it("rejects text that is not a web link", () => {
    expect(normalizeUrl("hello world")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("notes")).toBeNull();
  });
});

describe("embedFor", () => {
  it("embeds YouTube watch, short and youtu.be links", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=yorTG9at90g",
      "https://youtu.be/yorTG9at90g",
      "https://youtube.com/shorts/yorTG9at90g",
    ]) {
      const embed = embedFor(link);
      expect(embed?.provider).toBe("youtube");
      expect(embed?.src).toContain("youtube-nocookie.com/embed/yorTG9at90g");
      expect(embed?.thumbnail).toBe("https://i.ytimg.com/vi/yorTG9at90g/hqdefault.jpg");
    }
  });

  it("keeps a YouTube start time", () => {
    expect(embedFor("https://youtu.be/yorTG9at90g?t=90")?.src).toContain("start=90");
  });

  it("embeds Spotify tracks and playlists, also with a locale prefix", () => {
    expect(embedFor("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toMatchObject({
      provider: "spotify",
      src: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
      height: 152,
    });
    expect(embedFor("https://open.spotify.com/intl-de/playlist/37i9dQZF1DX8Uebhn9wzrS")?.height).toBe(352);
  });

  it("embeds Vimeo and SoundCloud", () => {
    expect(embedFor("https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871?autoplay=1");
    expect(embedFor("https://soundcloud.com/artist/track-name")?.src).toContain(
      encodeURIComponent("https://soundcloud.com/artist/track-name")
    );
  });

  it("returns null for other links", () => {
    expect(embedFor("https://lospec.com/palette-list")).toBeNull();
    expect(embedFor("https://www.youtube.com/@GMTK")).toBeNull();
    expect(embedFor("https://soundcloud.com/artist")).toBeNull();
  });
});

describe("isImageUrl", () => {
  it("spots image files by extension", () => {
    expect(isImageUrl("https://example.com/art/ref.PNG?size=2")).toBe(true);
    expect(isImageUrl("https://example.com/page")).toBe(false);
  });
});
