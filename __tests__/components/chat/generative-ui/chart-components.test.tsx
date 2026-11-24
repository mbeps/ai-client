import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  GenerativeAreaChart,
  GenerativeBarChart,
  GenerativeLineChart,
  GenerativePieChart,
  GenerativeRadarChart,
} from "@/components/chat/generative-ui/chart-components";

const sampleSeries = [
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost", color: "var(--chart-2)" },
];

const sampleData = [
  { month: "Jan", revenue: 120, cost: 80 },
  { month: "Feb", revenue: 180, cost: 95 },
];

describe("chart-components", () => {
  describe("GenerativeAreaChart", () => {
    it("renders title, description, and chart container with valid data", () => {
      const { container } = render(
        <GenerativeAreaChart
          title="Revenue Trend"
          description="Monthly revenue vs cost"
          data={sampleData}
          xKey="month"
          series={sampleSeries}
          stacked
        />,
      );

      expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
      expect(screen.getByText("Monthly revenue vs cost")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });

    it("renders empty state when data or series is empty", () => {
      render(
        <GenerativeAreaChart
          title="Empty Area"
          data={[]}
          xKey="month"
          series={sampleSeries}
        />,
      );

      expect(screen.getByText("Empty Area")).toBeInTheDocument();
      expect(screen.getByText("No chart data available")).toBeInTheDocument();
    });
  });

  describe("GenerativeBarChart", () => {
    it("renders vertical and horizontal bar charts with valid data", () => {
      const { container, rerender } = render(
        <GenerativeBarChart
          title="Sales by Month"
          data={sampleData}
          xKey="month"
          series={sampleSeries}
          stacked
        />,
      );

      expect(screen.getByText("Sales by Month")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();

      rerender(
        <GenerativeBarChart
          data={sampleData}
          xKey="month"
          series={sampleSeries}
          horizontal
        />,
      );
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });

    it("renders empty state when series is empty", () => {
      render(
        <GenerativeBarChart
          data={sampleData}
          xKey="month"
          series={[]}
        />,
      );

      expect(screen.getByText("No chart data available")).toBeInTheDocument();
    });
  });

  describe("GenerativeLineChart", () => {
    it("renders line chart and empty state", () => {
      const { container, rerender } = render(
        <GenerativeLineChart
          title="Growth"
          description="Year over year"
          data={sampleData}
          xKey="month"
          series={sampleSeries}
        />,
      );

      expect(screen.getByText("Growth")).toBeInTheDocument();
      expect(screen.getByText("Year over year")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();

      rerender(
        <GenerativeLineChart
          data={[]}
          xKey="month"
          series={sampleSeries}
        />,
      );
      expect(screen.getByText("No chart data available")).toBeInTheDocument();
    });
  });

  describe("GenerativePieChart", () => {
    const pieData = [
      { segment: "Enterprise", share: 60 },
      { segment: "SMB", share: 40 },
      { share: 10 },
    ];

    it("renders pie and donut charts with valid data", () => {
      const { container, rerender } = render(
        <GenerativePieChart
          title="Market Share"
          description="By segment"
          data={pieData}
          nameKey="segment"
          valueKey="share"
        />,
      );

      expect(screen.getByText("Market Share")).toBeInTheDocument();
      expect(screen.getByText("By segment")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();

      rerender(
        <GenerativePieChart
          data={pieData}
          nameKey="segment"
          valueKey="share"
          donut
        />,
      );
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });

    it("renders empty state when pie data is empty", () => {
      render(
        <GenerativePieChart
          data={[]}
          nameKey="segment"
          valueKey="share"
        />,
      );

      expect(screen.getByText("No chart data available")).toBeInTheDocument();
    });
  });

  describe("GenerativeRadarChart", () => {
    const radarData = [
      { metric: "Speed", a: 90, b: 70 },
      { metric: "Safety", a: 85, b: 95 },
    ];

    it("renders radar chart and empty state", () => {
      const { container, rerender } = render(
        <GenerativeRadarChart
          title="Model Comparison"
          description="Benchmark scores"
          data={radarData}
          angleKey="metric"
          series={[
            { key: "a", label: "Model A" },
            { key: "b", label: "Model B" },
          ]}
        />,
      );

      expect(screen.getByText("Model Comparison")).toBeInTheDocument();
      expect(screen.getByText("Benchmark scores")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();

      rerender(
        <GenerativeRadarChart
          data={[]}
          angleKey="metric"
          series={[{ key: "a", label: "Model A" }]}
        />,
      );
      expect(screen.getByText("No chart data available")).toBeInTheDocument();
    });
  });
});
