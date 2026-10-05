import { describe, expect, it } from "vitest";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

describe("extractMessageArtifacts", () => {
  it("returns empty array for user messages even if metadata contains tools", () => {
    const userMsg: Message = {
      id: "u1",
      chatId: "c1",
      role: "user",
      content: "Can you create a document?",
      parentId: null,
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-1",
            result: {
              artifact: {
                id: "art-1",
                type: "markdown",
                title: "Doc 1",
                content: "# Hello",
              },
            },
          },
        ],
      }),
    };

    expect(extractMessageArtifacts(userMsg)).toEqual([]);
  });

  it("extracts artifacts from assistant message metadata toolResults", () => {
    const assistantMsg: Message = {
      id: "a1",
      chatId: "c1",
      role: "assistant",
      content: "I have created the document for you.",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date("2026-09-26T10:00:00Z"),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-1",
            result: {
              artifact: {
                id: "art-1",
                type: "markdown",
                title: "Canvas Absence Notification",
                content: "# Absence Notification",
              },
            },
          },
        ],
      }),
    };

    const artifacts = extractMessageArtifacts(assistantMsg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toEqual({
      id: "art-1",
      type: "markdown",
      title: "Canvas Absence Notification",
      content: "# Absence Notification",
      messageId: "a1",
    });
  });

  it("extracts completed artifacts from streaming activeToolCalls", () => {
    const streamingMsg: Message = {
      id: "streaming",
      chatId: "c1",
      role: "assistant",
      content: "Drafting template...",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    const activeToolCalls: ToolCallState[] = [
      {
        toolCallId: "tc-stream-1",
        toolName: "manage_artifact",
        state: "completed",
        args: { type: "spreadsheet", title: "Budget 2026" },
        result: {
          success: true,
          artifact: {
            id: "art-stream-1",
            type: "spreadsheet",
            title: "Budget 2026",
            content: '{"sheets":[]}',
          },
        },
      },
    ];

    const artifacts = extractMessageArtifacts(streamingMsg, activeToolCalls);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].title).toBe("Budget 2026");
    expect(artifacts[0].type).toBe("spreadsheet");
    expect(artifacts[0].messageId).toBe("streaming");
  });

  it("extracts mermaid codeblock artifacts when present in message content", () => {
    const msg: Message = {
      id: "a2",
      chatId: "c1",
      role: "assistant",
      content: "Here is your diagram:\n```mermaid\ngraph TD\nA --> B\n```",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].type).toBe("mermaid");
    expect(artifacts[0].title).toBe("Mermaid Diagram");
    expect(artifacts[0].content).toBe("graph TD\nA --> B");
  });

  it("deduplicates artifacts when identical artifact id or mermaid content is encountered", () => {
    const msg: Message = {
      id: "a3",
      chatId: "c1",
      role: "assistant",
      content: "```mermaid\ngraph TD\nA --> B\n```",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-dup",
            result: {
              artifact: {
                id: "art-dup",
                type: "mermaid",
                title: "Flowchart",
                content: "graph TD\nA --> B",
              },
            },
          },
        ],
      }),
    };

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe("art-dup");
  });

  it("skips non-manage_artifact entries and entries with no result", () => {
    const msg: Message = {
      id: "a4",
      chatId: "c1",
      role: "assistant",
      content: "Looking things up...",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    const activeToolCalls: ToolCallState[] = [
      {
        toolCallId: "tc-web-1",
        toolName: "search_web",
        status: "complete",
        args: {},
        result: { success: true },
      },
      {
        // Right tool name, but no result yet (still streaming).
        toolCallId: "tc-pending-1",
        toolName: "manage_artifact",
        status: "calling",
        args: {},
      },
    ];

    expect(extractMessageArtifacts(msg, activeToolCalls)).toEqual([]);
  });

  it("ignores a non-manage_artifact tool result in persisted metadata", () => {
    const msg: Message = {
      id: "a5",
      chatId: "c1",
      role: "assistant",
      content: "No artifact here.",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "search_web",
            toolCallId: "tc-web-2",
            result: { results: ["a", "b"] },
          },
        ],
      }),
    };

    expect(extractMessageArtifacts(msg)).toEqual([]);
  });

  it("ignores malformed persisted metadata instead of throwing", () => {
    const msg: Message = {
      id: "a6",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: "{not-valid-json",
    };

    expect(extractMessageArtifacts(msg)).toEqual([]);
  });

  it("ignores persisted metadata whose toolResults is not an array", () => {
    const msg: Message = {
      id: "a7",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({ toolResults: { manage_artifact: true } }),
    };

    expect(extractMessageArtifacts(msg)).toEqual([]);
  });

  it("uses an already-parsed metadata object without re-parsing it", () => {
    // Runtime guard: Message.metadata is declared `string | null`, but the
    // `typeof message.metadata === "string"` ternary has a live non-string arm.
    // Without it, JSON.parse would be handed an object and the whole block
    // would be swallowed by the catch, yielding [].
    const msg = {
      id: "a8",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: {
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-obj-1",
            result: {
              artifact: {
                id: "art-obj-1",
                type: "markdown",
                title: "From Object Metadata",
                content: "# Object",
              },
            },
          },
        ],
      },
    } as unknown as Message;

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe("art-obj-1");
  });

  it("deduplicates two persisted tool results that resolve to the same id", () => {
    const msg: Message = {
      id: "a9",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-1",
            result: {
              artifact: {
                id: "art-same",
                type: "markdown",
                title: "First",
                content: "# First",
              },
            },
          },
          {
            toolName: "manage_artifact",
            toolCallId: "tc-2",
            result: {
              artifact: {
                id: "art-same",
                type: "markdown",
                title: "Second",
                content: "# Second",
              },
            },
          },
        ],
      }),
    };

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].title).toBe("First");
  });

  it("synthesises an id from the toolCallId when the artifact has no usable id", () => {
    // extractArtifactFromToolResult falls back to `<toolCallId>-artifact` when
    // the artifact has no id, so the `art.id || ...` fallback never fires here.
    // The `continue` path does: a tool result that yields no artifact.
    const msg: Message = {
      id: "a10",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-1",
            result: { artifact: { type: "unsupported", content: "x" } },
          },
          {
            toolName: "manage_artifact",
            toolCallId: "tc-2",
            result: { artifact: { id: "", type: "markdown", content: "# Ok" } },
          },
        ],
      }),
    };

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe("tc-2-artifact");
    expect(artifacts[0].content).toBe("# Ok");
  });

  it("deduplicates an active tool call that repeats an already-persisted artifact id", () => {
    const msg: Message = {
      id: "a11",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-persisted",
            result: {
              artifact: {
                id: "art-dup-stream",
                type: "markdown",
                title: "Persisted",
                content: "# Persisted",
              },
            },
          },
        ],
      }),
    };

    const activeToolCalls: ToolCallState[] = [
      {
        toolCallId: "tc-stream",
        toolName: "manage_artifact",
        status: "complete",
        args: {},
        result: {
          success: true,
          artifact: {
            id: "art-dup-stream",
            type: "markdown",
            title: "Streamed",
            content: "# Streamed",
          },
        },
      },
    ];

    const artifacts = extractMessageArtifacts(msg, activeToolCalls);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].title).toBe("Persisted");
  });

  it("skips an active manage_artifact call whose result holds no artifact", () => {
    const msg: Message = {
      id: "a12",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    const activeToolCalls: ToolCallState[] = [
      {
        toolCallId: "tc-empty-1",
        toolName: "manage_artifact",
        status: "complete",
        args: {},
        result: { success: false, error: "nothing to write" },
      },
    ];

    expect(extractMessageArtifacts(msg, activeToolCalls)).toEqual([]);
  });

  it("numbers the title of the second and later mermaid code blocks", () => {
    const msg: Message = {
      id: "a13",
      chatId: "c1",
      role: "assistant",
      content:
        "First:\n```mermaid\ngraph TD\nA --> B\n```\n\nSecond:\n```mermaid\ngraph LR\nC --> D\n```\n\nThird:\n```mermaid\ngraph RL\nE --> F\n```",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts.map((a) => a.title)).toEqual([
      "Mermaid Diagram",
      "Mermaid Diagram 2",
      "Mermaid Diagram 3",
    ]);
    expect(artifacts.map((a) => a.id)).toEqual([
      "a13-mermaid-0",
      "a13-mermaid-1",
      "a13-mermaid-2",
    ]);
  });

  it("derives a persisted artifact id from its toolCallId when the id is blank", () => {
    // extractArtifactFromToolResult always returns a non-empty id (it falls back
    // to `<toolCallId>-artifact`, then `artifact-default`), so the downstream
    // `art.id || <messageId>-art-N` fallback in extractMessageArtifacts is dead.
    // This test pins the behaviour that actually runs.
    const msg: Message = {
      id: "a15",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: JSON.stringify({
        toolResults: [
          {
            toolName: "manage_artifact",
            toolCallId: "tc-blank",
            result: {
              artifact: { id: "   ", type: "markdown", content: "# Blank" },
            },
          },
        ],
      }),
    };

    const artifacts = extractMessageArtifacts(msg);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe("tc-blank-artifact");
    expect(artifacts[0].messageId).toBe("a15");
  });

  it("derives a streamed artifact id from its toolCallId when the id is blank", () => {
    const msg: Message = {
      id: "a16",
      chatId: "c1",
      role: "assistant",
      content: "",
      parentId: "u1",
      childrenIds: [],
      createdAt: new Date(),
      metadata: null,
    };

    const activeToolCalls: ToolCallState[] = [
      {
        toolCallId: "tc-blank-stream",
        toolName: "manage_artifact",
        status: "complete",
        args: {},
        result: {
          artifact: { id: "   ", type: "markdown", content: "# Blank Stream" },
        },
      },
    ];

    const artifacts = extractMessageArtifacts(msg, activeToolCalls);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe("tc-blank-stream-artifact");
    expect(artifacts[0].content).toBe("# Blank Stream");
  });
});
