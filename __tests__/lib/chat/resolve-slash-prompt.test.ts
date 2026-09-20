import { describe, expect, it } from "vitest";
import { PROMPTS } from "@/constants/prompts";
import { resolveSlashPrompt } from "@/lib/chat/resolve-slash-prompt";

describe("resolveSlashPrompt", () => {
  const samplePrompts = [
    { id: "p-1", name: "Summarise", content: "Summarise this text" },
  ];

  it("prepends prompt content and separator when prompt found", () => {
    const result = resolveSlashPrompt("p-1", "My text", samplePrompts);
    expect(result.fullContent).toBe(
      "Summarise this text" + PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR + "My text",
    );
    expect(result.metadata).toEqual({
      promptId: "p-1",
      userContent: "My text",
    });
  });

  it("returns original userContent when prompt not found", () => {
    const result = resolveSlashPrompt("missing", "My text", samplePrompts);
    expect(result.fullContent).toBe("My text");
    expect(result.metadata).toEqual({
      promptId: "missing",
      userContent: "My text",
    });
  });
});
