import { describe, expect, it, vi } from "vitest";
import { createSaveTracker, flushAllAutosaves, registerAutosaveFlush } from "./autosave-registry";

describe("autosave registry", () => {
  it("awaits every registered flush, slow ones included", async () => {
    const order: string[] = [];
    const offSlow = registerAutosaveFlush(
      () => new Promise<void>((resolve) => setTimeout(() => { order.push("slow"); resolve(); }, 20))
    );
    const offSync = registerAutosaveFlush(() => { order.push("sync"); });
    await flushAllAutosaves();
    expect(order).toEqual(["sync", "slow"]);
    offSlow();
    offSync();
  });

  it("does not call a flush after it is unregistered", async () => {
    const spy = vi.fn();
    const off = registerAutosaveFlush(spy);
    off();
    await flushAllAutosaves();
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps flushing the others when one rejects or throws", async () => {
    const other = vi.fn();
    const offRejecting = registerAutosaveFlush(() => Promise.reject(new Error("x")));
    const offThrowing = registerAutosaveFlush(() => { throw new Error("y"); });
    const offOther = registerAutosaveFlush(other);
    await expect(flushAllAutosaves()).resolves.toBeUndefined();
    expect(other).toHaveBeenCalled();
    offRejecting();
    offThrowing();
    offOther();
  });
});

describe("save tracker", () => {
  it("keeps whenIdle pending until the in-flight save resolves", async () => {
    const tracker = createSaveTracker();
    let finish: () => void = () => undefined;
    void tracker.run(() => new Promise<void>((resolve) => { finish = resolve; }));
    let idle = false;
    const waiting = tracker.whenIdle().then(() => { idle = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(idle).toBe(false);
    finish();
    await waiting;
    expect(idle).toBe(true);
  });

  it("runs a second save only after the first one finishes", async () => {
    const tracker = createSaveTracker();
    const order: string[] = [];
    void tracker.run(() => new Promise<void>((resolve) => setTimeout(() => { order.push("first"); resolve(); }, 20)));
    await tracker.run(() => { order.push("second"); });
    expect(order).toEqual(["first", "second"]);
  });

  it("still runs later saves after one fails", async () => {
    const tracker = createSaveTracker();
    const failed = tracker.run(() => Promise.reject(new Error("x")));
    const next = vi.fn();
    await tracker.run(next);
    await expect(failed).rejects.toThrow("x");
    expect(next).toHaveBeenCalled();
    await expect(tracker.whenIdle()).resolves.toBeUndefined();
  });
});
