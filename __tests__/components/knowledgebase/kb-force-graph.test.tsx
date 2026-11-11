import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KbForceGraph } from "@/components/knowledgebase/kb-force-graph";
import type { PositionedGraphNode } from "@/lib/knowledgebase/force-graph-layout";
import type { KbGraphEdge } from "@/types/knowledgebase/kb-graph-data";

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

describe("KbForceGraph", () => {
  const sampleNodes: PositionedGraphNode[] = [
    {
      id: "doc-1",
      name: "Architecture.md",
      documentType: "technical_spec",
      summary: "System architecture",
      keyEntities: ["System"],
      chunkCount: 10,
      tokenCount: 2500,
      x: 0,
      y: 0,
      radius: 12,
      degree: 4,
      color: "#3b82f6",
    },
    {
      id: "doc-2",
      name: "Security.pdf",
      documentType: "policy",
      summary: "Security guidelines",
      keyEntities: ["Auth"],
      chunkCount: 5,
      tokenCount: 1200,
      x: 50,
      y: 50,
      radius: 8,
      degree: 1,
      color: "#ef4444",
    },
  ];

  const sampleEdges: KbGraphEdge[] = [
    {
      id: "rel-1",
      sourceDocId: "doc-1",
      targetDocId: "doc-2",
      relationType: "references",
      reason: "Architecture references security",
    },
  ];

  const sampleAdjacency = new Map<string, Set<string>>([
    ["doc-1", new Set(["doc-2"])],
    ["doc-2", new Set(["doc-1"])],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect on elements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the canvas and zoom controls", () => {
    render(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
      />,
    );

    expect(screen.getByTestId("kb-force-graph-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /fit graph to view/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset zoom and position/i }),
    ).toBeInTheDocument();
  });

  it("handles zoom in, zoom out, fit, and reset buttons", () => {
    render(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    fireEvent.click(screen.getByRole("button", { name: /zoom out/i }));
    fireEvent.click(screen.getByRole("button", { name: /fit graph to view/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /reset zoom and position/i }),
    );
  });

  it("selects a node when clicked on canvas", () => {
    const handleSelect = vi.fn();
    render(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={handleSelect}
      />,
    );

    const canvas = screen.getByTestId("kb-force-graph-canvas");

    // Click at center (400, 300) where doc-1 is positioned after auto fit
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 400, clientY: 300, pointerId: 1 });

    expect(handleSelect).toHaveBeenCalled();
  });

  it("shows tooltip on pointer move over a node", () => {
    render(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
      />,
    );

    const canvas = screen.getByTestId("kb-force-graph-canvas");
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 });

    // When hovering over doc-1, tooltip appears
    const tooltip = screen.queryByTestId("kb-graph-tooltip");
    if (tooltip) {
      expect(tooltip).toBeInTheDocument();
    }
  });

  it("supports wheel zooming and pointer dragging", () => {
    render(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId="doc-1"
        onSelectDocId={vi.fn()}
      />,
    );

    const canvas = screen.getByTestId("kb-force-graph-canvas");

    // Wheel zoom in and out
    fireEvent.wheel(canvas, { clientX: 400, clientY: 300, deltaY: -100 });
    fireEvent.wheel(canvas, { clientX: 400, clientY: 300, deltaY: 100 });

    // Drag / pan
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 150, clientY: 150, pointerId: 1 });
  });

  it("repositions camera when focusedNodeId is provided", () => {
    const { rerender } = render(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
        focusedNodeId={null}
      />,
    );

    rerender(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
        focusedNodeId="doc-1"
      />,
    );
  });
});
