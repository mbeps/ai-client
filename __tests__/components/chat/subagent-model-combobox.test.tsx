import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubagentModelCombobox } from "@/components/chat/subagent-model-combobox";

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: vi.fn(() => ({
    models: [
      {
        id: "m-1",
        modelId: "gpt-4o",
        label: "GPT-4o",
        providerName: "OpenAI",
      },
      {
        id: "m-2",
        modelId: "claude-3-5-sonnet",
        label: "Claude 3.5 Sonnet",
        providerName: "Anthropic",
      },
    ],
    isLoading: false,
  })),
}));

describe("SubagentModelCombobox", () => {
  it("renders trigger with default inherit label when value is undefined", () => {
    render(
      <SubagentModelCombobox
        value={undefined}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toBeDefined();
    expect(
      screen.getByText("Inherit Main Model (Default)"),
    ).toBeDefined();
  });

  it("renders selected model label when value matches an existing model", () => {
    render(
      <SubagentModelCombobox
        value="gpt-4o"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("GPT-4o")).toBeDefined();
  });

  it("disables trigger when disabled prop is true", () => {
    render(
      <SubagentModelCombobox
        value="gpt-4o"
        onValueChange={vi.fn()}
        disabled={true}
      />,
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox.getAttribute("disabled")).not.toBeNull();
  });
});

