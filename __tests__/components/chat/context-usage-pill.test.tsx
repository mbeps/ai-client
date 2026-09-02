import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextUsagePill } from "@/components/chat/context-usage-pill";
import type { ModelRegistryItem } from "@/types/models";

const mockModel: ModelRegistryItem = {
  id: "openai/gpt-4o",
  name: "GPT-4o",
  provider: "openai",
  contextWindow: 128000,
  maxOutputTokens: 4096,
  inputPricePerMillion: 2.5,
  outputPricePerMillion: 10,
  supportsVision: true,
  supportsTools: true,
  supportsStructuredOutputs: true,
  supportsJsonMode: true,
};

describe("ContextUsagePill", () => {
  it("renders trigger button with formatted percentage", () => {
    render(<ContextUsagePill selectedModel={mockModel} input="Hello world" />);

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(screen.getByText(/%/)).toBeDefined();
  });
});
