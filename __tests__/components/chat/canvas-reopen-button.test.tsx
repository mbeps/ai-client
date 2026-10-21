import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasReopenButton } from "@/components/chat/canvas-reopen-button";

describe("CanvasReopenButton", () => {
  it("renders with accessible label and invokes onReopen on click", () => {
    const handleReopen = vi.fn();
    render(<CanvasReopenButton onReopen={handleReopen} />);

    const button = screen.getByRole("button", { name: "Open canvas" });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(handleReopen).toHaveBeenCalledTimes(1);
  });
});

