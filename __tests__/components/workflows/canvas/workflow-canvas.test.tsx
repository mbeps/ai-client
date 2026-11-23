import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
