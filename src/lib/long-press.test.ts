import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPress } from "@/lib/long-press";

describe("createLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once after 500 ms", () => {
    const onLongPress = vi.fn();
    const press = createLongPress(onLongPress);
    press.down({ x: 10, y: 10, pointerType: "touch" });
    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({ x: 10, y: 10 });
  });

  it("allows 8 px of movement but no more", () => {
    const onLongPress = vi.fn();
    const press = createLongPress(onLongPress);
    press.down({ x: 10, y: 10, pointerType: "touch" });
    press.move({ x: 18, y: 10 });
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    const onOther = vi.fn();
    const other = createLongPress(onOther);
    other.down({ x: 10, y: 10, pointerType: "touch" });
    other.move({ x: 16, y: 16 });
    vi.advanceTimersByTime(1000);
    expect(onOther).not.toHaveBeenCalled();
  });

  it("never fires when released early", () => {
    const onLongPress = vi.fn();
    const press = createLongPress(onLongPress);
    press.down({ x: 0, y: 0, pointerType: "pen" });
    vi.advanceTimersByTime(300);
    press.up();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("never fires for the mouse", () => {
    const onLongPress = vi.fn();
    const press = createLongPress(onLongPress);
    press.down({ x: 0, y: 0, pointerType: "mouse" });
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("suppresses exactly one click after firing", () => {
    const press = createLongPress(vi.fn());
    expect(press.consumeClick()).toBe(false);
    press.down({ x: 0, y: 0, pointerType: "touch" });
    vi.advanceTimersByTime(500);
    expect(press.consumeClick()).toBe(true);
    expect(press.consumeClick()).toBe(false);
  });

  it("cancel() clears the timer", () => {
    const onLongPress = vi.fn();
    const press = createLongPress(onLongPress);
    press.down({ x: 0, y: 0, pointerType: "touch" });
    press.cancel();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
