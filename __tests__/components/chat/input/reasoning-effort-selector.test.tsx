import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ReasoningEffortSlider,
  ReasoningEffortSelector,
  ModelReasoningEffortCard,
} from "@/components/chat/input/reasoning-effort-selector";
import type { ReasoningEffort } from "@/types/reasoning";

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [
      { id: "m1", modelId: "m1", reasoningEffortFormat: "openai" },
      { id: "m2", modelId: "m2", reasoningEffortFormat: "none" },
    ],
  }),
}));

describe("ReasoningEffortSlider", () => {
  it("falls back to medium when value is invalid", () => {
    const onChange = vi.fn();
    render(
      <ReasoningEffortSlider
        value={"invalid" as ReasoningEffort}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Medium")).toBeTruthy();
  });

  it("handles slider keyDown", () => {
    const onChange = vi.fn();
    render(<ReasoningEffortSlider value="medium" onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("low");
  });
});

describe("ReasoningEffortSelector", () => {
  it("falls back to medium label for invalid value", () => {
    const onChange = vi.fn();
    render(
      <ReasoningEffortSelector
        value={"unknown" as ReasoningEffort}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button")).toBeTruthy();
  });
});

describe("ModelReasoningEffortCard", () => {
  it("returns null when model does not support reasoning effort", () => {
    const { container } = render(
      <ModelReasoningEffortCard
        modelId="m2"
        value="low"
        onChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("defaults value to medium when value is undefined", () => {
    render(
      <ModelReasoningEffortCard
        modelId="m1"
        value={undefined}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Medium")).toBeTruthy();
  });

  it("handles scalar and empty array slider changes", () => {
    const onChange = vi.fn();
    render(
      <ModelReasoningEffortCard
        modelId="m1"
        value="medium"
        onChange={onChange}
      />,
    );
    const slider = screen.getByRole("slider");
    expect(slider).toBeTruthy();
  });

  it("does not call onChange when slider moves to same effort or empty array", () => {
    const onChange = vi.fn();
    render(
      <ReasoningEffortSlider value="medium" onChange={onChange} />,
    );
    const slider = screen.getByRole("slider");
    // ArrowUp at medium -> high (different), ArrowDown -> medium
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("off");
  });
});
