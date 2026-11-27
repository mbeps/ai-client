import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { mapConnectedEdges } from "@/components/workflows/canvas/workflow-canvas-helpers";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("mapConnectedEdges", () => {
  it("preserves existing edge IDs and assigns a UUID to newly connected edges", () => {
    const existingEdge: Edge = {
      id: "existing-edge-1",
      source: "node-1",
      target: "node-2",
      sourceHandle: "main",
      targetHandle: "main",
    };

    const result = mapConnectedEdges(
      {
        source: "node-2",
        target: "node-3",
        sourceHandle: "true",
        targetHandle: "main",
      },
      [existingEdge],
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("existing-edge-1");
    expect(result[1]?.id).toMatch(UUID_REGEX);
    expect(result[1]?.id).not.toMatch(/^xy-edge__/);
    expect(result[1]).toEqual(
      expect.objectContaining({
        sourceNodeId: "node-2",
        targetNodeId: "node-3",
        sourceHandle: "true",
        targetHandle: "main",
      }),
    );
  });
});
