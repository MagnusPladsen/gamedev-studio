import { describe, expect, it, vi } from "vitest";
import { flushAllAutosaves, registerAutosaveFlush } from "./autosave-registry";

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
