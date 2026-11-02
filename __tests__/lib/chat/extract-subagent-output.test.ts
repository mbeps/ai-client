import { describe, expect, it } from "vitest";
import { extractSubagentOutputText } from "@/lib/chat/extract-subagent-output";

describe("extractSubagentOutputText", () => {
  it("returns raw string if result is already a string", () => {
    expect(extractSubagentOutputText("Analysis complete.")).toBe("Analysis complete.");
  });

  it("returns empty string when result is null or not an object", () => {
    expect(extractSubagentOutputText(null)).toBe("");
    expect(extractSubagentOutputText(undefined)).toBe("");
    expect(extractSubagentOutputText(123)).toBe("");
  });

  it("extracts text from parts array when available", () => {
    const result = {
      parts: [
        { type: "text", text: "Part 1 summary" },
        { type: "image", data: "..." },
        { type: "text", text: "Part 2 conclusion" },
      ],
    };
    expect(extractSubagentOutputText(result)).toBe("Part 1 summary\n\nPart 2 conclusion");
  });

  it("falls back to summary, value, or text property when parts is absent or has no text", () => {
    expect(extractSubagentOutputText({ summary: "Summary text" })).toBe("Summary text");
    expect(extractSubagentOutputText({ value: "Value text" })).toBe("Value text");
    expect(extractSubagentOutputText({ text: "Text content" })).toBe("Text content");
    expect(extractSubagentOutputText({ parts: [{ type: "image" }] })).toBe("Task completed.");
  });

  it("falls back to 'Task completed.' when no recognizable text is present", () => {
    expect(extractSubagentOutputText({})).toBe("Task completed.");
    expect(extractSubagentOutputText({ count: 5 })).toBe("Task completed.");
  });
});

