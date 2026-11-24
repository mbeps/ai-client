"use client";

import type { ReactElement } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

export const CHART_COLORS = [
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

export interface BaseChartProps {
  title?: string;
  description?: string;
  data: Array<Record<string, unknown>>;
}

export function getSeriesColor(index: number, customColor?: string): string {
  return customColor || CHART_COLORS[index % CHART_COLORS.length];
}

export function buildSeriesConfig(series: ChartSeriesItem[]): ChartConfig {
  const config: ChartConfig = {};
  series.forEach((item, index) => {
    config[item.key] = {
      label: item.label,
      color: getSeriesColor(index, item.color),
    };
  });
  return config;
}

/**
 * Shared Card + ChartContainer shell with empty-state fallback for all
 * Generative UI chart adapters. Enforces `min-h-[240px]` to prevent Recharts v3
 * zero-height collapse inside flex/tab containers.
 */
export function ChartCardShell({
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
