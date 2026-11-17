import { describe, expect, it } from "vitest";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";

describe("sanitizeSubagentOutput", () => {
  it("strips <think>...</think> reasoning blocks from string and UIMessage outputs", () => {
    const raw =
      "<think>Internal reasoning about summary.</think>STATUS: DONE\n\nFinal summary for main agent.";
    expect(sanitizeSubagentOutput(raw)).toBe(
      "STATUS: DONE\n\nFinal summary for main agent.",
    );

    const uiMessage = {
      id: "run-1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "<think>Checking tools...</think>**STATUS: DONE**\n\nHere are the findings.",
        },
      ],
    };
    expect(sanitizeSubagentOutput(uiMessage)).toBe(
      "**STATUS: DONE**\n\nHere are the findings.",
    );
  });

  it("strips unclosed <think> blocks and other reasoning delimiters", () => {
    expect(sanitizeSubagentOutput("<think>Still thinking...")).toBe(
      "Subagent finished with no text output.",
    );
    expect(
      sanitizeSubagentOutput("[THINK]step 1[/THINK]STATUS: DONE\n\nResult."),
    ).toBe("STATUS: DONE\n\nResult.");
  });

  it("handles summary, value, text, multi-part UIMessages, and non-object outputs", () => {
    expect(sanitizeSubagentOutput(null)).toBe(
      "Subagent finished with no text output.",
    );
    expect(sanitizeSubagentOutput({ summary: "Summary output" })).toBe(
      "Summary output",
    );
    expect(sanitizeSubagentOutput({ value: "Value output" })).toBe(
      "Value output",
    );
    expect(sanitizeSubagentOutput({ text: "Text output" })).toBe("Text output");
    expect(
      sanitizeSubagentOutput({
        parts: [
          { type: "text", text: "First step." },
          { type: "text", text: "Second step." },
        ],
      }),
    ).toBe("First step.\n\nSecond step.");
    expect(
      sanitizeSubagentOutput({
        parts: [
          { type: "text", text: "Draft." },
          { type: "text", text: "STATUS: DONE\n\nFinal." },
        ],
      }),
    ).toBe("STATUS: DONE\n\nFinal.");
    expect(sanitizeSubagentOutput({ parts: [{ type: "image" }] })).toBe(
      "Subagent finished with no text output.",
    );
    expect(sanitizeSubagentOutput({ foo: 1 })).toBe(
      "Subagent finished with no text output.",
    );
  });

  it("truncates output exceeding maxChars", () => {
    const longText = "a".repeat(100);
    const result = sanitizeSubagentOutput(longText, 50);
    expect(result.startsWith("a".repeat(50))).toBe(true);
    expect(result).toContain("Output truncated to 8,000 characters");
  });
});
