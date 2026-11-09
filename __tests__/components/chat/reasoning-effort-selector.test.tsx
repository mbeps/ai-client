import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReasoningEffortSelector } from "@/components/chat/input/reasoning-effort-selector";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";

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

  it("opens menu and calls onChange when a different effort option is chosen", () => {
    const handleChange = vi.fn();
    render(
      <ReasoningEffortSelector value="medium" onChange={handleChange} />,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: Medium/i,
    });
    fireEvent.pointerDown(trigger);

    expect(screen.getByText("Reasoning Effort")).toBeDefined();
    expect(screen.getByText("Disable reasoning")).toBeDefined();
    expect(screen.getByText("Maximum depth and thoroughness")).toBeDefined();

    const highOption = screen.getByText("Maximum depth and thoroughness");
    fireEvent.click(highOption);

    expect(handleChange).toHaveBeenCalledWith("high");
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
