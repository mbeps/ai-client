import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@/components/ui/chart";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container">{children}</div>
    ),
  };
});

const Icon = () => <svg data-testid="custom-icon" />;

const config = {
  desktop: { label: "Desktop", color: "#2563eb", icon: Icon },
  mobile: { label: "Mobile", theme: { light: "#111", dark: "#eee" } },
};

describe("Chart", () => {
  it("throws when ChartTooltipContent is rendered outside ChartContainer", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ChartTooltipContent active payload={[]} />)).toThrow(
      "useChart must be used within a <ChartContainer />",
    );
    spy.mockRestore();
  });

  it("renders ChartContainer with empty color config and with themed color config", () => {
    const { container, rerender } = render(
      <ChartContainer config={{ plain: { label: "Plain" } }}>
        <div>Chart</div>
      </ChartContainer>,
    );
    expect(container.querySelector("style")).toBeNull();

    rerender(
      <ChartContainer config={config}>
        <div>Chart</div>
      </ChartContainer>,
    );
    expect(container.querySelector("style")).not.toBeNull();
  });

  it("renders ChartTooltipContent across all branches", () => {
    const { container, rerender } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active={false} payload={[]} />
      </ChartContainer>,
    );
    expect(container.querySelector(".grid")).toBeNull();

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="desktop"
          payload={[
            {
              name: "desktop",
              dataKey: "desktop",
              value: 100,
              color: "#2563eb",
              payload: { fill: "#2563eb" },
            },
            {
              dataKey: "mobile",
              value: 50,
              payload: { mobile: "mobile" },
            },
          ]}
        />
      </ChartContainer>,
    );
    expect(screen.getAllByText("Desktop").length).toBeGreaterThan(0);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          hideLabel
          indicator="dashed"
          color="#000"
          payload={[{ name: "unknown", value: 42, payload: {} }]}
          formatter={(val) => <span data-testid="fmt">{String(val)}</span>}
        />
      </ChartContainer>,
    );
    expect(screen.getByTestId("fmt")).toHaveTextContent("42");

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="unmapped"
          labelFormatter={(val) => `Fmt:${String(val)}`}
          indicator="line"
          hideIndicator
          payload={[{ value: 10 }]}
        />
      </ChartContainer>,
    );
    expect(screen.getByText("Fmt:unmapped")).toBeInTheDocument();

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          labelKey="unknownKey"
          indicator="dashed"
          payload={[{ name: "unknown", value: "N/A", payload: {} }]}
        />
      </ChartContainer>,
    );
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders ChartLegendContent across all branches", () => {
    const { rerender } = render(
      <ChartContainer config={config}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    );
    expect(screen.queryByText("Desktop")).not.toBeInTheDocument();

    rerender(
      <ChartContainer config={config}>
        <ChartLegendContent
          verticalAlign="top"
          payload={[
            { value: "desktop", dataKey: "desktop", color: "#2563eb", type: "line" },
            { value: "mobile", dataKey: "mobile", color: "#111", type: "line" },
            { value: "plain", desktop: "desktop", type: "line" } as never,
          ]}
        />
      </ChartContainer>,
    );
    expect(screen.getAllByText("Desktop").length).toBeGreaterThan(0);
    expect(screen.getByText("Mobile")).toBeInTheDocument();

    rerender(
      <ChartContainer config={config}>
        <ChartLegendContent
          hideIcon
          payload={[{ value: "desktop", dataKey: "desktop", color: "#2563eb", type: "line" }]}
        />
      </ChartContainer>,
    );
    expect(screen.queryByTestId("custom-icon")).not.toBeInTheDocument();
  });

  it("handles non-object payload item in ChartLegendContent", () => {
    render(
      <ChartContainer config={config}>
        <ChartLegendContent payload={["not-an-object" as any]} />
      </ChartContainer>,
    );
    expect(document.querySelector("[data-slot='chart']")).toBeInTheDocument();
  });
});
