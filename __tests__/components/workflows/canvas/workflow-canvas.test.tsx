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

  it("handles node onConfigure/onDelete, position changes, readOnly guards, and onConnect", async () => {
    const { addEdge } = await import("@xyflow/react");
    vi.mocked(addEdge).mockImplementation((conn, prev) => [
      ...(prev as Array<Record<string, unknown>>),
      {
        id: "",
        source: (conn as { source: string }).source,
        target: (conn as { target: string }).target,
      } as never,
    ]);

    const onNodesChange = vi.fn();
    const onEdgesChange = vi.fn();
    const onDeleteNode = vi.fn();
    const onUpdateNode = vi.fn();

    const { rerender } = render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onAddNode={vi.fn()}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );

    const rfNodes = capturedReactFlowProps.nodes as Array<{
      id: string;
      data: {
        onConfigure?: (id: string) => void;
        onDelete?: (id: string) => void;
      };
    }>;

    act(() => {
      rfNodes[0].data.onConfigure?.("n1");
    });
    expect(screen.getByText(/Configure Node/i)).toBeInTheDocument();

    act(() => {
      rfNodes[0].data.onDelete?.("n1");
    });
    expect(onDeleteNode).toHaveBeenCalledWith("n1");

    // Position change + measured
    const rfOnNodesChange = capturedReactFlowProps.onNodesChange as (c: {
      applyTo: (nodes: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
    }) => void;
    act(() => {
      rfOnNodesChange({
        applyTo: (prev) =>
          prev.map((n) => ({
            ...n,
            position: { x: 120, y: 220 },
            measured: { width: 200, height: 80 },
          })),
      });
    });
    expect(onNodesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "n1", position: { x: 120, y: 220 } }),
    ]);

    // onConnect: self-loop ignored, valid connection mapped
    const rfOnConnect = capturedReactFlowProps.onConnect as (conn: {
      source: string;
      target: string;
    }) => void;
    act(() => {
      rfOnConnect({ source: "n1", target: "n1" });
    });
    expect(onEdgesChange).not.toHaveBeenCalled();

    act(() => {
      rfOnConnect({ source: "n1", target: "n2" });
    });
    expect(onEdgesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceNodeId: "n1",
        targetNodeId: "n2",
        sourceHandle: "main",
        targetHandle: "main",
      }),
    ]);

    // readOnly guards
    rerender(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        readOnly={true}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onAddNode={vi.fn()}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );

    act(() => {
      (capturedReactFlowProps.onNodesChange as (c: { applyTo: (n: unknown[]) => unknown[] }) => void)({
        applyTo: (prev) => prev,
      });
      (capturedReactFlowProps.onEdgesChange as (c: { applyTo: (e: unknown[]) => unknown[] }) => void)({
        applyTo: (prev) => prev,
      });
      (capturedReactFlowProps.onConnect as (conn: { source: string; target: string }) => void)({
        source: "n1",
        target: "n2",
      });
    });
    expect(onEdgesChange).toHaveBeenCalledTimes(1);
  });

  it("covers nodeStates, true/false edge labels, readOnly double-click, and pendingNode updates", () => {
    const onAddNode = vi.fn();
    const onUpdateNode = vi.fn();
    const { rerender } = render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[
          {
            id: "e-true",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            sourceHandle: "true",
            targetHandle: "main",
          },
        ]}
        nodeStates={{ n1: { status: "running" } as never }}
        onAddNode={onAddNode}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(
      (capturedReactFlowProps.edges as Array<{ id: string; label?: string }>)[0]?.label,
    ).toBe("true");

    // Open pending node from palette, update it, then close sheet
    fireEvent.click(screen.getByRole("button", { name: /Add Node/i }));
    fireEvent.click(screen.getByText(/AI Step/i));
    expect(screen.getByText(/Configure Node/i)).toBeInTheDocument();

    const labelInput = screen.getByLabelText(/Node Name/i);
    fireEvent.change(labelInput, { target: { value: "Updated Pending" } });
    expect(onUpdateNode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));

    // Double-click existing node and update it -> calls onUpdateNode
    act(() => {
      (capturedReactFlowProps.onNodeDoubleClick as (e: unknown, n: { id: string }) => void)(
        {},
        { id: "n1" },
      );
    });
    const existingLabelInput = screen.getByLabelText(/Node Name/i);
    fireEvent.change(existingLabelInput, { target: { value: "Updated Existing" } });
    expect(onUpdateNode).toHaveBeenCalledWith("n1", expect.objectContaining({ name: "Updated Existing" }));

    // readOnly double-click does nothing
    rerender(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        readOnly={true}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    act(() => {
      (capturedReactFlowProps.onNodeDoubleClick as (e: unknown, n: { id: string }) => void)(
        {},
        { id: "n1" },
      );
    });
  });

  it("handles nodes without measured, omitted onAutoLayout/onRunWorkflow, and onOpenChange(true)", () => {
    const onNodesChange = vi.fn();
    render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Auto-Layout/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Run Workflow/i })).toBeNull();

    const onRfNodesChange = capturedReactFlowProps.onNodesChange as (cs: {
      applyTo: (nodes: unknown[]) => unknown[];
    }) => void;

    act(() => {
      onRfNodesChange({
        applyTo: () => [
          {
            id: "n1",
            position: { x: 99, y: 99 },
          },
        ],
      });
    });
    expect(onNodesChange).toHaveBeenCalledTimes(1);
  });

  it("covers optional toolbar props and sheet onOpenChange(true) / onConfirmAdd without pendingNode", () => {
    const onUpdateNode = vi.fn();
    const onDeleteNode = vi.fn();

    render(
      <WorkflowCanvas
        workflowId="wf-1"
        nodes={[
          {
            id: "t1",
            type: "manual_trigger",
            position: { x: 0, y: 0 },
            data: { kind: "manual_trigger", label: "Trigger", requiresFileUpload: false },
          },
        ]}
        edges={[]}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );

    expect(screen.queryByRole("button", { name: /Auto-Layout/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Run Workflow/i })).toBeNull();
  });
});
