import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelSelector } from "@/components/shared/model-selector";

const mockUseUserModels = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

describe("ModelSelector", () => {
  it("keeps clear button accessible for unavailable model overrides and clears value on click", () => {
    mockUseUserModels.mockReturnValue({
      models: [
        {
          id: "m1",
          modelId: "gpt-4o",
          label: "GPT-4o",
          providerName: "OpenAI",
        },
      ],
      isLoading: false,
    });
    const onValueChange = vi.fn();

    render(
      <ModelSelector
        value="deleted-model-id"
        onValueChange={onValueChange}
        allowClear
      />,
    );

    expect(screen.getByText("Unavailable (deleted-model-id)")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Clear model override" }),
    );
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("opens the model list and selects a model when rendered outside a dialog", () => {
    mockUseUserModels.mockReturnValue({
      models: [
        {
          id: "m1",
          modelId: "gpt-4o",
          label: "GPT-4o",
          providerName: "OpenAI",
          contextWindow: 128000,
        },
        {
          id: "m2",
          modelId: "claude-3-5-sonnet",
          label: "Claude 3.5 Sonnet",
          providerName: "Anthropic",
          contextWindow: 200000,
        },
      ],
      isLoading: false,
    });
    const onValueChange = vi.fn();

    render(<ModelSelector value="gpt-4o" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Select model" }));

    expect(screen.getByLabelText("Search models")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Claude 3.5 Sonnet"));
    expect(onValueChange).toHaveBeenCalledWith("claude-3-5-sonnet");
  });

  it("portals inside the nearest dialog when rendered inside a dialog", () => {
    mockUseUserModels.mockReturnValue({
      models: [
        {
          id: "m1",
          modelId: "gpt-4o",
          label: "GPT-4o",
          providerName: "OpenAI",
          contextWindow: 128000,
        },
        {
          id: "m2",
          modelId: "claude-3-5-sonnet",
          label: "Claude 3.5 Sonnet",
          providerName: "Anthropic",
          contextWindow: 200000,
        },
      ],
      isLoading: false,
    });
    const onValueChange = vi.fn();

    render(
      <div role="dialog" data-testid="dialog-container">
        <ModelSelector value="gpt-4o" onValueChange={onValueChange} />
      </div>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Select model" }));

    const dialog = screen.getByTestId("dialog-container");
    const searchInput = screen.getByLabelText("Search models");
    expect(dialog).toContainElement(searchInput);

    fireEvent.click(screen.getByText("Claude 3.5 Sonnet"));
    expect(onValueChange).toHaveBeenCalledWith("claude-3-5-sonnet");
  });

  it("renders empty, unavailable override, custom placeholder, and default placeholder states", () => {
    mockUseUserModels.mockReturnValue({ models: [], isLoading: false });
    const { rerender } = render(
      <ModelSelector value="" onValueChange={vi.fn()} />,
    );
    expect(screen.getByText("No models configured")).toBeInTheDocument();

    mockUseUserModels.mockReturnValue({
      models: [
        {
          id: "m1",
          modelId: "gpt-4o",
          label: "GPT-4o",
          providerName: "OpenAI",
          contextWindow: 128000,
        },
      ],
      isLoading: false,
    });
    rerender(
      <ModelSelector
        value="missing-model"
        onValueChange={vi.fn()}
        allowClear
      />,
    );
    expect(document.body.textContent).toContain("Unavailable (missing-model)");

    rerender(
      <ModelSelector
        value=""
        onValueChange={vi.fn()}
        allowClear
        placeholder="Pick a model"
      />,
    );
    expect(screen.getByText("Pick a model")).toBeInTheDocument();

    rerender(<ModelSelector value="" onValueChange={vi.fn()} allowClear />);
    expect(screen.getByText("Select model...")).toBeInTheDocument();
  });
});
