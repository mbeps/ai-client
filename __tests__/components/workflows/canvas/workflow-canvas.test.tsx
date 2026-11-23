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

  it("selects node to show actions on single click without opening sidebar, and opens sidebar on double click", () => {
    render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    const onNodeClick = capturedReactFlowProps.onNodeClick as
      | ((event: unknown, node: { id: string }) => void)
      | undefined;
    const onNodeDoubleClick = capturedReactFlowProps.onNodeDoubleClick as
      | ((event: unknown, node: { id: string }) => void)
      | undefined;
    const onPaneClick = capturedReactFlowProps.onPaneClick as
      | (() => void)
      | undefined;

    expect(onNodeClick).toBeTypeOf("function");
    expect(onPaneClick).toBeTypeOf("function");

    act(() => {
      onNodeClick?.({}, { id: "n1" });
    });

    const rfNodesAfterClick = capturedReactFlowProps.nodes as Array<{
      id: string;
      selected?: boolean;
    }>;
    expect(rfNodesAfterClick[0]?.selected).toBe(true);
    expect(screen.queryByRole("button", { name: /Done/i })).toBeNull();

    act(() => {
      onNodeDoubleClick?.({}, { id: "n1" });
    });

    expect(screen.getByRole("button", { name: /Done/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Done/i }));
    expect(screen.queryByRole("button", { name: /Done/i })).toBeNull();

    act(() => {
      onPaneClick?.();
    });

    const rfNodesAfterPaneClick = capturedReactFlowProps.nodes as Array<{
      id: string;
      selected?: boolean;
    }>;
    expect(rfNodesAfterPaneClick[0]?.selected).toBe(false);
  });

  it("configures a pending node before committing via Add Node button", () => {
    const onAddNode = vi.fn();

    render(
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

    fireEvent.click(screen.getByRole("button", { name: /Add Node/i }));
    fireEvent.click(screen.getByText("Manual Trigger"));

    expect(onAddNode).not.toHaveBeenCalled();

    const addButtons = screen.getAllByRole("button", { name: /Add Node/i });
    const sheetAddButton = addButtons[addButtons.length - 1];
    fireEvent.click(sheetAddButton);

    expect(onAddNode).toHaveBeenCalledTimes(1);
    expect(onAddNode).toHaveBeenCalledWith(
      "manual_trigger",
      expect.any(Object),
      expect.objectContaining({
        type: "manual_trigger",
      }),
    );
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
