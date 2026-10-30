import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cacheKey,
  PROJECT_COLLECTIONS,
  parseCacheKey,
  type ChangeEvent,
  type Persister,
  type Snapshot,
} from "../storage";

type Row = { id: string; project_id?: string; collection?: string; data: Record<string, unknown> };
type Op =
  | { kind: "upsertProject"; id: string; data: Record<string, unknown> }
  | { kind: "deleteProject"; id: string }
  | { kind: "upsertAsset"; id: string; projectId: string; collection: string; data: Record<string, unknown> }
  | { kind: "deleteAsset"; id: string };

const PAGE = 500;

async function selectAll(supabase: SupabaseClient, table: "projects" | "assets"): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(table === "projects" ? "id, data" : "id, project_id, collection, data")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadCloudSnapshot(supabase: SupabaseClient): Promise<Snapshot> {
  const [projects, assets] = await Promise.all([selectAll(supabase, "projects"), selectAll(supabase, "assets")]);
  const snap: Snapshot = new Map();
  snap.set(cacheKey("projects"), projects.map((r) => ({ ...r.data, id: r.id })));
  for (const a of assets) {
    if (!a.project_id || !(PROJECT_COLLECTIONS as string[]).includes(a.collection ?? "")) continue;
    const key = cacheKey(a.collection as (typeof PROJECT_COLLECTIONS)[number], a.project_id);
    const list = snap.get(key) ?? [];
    list.push({ ...a.data, id: a.id });
    snap.set(key, list);
  }
  return snap;
}

/** Upload a whole snapshot (used once when a guest signs in with local data). */
export async function uploadSnapshot(supabase: SupabaseClient, userId: string, snap: Snapshot): Promise<void> {
  const projects = (snap.get(cacheKey("projects")) ?? []).map((p) => projectRow(userId, p));
  const known = new Set(projects.map((p) => p.id));
  const assets: ReturnType<typeof assetRow>[] = [];
  for (const [key, items] of snap) {
    const parsed = parseCacheKey(key);
    if (!parsed?.projectId || !known.has(parsed.projectId)) continue;
    for (const item of items) assets.push(assetRow(userId, item, parsed.projectId, parsed.collection));
  }
  for (let i = 0; i < projects.length; i += PAGE) {
    const { error } = await supabase.from("projects").upsert(projects.slice(i, i + PAGE), { onConflict: "user_id,id" });
    if (error) throw error;
  }
  for (let i = 0; i < assets.length; i += 100) {
    const { error } = await supabase.from("assets").upsert(assets.slice(i, i + 100), { onConflict: "user_id,id" });
    if (error) throw error;
  }
}

function projectRow(userId: string, item: { id: string; [k: string]: unknown }) {
  return {
    user_id: userId,
    id: item.id,
    name: String(item.name ?? ""),
    data: item,
    updated_at: new Date().toISOString(),
  };
}

function assetRow(userId: string, item: { id: string }, projectId: string, collection: string) {
  return { user_id: userId, id: item.id, project_id: projectId, collection, data: item, updated_at: new Date().toISOString() };
}

export type SyncStatus = { state: "idle" | "saving" | "saved" | "error"; message?: string };

/**
 * Mirrors cache changes to Supabase. Writes are coalesced per item (rapid edits become one
 * request), flushed in order — projects before assets, so foreign keys hold — and retried.
 */
export function createCloudPersister(
  supabase: SupabaseClient,
  userId: string,
  onStatus: (s: SyncStatus) => void
): Persister & { flush(): Promise<void> } {
  const pending = new Map<string, Op>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let failures = 0;

  const schedule = (delay = 700) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
  };

  async function run(ops: Op[]) {
    const order = { upsertProject: 0, upsertAsset: 1, deleteAsset: 2, deleteProject: 3 } as const;
    ops.sort((a, b) => order[a.kind] - order[b.kind]);

    const projectUpserts = ops.filter((o) => o.kind === "upsertProject").map((o) => projectRow(userId, { ...o.data, id: o.id }));
    if (projectUpserts.length) {
      const { error } = await supabase.from("projects").upsert(projectUpserts, { onConflict: "user_id,id" });
      if (error) throw error;
    }
    const assetUpserts = ops
      .filter((o): o is Extract<Op, { kind: "upsertAsset" }> => o.kind === "upsertAsset")
      .map((o) => assetRow(userId, { ...o.data, id: o.id }, o.projectId, o.collection));
    for (let i = 0; i < assetUpserts.length; i += 100) {
      const { error } = await supabase.from("assets").upsert(assetUpserts.slice(i, i + 100), { onConflict: "user_id,id" });
      if (error) throw error;
    }
    const assetDeletes = ops.filter((o) => o.kind === "deleteAsset").map((o) => o.id);
    if (assetDeletes.length) {
      const { error } = await supabase.from("assets").delete().eq("user_id", userId).in("id", assetDeletes);
      if (error) throw error;
    }
    const projectDeletes = ops.filter((o) => o.kind === "deleteProject").map((o) => o.id);
    if (projectDeletes.length) {
      const { error } = await supabase.from("projects").delete().eq("user_id", userId).in("id", projectDeletes);
      if (error) throw error;
    }
  }

  async function flush(): Promise<void> {
    if (running) {
      await running;
      if (pending.size) return flush();
      return;
    }
    if (!pending.size) return;
    const batch = new Map(pending);
    pending.clear();
    onStatus({ state: "saving" });
    running = run([...batch.values()])
      .then(() => {
        failures = 0;
        onStatus(pending.size ? { state: "saving" } : { state: "saved" });
      })
      .catch((err: { message?: string }) => {
        // put back anything that wasn't superseded meanwhile, then retry with backoff
        for (const [k, op] of batch) if (!pending.has(k)) pending.set(k, op);
        failures++;
        onStatus({ state: "error", message: err?.message ?? "Could not save to the cloud" });
        schedule(Math.min(30_000, 1000 * 2 ** failures));
      })
      .finally(() => {
        running = null;
      });
    await running;
    if (pending.size && failures === 0) schedule(0);
  }

  return {
    name: "cloud",
    flush,
    onChange(event: ChangeEvent) {
      if (event.op === "deleteProject") {
        for (const [k, op] of pending) if ("projectId" in op && op.projectId === event.projectId) pending.delete(k);
        pending.delete(`p:${event.projectId}`);
        pending.set(`p:${event.projectId}`, { kind: "deleteProject", id: event.projectId });
      } else if (event.collection === "projects") {
        pending.set(
          `p:${event.op === "put" ? event.item.id : event.id}`,
          event.op === "put"
            ? { kind: "upsertProject", id: event.item.id, data: event.item as Record<string, unknown> }
            : { kind: "deleteProject", id: event.id }
        );
      } else if (event.op === "put" && event.projectId) {
        pending.set(`a:${event.item.id}`, {
          kind: "upsertAsset",
          id: event.item.id,
          projectId: event.projectId,
          collection: event.collection,
          data: event.item as Record<string, unknown>,
        });
      } else if (event.op === "delete") {
        pending.set(`a:${event.id}`, { kind: "deleteAsset", id: event.id });
      }
      schedule(event.op === "put" && event.collection !== "projects" ? 700 : 0);
    },
  };
}
