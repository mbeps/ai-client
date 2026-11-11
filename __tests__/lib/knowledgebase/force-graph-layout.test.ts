import { describe, expect, it } from "vitest";
import {
  DOCUMENT_TYPE_COLORS,
  computeFitCamera,
  computeForceGraphLayout,
  findNodeAtPoint,
  screenToWorld,
  worldToScreen,
} from "@/lib/knowledgebase/force-graph-layout";
import type { KbGraphEdge, KbGraphNode } from "@/types/knowledgebase/kb-graph-data";

describe("force-graph-layout", () => {
  const sampleDocs: KbGraphNode[] = [
    {
      id: "doc-1",
      name: "Architecture.md",
      documentType: "technical_spec",
      summary: "System architecture",
      keyEntities: ["System"],
      chunkCount: 10,
      tokenCount: 2500,
    },
    {
      id: "doc-2",
      name: "Security.pdf",
      documentType: "policy",
      summary: "Security guidelines",
      keyEntities: ["Auth"],
      chunkCount: 5,
      tokenCount: 1200,
    },
    {
      id: "doc-3",
      name: "Guide.txt",
      documentType: "unknown_custom_type",
      summary: "Guide",
      keyEntities: [],
      chunkCount: 2,
      tokenCount: 400,
    },
  ];

  const sampleRelations: KbGraphEdge[] = [
    {
      id: "rel-1",
      sourceDocId: "doc-1",
      targetDocId: "doc-2",
      relationType: "references",
      reason: "references security",
    },
    {
      id: "rel-self",
      sourceDocId: "doc-1",
      targetDocId: "doc-1",
      relationType: "references",
      reason: "self-loop to discard",
    },
    {
      id: "rel-dangling",
      sourceDocId: "doc-1",
      targetDocId: "missing-doc",
      relationType: "references",
      reason: "dangling edge to discard",
    },
  ];

  it("returns empty result when documents array is empty", () => {
    const layout = computeForceGraphLayout([], []);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.adjacency.size).toBe(0);
  });

  it("positions a single document at center (0, 0)", () => {
    const layout = computeForceGraphLayout([sampleDocs[0]], []);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].x).toBe(0);
    expect(layout.nodes[0].y).toBe(0);
    expect(layout.nodes[0].degree).toBe(0);
    expect(layout.nodes[0].color).toBe(DOCUMENT_TYPE_COLORS.technical_spec);

    const customLayout = computeForceGraphLayout([sampleDocs[2]], []);
    expect(customLayout.nodes[0].color).toBe(DOCUMENT_TYPE_COLORS.general);
  });

  it("filters self-loops and dangling edges while computing degree and adjacency", () => {
    const layout = computeForceGraphLayout(sampleDocs, sampleRelations, {
      iterations: 20,
    });

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0].id).toBe("rel-1");

    const node1 = layout.nodes.find((n) => n.id === "doc-1");
    const node2 = layout.nodes.find((n) => n.id === "doc-2");
    const node3 = layout.nodes.find((n) => n.id === "doc-3");

    expect(node1?.degree).toBe(1);
    expect(node2?.degree).toBe(1);
    expect(node3?.degree).toBe(0);

    expect(layout.adjacency.get("doc-1")?.has("doc-2")).toBe(true);
    expect(layout.adjacency.get("doc-2")?.has("doc-1")).toBe(true);
    expect(layout.adjacency.get("doc-3")?.size).toBe(0);

    // Fallback color for unknown documentType
    expect(node3?.color).toBe(DOCUMENT_TYPE_COLORS.general);
  });

  it("scales node radius smoothly based on connection degree", () => {
    const layout = computeForceGraphLayout(sampleDocs, sampleRelations, {
      iterations: 10,
    });
    const hub = layout.nodes.find((n) => n.id === "doc-1");
    const isolated = layout.nodes.find((n) => n.id === "doc-3");

    expect(hub && isolated).toBeTruthy();
    if (hub && isolated) {
      expect(hub.radius).toBeGreaterThan(isolated.radius);
    }
  });

  it("converts coordinates between world and screen spaces accurately", () => {
    const camera = { x: 100, y: -50, scale: 2 };
    const width = 800;
    const height = 600;

    const screenPos = worldToScreen(10, 20, camera, width, height);
    const worldPos = screenToWorld(
      screenPos.x,
      screenPos.y,
      camera,
      width,
      height,
    );

    expect(worldPos.x).toBeCloseTo(10, 4);
    expect(worldPos.y).toBeCloseTo(20, 4);
  });

  it("finds the topmost node under a world coordinate point", () => {
    const nodes = [
      { ...sampleDocs[0], x: 0, y: 0, radius: 10, degree: 1, color: "#fff" },
      { ...sampleDocs[1], x: 100, y: 100, radius: 12, degree: 1, color: "#fff" },
    ];

    expect(findNodeAtPoint(nodes, 2, -3)?.id).toBe("doc-1");
    expect(findNodeAtPoint(nodes, 98, 102)?.id).toBe("doc-2");
    expect(findNodeAtPoint(nodes, 50, 50)).toBeNull();
  });

  it("computes fit camera containing all nodes with padding", () => {
    const nodes = [
      { ...sampleDocs[0], x: -100, y: -50, radius: 10, degree: 1, color: "#fff" },
      { ...sampleDocs[1], x: 100, y: 50, radius: 10, degree: 1, color: "#fff" },
    ];

    const camera = computeFitCamera(nodes, 800, 600);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.scale).toBeGreaterThan(0);
    expect(camera.scale).toBeLessThanOrEqual(1.5);
  });

  it("handles fit camera when node list is empty", () => {
    const camera = computeFitCamera([], 800, 600);
    expect(camera).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("separates multiple nodes with non-zero distances across iterations", () => {
    const layout = computeForceGraphLayout(sampleDocs, sampleRelations, {
      iterations: 30,
    });
    const [n1, n2, n3] = layout.nodes;
    const dist12 = Math.hypot(n1.x - n2.x, n1.y - n2.y);
    const dist23 = Math.hypot(n2.x - n3.x, n2.y - n3.y);

    expect(dist12).toBeGreaterThan(20);
    expect(dist23).toBeGreaterThan(20);
  });

  it("uses default iterations when options is omitted, adapting for >150 nodes", () => {
    const layoutDefault = computeForceGraphLayout(sampleDocs, sampleRelations);
    expect(layoutDefault.nodes).toHaveLength(3);

    const manyDocs: KbGraphNode[] = Array.from({ length: 155 }, (_, i) => ({
      id: `doc-${i}`,
      name: `Doc ${i}.md`,
      documentType: "general",
      summary: "",
      keyEntities: [],
      chunkCount: 1,
      tokenCount: 100,
    }));

    const layoutMany = computeForceGraphLayout(manyDocs, []);
    expect(layoutMany.nodes).toHaveLength(155);
  });
});
