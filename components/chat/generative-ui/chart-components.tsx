"use client";

import type { ReactElement } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export interface ChartSeriesItem {
  key: string;
  label: string;
  color?: string;
}

interface BaseChartProps {
  title?: string;
  description?: string;
  data: Array<Record<string, unknown>>;
}

function getSeriesColor(index: number, customColor?: string): string {
  return customColor || CHART_COLORS[index % CHART_COLORS.length];
}

function buildSeriesConfig(series: ChartSeriesItem[]): ChartConfig {
  const config: ChartConfig = {};
  series.forEach((item, index) => {
    config[item.key] = {
      label: item.label,
      color: getSeriesColor(index, item.color),
    };
  });
  return config;
}

function ChartCardShell({
  title,
  description,
  isEmpty,
  config,
  children,
}: {
  title?: string;
  description?: string;
  isEmpty: boolean;
  config: ChartConfig;
  children: ReactElement;
}) {
  return (
    <Card className="w-full">
      {(title || description) && (
        <CardHeader className="pb-2">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        {isEmpty ? (
          <div className="bg-muted/40 text-muted-foreground flex min-h-[240px] w-full items-center justify-center rounded-md border border-dashed text-sm">
            No chart data available
          </div>
        ) : (
          <ChartContainer config={config} className="min-h-[240px] w-full">
            {children}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

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
  const isEmpty = data.length === 0 || series.length === 0;
  const config = buildSeriesConfig(series);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <AreaChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
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
        {series.map((item, index) => {
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
  const isEmpty = data.length === 0 || series.length === 0;
  const config = buildSeriesConfig(series);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <BarChart
        data={data}
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
        {series.map((item, index) => (
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
  const isEmpty = data.length === 0 || series.length === 0;
  const config = buildSeriesConfig(series);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
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
        {series.map((item, index) => (
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
  const isEmpty = data.length === 0;
  const config: ChartConfig = {};
  data.forEach((row, index) => {
    const label = String(row[nameKey] ?? `Item ${index + 1}`);
    config[label] = {
      label,
      color: CHART_COLORS[index % CHART_COLORS.length],
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
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius={donut ? 48 : 0}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((row, index) => (
            <Cell
              key={`${String(row[nameKey] ?? index)}-${index}`}
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
  const isEmpty = data.length === 0 || series.length === 0;
  const config = buildSeriesConfig(series);

  return (
    <ChartCardShell
      title={title}
      description={description}
      isEmpty={isEmpty}
      config={config}
    >
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey={angleKey} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((item, index) => {
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
