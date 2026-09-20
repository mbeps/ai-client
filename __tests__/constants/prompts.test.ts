import { describe, expect, it } from "vitest";
import { PROMPTS } from "@/constants/prompts";

describe("constants/prompts", () => {
  it("defines system, tools, schema, and UI constants", () => {
    expect(PROMPTS.SYSTEM.KNOWLEDGE_BASE_TOOL_INSTRUCTION).toContain("knowledge base");
    expect(PROMPTS.TOOLS.MANAGE_ARTIFACT.DEFAULT_TITLE).toBe("Generated Artifact");
    expect(PROMPTS.TOOLS.SEARCH_KNOWLEDGE_BASE.DESCRIPTION).toContain("semantic search");
    expect(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TYPE_DESCRIPTION).toContain("markdown");
    expect(PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR).toBe("\n\n");
    expect(PROMPTS.UI.EXAMPLES.ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_CREATE).toBeDefined();
  });

  it("WORKFLOWS.TRANSLATE generates prompt without image", () => {
    const prompt = PROMPTS.WORKFLOWS.TRANSLATE(
      "English",
      "Spanish",
      "Hello world",
      false,
    );
    expect(prompt).toContain("Translate the following text from English to Spanish.");
    expect(prompt).toContain("Hello world");
    expect(prompt).not.toContain("OCR:");
  });

  it("WORKFLOWS.TRANSLATE generates prompt with image", () => {
    const prompt = PROMPTS.WORKFLOWS.TRANSLATE(
      "English",
      "Spanish",
      "Sample text",
      true,
    );
    expect(prompt).toContain("OCR: Accurately identify and extract all text from the image.");
    expect(prompt).toContain("Translate: Translate the extracted text from English to Spanish.");
  });
});

