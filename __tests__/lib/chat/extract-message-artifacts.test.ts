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
});
