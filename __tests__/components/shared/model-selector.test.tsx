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
});
