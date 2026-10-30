import { describe, expect, it } from "vitest";
import {
  anchorPoint,
  contextMenuDecision,
  nextEnabledIndex,
  positionMenu,
  positionSubmenu,
  shouldUseNativeMenu,
} from "@/lib/menu-position";

const desk = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const menu = { width: 200, height: 300 };

describe("positionMenu", () => {
  it("opens right and down of the anchor", () => {
    expect(positionMenu({ x: 100, y: 100 }, menu, desk)).toEqual({ left: 100, top: 100, maxHeight: 884 });
  });
  it("flips left and up near the edges", () => {
    expect(positionMenu({ x: 1400, y: 100 }, menu, desk).left).toBe(1200);
    expect(positionMenu({ x: 100, y: 850 }, menu, desk).top).toBe(550);
  });
  it("clamps into the viewport", () => {
    expect(positionMenu({ x: 150, y: 100 }, { width: 240, height: 100 }, phone).left).toBe(8);
    expect(positionMenu({ x: 10, y: 10 }, { width: 200, height: 1000 }, desk)).toEqual({ left: 10, top: 8, maxHeight: 884 });
    expect(positionMenu({ x: 380, y: 800 }, { width: 220, height: 400 }, phone)).toMatchObject({ left: 160, top: 400 });
  });
});

describe("positionSubmenu", () => {
  it("overlaps the parent by 4px and flips when out of room", () => {
    expect(positionSubmenu({ left: 100, right: 300, top: 200 }, { width: 200, height: 150 }, desk)).toMatchObject({ left: 296, top: 200 });
    expect(positionSubmenu({ left: 1100, right: 1300, top: 200 }, { width: 200, height: 150 }, desk).left).toBe(904);
  });
});

describe("nextEnabledIndex", () => {
  it("wraps and skips disabled entries", () => {
    expect(nextEnabledIndex([false, true, false], 0, "ArrowDown")).toBe(2);
    expect(nextEnabledIndex([false, true, false], 2, "ArrowDown")).toBe(0);
    expect(nextEnabledIndex([false, true, false], 0, "ArrowUp")).toBe(2);
    expect(nextEnabledIndex([true, false, false, true], 2, "Home")).toBe(1);
    expect(nextEnabledIndex([true, false, false, true], 1, "End")).toBe(2);
  });
  it("returns -1 when nothing is enabled", () => {
    expect(nextEnabledIndex([true, true], 0, "ArrowDown")).toBe(-1);
  });
});

describe("anchorPoint", () => {
  it("anchors keyboard invocations at the element", () => {
    expect(anchorPoint({ clientX: 0, clientY: 0 }, { left: 40, bottom: 60 })).toEqual({ x: 40, y: 60 });
    expect(anchorPoint({ clientX: 5, clientY: 5, pointerType: "" }, { left: 40, bottom: 60 })).toEqual({ x: 40, y: 60 });
  });
  it("anchors pointer invocations at the pointer", () => {
    expect(anchorPoint({ clientX: 300, clientY: 200, pointerType: "mouse" }, { left: 40, bottom: 60 })).toEqual({ x: 300, y: 200 });
  });
});

describe("native menu guards", () => {
  const fake = (match: boolean) => ({ closest: () => (match ? {} : null) });
  it("keeps the native menu for editable targets and selected text", () => {
    expect(shouldUseNativeMenu(fake(true), "")).toBe(true);
    expect(shouldUseNativeMenu(fake(false), "Pip")).toBe(true);
    expect(shouldUseNativeMenu(fake(false), "")).toBe(false);
    expect(shouldUseNativeMenu(null, "")).toBe(false);
  });
  it("decides who owns the contextmenu event", () => {
    expect(contextMenuDecision({ isNativeTarget: true, lastPointerType: "touch" })).toBe("native");
    expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: "touch" })).toBe("ignore");
    expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: "pen" })).toBe("ignore");
    expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: "mouse" })).toBe("open");
    expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: null })).toBe("open");
  });
});
