import { describe, expect, it } from "vitest";
import type { AssetRef } from "@/types";
import { ASSET_KINDS } from "@/lib/assets";
import { embedFor } from "@/lib/diagrams/embeds";
import { diagramBoardExamples } from "./diagram-boards";
import { EXAMPLE_SLUGS } from "./types";

const ctx = { projectId: "p", id: (slug: string) => `p--ex--${slug}` };

describe("diagram board examples", () => {
  const boards = diagramBoardExamples(ctx);

  it("links only to example assets that exist", () => {
    for (const board of boards) {
      for (const node of board.nodes) {
        const asset = node.data?.asset as AssetRef | undefined;
        if (!asset) continue;
        const slugs: readonly string[] = EXAMPLE_SLUGS[ASSET_KINDS[asset.type].collection as keyof typeof EXAMPLE_SLUGS];
        expect(slugs.map(ctx.id), `${board.name}: ${node.label}`).toContain(asset.id);
      }
    }
  });

  it("connects only cards on the same board", () => {
    for (const board of boards) {
      const ids = new Set(board.nodes.map((n) => n.id));
      for (const edge of board.edges) expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
    }
  });

  it("shows off playable links and images", () => {
    const nodes = boards.flatMap((b) => b.nodes);
    expect(nodes.some((n) => n.type === "link" && embedFor(n.data?.url as string)?.provider === "youtube")).toBe(true);
    expect(nodes.some((n) => n.type === "link" && embedFor(n.data?.url as string)?.provider === "spotify")).toBe(true);
    expect(nodes.filter((n) => n.type === "image").every((n) => String(n.data?.src).startsWith("data:image/svg+xml"))).toBe(true);
  });
});
