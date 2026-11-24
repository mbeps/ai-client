"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  type BaseChartProps,
  buildSeriesConfig,
  CHART_COLORS,
  ChartCardShell,
  type ChartSeriesItem,
  getSeriesColor,
} from "@/components/chat/generative-ui/chart-shell";
import {
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type { ChartSeriesItem };

/**
 * Shadcn/Recharts AreaChart adapter for Generative UI specs.
 */
export function GenerativeAreaChart({
  title,
  description,
  data,
  xKey,
  series,
  stacked,
}: BaseChartProps & {
  xKey: string;
  series: ChartSeriesItem[];
  stacked?: boolean;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeSeries = Array.isArray(series) ? series : [];
  const isEmpty = safeData.length === 0 || safeSeries.length === 0;
  const config = buildSeriesConfig(safeSeries);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <AreaChart data={safeData} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {safeSeries.map((item, index) => {
          const color = getSeriesColor(index, item.color);
          return (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stackId={stacked ? "stack" : undefined}
              stroke={color}
              fill={color}
              fillOpacity={0.25}
            />
          );
        })}
      </AreaChart>
    </ChartCardShell>
  );
}

/**
 * Shadcn/Recharts BarChart adapter supporting vertical, horizontal, and stacked layouts.
 */
export function GenerativeBarChart({
  title,
  description,
  data,
  xKey,
  series,
  stacked,
  horizontal,
}: BaseChartProps & {
  xKey: string;
  series: ChartSeriesItem[];
  stacked?: boolean;
  horizontal?: boolean;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeSeries = Array.isArray(series) ? series : [];
  const isEmpty = safeData.length === 0 || safeSeries.length === 0;
  const config = buildSeriesConfig(safeSeries);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <BarChart
        data={safeData}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: 8, right: 8, top: 8 }}
      >
        <CartesianGrid
          vertical={!horizontal}
          horizontal={Boolean(horizontal)}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              dataKey={xKey}
              type="category"
              tickLine={false}
              axisLine={false}
              width={80}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} width={40} />
          </>
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {safeSeries.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            stackId={stacked ? "stack" : undefined}
            fill={getSeriesColor(index, item.color)}
            radius={4}
          />
        ))}
      </BarChart>
    </ChartCardShell>
  );
}

/**
 * Shadcn/Recharts LineChart adapter for continuous multi-series data.
 */
export function GenerativeLineChart({
  title,
  description,
  data,
  xKey,
  series,
}: BaseChartProps & {
  xKey: string;
  series: ChartSeriesItem[];
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeSeries = Array.isArray(series) ? series : [];
  const isEmpty = safeData.length === 0 || safeSeries.length === 0;
  const config = buildSeriesConfig(safeSeries);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <LineChart data={safeData} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {safeSeries.map((item, index) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            stroke={getSeriesColor(index, item.color)}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartCardShell>
  );
}

/**
 * Shadcn/Recharts PieChart / Donut adapter for part-to-whole proportions.
 */
export function GenerativePieChart({
  title,
  description,
  data,
  nameKey,
  valueKey,
  donut,
}: BaseChartProps & {
  nameKey: string;
  valueKey: string;
  donut?: boolean;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const isEmpty = safeData.length === 0;
  const config: ChartConfig = {};
  const chartData = safeData.map((row, index) => {
    const label = String(row[nameKey] ?? `Item ${index + 1}`);
    const configKey = `slice-${index}`;
    config[configKey] = {
      label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return {
      ...row,
      __pieConfigKey: configKey,
    };
  });

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="__pieConfigKey" />}
        />
        <ChartLegend
          content={<ChartLegendContent nameKey="__pieConfigKey" />}
        />
        <Pie
          data={chartData}
          dataKey={valueKey}
          nameKey="__pieConfigKey"
          innerRadius={donut ? 48 : 0}
          outerRadius={80}
          paddingAngle={2}
        >
          {chartData.map((row, index) => (
            <Cell
              key={row.__pieConfigKey}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartCardShell>
  );
}

/**
 * Shadcn/Recharts RadarChart adapter for multi-dimensional comparisons.
 */
export function GenerativeRadarChart({
  title,
  description,
  data,
  angleKey,
  series,
}: BaseChartProps & {
  angleKey: string;
  series: ChartSeriesItem[];
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeSeries = Array.isArray(series) ? series : [];
  const isEmpty = safeData.length === 0 || safeSeries.length === 0;
  const config = buildSeriesConfig(safeSeries);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <RadarChart data={safeData}>
        <PolarGrid />
        <PolarAngleAxis dataKey={angleKey} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {safeSeries.map((item, index) => {
          const color = getSeriesColor(index, item.color);
          return (
            <Radar
              key={item.key}
              name={item.label}
              dataKey={item.key}
              stroke={color}
              fill={color}
              fillOpacity={0.25}
            />
          );
        })}
      </RadarChart>
    </ChartCardShell>
  );
}
