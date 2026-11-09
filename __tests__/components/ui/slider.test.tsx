import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "@/components/ui/slider";

describe("Slider component", () => {
  it("renders with default props", () => {
    render(<Slider defaultValue={50} min={0} max={100} step={1} aria-label="Volume" />);
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders discrete tick notches when showTicks is true", () => {
    const { container } = render(
      <Slider defaultValue={0} min={0} max={3} step={1} showTicks aria-label="Effort" />,
    );
    // Should render 4 notch dots: 0, 1, 2, 3
    const ticks = container.querySelectorAll("span.rounded-full");
    expect(ticks.length).toBe(4);
  });

  it("handles value change events", () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        value={1}
        min={0}
        max={3}
        step={1}
        onValueChange={onValueChange}
        aria-label="Level"
      />,
    );

    const slider = screen.getByRole("slider", { name: "Level" });
    fireEvent.change(slider, { target: { value: "2" } });
    expect(onValueChange).toHaveBeenCalled();
  });
});
