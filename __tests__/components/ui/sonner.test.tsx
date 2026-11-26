import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";

const mockUseTheme = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  useTheme: mockUseTheme,
}));

vi.mock("sonner", () => ({
  Toaster: ({ theme }: { theme?: string }) => (
    <div data-testid="sonner-toaster" data-theme={theme} />
  ),
}));

describe("Toaster (sonner)", () => {
  it("uses theme from useTheme and defaults to system", () => {
    mockUseTheme.mockReturnValue({});
    const { rerender } = render(<Toaster />);
    expect(screen.getByTestId("sonner-toaster")).toHaveAttribute(
      "data-theme",
      "system",
    );

    mockUseTheme.mockReturnValue({ theme: "dark" });
    rerender(<Toaster />);
    expect(screen.getByTestId("sonner-toaster")).toHaveAttribute(
      "data-theme",
      "dark",
    );
  });
});
