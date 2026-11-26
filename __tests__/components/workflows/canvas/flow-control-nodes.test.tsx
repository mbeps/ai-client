import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterConfig } from "@/components/workflows/canvas/config-sections/filter-config";
import { LoopConfig } from "@/components/workflows/canvas/config-sections/loop-config";
import { FilterNode } from "@/components/workflows/canvas/nodes/filter-node";
import { LoopNode } from "@/components/workflows/canvas/nodes/loop-node";
import { WorkflowPaletteView } from "@/components/workflows/canvas/workflow-palette-view";

vi.mock("@xyflow/react", () => ({
  Handle: ({ id, type }: { id?: string; type: string }) => (
    <div data-testid={`handle-${type}-${id ?? "default"}`} />
  ),
  NodeToolbar: () => null,
  Position: {
    Left: "left",
    Right: "right",
  },
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: ({
    value,
    onValueChange,
  }: {
    value?: string;
    onValueChange: (val: string) => void;
  }) => (
    <input
      aria-label="Judge Model"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/chat/input/reasoning-effort-selector", () => ({
  ModelReasoningEffortCard: () => null,
}));

describe("Flow Control Canvas Nodes & Configs", () => {
  it("displays Condition, Loop, and Filter in the Flow Control palette", () => {
    const onAddNode = vi.fn();
    render(
      <WorkflowPaletteView
        agents={[]}
        onAddNode={onAddNode}
        onAddAgentNode={vi.fn()}
      />,
    );

    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByText("Loop")).toBeInTheDocument();
    expect(screen.getByText("Filter")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Loop"));
    expect(onAddNode).toHaveBeenCalledWith("loop");

    fireEvent.click(screen.getByText("Filter"));
    expect(onAddNode).toHaveBeenCalledWith("filter");
  });

  it("renders LoopNode with body and done source handles", () => {
    render(
      <LoopNode
        id="loop-1"
        data={{
          label: "Loop",
          nodeType: "loop",
          nodeData: {
            kind: "loop",
            variableName: "loop1",
            mode: "for_each",
            itemsTemplate: "{{step1.items}}",
            maxIterations: 25,
          },
        }}
      />,
    );

    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-body")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-done")).toBeInTheDocument();
    expect(screen.getByText("For Each")).toBeInTheDocument();
    expect(screen.getByText("max 25")).toBeInTheDocument();
  });

  it("renders FilterNode with mode and rule count badges", () => {
    render(
      <FilterNode
        id="filter-1"
        data={{
          label: "Filter",
          nodeType: "filter",
          nodeData: {
            kind: "filter",
            variableName: "filter1",
            itemsTemplate: "{{step1.items}}",
            evaluationMode: "deterministic",
            logic: "and",
            rules: [
              {
                id: "r1",
                leftTemplate: "{{item.active}}",
                operator: "equals",
                rightValue: "true",
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("Rules")).toBeInTheDocument();
    expect(screen.getByText("1 rule")).toBeInTheDocument();
  });

  it("edits LoopConfig fields for for_each and count modes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LoopConfig
        data={{
          kind: "loop",
          variableName: "loop1",
          mode: "for_each",
          itemsTemplate: "{{step1.items}}",
          maxIterations: 50,
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Items Array Template"), {
      target: { value: "{{filter1.items}}" },
    });
    expect(onChange).toHaveBeenCalledWith({
      itemsTemplate: "{{filter1.items}}",
    });

    fireEvent.change(screen.getByLabelText("Max Iterations"), {
      target: { value: "10" },
    });
    expect(onChange).toHaveBeenCalledWith({ maxIterations: 10 });

    rerender(
      <LoopConfig
        data={{
          kind: "loop",
          variableName: "loop1",
          mode: "count",
          count: 3,
          maxIterations: 50,
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Iteration Count"), {
      target: { value: "5" },
    });
    expect(onChange).toHaveBeenCalledWith({ count: 5 });
  });

  it("edits FilterConfig deterministic rules and LLM prompt", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterConfig
        data={{
          kind: "filter",
          variableName: "filter1",
          itemsTemplate: "{{step1.items}}",
          evaluationMode: "deterministic",
          logic: "and",
          rules: [],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
    expect(onChange).toHaveBeenCalledWith({
      rules: [
        expect.objectContaining({
          leftTemplate: "{{item}}",
          operator: "equals",
        }),
      ],
    });

    rerender(
      <FilterConfig
        data={{
          kind: "filter",
          variableName: "filter1",
          itemsTemplate: "{{step1.items}}",
          evaluationMode: "llm",
          logic: "and",
          rules: [],
          llmFilterPrompt: "",
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Filter Criteria Prompt"), {
      target: { value: "Keep urgent items" },
    });
    expect(onChange).toHaveBeenCalledWith({
      llmFilterPrompt: "Keep urgent items",
    });
  });
});
