"use client";

import { Box, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { ExamplesBar } from "@/components/ExamplesBar";
import { LinkedAssets } from "@/components/LinkedAssets";
import type { VoxelModel } from "@/types";

interface Props {
  projectId: string;
  models: VoxelModel[];
  activeModelId: string | null;
  onOpen(model: VoxelModel): void;
  onDelete(model: VoxelModel): void;
  onNew(): void;
  onFromSprite(): void;
}

const iconButtonStyle: React.CSSProperties = { color: "var(--accent)" };

function ModelRow({ model, isActive, onOpen, onDelete }: { model: VoxelModel; isActive: boolean; onOpen(): void; onDelete(): void }): React.JSX.Element {
  return (
    <div
      className="group flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-[var(--bg-hover)]"
      style={{ background: isActive ? "var(--bg-hover)" : undefined, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
      onClick={onOpen}
    >
      {model.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={model.thumbnail} alt="" className="w-5 h-5 shrink-0" />
      ) : (
        <Box className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
      )}
      <span className="flex-1 truncate">{model.name}</span>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 max-md:opacity-100 shrink-0"
        style={{ color: "var(--red)" }}
        title={`Delete ${model.name}`}
        aria-label={`Delete ${model.name}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

/** The project's voxel models, ways to start one, examples and links for the open model. */
export function ModelList({ projectId, models, activeModelId, onOpen, onDelete, onNew, onFromSprite }: Props): React.JSX.Element {
  const savedModelId = models.some((model) => model.id === activeModelId) ? activeModelId : null;
  return (
    <div className="p-3 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Models</span>
          <div className="flex items-center gap-1">
            <button onClick={onFromSprite} className="p-1 rounded" style={iconButtonStyle} title="New model from a sprite" aria-label="New model from a sprite">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button onClick={onNew} className="p-1 rounded" style={iconButtonStyle} title="New model" aria-label="New model">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-0.5 max-md:max-h-48 max-md:overflow-y-auto">
          {models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              isActive={model.id === activeModelId}
              onOpen={() => onOpen(model)}
              onDelete={() => onDelete(model)}
            />
          ))}
          {models.length === 0 && (
            <p className="text-xs py-1" style={{ color: "var(--text-muted)" }}>No models yet. Start one and it saves itself.</p>
          )}
        </div>
        <ExamplesBar projectId={projectId} collections={["models"]} className="mt-3" />
      </div>
      {savedModelId && (
        <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <LinkedAssets projectId={projectId} type="model" id={savedModelId} layout="panel" />
        </div>
      )}
    </div>
  );
}
