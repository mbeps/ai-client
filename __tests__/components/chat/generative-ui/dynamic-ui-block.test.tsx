import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicUIBlock } from "@/components/chat/generative-ui/dynamic-ui-block";
import { DynamicUIErrorBoundary } from "@/components/chat/generative-ui/dynamic-ui-error-boundary";
import { GenerativeUIProvider } from "@/components/chat/generative-ui/generative-ui-context";
import { generativeUIRegistry } from "@/components/chat/generative-ui/registry";

describe("DynamicUIBlock", () => {
  it("renders streaming skeleton when isStreaming and isUnclosed are true", () => {
    const partialSpec = '{"root":"card","elements":{"card":';
    render(
      <DynamicUIBlock rawSpec={partialSpec} isStreaming isUnclosed />,
    );

    expect(screen.getByText("Building interactive UI...")).toBeInTheDocument();
    expect(screen.queryByText(partialSpec)).not.toBeInTheDocument();
  });

  it("renders error alert and raw code fallback for malformed spec", () => {
    const badSpec = "not valid json or jsonl";
    render(<DynamicUIBlock rawSpec={badSpec} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(badSpec)).toBeInTheDocument();
  });

  it("renders Shadcn layout, display, disclosure, and interactive state-bound inputs", () => {
    const spec = JSON.stringify({
      root: "root",
      state: {
        name: "Ada",
        notes: "Initial",
        role: "admin",
        enabled: false,
        agreed: true,
        volume: 40,
      },
      elements: {
        root: {
          type: "Card",
          props: { title: "Dashboard", description: "Interactive controls" },
          children: [
            "stack",
            "sep",
            "grid",
            "tabs",
            "accordion",
            "form",
            "btn",
          ],
        },
        stack: {
          type: "Stack",
          props: { direction: "horizontal", gap: "md", align: "center", justify: "between", wrap: true },
          children: ["heading", "badge", "metricUp", "metricDown", "metricNeutral"],
        },
        heading: {
          type: "Text",
          props: { content: "Overview", variant: "heading" },
        },
        badge: {
          type: "Badge",
          props: { label: "Live", variant: "secondary" },
        },
        metricUp: {
          type: "Metric",
          props: { label: "Users", value: 1200, change: "+12%", trend: "up" },
        },
        metricDown: {
          type: "Metric",
          props: { label: "Errors", value: 3, change: "-5%", trend: "down" },
        },
        metricNeutral: {
          type: "Metric",
          props: { label: "Latency", value: "42ms", change: "0%", trend: "neutral" },
        },
        sep: {
          type: "Separator",
          props: { orientation: "horizontal" },
        },
        grid: {
          type: "Grid",
          props: { columns: 2, gap: "sm" },
          children: ["alert", "progress", "subtext", "mutedtext", "codetext"],
        },
        alert: {
          type: "Alert",
          props: { title: "Heads up", description: "All systems nominal" },
        },
        progress: {
          type: "Progress",
          props: { value: 75, label: "Completion", showValue: true },
        },
        subtext: {
          type: "Text",
          props: { content: "Subheading", variant: "subheading" },
        },
        mutedtext: {
          type: "Text",
          props: { content: "Muted note", variant: "muted" },
        },
        codetext: {
          type: "Text",
          props: { content: "const x = 1;", variant: "code" },
        },
        tabs: {
          type: "Tabs",
          props: {
            tabs: [
              { value: "tab1", label: "First Tab" },
              { value: "tab2", label: "Second Tab" },
            ],
            defaultValue: "tab1",
          },
          children: ["tabBody"],
        },
        tabBody: {
          type: "Text",
          props: { content: "Tab panel body", variant: "body" },
        },
        accordion: {
          type: "Accordion",
          props: {
            type: "single",
            items: [{ value: "item-1", title: "FAQ 1", content: "Answer 1" }],
          },
        },
        form: {
          type: "Stack",
          props: { direction: "vertical", gap: "sm" },
          children: ["input", "textarea", "select", "switch", "checkbox", "slider"],
        },
        input: {
          type: "Input",
          props: { label: "Name", value: { $bindState: "/name" } },
        },
        textarea: {
          type: "Textarea",
          props: { label: "Notes", value: { $bindState: "/notes" } },
        },
        select: {
          type: "Select",
          props: {
            label: "Role",
            options: [
              { label: "Admin", value: "admin" },
              { label: "User", value: "user" },
            ],
            value: { $bindState: "/role" },
          },
        },
        switch: {
          type: "Switch",
          props: { label: "Active", description: "Toggle active", checked: { $bindState: "/enabled" } },
        },
        checkbox: {
          type: "Checkbox",
          props: { label: "Agree", description: "Accept terms", checked: { $bindState: "/agreed" } },
        },
        slider: {
          type: "Slider",
          props: { label: "Volume", min: 0, max: 100, step: 5, value: { $bindState: "/volume" } },
        },
        btn: {
          type: "Button",
          props: { label: "Send Follow-up" },
          on: {
            press: {
              action: "sendChatMessage",
              params: { message: { $template: "Hello ${/name}" } },
            },
          },
        },
      },
    });

    const onSend = vi.fn();
    render(
      <GenerativeUIProvider sendMessage={onSend} isStreaming={false}>
        <DynamicUIBlock rawSpec={spec} />
      </GenerativeUIProvider>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("FAQ 1")).toBeInTheDocument();

    // Update Input bound to /name
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Ada");
    fireEvent.change(nameInput, { target: { value: "Grace" } });
    expect(nameInput.value).toBe("Grace");

    // Update Textarea bound to /notes
    const notesInput = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    fireEvent.change(notesInput, { target: { value: "Updated" } });
    expect(notesInput.value).toBe("Updated");

    // Toggle Switch and Checkbox
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("checkbox"));

    // Move Slider via hidden range input change
    const sliderInput = document.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    fireEvent.change(sliderInput, { target: { value: "55" } });

    // Click Button -> triggers sendChatMessage with interpolated template
    fireEvent.click(screen.getByRole("button", { name: "Send Follow-up" }));
    expect(onSend).toHaveBeenCalledWith("Hello Grace");
  });

  it("covers default prop fallbacks and multi-child Tabs", async () => {
    const spec = JSON.stringify({
      root: "stack",
      elements: {
        stack: {
          type: "Stack",
          props: {},
          children: [
            "grid",
            "gridDefault",
            "card",
            "cardDescOnly",
            "cardTitleOnly",
            "sep",
            "badgeDefault",
            "alert",
            "progress",
            "progressValOnly",
            "tabs",
            "tabsEmpty",
            "accSingle",
            "accMultiDefault",
            "accMultiStr",
            "input",
            "textarea",
            "select",
            "slider",
            "disabledBtn",
            "nonStringActionBtn",
          ],
        },
        grid: {
          type: "Grid",
          props: { columns: 99 as unknown as number },
          children: [],
        },
        gridDefault: {
          type: "Grid",
          props: {},
          children: [],
        },
        card: {
          type: "Card",
          props: {},
          children: [],
        },
        cardDescOnly: {
          type: "Card",
          props: { description: "Desc only" },
          children: [],
        },
        cardTitleOnly: {
          type: "Card",
          props: { title: "Title only" },
          children: [],
        },
        sep: { type: "Separator", props: {} },
        badgeDefault: { type: "Badge", props: { label: "DefaultBadge" } },
        alert: { type: "Alert", props: { description: "Plain alert" } },
        progress: { type: "Progress", props: { value: 50 } },
        progressValOnly: {
          type: "Progress",
          props: { value: 25, showValue: true },
        },
        tabs: {
          type: "Tabs",
          props: {
            tabs: [
              { value: "t1", label: "T1" },
              { value: "t2", label: "T2" },
            ],
          },
          children: ["tabChild1", "tabChild2"],
        },
        tabsEmpty: {
          type: "Tabs",
          props: { tabs: [] },
          children: [],
        },
        tabChild1: { type: "Text", props: { content: "Body 1" } },
        tabChild2: { type: "Text", props: { content: "Body 2" } },
        accSingle: {
          type: "Accordion",
          props: {
            defaultValue: "s1",
            items: [{ value: "s1", title: "S1", content: "SC1" }],
          },
        },
        accMultiDefault: {
          type: "Accordion",
          props: {
            type: "multiple",
            items: [{ value: "m1", title: "M1", content: "MC1" }],
          },
        },
        accMultiStr: {
          type: "Accordion",
          props: {
            type: "multiple",
            defaultValue: "m2",
            items: [{ value: "m2", title: "M2", content: "MC2" }],
          },
        },
        input: { type: "Input", props: {} },
        textarea: { type: "Textarea", props: {} },
        select: {
          type: "Select",
          props: { options: [{ label: "Opt", value: "opt" }] },
        },
        slider: { type: "Slider", props: {} },
        disabledBtn: {
          type: "Button",
          props: { label: "Disabled", disabled: true },
        },
        nonStringActionBtn: {
          type: "Button",
          props: { label: "NonString" },
          on: {
            press: {
              action: "sendChatMessage",
              params: { message: 123 as unknown as string },
            },
          },
        },
      },
    });

    const onSend = vi.fn();
    render(
      <GenerativeUIProvider sendMessage={onSend} isStreaming={false}>
        <DynamicUIBlock rawSpec={spec} />
      </GenerativeUIProvider>,
    );

    expect(screen.getByText("Plain alert")).toBeInTheDocument();
    expect(screen.getByText("Body 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "NonString" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("renders DynamicUIErrorBoundary fallback when Renderer throws", async () => {
    vi.resetModules();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let shouldThrowEmpty = false;
    vi.doMock("@json-render/react", async () => {
      const actual =
        await vi.importActual<typeof import("@json-render/react")>(
          "@json-render/react",
        );
      return {
        ...actual,
        Renderer: () => {
          throw new Error(shouldThrowEmpty ? "" : "Renderer boom");
        },
      };
    });

    try {
      const { DynamicUIBlock: MockedBlock } = await import(
        "@/components/chat/generative-ui/dynamic-ui-block"
      );
      const spec = JSON.stringify({
        root: "card",
        elements: { card: { type: "Card", props: { title: "Ok" } } },
      });

      const { rerender } = render(<MockedBlock rawSpec={spec} />);
      expect(screen.getByRole("alert")).toHaveTextContent("Renderer boom");

      shouldThrowEmpty = true;
      rerender(<MockedBlock key="empty-err" rawSpec={spec} />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unexpected render error",
      );
    } finally {
      vi.doUnmock("@json-render/react");
      vi.resetModules();
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders charts, DataTable, multiple Accordion, and ignores empty sendChatMessage", () => {
    const onSend = vi.fn();
    const spec = JSON.stringify({
      root: "stack",
      elements: {
        stack: {
          type: "Stack",
          props: { direction: "vertical", gap: "md" },
          children: [
            "accMulti",
            "table",
            "area",
            "bar",
            "line",
            "pie",
            "radar",
            "emptyBtn",
          ],
        },
        accMulti: {
          type: "Accordion",
          props: {
            type: "multiple",
            defaultValue: ["a"],
            items: [
              { value: "a", title: "Multi A", content: "Content A" },
              { value: "b", title: "Multi B", content: "Content B" },
            ],
          },
        },
        table: {
          type: "DataTable",
          props: {
            columns: [{ key: "k", label: "Key" }],
            data: [{ k: "row-1" }],
          },
        },
        area: {
          type: "AreaChart",
          props: {
            data: [{ x: "Jan", y: 10 }],
            xKey: "x",
            series: [{ key: "y", label: "Y" }],
          },
        },
        bar: {
          type: "BarChart",
          props: {
            data: [{ x: "Jan", y: 10 }],
            xKey: "x",
            series: [{ key: "y", label: "Y" }],
          },
        },
        line: {
          type: "LineChart",
          props: {
            data: [{ x: "Jan", y: 10 }],
            xKey: "x",
            series: [{ key: "y", label: "Y" }],
          },
        },
        pie: {
          type: "PieChart",
          props: {
            data: [{ name: "A", value: 10 }],
            nameKey: "name",
            valueKey: "value",
          },
        },
        radar: {
          type: "RadarChart",
          props: {
            data: [{ m: "Speed", a: 80 }],
            angleKey: "m",
            series: [{ key: "a", label: "A" }],
          },
        },
        emptyBtn: {
          type: "Button",
          props: { label: "Empty Prompt" },
          on: {
            press: {
              action: "sendChatMessage",
              params: { message: "   " },
            },
          },
        },
      },
    });

    const { container } = render(
      <GenerativeUIProvider sendMessage={onSend} isStreaming={false}>
        <DynamicUIBlock rawSpec={spec} />
      </GenerativeUIProvider>,
    );

    expect(screen.getByText("Multi A")).toBeInTheDocument();
    expect(screen.getByText("row-1")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Empty Prompt" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables sendChatMessage button when isStreaming is true or no provider is present", () => {
    const spec = JSON.stringify({
      root: "btn",
      elements: {
        btn: {
          type: "Button",
          props: { label: "Ask AI" },
          on: {
            press: {
              action: "sendChatMessage",
              params: { message: "Follow up" },
            },
          },
        },
      },
    });

    const { rerender } = render(
      <GenerativeUIProvider sendMessage={vi.fn()} isStreaming>
        <DynamicUIBlock rawSpec={spec} />
      </GenerativeUIProvider>,
    );
    expect(screen.getByRole("button", { name: "Ask AI" })).toBeDisabled();

    // Outside provider -> disabled
    rerender(<DynamicUIBlock rawSpec={spec} />);
    expect(screen.getByRole("button", { name: "Ask AI" })).toBeDisabled();
  });

  it("isolates runtime render errors in DynamicUIErrorBoundary and Renderer without crashing parent", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const ThrowingChild = () => {
      throw new Error("Simulated component crash");
    };

    try {
      render(
        <div data-testid="parent">
          <DynamicUIErrorBoundary
            fallback={(err) => <div role="alert">{err.message}</div>}
          >
            <ThrowingChild />
          </DynamicUIErrorBoundary>
        </div>,
      );

      expect(screen.getByTestId("parent")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Simulated component crash",
      );

      // Also verify DynamicUIBlock isolates throws inside registered components
      const originalCard = generativeUIRegistry.Card;
      generativeUIRegistry.Card = () => {
        throw new Error("Card crash");
      };
      try {
        const spec = JSON.stringify({
          root: "card",
          elements: {
            card: { type: "Card", props: { title: "Boom" } },
          },
        });
        render(
          <div data-testid="parent-block">
            <DynamicUIBlock rawSpec={spec} />
          </div>,
        );
        expect(screen.getByTestId("parent-block")).toBeInTheDocument();
      } finally {
        generativeUIRegistry.Card = originalCard;
      }
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("resets DynamicUIErrorBoundary when rawSpec changes from failing to valid", async () => {
    vi.resetModules();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.doMock("@json-render/react", async () => {
      const actual =
        await vi.importActual<typeof import("@json-render/react")>(
          "@json-render/react",
        );
      return {
        ...actual,
        Renderer: (props: Parameters<typeof actual.Renderer>[0]) => {
          if (props.spec?.root === "broken") {
            throw new Error("Transient renderer failure");
          }
          return actual.Renderer(props);
        },
      };
    });

    try {
      const { DynamicUIBlock: MockedBlock } = await import(
        "@/components/chat/generative-ui/dynamic-ui-block"
      );
      const brokenSpec = JSON.stringify({
        root: "broken",
        elements: { broken: { type: "Card", props: { title: "Bad" } } },
      });
      const validSpec = JSON.stringify({
        root: "text",
        elements: {
          text: { type: "Text", props: { content: "Recovered UI" } },
        },
      });

      const { rerender } = render(<MockedBlock rawSpec={brokenSpec} />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Transient renderer failure",
      );

      rerender(<MockedBlock rawSpec={validSpec} />);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("Recovered UI")).toBeInTheDocument();
    } finally {
      vi.doUnmock("@json-render/react");
      vi.resetModules();
      consoleErrorSpy.mockRestore();
    }
  });

  it("keeps local setState buttons enabled during streaming and outside provider while disabling chat actions", () => {
    const spec = JSON.stringify({
      root: "stack",
      state: { count: 2 },
      elements: {
        stack: {
          type: "Stack",
          props: { direction: "vertical" },
          children: ["input", "resetBtn", "chatBtn", "chainedBtn"],
        },
        input: {
          type: "Input",
          props: { label: "Count", value: { $bindState: "/count" } },
        },
        resetBtn: {
          type: "Button",
          props: { label: "Reset Local" },
          on: {
            press: {
              action: "setState",
              params: { statePath: "/count", value: 0 },
            },
          },
        },
        chatBtn: {
          type: "Button",
          props: { label: "Send Chat" },
          on: {
            press: {
              action: "sendChatMessage",
              params: { message: "Next" },
            },
          },
        },
        chainedBtn: {
          type: "Button",
          props: { label: "Chained Chat" },
          on: {
            press: {
              action: "setState",
              params: { statePath: "/count", value: 1 },
              onSuccess: {
                action: "sendChatMessage",
                params: { message: "After set" },
              },
            },
          },
        },
      },
    });

    const { rerender } = render(
      <GenerativeUIProvider sendMessage={vi.fn()} isStreaming>
        <DynamicUIBlock rawSpec={spec} />
      </GenerativeUIProvider>,
    );

    const resetBtn = screen.getByRole("button", { name: "Reset Local" });
    expect(resetBtn).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Send Chat" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chained Chat" })).toBeDisabled();

    fireEvent.click(resetBtn);
    expect((screen.getByLabelText("Count") as HTMLInputElement).value).toBe("0");

    // Outside GenerativeUIProvider (sendMessage undefined): local setState remains enabled
    rerender(<DynamicUIBlock rawSpec={spec} />);
    expect(screen.getByRole("button", { name: "Reset Local" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Send Chat" })).toBeDisabled();
  });
});
