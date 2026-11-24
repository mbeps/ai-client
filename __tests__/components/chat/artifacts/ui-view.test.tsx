import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/chat/generative-ui/dynamic-ui-block", () => ({
  DynamicUIBlock: ({
    rawSpec,
    className,
  }: {
    rawSpec: string;
    className?: string;
  }) => (
    <div data-testid="dynamic-ui-block" data-classname={className}>
      {rawSpec}
    </div>
  ),
}));

import { UiView } from "@/components/chat/artifacts/ui-view";

describe("UiView", () => {
  it("renders DynamicUIBlock with rawSpec when content is provided", () => {
    const spec = JSON.stringify({
      root: "card",
      elements: {
        card: { type: "Card", props: { title: "KPI" }, children: [] },
      },
    });

    render(<UiView content={spec} />);

    const block = screen.getByTestId("dynamic-ui-block");
    expect(block).toBeInTheDocument();
    expect(block).toHaveTextContent(spec);
  });

  it("renders empty-state fallback when content is empty or whitespace", () => {
    const { rerender } = render(<UiView content="" />);
    expect(
      screen.getByText("No interactive UI content to display."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dynamic-ui-block")).toBeNull();

    rerender(<UiView content={"   \n  "} />);
    expect(
      screen.getByText("No interactive UI content to display."),
    ).toBeInTheDocument();
  });
});
