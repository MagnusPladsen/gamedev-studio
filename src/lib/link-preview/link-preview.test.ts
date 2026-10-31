import { describe, expect, it } from "vitest";
import { decodeEntities, parsePageMeta } from "./meta";
import { isPrivateAddress, isPrivateHostname } from "./safe-host";

describe("parsePageMeta", () => {
  it("prefers Open Graph tags and resolves a relative image", () => {
    const html = `<html><head>
      <title>Fallback</title>
      <meta property="og:title" content="Celeste &amp; Forgiveness">
      <meta name="description" content="Plain description">
      <meta content="/img/card.png" property="og:image" />
      <meta property="og:site_name" content='Maddy&#39;s blog'>
    </head></html>`;
    expect(parsePageMeta(html, "https://example.com/posts/1")).toEqual({
      title: "Celeste & Forgiveness",
      description: "Plain description",
      image: "https://example.com/img/card.png",
      siteName: "Maddy's blog",
    });
  });

  it("falls back to the title tag and drops non-web images", () => {
    const html = `<title>  Lospec
      Palette List </title><meta property="og:image" content="javascript:alert(1)">`;
    expect(parsePageMeta(html, "https://lospec.com/")).toEqual({
      title: "Lospec Palette List",
      description: undefined,
      image: undefined,
      siteName: undefined,
    });
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("a &lt;b&gt; &#x2014; &#8212; &unknown;")).toBe("a <b> — — &unknown;");
  });
});

describe("isPrivateAddress", () => {
  it("blocks loopback, private and link-local addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::1", "::7f00:1", "fec0::1", "2001:db8::1", "2001::1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});

describe("isPrivateHostname", () => {
  it("blocks local names", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("printer.local")).toBe(true);
    expect(isPrivateHostname("intranet")).toBe(true);
    expect(isPrivateHostname("youtube.com")).toBe(false);
  });
});
