import { describe, expect, it } from "vitest";
import { PROMPTS } from "@/config/prompts";
import {
  resolveSlashPrompt,
  resolveSlashPrompts,
} from "@/lib/chat/resolve-slash-prompt";

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

describe("resolveSlashPrompts", () => {
  const samplePrompts = [
    { id: "p-1", name: "Summarise", content: "Summarise this text" },
    { id: "p-2", name: "BulletPoints", content: "Format as bullet points" },
  ];

  it("returns original userContent when promptIds array is empty", () => {
    const result = resolveSlashPrompts([], "My text", samplePrompts);
    expect(result.fullContent).toBe("My text");
    expect(result.metadata).toEqual({
      promptIds: [],
      userContent: "My text",
    });
  });

  it("prepends multiple prompts in order with separators", () => {
    const result = resolveSlashPrompts(
      ["p-1", "p-2"],
      "My text",
      samplePrompts,
    );
    expect(result.fullContent).toBe(
      "Summarise this text" +
        PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
        "Format as bullet points" +
        PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
        "My text",
    );
    expect(result.metadata).toEqual({
      promptId: "p-1",
      promptIds: ["p-1", "p-2"],
      userContent: "My text",
    });
  });
});
