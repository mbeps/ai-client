import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowNodePalette } from "@/components/workflows/canvas/workflow-node-palette";
import { useWorkflowEditorStore } from "@/components/workflows/canvas/workflow-editor-store";

describe("WorkflowNodePalette", () => {
  beforeEach(() => {
    useWorkflowEditorStore.setState({ editorInstance: null });
  });

  it("uses fallback position when editorInstance is null and screenToFlowPosition when present", () => {
    const onAddNode = vi.fn();
    render(<WorkflowNodePalette onAddNode={onAddNode} />);

    fireEvent.click(screen.getByRole("button", { name: /Add Node/i }));
    fireEvent.click(screen.getByText("AI Step"));
    expect(onAddNode).toHaveBeenCalledWith("ai_step", { x: 240, y: 180 });

    const screenToFlowPosition = vi.fn(() => ({ x: 500, y: 400 }));
    useWorkflowEditorStore.setState({
      editorInstance: { screenToFlowPosition } as never,
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Node/i }));
    fireEvent.click(screen.getByText("HTTP Request"));
    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 320, y: 220 });
    expect(onAddNode).toHaveBeenCalledWith("http_request", { x: 500, y: 400 });
  });
});
