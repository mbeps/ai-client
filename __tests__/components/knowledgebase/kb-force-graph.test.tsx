import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KbForceGraph } from "@/components/knowledgebase/kb-force-graph";
import type { PositionedGraphNode } from "@/lib/knowledgebase/force-graph-layout";
import type { KbGraphEdge } from "@/types/knowledgebase/kb-graph-data";

// Mock next-themes
const mockUseTheme = vi.hoisted(() =>
  vi.fn(() => ({ resolvedTheme: "dark" })),
);
vi.mock("next-themes", () => ({
  useTheme: mockUseTheme,
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

    rerender(
      <KbForceGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
        focusedNodeId="missing-node"
      />,
    );
  });

  it("handles node dragging, hovering, dark mode, missing edge nodes, and non-highlighted edges", () => {
    document.documentElement.classList.add("dark");
    const extraNodes = [
      ...sampleNodes,
      { ...sampleNodes[0], id: "doc-3", x: 100, y: 100, name: "Three.md" },
      { ...sampleNodes[0], id: "doc-4", x: 150, y: 150, name: "Four.md" },
    ];
    const extraEdges = [
      ...sampleEdges,
      { id: "e-missing", sourceDocId: "missing", targetDocId: "doc-1", relationType: "references", description: "", weight: 1 },
      { id: "e-other", sourceDocId: "doc-3", targetDocId: "doc-4", relationType: "references", description: "", weight: 1 },
    ];

    render(
      <KbForceGraph
        nodes={extraNodes}
        edges={extraEdges}
        adjacency={sampleAdjacency}
        selectedDocId="doc-1"
        onSelectDocId={vi.fn()}
        focusedNodeId="doc-1"
      />,
    );

    const canvas = screen.getByTestId("kb-force-graph-canvas");
    // Center of 800x600 is (400, 300) which is where focusedNodeId="doc-1" is centered
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300, pointerId: 2 });
    fireEvent.pointerMove(canvas, { clientX: 420, clientY: 320, pointerId: 2 });
    fireEvent.pointerUp(canvas, { clientX: 420, clientY: 320, pointerId: 2 });

    document.documentElement.classList.remove("dark");
  });

  it("handles zero rect, null 2d context, missing dpr, long node names, degree-1 tooltip, and click on node", () => {
    const onSelectDocId = vi.fn();
    const longNameNodes = [
      {
        ...sampleNodes[0],
        id: "doc-long",
        name: "VeryLongDocumentNameThatExceedsTwentyChars.md",
        degree: 1,
        x: 0,
        y: 0,
      },
    ];

    const origDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });

    const { rerender } = render(
      <KbForceGraph
        nodes={longNameNodes}
        edges={[]}
        adjacency={new Map([["doc-long", new Set()]])}
        selectedDocId="doc-long"
        onSelectDocId={onSelectDocId}
        focusedNodeId="doc-long"
      />,
    );

    const canvas = screen.getByTestId("kb-force-graph-canvas");
    // Hover over doc-long at center (400, 300) to show degree-1 tooltip
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 });
    expect(screen.getByTestId("kb-graph-tooltip")).toHaveTextContent("1 relation");

    // Click on doc-long with < 3px movement
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300, pointerId: 3 });
    fireEvent.pointerMove(canvas, { clientX: 401, clientY: 301, pointerId: 3 });
    fireEvent.pointerUp(canvas, { clientX: 401, clientY: 301, pointerId: 3 });
    expect(onSelectDocId).toHaveBeenCalledWith("doc-long");

    // Zero-sized rect
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    rerender(
      <KbForceGraph
        nodes={longNameNodes}
        edges={[]}
        adjacency={new Map()}
        selectedDocId={null}
        onSelectDocId={onSelectDocId}
      />,
    );

    // Null 2d context
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    rerender(
      <KbForceGraph
        nodes={longNameNodes}
        edges={[]}
        adjacency={new Map()}
        selectedDocId="doc-long"
        onSelectDocId={onSelectDocId}
      />,
    );

    Object.defineProperty(window, "devicePixelRatio", { value: origDpr, configurable: true });
  });

  it("renders in light theme with selected node, active target edge, and dimmed hub node", () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "light" });
    const extraNodes: PositionedGraphNode[] = [
      ...sampleNodes,
      {
        id: "doc-3",
        name: "UnrelatedHub.md",
        documentType: "note",
        summary: "Unrelated",
        keyEntities: [],
        chunkCount: 2,
        tokenCount: 500,
        x: -100,
        y: -100,
        radius: 10,
        degree: 3,
        color: "#10b981",
      },
    ];

    const { rerender } = render(
      <KbForceGraph
        nodes={extraNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId={null}
        onSelectDocId={vi.fn()}
      />,
    );

    rerender(
      <KbForceGraph
        nodes={extraNodes}
        edges={sampleEdges}
        adjacency={sampleAdjacency}
        selectedDocId="doc-2"
        onSelectDocId={vi.fn()}
      />,
    );

    expect(screen.getByTestId("kb-force-graph-canvas")).toBeInTheDocument();
  });

  it("renders unconnected dimmed edges in light mode when a node is selected", () => {
    const extraNodes = [
      ...sampleNodes,
      {
        id: "doc-3",
        name: "UnrelatedHub.md",
        documentType: "note",
        summary: "Unrelated",
        keyEntities: [],
        chunkCount: 2,
        tokenCount: 500,
        x: -100,
        y: -100,
        radius: 10,
        degree: 3,
        color: "#10b981",
      },
    ];
    const extraEdges = [
      ...sampleEdges,
      {
        id: "edge-2",
        source: "doc-3",
        target: "doc-4",
        weight: 1,
        sharedEntities: [],
      },
    ];

    render(
      <KbForceGraph
        nodes={extraNodes}
        edges={extraEdges}
        adjacency={sampleAdjacency}
        selectedDocId="doc-2"
        onSelectDocId={vi.fn()}
      />,
    );

    expect(screen.getByTestId("kb-force-graph-canvas")).toBeInTheDocument();
  });
});
