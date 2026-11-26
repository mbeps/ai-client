import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowNode } from "@/types/workflows/workflow";

let capturedReactFlowProps: Record<string, unknown> = {};

const mockReactFlowInstance = {
  screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  fitView: vi.fn(),
};

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ReactFlow: (props: Record<string, unknown>) => {
    capturedReactFlowProps = props;
    return (
      <div data-testid="react-flow">
        {props.children as React.ReactNode}
      </div>
    );
  },
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: () => <div />,
  NodeToolbar: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  addEdge: vi.fn((_conn, edges) => edges),
  useReactFlow: () => mockReactFlowInstance,
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: () => <div />,
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: () => <div />,
}));

import { WorkflowCanvas } from "@/components/workflows/canvas/workflow-canvas";
import { useWorkflowEditorStore } from "@/components/workflows/canvas/workflow-editor-store";

const sampleNodes: WorkflowNode[] = [
  {
    id: "n1",
    type: "manual_trigger",
    name: "Manual Trigger",
    position: { x: 80, y: 180 },
    data: {
      kind: "manual_trigger",
      variableName: "trigger",
      requiresFileUpload: false,
    },
  },
];

describe("WorkflowCanvas", () => {
  beforeEach(() => {
    useWorkflowEditorStore.setState({ selectedNodeId: null });
  });

  it("selects node and opens docked inspector on click, returns to palette on back, and hides panel in readOnly", () => {
    const onAddNode = vi.fn();
    const { rerender } = render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onAddNode={onAddNode}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    // Docked right panel is visible in palette mode initially
    expect(
      screen.getByRole("complementary", { name: /Workflow studio panel/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search nodes/i)).toBeInTheDocument();

    const onNodeClick = capturedReactFlowProps.onNodeClick as
      | ((event: unknown, node: { id: string }) => void)
      | undefined;
    const onPaneClick = capturedReactFlowProps.onPaneClick as
      | (() => void)
      | undefined;

    act(() => {
      onNodeClick?.({}, { id: "n1" });
    });

    const rfNodesAfterClick = capturedReactFlowProps.nodes as Array<{
      id: string;
      selected?: boolean;
    }>;
    expect(rfNodesAfterClick[0]?.selected).toBe(true);
    expect(
      screen.getByRole("button", { name: /Back to palette/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back to palette/i }));
    expect(
      screen.queryByRole("button", { name: /Back to palette/i }),
    ).toBeNull();
    expect(screen.getByPlaceholderText(/Search nodes/i)).toBeInTheDocument();

    // Instant node drop from palette adds node & opens inspector without modal staging
    fireEvent.click(screen.getByRole("button", { name: /AI Agent/i }));
    expect(onAddNode).toHaveBeenCalledWith(
      "ai_step",
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      expect.objectContaining({ type: "ai_step" }),
    );

    act(() => {
      onPaneClick?.();
    });

    // readOnly mode hides right panel cleanly
    rerender(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        readOnly
      />,
    );
    expect(
      screen.queryByRole("complementary", { name: /Workflow studio panel/i }),
    ).toBeNull();
  });

  it("preserves measured node dimensions without calling onNodesChange on dimension-only updates", () => {
    const onNodesChange = vi.fn();

    const { rerender } = render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onEdgesChange={vi.fn()}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    const rfOnNodesChange = capturedReactFlowProps.onNodesChange as (
      changeset: {
        applyTo: (
          nodes: Array<Record<string, unknown>>,
        ) => Array<Record<string, unknown>>;
      },
    ) => void;

    rfOnNodesChange({
      applyTo: (prev) =>
        prev.map((n) => ({
          ...n,
          measured: { width: 256, height: 96 },
        })),
    });

    expect(onNodesChange).not.toHaveBeenCalled();

    rerender(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={[...sampleNodes]}
        edges={[]}
        onNodesChange={onNodesChange}
        onEdgesChange={vi.fn()}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    const rfNodes = capturedReactFlowProps.nodes as Array<{
      id: string;
      measured?: { width: number; height: number };
    }>;
    expect(rfNodes[0]?.measured).toEqual({ width: 256, height: 96 });
  });

  it("supports controlled selectedNodeId/onSelectNode, preserves selectedEdgeIds, and removes edges cleanly", () => {
    const onSelectNode = vi.fn();
    const onEdgesChange = vi.fn();
    const sampleEdges = [
      {
        id: "e1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
        sourceHandle: "main",
        targetHandle: "main",
      },
    ];

    const { rerender } = render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={sampleEdges}
        selectedNodeId="n1"
        onSelectNode={onSelectNode}
        onNodesChange={vi.fn()}
        onEdgesChange={onEdgesChange}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(
      (capturedReactFlowProps.nodes as Array<{ id: string; selected?: boolean }>).find(
        (n) => n.id === "n1",
      )?.selected,
    ).toBe(true);

    // Clicking a node notifies controlled onSelectNode
    const rfOnNodeClick = capturedReactFlowProps.onNodeClick as (
      e: unknown,
      node: { id: string },
    ) => void;
    act(() => {
      rfOnNodeClick({}, { id: "n2" });
    });
    expect(onSelectNode).toHaveBeenCalledWith("n2");

    // Selecting an edge preserves selected state across edge array rebuilds
    const rfOnEdgesChange = capturedReactFlowProps.onEdgesChange as (changeset: {
      applyTo: (edges: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
    }) => void;
    act(() => {
      rfOnEdgesChange({
        applyTo: (prev) => prev.map((e) => ({ ...e, selected: true })),
      });
    });

    rerender(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[...sampleEdges]}
        selectedNodeId="n2"
        onSelectNode={onSelectNode}
        onNodesChange={vi.fn()}
        onEdgesChange={onEdgesChange}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(
      (capturedReactFlowProps.edges as Array<{ id: string; selected?: boolean }>)[0]
        ?.selected,
    ).toBe(true);

    // Pane click clears both node selection and selected edges
    const rfOnPaneClick = capturedReactFlowProps.onPaneClick as () => void;
    act(() => {
      rfOnPaneClick();
    });
    expect(onSelectNode).toHaveBeenCalledWith(null);
    expect(
      (capturedReactFlowProps.edges as Array<{ id: string; selected?: boolean }>)[0]
        ?.selected,
    ).toBe(false);

    // Edge removal notifies onEdgesChange
    act(() => {
      (
        capturedReactFlowProps.onEdgesChange as (c: {
          applyTo: () => Array<Record<string, unknown>>;
        }) => void
      )({
        applyTo: () => [],
      });
    });
    expect(onEdgesChange).toHaveBeenCalledWith([]);
  });
});
