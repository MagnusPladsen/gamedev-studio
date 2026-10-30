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

export interface SaveTracker {
  run(save: () => void | Promise<void>): Promise<void>;
  whenIdle(): Promise<void>;
}

/** Runs saves one after another and lets callers wait for whatever is still in flight. */
export function createSaveTracker(): SaveTracker {
  let inFlight: Promise<void> | null = null;

  return {
    run(save) {
      const previous = inFlight ?? Promise.resolve();
      const current = previous.catch(() => undefined).then(save);
      inFlight = current;
      const clear = (): void => {
        if (inFlight === current) inFlight = null;
      };
      current.then(clear, clear);
      return current;
    },
    whenIdle() {
      return (inFlight ?? Promise.resolve()).catch(() => undefined);
    },
  };
}
