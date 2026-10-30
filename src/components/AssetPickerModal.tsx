"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { AssetRef, AssetType } from "@/types";
import { ASSET_KINDS, ASSET_TYPES, listAssets, type AssetSummary } from "@/lib/assets";

interface AssetPickerModalProps {
  projectId: string;
  title: string;
  /** Only these kinds are offered; every kind when left out. */
  types?: AssetType[];
  exclude: AssetRef[];
  createLabel?: string;
  onCreate?(): void;
  onPick(ref: AssetRef): void;
  onClose(): void;
}

function Thumb({ asset }: { asset: AssetSummary }): React.JSX.Element {
  if (asset.thumbnail) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.thumbnail} alt="" className="w-4 h-4 shrink-0" style={{ imageRendering: "pixelated" }} />;
  }
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ASSET_KINDS[asset.type].color }} />;
}

function findCandidates(projectId: string, types: AssetType[] | undefined, exclude: AssetRef[], query: string): AssetSummary[] {
  const excluded = new Set(exclude.map((ref) => `${ref.type}:${ref.id}`));
  const search = query.trim().toLowerCase();
  return listAssets(projectId).filter(
    (asset) =>
      (!types || types.includes(asset.type)) &&
      !excluded.has(`${asset.type}:${asset.id}`) &&
      (!search || asset.name.toLowerCase().includes(search)),
  );
}

function CandidateGroups({ candidates, onPick }: { candidates: AssetSummary[]; onPick(ref: AssetRef): void }): React.JSX.Element {
  return (
    <>
      {ASSET_TYPES.map((type) => {
        const group = candidates.filter((candidate) => candidate.type === type);
        if (!group.length) return null;
        return (
          <div key={type} className="mb-1">
            <div className="text-[10px] uppercase tracking-wide px-2 py-1" style={{ color: ASSET_KINDS[type].color }}>
              {ASSET_KINDS[type].label}
            </div>
            {group.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onPick({ type: candidate.type, id: candidate.id })}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left hover:bg-[var(--bg-hover)] max-md:py-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Thumb asset={candidate} />
                <span className="truncate">{candidate.name}</span>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

/** Searchable asset list in a modal, grouped by kind like the LinkedAssets picker. */
export function AssetPickerModal({
  projectId,
  title,
  types,
  exclude,
  createLabel,
  onCreate,
  onPick,
  onClose,
}: AssetPickerModalProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const candidates = findCandidates(projectId, types, exclude, query);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onClose();
        }}
        className="w-80 max-w-full max-h-[70vh] flex flex-col rounded-lg shadow-xl p-2"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="text-xs font-medium px-2 pt-1 pb-2" style={{ color: "var(--text-primary)" }}>
          {title}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 rounded" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
          <Search className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets in this project"
            aria-label="Search assets in this project"
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <div className="min-h-0 overflow-y-auto">
          {onCreate && createLabel && (
            <button
              type="button"
              onClick={onCreate}
              className="w-full flex items-center gap-2 px-2 py-1 mb-1 rounded text-xs text-left hover:bg-[var(--bg-hover)] max-md:py-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              {createLabel}
            </button>
          )}
          {candidates.length === 0 && (
            <p className="text-xs px-2 py-3 text-center" style={{ color: "var(--text-muted)" }}>
              Nothing to pick yet.
            </p>
          )}
          <CandidateGroups candidates={candidates} onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
