import { describe, expect, it } from "vitest";
import { extractCitations } from "@/lib/chat/extract-citations";
import type { ToolResult } from "@/types/chat/tool-result";

describe("extractCitations", () => {
  it("returns empty array when toolResults is empty", () => {
    expect(extractCitations([])).toEqual([]);
  });

  it("extracts citations from search_knowledge_base tool result object", () => {
    const results: ToolResult[] = [
      {
        toolName: "search_knowledge_base",
        result: {
          results: [
            { id: "1", title: "Doc 1", score: 0.9 },
            { id: "2", title: "Doc 2", score: 0.8 },
          ],
        },
      },
    ];

    const citations = extractCitations(results);
    expect(citations).toHaveLength(2);
    expect(citations[0]).toMatchObject({ id: "1", title: "Doc 1" });
  });

  it("extracts citations when result is a JSON string", () => {
    const results: ToolResult[] = [
      {
        toolName: "search_knowledge_base",
        result: JSON.stringify({
          results: [{ id: "3", title: "Doc 3", score: 0.95 }],
        }),
      },
    ];

    const citations = extractCitations(results);
    expect(citations).toHaveLength(1);
    expect(citations[0].id).toBe("3");
  });

  it("handles invalid JSON string gracefully", () => {
    const results: ToolResult[] = [
      {
        toolName: "search_knowledge_base",
        result: "not valid json",
      },
    ];

    expect(extractCitations(results)).toEqual([]);
  });

  it("ignores other tool names", () => {
    const results: ToolResult[] = [
      {
        toolName: "other_tool",
        result: { results: [{ id: "4" }] },
      },
    ];

    expect(extractCitations(results)).toEqual([]);
  });

  it("extracts citations from output property fallback and handles non-array results", () => {
    const results = [
      {
        toolName: "search_knowledge_base",
        output: { results: [{ id: "5", title: "Doc 5" }] },
      },
      {
        toolName: "search_knowledge_base",
        result: { results: "not-an-array" },
      },
      {
        toolName: "search_knowledge_base",
        result: null,
      },
    ] as any;

    const citations = extractCitations(results);
    expect(citations).toHaveLength(1);
    expect(citations[0].id).toBe("5");
  });
});
