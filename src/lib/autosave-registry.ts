type FlushHandler = () => void | Promise<void>;

const handlers = new Set<FlushHandler>();

/** Registers a function that writes any pending editor changes. Returns the unregister function. */
export function registerAutosaveFlush(flush: FlushHandler): () => void {
  handlers.add(flush);
  return () => {
    handlers.delete(flush);
  };
}

/** Writes every pending editor autosave and waits for async ones. Never rejects. */
export async function flushAllAutosaves(): Promise<void> {
  const pendingFlushes = [...handlers].map(async (flush) => flush());
  await Promise.allSettled(pendingFlushes);
}
