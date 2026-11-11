"use client";

import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  computeFitCamera,
  findNodeAtPoint,
  type GraphCamera,
  type PositionedGraphNode,
  screenToWorld,
  worldToScreen,
} from "@/lib/knowledgebase/force-graph-layout";
import type { KbGraphEdge } from "@/types/knowledgebase/kb-graph-data";

/**
 * Props for {@link KbForceGraph}.
 */
export interface KbForceGraphProps {
  /** Array of simulation-positioned document nodes */
  nodes: PositionedGraphNode[];
  /** Array of semantic relationship edges between nodes */
  edges: KbGraphEdge[];
  /** Adjacency lookup mapping docId to Set of neighbor docIds */
  adjacency: Map<string, Set<string>>;
  /** ID of the currently selected document node, or null */
  selectedDocId: string | null;
  /** Callback fired when a document node is clicked or selection changes */
  onSelectDocId: (docId: string | null) => void;
  /**
   * Node ID to focus and center the camera on (e.g. from search selection).
   * Changes trigger smooth camera repositioning to the target node.
   */
  focusedNodeId?: string | null;
  /** Additional CSS class names for the container */
  className?: string;
}

/**
 * Interactive HTML5 Canvas force-directed graph component inspired by Graphify.
 *
 * Renders document nodes as colored circles with radii scaled by degree, subtle directed/undirected
 * edges, 1-hop neighborhood highlighting on selection or hover, hub labels, interactive tooltips,
 * zoom-to-cursor, panning, and node dragging.
 *
 * @param props - {@link KbForceGraphProps}
 * @returns Responsive canvas graph element with floating zoom/fit controls
 * @author Maruf Bepary
 */
