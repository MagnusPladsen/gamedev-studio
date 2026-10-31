import { describe, expect, it } from "vitest";
import { borderPoint, boundsOf, edgeEndpoints, idsInside, stackColumn, GROUP_HEADER, GROUP_PADDING } from "./geometry";

describe("borderPoint", () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };

  it("leaves through the side facing the target", () => {
    expect(borderPoint(box, { x: 300, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(borderPoint(box, { x: 50, y: -200 })).toEqual({ x: 50, y: 0 });
  });

  it("pushes the point out by the gap", () => {
    expect(borderPoint(box, { x: 300, y: 25 }, 4)).toEqual({ x: 104, y: 25 });
  });
});

describe("edgeEndpoints", () => {
  it("runs from edge to edge, not centre to centre", () => {
    const { start, end } = edgeEndpoints({ x: 0, y: 0, width: 100, height: 50 }, { x: 300, y: 0, width: 100, height: 50 });
    expect(start).toEqual({ x: 102, y: 25 });
    expect(end).toEqual({ x: 296, y: 25 });
  });
});

describe("idsInside", () => {
  it("counts a card when its centre is inside the area", () => {
    const area = { x: 0, y: 0, width: 200, height: 200 };
    const cards = [
      { id: "in", x: 150, y: 150, width: 80, height: 40 },
      { id: "out", x: 180, y: 180, width: 80, height: 80 },
    ];
    expect(idsInside(area, cards)).toEqual(["in"]);
  });
});

describe("stackColumn", () => {
  it("stacks cards in their vertical order and grows the group to fit", () => {
    const group = { x: 10, y: 20, width: 100, height: 100 };
    const { positions, width, height } = stackColumn(group, [
      { id: "b", x: 50, y: 300, width: 200, height: 60 },
      { id: "a", x: 40, y: 100, width: 120, height: 40 },
    ]);
    expect(positions.get("a")).toEqual({ x: 10 + GROUP_PADDING, y: 20 + GROUP_HEADER });
    expect(positions.get("b")).toEqual({ x: 10 + GROUP_PADDING, y: 20 + GROUP_HEADER + 40 + 12 });
    expect(width).toBe(200 + GROUP_PADDING * 2);
    expect(height).toBe(GROUP_HEADER + 40 + 12 + 60 + GROUP_PADDING);
  });
});

describe("boundsOf", () => {
  it("returns null for nothing and the enclosing box otherwise", () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { x: 0, y: 10, width: 10, height: 10 },
        { x: -5, y: 0, width: 10, height: 5 },
      ])
    ).toEqual({ x: -5, y: 0, width: 15, height: 20 });
  });
});
