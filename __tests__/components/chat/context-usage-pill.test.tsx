import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextUsagePill } from "@/components/chat/context-usage-pill";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { UserModelOption } from "@/hooks/use-user-models";

const mockModel: UserModelOption = {
  id: "openai/gpt-4o",
  modelId: "gpt-4o",
  label: "GPT-4o",
  providerName: "OpenAI",
  providerId: "openai",
  modelType: "chat",
  contextWindow: 128000,
  embeddingDimensions: null,
  capTools: true,
  capVision: true,
  capReasoning: false,
  capStructuredOutput: true,
  isEnabled: true,
  providerIsEnabled: true,
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

  it("factors selectedSkillTokens, availableSkillCount, and systemPrompt into token usage", () => {
    // 64,000 tokens of skills on a 128,000 model should equal 50%
    render(
      <TooltipProvider>
        <ContextUsagePill
          selectedModel={mockModel}
          systemPrompt="Custom instructions for assistant"
          selectedSkillTokens={64000}
          availableSkillCount={5}
        />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    // 64000 (skills) + 250 (catalog) + ~8 (prompt) = ~64258 / 128000 = 50%
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("renders near-limit and exceeded states", () => {
    const { rerender } = render(
      <TooltipProvider>
        <ContextUsagePill
          selectedModel={mockModel}
          selectedSkillTokens={110000}
          availableSkillCount={0}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button")).toBeDefined();

    rerender(
      <TooltipProvider>
        <ContextUsagePill
          selectedModel={mockModel}
          selectedSkillTokens={135000}
          availableSkillCount={0}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("renders popover with compact button states and zero-token breakdown", () => {
    const onCompact = vi.fn();
    const { rerender } = render(
      <TooltipProvider>
        <ContextUsagePill
          selectedModel={mockModel}
          selectedSkillTokens={0}
          availableSkillCount={0}
          onCompact={onCompact}
          canCompact={true}
          isCompacting={false}
        />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: /Compact/i })).not.toBeDisabled();

    rerender(
      <TooltipProvider>
        <ContextUsagePill
          selectedModel={mockModel}
          selectedSkillTokens={0}
          availableSkillCount={0}
          onCompact={onCompact}
          canCompact={false}
          isCompacting={true}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: /Compacting/i })).toBeDisabled();
  });

  it("renders 0.0% in breakdown when model contextWindow is 0", () => {
    render(
      <TooltipProvider>
        <ContextUsagePill
          selectedModel={{ ...mockModel, contextWindow: 0 }}
          input="Hello"
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getAllByText(/0\.0%/).length).toBeGreaterThan(0);

    const sessionTab = screen.queryByRole("tab", { name: /Session/i });
    if (sessionTab) {
      fireEvent.click(sessionTab);
      expect(screen.getAllByText(/0\.0%/).length).toBeGreaterThan(0);
    }
  });
});
