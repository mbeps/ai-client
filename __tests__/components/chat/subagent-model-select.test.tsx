import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubagentModelSelect } from "@/components/chat/subagent-model-select";
import { useUserModels } from "@/hooks/use-user-models";

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

describe("SubagentModelSelect", () => {
  it("renders trigger with default inherit label when value is undefined", () => {
    render(
      <SubagentModelSelect
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
      <SubagentModelSelect
        value="gpt-4o"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("GPT-4o")).toBeDefined();
  });

  it("disables trigger when disabled prop is true", () => {
    render(
      <SubagentModelSelect
        value="gpt-4o"
        onValueChange={vi.fn()}
        disabled={true}
      />,
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox.getAttribute("disabled")).not.toBeNull();
  });

  it("falls back to inherit when value is not in models", () => {
    render(
      <SubagentModelSelect value="non-existent-model" onValueChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows loading placeholder when models are loading", () => {
    vi.mocked(useUserModels).mockReturnValueOnce({ models: [], isLoading: true });
    render(<SubagentModelSelect onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("calls onValueChange with modelId or undefined when selecting options", () => {
    const onValueChange = vi.fn();
    render(
      <SubagentModelSelect value="gpt-4o" onValueChange={onValueChange} />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Claude 3.5 Sonnet"));
    expect(onValueChange).toHaveBeenCalledWith("claude-3-5-sonnet");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Inherit Main Model (Default)"));
    expect(onValueChange).toHaveBeenCalledWith(undefined);
  });
});

