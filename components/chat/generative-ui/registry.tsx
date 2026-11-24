"use client";

import { defineRegistry } from "@json-render/react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Children } from "react";
import {
  GenerativeAreaChart,
  GenerativeBarChart,
  GenerativeLineChart,
  GenerativePieChart,
  GenerativeRadarChart,
} from "@/components/chat/generative-ui/chart-components";
import { DataTableComponent } from "@/components/chat/generative-ui/data-table-component";
import { generativeUIInputComponents } from "@/components/chat/generative-ui/input-components";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generativeUICatalog } from "@/lib/generative-ui/catalog";
import { cn } from "@/lib/utils";

const STACK_GAP_CLASSES = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
} as const;

const STACK_ALIGN_CLASSES = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

const STACK_JUSTIFY_CLASSES = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

const GRID_COL_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-3 lg:grid-cols-6",
};

const { registry } = defineRegistry(generativeUICatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div
        className={cn(
          "flex",
          props.direction === "horizontal" ? "flex-row" : "flex-col",
          STACK_GAP_CLASSES[props.gap ?? "md"],
          STACK_ALIGN_CLASSES[props.align ?? "stretch"],
          STACK_JUSTIFY_CLASSES[props.justify ?? "start"],
          props.wrap && "flex-wrap",
        )}
      >
        {children}
      </div>
    ),
    Grid: ({ props, children }) => (
      <div
        className={cn(
          "grid",
          GRID_COL_CLASSES[props.columns ?? 2] ?? "grid-cols-1 sm:grid-cols-2",
          STACK_GAP_CLASSES[props.gap ?? "md"],
        )}
      >
        {children}
      </div>
    ),
    Card: ({ props, children }) => (
      <Card>
        {(props.title || props.description) && (
          <CardHeader>
            {props.title && <CardTitle>{props.title}</CardTitle>}
            {props.description && (
              <CardDescription>{props.description}</CardDescription>
            )}
          </CardHeader>
        )}
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    ),
    Separator: ({ props }) => (
      <Separator orientation={props.orientation ?? "horizontal"} />
    ),
    Text: ({ props }) => {
      switch (props.variant) {
        case "heading":
          return (
            <h3 className="text-lg font-semibold tracking-tight">
              {props.content}
            </h3>
          );
        case "subheading":
          return (
            <h4 className="text-base font-medium tracking-tight">
              {props.content}
            </h4>
          );
        case "muted":
          return (
            <p className="text-muted-foreground text-sm">{props.content}</p>
          );
        case "code":
          return (
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              {props.content}
            </code>
          );
        default:
          return <p className="text-sm leading-relaxed">{props.content}</p>;
      }
    },
    Metric: ({ props }) => {
      const TrendIcon =
        props.trend === "up"
          ? TrendingUp
          : props.trend === "down"
            ? TrendingDown
            : Minus;
      const trendClass =
        props.trend === "up"
          ? "text-emerald-600 dark:text-emerald-400"
          : props.trend === "down"
            ? "text-destructive"
            : "text-muted-foreground";

      return (
        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground text-xs font-medium">
            {props.label}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tabular-nums">
              {String(props.value)}
            </span>
            {props.change && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  trendClass,
                )}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                {props.change}
              </span>
            )}
          </div>
        </div>
      );
    },
    Badge: ({ props }) => (
      <Badge variant={props.variant ?? "default"}>{props.label}</Badge>
    ),
    Alert: ({ props }) => (
      <Alert variant={props.variant ?? "default"}>
        {props.title && <AlertTitle>{props.title}</AlertTitle>}
        <AlertDescription>{props.description}</AlertDescription>
      </Alert>
    ),
    Progress: ({ props }) => (
      <div className="space-y-1.5">
        {(props.label || props.showValue) && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{props.label ?? ""}</span>
            {props.showValue && (
              <span className="font-mono font-medium tabular-nums">
                {Math.round(props.value)}%
              </span>
            )}
          </div>
        )}
        <Progress value={props.value} />
      </div>
    ),
    DataTable: ({ props }) => (
      <DataTableComponent
        columns={props.columns}
        data={props.data}
        searchable={props.searchable}
        pageSize={props.pageSize}
      />
    ),
    Tabs: ({ props, children }) => {
      const childArray = Children.toArray(children);
      const firstValue = props.defaultValue ?? props.tabs[0]?.value ?? "";
      return (
        <Tabs defaultValue={firstValue} className="w-full">
          <TabsList>
            {props.tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {props.tabs.map((tab, index) => (
            <TabsContent key={tab.value} value={tab.value} className="pt-2">
              {childArray.length > 1 ? childArray[index] : children}
            </TabsContent>
          ))}
        </Tabs>
      );
    },
    Accordion: ({ props }) => {
      if (props.type === "multiple") {
        const defaultVals = Array.isArray(props.defaultValue)
          ? props.defaultValue
          : props.defaultValue
            ? [props.defaultValue]
            : undefined;
        return (
          <Accordion type="multiple" defaultValue={defaultVals}>
            {props.items.map((item) => (
              <AccordionItem key={item.value} value={item.value}>
                <AccordionTrigger>{item.title}</AccordionTrigger>
                <AccordionContent>{item.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        );
      }

      const defaultVal =
        typeof props.defaultValue === "string" ? props.defaultValue : undefined;
      return (
        <Accordion type="single" collapsible defaultValue={defaultVal}>
          {props.items.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.title}</AccordionTrigger>
              <AccordionContent>{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    },
    ...generativeUIInputComponents,
    AreaChart: ({ props }) => <GenerativeAreaChart {...props} />,
    BarChart: ({ props }) => <GenerativeBarChart {...props} />,
    LineChart: ({ props }) => <GenerativeLineChart {...props} />,
    PieChart: ({ props }) => <GenerativePieChart {...props} />,
    RadarChart: ({ props }) => <GenerativeRadarChart {...props} />,
  },
  actions: {
    // Placeholder handler; runtime ActionProvider in DynamicUIBlock supplies the
    // active chat's sendChatMessage handler.
    sendChatMessage: async () => {},
  },
});

export const generativeUIRegistry = registry;
