import { describe, expect, it } from "vitest";
import { extractThreadCanvasArtifacts } from "@/lib/chat/extract-canvas-artifacts";
import type { ThreadMessage } from "@/lib/chat/load-thread-from-db";

function makeMessage(
  id: string,
  role: "user" | "assistant",
  metadata: string | null = null,
): ThreadMessage {
  return {
    id,
    role,
    content: "hello",
    parentId: null,
    metadata,
    createdAt: new Date(),
  };
}

function makeArtifactMeta(
  id: string,
  title: string,
  type: "markdown" | "spreadsheet" | "html" | "mermaid",
  content: string,
): string {
  return JSON.stringify({
    toolCalls: [
      {
        toolCallId: `call_${id}`,
        toolName: "manage_artifact",
        args: { title, type, content: "original-args-content" },
      },
    ],
    toolResults: [
      {
        toolCallId: `call_${id}`,
        toolName: "manage_artifact",
        result: {
          success: true,
          artifact: { id, title, type, content },
        },
      },
    ],
  });
}

describe("extractThreadCanvasArtifacts", () => {
  it("returns empty array for empty thread or thread without artifacts", () => {
    expect(extractThreadCanvasArtifacts([])).toEqual([]);
    expect(
      extractThreadCanvasArtifacts([makeMessage("m1", "user")]),
    ).toEqual([]);
  });

  it("extracts canvas artifact with user-edited content from message metadata", () => {
    const meta = makeArtifactMeta(
      "art-1",
      "Out of Office",
      "markdown",
      "Dear Andy,\nI will be off...",
    );
    const thread = [
      makeMessage("m1", "user"),
      makeMessage("m2", "assistant", meta),
      makeMessage("m3", "user"),
    ];

    const artifacts = extractThreadCanvasArtifacts(thread);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      id: "art-1",
      title: "Out of Office",
      type: "markdown",
      content: "Dear Andy,\nI will be off...",
    });
  });

  it("preserves the latest version when multiple messages touch the same artifact ID", () => {
    const meta1 = makeArtifactMeta("art-1", "Doc", "markdown", "v1 content");
    const meta2 = makeArtifactMeta("art-1", "Doc", "markdown", "v2 content");
    const thread = [
      makeMessage("m1", "assistant", meta1),
      makeMessage("m2", "assistant", meta2),
    ];

    const artifacts = extractThreadCanvasArtifacts(thread);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe("v2 content");
  });

  it("limits to the most recent artifacts when thread has many distinct artifacts", () => {
    const thread = [
      makeMessage("m1", "assistant", makeArtifactMeta("art-1", "Doc 1", "markdown", "Content 1")),
      makeMessage("m2", "assistant", makeArtifactMeta("art-2", "Doc 2", "markdown", "Content 2")),
      makeMessage("m3", "assistant", makeArtifactMeta("art-3", "Doc 3", "markdown", "Content 3")),
    ];

    const artifacts = extractThreadCanvasArtifacts(thread, { maxArtifacts: 2 });
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((a) => a.id)).toEqual(["art-2", "art-3"]);
  });

  it("truncates oversized artifact content beyond maxContentLength", () => {
    const hugeContent = "A".repeat(25000);
    const meta = makeArtifactMeta("art-huge", "Huge Doc", "markdown", hugeContent);
    const thread = [makeMessage("m1", "assistant", meta)];

    const artifacts = extractThreadCanvasArtifacts(thread, { maxContentLength: 1000 });
    expect(artifacts[0].content.length).toBeLessThan(25000);
    expect(artifacts[0].content).toContain("[... Canvas content truncated for context window limits ...]");
  });
});
