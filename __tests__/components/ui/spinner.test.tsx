import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "@/components/ui/spinner";

describe("Spinner", () => {
  it("renders with default props and accessibility attributes", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders with custom accessible label", () => {
    render(<Spinner label="Fetching session..." />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Fetching session...",
    );
    expect(screen.getByText("Fetching session...")).toBeInTheDocument();
  });

  it("applies size classes appropriately", () => {
    const { container } = render(
      <Spinner size="lg" className="custom-class" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("class")).toContain("size-8");
    expect(svg?.getAttribute("class")).toContain("custom-class");
    expect(svg?.getAttribute("class")).toContain("animate-spin");
  });
});
