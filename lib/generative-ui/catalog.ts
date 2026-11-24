import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { z } from "zod";

const chartSeriesSchema = z.array(
  z.object({
    key: z.string(),
    label: z.string(),
    color: z.string().optional(),
  }),
);

/**
 * Declarative UI catalog mapped 1:1 to local Shadcn UI primitives and Recharts
 * wrappers. Isolates `@json-render/core` schema definitions inside `lib/generative-ui/`.
 */
export const generativeUICatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        direction: z.enum(["vertical", "horizontal"]).optional(),
        gap: z.enum(["none", "sm", "md", "lg"]).optional(),
        align: z.enum(["start", "center", "end", "stretch"]).optional(),
        justify: z.enum(["start", "center", "end", "between"]).optional(),
        wrap: z.boolean().optional(),
      }),
      slots: ["default"],
      description:
        "Flex container arranging child elements vertically or horizontally.",
    },
    Grid: {
      props: z.object({
        columns: z.number().int().min(1).max(6).optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
      }),
      slots: ["default"],
      description: "Responsive multi-column grid layout container.",
    },
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      slots: ["default"],
      description:
        "Bordered surface container with optional header title and description.",
    },
    Separator: {
      props: z.object({
        orientation: z.enum(["horizontal", "vertical"]).optional(),
      }),
      description: "Visual divider between sections.",
    },
    Text: {
      props: z.object({
        content: z.string(),
        variant: z
          .enum(["body", "heading", "subheading", "muted", "code"])
          .optional(),
      }),
      description:
        "Typography block for headings, body text, muted captions, or code.",
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        change: z.string().optional(),
        trend: z.enum(["up", "down", "neutral"]).optional(),
      }),
      description:
        "KPI metric display with label, primary value, and optional delta trend.",
    },
    Badge: {
      props: z.object({
        label: z.string(),
        variant: z
          .enum(["default", "secondary", "destructive", "outline"])
          .optional(),
      }),
      description: "Compact status pill or tag.",
    },
    Alert: {
      props: z.object({
        title: z.string().optional(),
        description: z.string(),
        variant: z.enum(["default", "destructive"]).optional(),
      }),
      description: "Callout banner for informational notices or warnings.",
    },
    Progress: {
      props: z.object({
        value: z.number().min(0).max(100),
        label: z.string().optional(),
        showValue: z.boolean().optional(),
      }),
      description: "Horizontal progress bar (0 to 100).",
    },
    DataTable: {
      props: z.object({
        columns: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            sortable: z.boolean().optional(),
          }),
        ),
        data: z.array(z.record(z.string(), z.unknown())),
        searchable: z.boolean().optional(),
        pageSize: z.number().int().positive().optional(),
      }),
      description: "Client-side sortable and searchable data table.",
    },
    Tabs: {
      props: z.object({
        tabs: z.array(
          z.object({
            value: z.string(),
            label: z.string(),
          }),
        ),
        defaultValue: z.string().optional(),
      }),
      slots: ["default"],
      description: "Tabbed container switching between child panels.",
    },
    Accordion: {
      props: z.object({
        items: z.array(
          z.object({
            value: z.string(),
            title: z.string(),
            content: z.string(),
          }),
        ),
        type: z.enum(["single", "multiple"]).optional(),
        defaultValue: z.union([z.string(), z.array(z.string())]).optional(),
      }),
      description: "Collapsible sections for progressive disclosure.",
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z
          .enum(["default", "secondary", "destructive", "outline", "ghost"])
          .optional(),
        size: z.enum(["default", "sm", "lg"]).optional(),
        disabled: z.boolean().optional(),
      }),
      description: "Interactive button supporting click action bindings.",
    },
    Input: {
      props: z.object({
        label: z.string().optional(),
        placeholder: z.string().optional(),
        type: z
          .enum(["text", "number", "email", "password", "search"])
          .optional(),
        value: z.string().optional(),
      }),
      description: "Single-line text or numeric input supporting $bindState.",
    },
    Textarea: {
      props: z.object({
        label: z.string().optional(),
        placeholder: z.string().optional(),
        rows: z.number().int().positive().optional(),
        value: z.string().optional(),
      }),
      description: "Multi-line text input supporting $bindState.",
    },
    Select: {
      props: z.object({
        label: z.string().optional(),
        placeholder: z.string().optional(),
        options: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        ),
        value: z.string().optional(),
      }),
      description: "Dropdown select input supporting $bindState.",
    },
    Switch: {
      props: z.object({
        label: z.string(),
        checked: z.boolean().optional(),
        description: z.string().optional(),
      }),
      description: "Boolean toggle switch supporting $bindState.",
    },
    Checkbox: {
      props: z.object({
        label: z.string(),
        checked: z.boolean().optional(),
        description: z.string().optional(),
      }),
      description: "Boolean checkbox supporting $bindState.",
    },
    Slider: {
      props: z.object({
        label: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().positive().optional(),
        value: z.number().optional(),
      }),
      description: "Numeric range slider supporting $bindState.",
    },
    AreaChart: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        series: chartSeriesSchema,
        stacked: z.boolean().optional(),
      }),
      description: "Shadcn/Recharts area chart for time-series or trend data.",
    },
    BarChart: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        series: chartSeriesSchema,
        stacked: z.boolean().optional(),
        horizontal: z.boolean().optional(),
      }),
      description: "Shadcn/Recharts bar chart for categorical comparisons.",
    },
    LineChart: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(z.record(z.string(), z.unknown())),
        xKey: z.string(),
        series: chartSeriesSchema,
      }),
      description: "Shadcn/Recharts line chart for continuous series.",
    },
    PieChart: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(z.record(z.string(), z.unknown())),
        nameKey: z.string(),
        valueKey: z.string(),
        donut: z.boolean().optional(),
      }),
      description:
        "Shadcn/Recharts pie or donut chart for part-to-whole proportions.",
    },
    RadarChart: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(z.record(z.string(), z.unknown())),
        angleKey: z.string(),
        series: chartSeriesSchema,
      }),
      description:
        "Shadcn/Recharts radar chart for multi-dimensional comparisons.",
    },
  },
  actions: {
    sendChatMessage: {
      params: z.object({
        message: z.string().min(1).max(4000),
      }),
      description:
        "Send a follow-up message into the active chat conversation (for example from a Button click).",
    },
  },
});

let cachedInteractiveUiPrompt: string | null = null;

/**
 * Returns the memoized system prompt instructions for Interactive UI generation.
 * Memoized because `catalog.prompt()` is deterministic and called on every chat turn
 * and context-token calculation.
 */
export function getInteractiveUiSystemPrompt(): string {
  if (cachedInteractiveUiPrompt !== null) {
    return cachedInteractiveUiPrompt;
  }

  const catalogPrompt = generativeUICatalog.prompt({
    mode: "inline",
    customRules: [
      "Wrap inline UI specs in a fenced ```spec block alongside your Markdown prose.",
      "For large standalone dashboards, calculators, or multi-section tools, prefer calling manage_artifact with type 'ui' instead of an inline fence.",
      "Keep UI specs concise and under 150 elements.",
    ],
  });

  cachedInteractiveUiPrompt = [
    "## Interactive UI",
    "You can render interactive Shadcn UI widgets and charts inline using ```spec code fences (or in Canvas via manage_artifact with type 'ui').",
    catalogPrompt,
  ].join("\n\n");

  return cachedInteractiveUiPrompt;
}
