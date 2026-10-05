import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextUsagePill } from "@/components/chat/context-usage-pill";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    render(
      <TooltipProvider>
        <ContextUsagePill selectedModel={mockModel} input="Hello world" />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(screen.getByText(/%/)).toBeDefined();
    expect(button.getAttribute("title")).toBeNull();
    expect(button.getAttribute("aria-label")).toMatch(/Context Window:/);
  });
});