export function KbForceGraph({
  nodes,
  edges,
  adjacency,
  selectedDocId,
  onSelectDocId,
  focusedNodeId,
  className = "",
}: KbForceGraphProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Node position map for O(1) coordinate lookups during rendering
  const nodeMap = useMemo(() => {
    const map = new Map<string, PositionedGraphNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  // Camera viewport transform state
  const [camera, setCamera] = useState<GraphCamera>({ x: 0, y: 0, scale: 1 });
  const [hoveredNode, setHoveredNode] = useState<PositionedGraphNode | null>(
    null,
  );
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Mouse interaction state refs (to avoid excessive re-renders during drag/pan)
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<PositionedGraphNode | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraStartRef = useRef<GraphCamera>({ x: 0, y: 0, scale: 1 });
  const hasMovedRef = useRef(false);

  // Fit camera whenever nodes collection changes
  const handleFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const newCamera = computeFitCamera(nodes, rect.width, rect.height);
    setCamera(newCamera);
  }, [nodes]);

  useEffect(() => {
    handleFit();
  }, [handleFit]);

  // Center camera on focusedNodeId when signaled
  useEffect(() => {
    if (!focusedNodeId) return;
    const target = nodeMap.get(focusedNodeId);
    if (!target) return;
    setCamera({
      x: target.x,
      y: target.y,
      scale: 1.3,
    });
  }, [focusedNodeId, nodeMap]);

  // Zoom helpers
  const handleZoomIn = useCallback(() => {
    setCamera((prev: GraphCamera) => ({
      ...prev,
      scale: Math.min(4, prev.scale * 1.25),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCamera((prev: GraphCamera) => ({
      ...prev,
      scale: Math.max(0.1, prev.scale * 0.8),
    }));
  }, []);

  const handleReset = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
  }, []);

  // Compute active highlight set (selected node + 1-hop neighbors, or hovered node + neighbors)
  const activeDocId = hoveredNode?.id ?? selectedDocId;
  const highlightSet = useMemo(() => {
    if (!activeDocId) return null;
    const set = new Set<string>();
    set.add(activeDocId);
    const neighbors = adjacency.get(activeDocId);
    if (neighbors) {
      for (const n of neighbors) {
        set.add(n);
      }
    }
    return set;
  }, [activeDocId, adjacency]);

  // Redraw canvas on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    // Canvas background
    ctx.fillStyle = isDark ? "#09090b" : "#fafafa";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Save context state for camera transform
    ctx.save();
    ctx.translate(rect.width / 2, rect.height / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);

    // 1. Draw Edges
    for (const edge of edges) {
      const u = nodeMap.get(edge.sourceDocId);
      const v = nodeMap.get(edge.targetDocId);
      if (!u || !v) continue;

      const isConnectedToActive =
        highlightSet &&
        (highlightSet.has(u.id) || highlightSet.has(v.id)) &&
        (u.id === activeDocId || v.id === activeDocId);

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);

      if (highlightSet) {
        if (isConnectedToActive) {
          ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
          ctx.lineWidth = 1.8 / camera.scale;
          ctx.globalAlpha = 0.9;
        } else {
          ctx.strokeStyle = isDark ? "#27272a" : "#e4e4e7";
          ctx.lineWidth = 0.6 / camera.scale;
          ctx.globalAlpha = 0.15;
        }
      } else {
        ctx.strokeStyle = isDark ? "#3f3f46" : "#cbd5e1";
        ctx.lineWidth = 0.8 / camera.scale;
        ctx.globalAlpha = 0.55;
      }

      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 2. Draw Nodes
    for (const node of nodes) {
      const isSelected = node.id === selectedDocId;
      const isHovered = hoveredNode?.id === node.id;
      const isHighlighted = !highlightSet || highlightSet.has(node.id);

      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      if (isHighlighted) {
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.18;
      }
      ctx.fill();

      // Ring around selected or hovered node
      if (isSelected || isHovered) {
        ctx.strokeStyle = isDark ? "#ffffff" : "#09090b";
        ctx.lineWidth = 2.5 / camera.scale;
        ctx.globalAlpha = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = isDark ? "#18181b" : "#ffffff";
        ctx.lineWidth = 1 / camera.scale;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Draw Hub Labels (labels for high-degree nodes or selected node)
    ctx.font = `600 ${Math.max(9, Math.min(13, 11 / camera.scale))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (const node of nodes) {
      const isSelected = node.id === selectedDocId;
      const isHovered = hoveredNode?.id === node.id;
      const showLabel = isSelected || isHovered || node.degree >= 3;
      if (!showLabel) continue;

      const isDimmed = highlightSet && !highlightSet.has(node.id);
      ctx.fillStyle = isDimmed
        ? isDark
          ? "#52525b"
          : "#a1a1aa"
        : isDark
          ? "#f4f4f5"
          : "#18181b";
      ctx.globalAlpha = isDimmed ? 0.3 : 1;

      const displayName =
        node.name.length > 20 ? `${node.name.slice(0, 18)}…` : node.name;
      ctx.fillText(displayName, node.x, node.y + node.radius + 3);
    }

    ctx.restore();
  }, [
    camera,
    nodes,
    edges,
    nodeMap,
    isDark,
    selectedDocId,
    hoveredNode,
    highlightSet,
    activeDocId,
  ]);

  // Pointer / Mouse events for Pan, Zoom, Drag, Click
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(
      screenX,
      screenY,
      camera,
      rect.width,
      rect.height,
    );

    const hit = findNodeAtPoint(nodes, worldPoint.x, worldPoint.y);
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    cameraStartRef.current = { ...camera };

    if (hit) {
      draggedNodeRef.current = hit;
    } else {
      draggedNodeRef.current = null;
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 3) {
        hasMovedRef.current = true;
      }

      if (draggedNodeRef.current) {
        // Dragging a node in world space
        const worldPoint = screenToWorld(
          screenX,
          screenY,
          camera,
          rect.width,
          rect.height,
        );
        draggedNodeRef.current.x = worldPoint.x;
        draggedNodeRef.current.y = worldPoint.y;
        // Trigger re-render
        setCamera((prev: GraphCamera) => ({ ...prev }));
      } else {
        // Panning the camera
        setCamera({
          scale: cameraStartRef.current.scale,
          x: cameraStartRef.current.x - dx / cameraStartRef.current.scale,
          y: cameraStartRef.current.y - dy / cameraStartRef.current.scale,
        });
      }
      return;
    }

    // Hover hit test
    const worldPoint = screenToWorld(
      screenX,
      screenY,
      camera,
      rect.width,
      rect.height,
    );
    const hit = findNodeAtPoint(nodes, worldPoint.x, worldPoint.y);
    if (hit) {
      setHoveredNode(hit);
      const scr = worldToScreen(hit.x, hit.y, camera, rect.width, rect.height);
      setTooltipPos({ x: scr.x, y: scr.y });
    } else {
      setHoveredNode(null);
      setTooltipPos(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasMovedRef.current) {
      // It was a click!
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPoint = screenToWorld(
          screenX,
          screenY,
          camera,
          rect.width,
          rect.height,
        );
        const hit = findNodeAtPoint(nodes, worldPoint.x, worldPoint.y);
        onSelectDocId(hit ? hit.id : null);
      }
    }

    isDraggingRef.current = false;
    draggedNodeRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if capture wasn't held
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setCamera((prev: GraphCamera) => ({
      ...prev,
      scale: Math.min(4, Math.max(0.1, prev.scale * zoomFactor)),
    }));
  };

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        data-testid="kb-force-graph-canvas"
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Zoom and Reset Controls */}
      <div className="border-border/60 bg-background/90 absolute right-4 bottom-4 flex flex-col gap-1 rounded-md border p-1 shadow-md backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Zoom in"
          onClick={handleZoomIn}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Zoom out"
          onClick={handleZoomOut}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Fit graph to view"
          onClick={handleFit}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Reset zoom and position"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Hover Tooltip */}
      {hoveredNode && tooltipPos && (
        <div
          data-testid="kb-graph-tooltip"
          className="border-border bg-popover/95 text-popover-foreground pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 12}px`,
          }}
        >
          <div className="text-foreground font-semibold">
            {hoveredNode.name}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {hoveredNode.documentType} • {hoveredNode.degree}{" "}
            {hoveredNode.degree === 1 ? "relation" : "relations"}
          </div>
        </div>
      )}
    </div>
  );
}
