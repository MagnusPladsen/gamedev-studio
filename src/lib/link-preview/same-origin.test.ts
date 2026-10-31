import { describe, expect, it } from "vitest";
import { isCrossSiteRequest } from "./same-origin";

const HOST = "gamedev-studio.pladsen.dev";

describe("isCrossSiteRequest", () => {
  it("allows the app's own fetches and direct visits", () => {
    expect(isCrossSiteRequest(new Headers({ "sec-fetch-site": "same-origin" }), HOST)).toBe(false);
    expect(isCrossSiteRequest(new Headers({ "sec-fetch-site": "none" }), HOST)).toBe(false);
    expect(isCrossSiteRequest(new Headers(), HOST)).toBe(false);
    expect(isCrossSiteRequest(new Headers({ origin: `https://${HOST}` }), HOST)).toBe(false);
  });

  it("rejects requests from other sites", () => {
    expect(isCrossSiteRequest(new Headers({ "sec-fetch-site": "cross-site" }), HOST)).toBe(true);
    expect(isCrossSiteRequest(new Headers({ "sec-fetch-site": "same-site" }), HOST)).toBe(true);
    expect(isCrossSiteRequest(new Headers({ origin: "https://evil.example" }), HOST)).toBe(true);
    expect(isCrossSiteRequest(new Headers({ origin: "null" }), HOST)).toBe(true);
  });
});
