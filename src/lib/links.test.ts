import { beforeEach, describe, expect, it } from "vitest";
import type { AssetLink, Sprite } from "@/types";
import { replaceCache, storage } from "./storage";
import { dropDeletedLinkTargets } from "./links";

const now = "2026-01-01T00:00:00.000Z";
const toPip: AssetLink = { targetId: "sprite-pip", targetType: "sprite" };
const toDeletedSprite: AssetLink = { targetId: "sprite-gone", targetType: "sprite" };
const toDeletedNote: AssetLink = { targetId: "note-gone", targetType: "note" };

describe("dropDeletedLinkTargets", () => {
  beforeEach(() => {
    replaceCache(new Map());
    const pip = { id: "sprite-pip", projectId: "p1", name: "Pip", tags: [], createdAt: now, updatedAt: now } as unknown as Sprite;
    storage.save("sprites", pip, "p1");
  });

  it("should keep links when their targets still exist", () => {
    expect(dropDeletedLinkTargets("p1", [toPip])).toEqual({ links: [toPip], dropped: 0 });
  });

  it("should drop links when their targets were deleted", () => {
    expect(dropDeletedLinkTargets("p1", [toPip, toDeletedSprite, toDeletedNote])).toEqual({ links: [toPip], dropped: 2 });
  });

  it("should return nothing to drop when there are no links", () => {
    expect(dropDeletedLinkTargets("p1", [])).toEqual({ links: [], dropped: 0 });
  });

  it("should drop a link when its target lives in another project", () => {
    expect(dropDeletedLinkTargets("p2", [toPip])).toEqual({ links: [], dropped: 1 });
  });
});
