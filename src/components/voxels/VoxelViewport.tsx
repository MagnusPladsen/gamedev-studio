"use client";

import { useEffect, useRef } from "react";
import type { Vec3, VoxelGrid } from "@/lib/voxels/grid";
import type { RayHit } from "@/lib/voxels/raycast";
import { StrokeInput } from "./stroke-input";
import type { StrokeEvent, ViewPreset, VoxelTool } from "./types";
import { getPresetPose } from "./viewport-helpers";
import {
  applyCameraPose,
  applyControlScheme,
  createViewportScene,
  disposeViewportScene,
  pickGridHit,
  requestRender,
  resizeViewport,
  setGroundGrid,
  setPreviewCells,
  setVoxelMesh,
  snapshotViewportPng,
  type ViewportScene,
} from "./viewport-scene";

export interface VoxelViewportApi {
  snapshotPng(): string;
}

export interface VoxelViewportProps {
  grid: VoxelGrid;
  colors: string[];
  tool: VoxelTool;
  preview: Vec3[];
  oneFingerOrbit: boolean;
  view: { preset: ViewPreset; nonce: number };
  onStroke(event: StrokeEvent): void;
  onHover?(hit: RayHit | null): void;
  onReady?(api: VoxelViewportApi): void;
  onUnsupported?(): void;
}

function tryCreateViewport(canvas: HTMLCanvasElement): ViewportScene | null {
  try {
    return createViewportScene(canvas);
  } catch {
    return null;
  }
}

function connectViewport(viewport: ViewportScene, container: HTMLElement, input: StrokeInput): () => void {
  const handleChange = (): void => {
    requestRender(viewport);
    input.refreshHover();
  };
  viewport.controls.addEventListener("change", handleChange);
  const fitToContainer = (): void => {
    resizeViewport(viewport, container.clientWidth, container.clientHeight);
    requestRender(viewport);
  };
  fitToContainer();
  const observer = new ResizeObserver(fitToContainer);
  observer.observe(container);
  return () => {
    observer.disconnect();
    viewport.controls.removeEventListener("change", handleChange);
  };
}

export default function VoxelViewport(props: VoxelViewportProps): React.JSX.Element {
  const { grid, colors, tool, preview, oneFingerOrbit, view } = props;
  const [sizeX, sizeY, sizeZ] = grid.size;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<ViewportScene | null>(null);
  const inputRef = useRef<StrokeInput | null>(null);
  const latestProps = useRef(props);

  useEffect(() => {
    latestProps.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const viewport = tryCreateViewport(canvas);
    if (!viewport) {
      latestProps.current.onUnsupported?.();
      return;
    }
    const input = new StrokeInput({
      canvas,
      pick: (clientX, clientY) => pickGridHit(viewport, clientX, clientY, latestProps.current.grid),
      isOrbitPrimary: () => latestProps.current.oneFingerOrbit,
      onStroke: (event) => latestProps.current.onStroke(event),
      onHover: (hit) => latestProps.current.onHover?.(hit),
    });
    const disconnect = connectViewport(viewport, container, input);
    viewportRef.current = viewport;
    inputRef.current = input;
    latestProps.current.onReady?.({ snapshotPng: () => snapshotViewportPng(viewport) });
    return () => {
      viewportRef.current = null;
      inputRef.current = null;
      disconnect();
      input.detach();
      disposeViewportScene(viewport);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setVoxelMesh(viewport, grid, colors);
    inputRef.current?.refreshHover();
    requestRender(viewport);
  }, [grid, colors]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const size: Vec3 = [sizeX, sizeY, sizeZ];
    setGroundGrid(viewport, size);
    requestRender(viewport);
  }, [sizeX, sizeY, sizeZ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const size: Vec3 = [sizeX, sizeY, sizeZ];
    applyCameraPose(viewport, getPresetPose(view.preset, size), size);
    requestRender(viewport);
  }, [view.preset, view.nonce, sizeX, sizeY, sizeZ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPreviewCells(viewport, preview, [sizeX, sizeY, sizeZ], tool === "erase");
    requestRender(viewport);
  }, [preview, tool, sizeX, sizeY, sizeZ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    applyControlScheme(viewport.controls, oneFingerOrbit);
  }, [oneFingerOrbit]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`block h-full w-full ${oneFingerOrbit ? "cursor-grab" : "cursor-crosshair"}`}
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
