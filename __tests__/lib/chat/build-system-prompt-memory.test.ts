import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";

describe("buildSystemPrompt Memory Integration", () => {
  it("injects user memories section into system prompt when provided", () => {
    const prompt = buildSystemPrompt(null, null, null, false, {
      userMemories: [
        "User prefers TypeScript over JavaScript",
        "Keep responses concise and direct",
      ],
    });

    expect(prompt).toContain("## User Memory");
    expect(prompt).toContain("- User prefers TypeScript over JavaScript");
    expect(prompt).toContain("- Keep responses concise and direct");
  });

  it("omits memory section when userMemories is empty or undefined", () => {
    const promptEmpty = buildSystemPrompt(null, null, null, false, {
      userMemories: [],
    });
    expect(promptEmpty).not.toContain("## User Memory");

    const promptUndefined = buildSystemPrompt(null, null, null, false, {});
    expect(promptUndefined).not.toContain("## User Memory");
  });
});

