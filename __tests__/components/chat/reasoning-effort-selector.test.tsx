import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ModelReasoningEffortCard,
  ReasoningEffortSelector,
} from "@/components/chat/input/reasoning-effort-selector";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: vi.fn(() => ({
    models: [
      {
        id: "m-1",
        modelId: "gpt-4o",
        label: "GPT-4o",
        providerName: "OpenAI",
        reasoningEffortFormat: "none",
      },
      {
        id: "m-2",
        modelId: "o3-mini",
        label: "o3-mini",
        providerName: "OpenAI",
        reasoningEffortFormat: "openai",
      },
    ],
    isLoading: false,
  })),
}));

describe("ReasoningEffortSelector", () => {
  it("renders trigger with medium effort by default", () => {
    const handleChange = vi.fn();
    render(
      <ReasoningEffortSelector value="medium" onChange={handleChange} />,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: Medium/i,
    });
    expect(trigger).toBeDefined();
    expect(screen.getByText("Medium")).toBeDefined();
  });

  it("renders correct labels for off, low, and high effort", () => {
    const { rerender } = render(
      <ReasoningEffortSelector value="off" onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /Reasoning effort: Off/i }),
    ).toBeDefined();

    rerender(<ReasoningEffortSelector value="low" onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Reasoning effort: Low/i }),
    ).toBeDefined();

    rerender(<ReasoningEffortSelector value="high" onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Reasoning effort: High/i }),
    ).toBeDefined();
  });

  it("opens popup and calls onChange when slider input changes", () => {
    const handleChange = vi.fn();
    render(
      <ReasoningEffortSelector value="medium" onChange={handleChange} />,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: Medium/i,
    });
    fireEvent.click(trigger);

    expect(screen.getByText("Reasoning Effort")).toBeDefined();

    // Slider provides a range input with role "slider"
    const sliderInput = screen.getByRole("slider", {
      name: /Reasoning effort/i,
    });
    expect(sliderInput).toBeDefined();
    expect(sliderInput.getAttribute("aria-valuenow")).toBe("2");

    // Change slider to index 3 ("high")
    fireEvent.change(sliderInput, { target: { value: "3" } });
    expect(handleChange).toHaveBeenCalledWith("high");
  });

  it("calls onChange when a notch label button is clicked", () => {
    const handleChange = vi.fn();
    render(
      <ReasoningEffortSelector value="medium" onChange={handleChange} />,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: Medium/i,
    });
    fireEvent.click(trigger);

    // Find and click the 'Off' notch label button
    const offButton = screen.getByRole("button", { name: /^Off$/i });
    fireEvent.click(offButton);

    expect(handleChange).toHaveBeenCalledWith("off");

    // Clicking the already-active 'Medium' button does not call onChange again
    const medButton = screen.getByRole("button", { name: /^Medium$/i });
    fireEvent.click(medButton);
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("falls back to medium for invalid value", () => {
    const handleChange = vi.fn();
    render(
      <ReasoningEffortSelector value={"invalid" as any} onChange={handleChange} />,
    );
    expect(screen.getByRole("button", { name: /Reasoning effort: Medium/i })).toBeTruthy();
  });

  it("disables trigger button when disabled prop is true", () => {
    render(
      <ReasoningEffortSelector
        value="medium"
        onChange={vi.fn()}
        disabled={true}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: Medium/i,
    });
    expect(trigger).toHaveProperty("disabled", true);
  });

  it("falls back to medium detail when value is unknown", () => {
    render(
      <ReasoningEffortSelector
        value={"custom" as unknown as ReasoningEffort}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Reasoning effort: Medium/i }),
    ).toBeDefined();
  });
});

describe("ModelReasoningEffortCard", () => {
  it("returns null when modelId is unset or does not support reasoning effort", () => {
    const { container, rerender } = render(
      <ModelReasoningEffortCard modelId={null} value="medium" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <ModelReasoningEffortCard modelId="gpt-4o" value="medium" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders ReasoningEffortSlider when selected model supports reasoning effort", () => {
    const handleChange = vi.fn();
    render(
      <ModelReasoningEffortCard
        modelId="o3-mini"
        value="low"
        onChange={handleChange}
      />,
    );

    expect(screen.getByText("Reasoning Effort")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^High$/i }));
    expect(handleChange).toHaveBeenCalledWith("high");
  });
});
