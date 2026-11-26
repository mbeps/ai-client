import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowOptions } from "@/components/workflows/editor/workflow-options";
import { WorkflowRunCard } from "@/components/workflows/editor/workflow-run-card";
import { WorkflowRunsTab } from "@/components/workflows/editor/workflow-runs-tab";
import type { WorkflowItem, WorkflowRunItem } from "@/types/workflows/workflow";

const mockRenameWorkflow = vi.hoisted(() => vi.fn());
const mockDeleteWorkflow = vi.hoisted(() => vi.fn());
const mockSetShowRename = vi.hoisted(() => vi.fn());
const mockSetShowDelete = vi.hoisted(() => vi.fn());

vi.mock("@/actions/workflows/rename-workflow", () => ({
  renameWorkflow: mockRenameWorkflow,
}));
vi.mock("@/actions/workflows/delete-workflow", () => ({
  deleteWorkflow: mockDeleteWorkflow,
}));
vi.mock("@/hooks/use-entity-options", () => ({
  useEntityOptions: ({
    onRename,
    onDelete,
  }: {
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
  }) => ({
    isMobile: false,
    showRename: false,
    setShowRename: mockSetShowRename,
    showDelete: false,
    setShowDelete: mockSetShowDelete,
    isDeleting: false,
    handleRename: (name: string) => onRename("wf-1", name),
    handleDelete: () => onDelete("wf-1"),
  }),
}));
vi.mock("@/components/shared/base-entity-options", () => ({
  BaseEntityOptions: ({
    items,
    handleRename,
    handleDelete,
  }: {
    items: Array<{ label: string; onClick: () => void }>;
    handleRename: (name: string) => void;
    handleDelete: () => void;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
      <button type="button" onClick={() => handleRename("New Name")}>
        trigger-rename
      </button>
      <button type="button" onClick={() => handleDelete()}>
        trigger-delete
      </button>
    </div>
  ),
}));

function makeRun(overrides: Partial<WorkflowRunItem> = {}): WorkflowRunItem {
  return {
    id: "run-1",
    workflowId: "wf-1",
    status: "completed",
    triggerType: "manual",
    dryRun: false,
    currentNodeId: null,
    input: {},
    nodeStates: {},
    inputAttachmentIds: [],
    outputAttachmentIds: [],
    errorMessage: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("WorkflowOptions", () => {
  it("renders menu items and wires rename/delete callbacks", () => {
    const workflow = { id: "wf-1", name: "My Workflow" } as WorkflowItem;
    render(<WorkflowOptions workflow={workflow} />);

    fireEvent.click(screen.getByText("Rename Workflow"));
    expect(mockSetShowRename).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("Delete Workflow"));
    expect(mockSetShowDelete).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("trigger-rename"));
    expect(mockRenameWorkflow).toHaveBeenCalledWith("wf-1", { name: "New Name" });

    fireEvent.click(screen.getByText("trigger-delete"));
    expect(mockDeleteWorkflow).toHaveBeenCalledWith("wf-1");
  });
});

describe("WorkflowRunCard", () => {
  it("renders completed, failed, and running statuses and dryRun badge", () => {
    const { rerender } = render(
      <WorkflowRunCard run={makeRun({ status: "completed", dryRun: true })} workflowId="wf-1" />,
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("Dry Run")).toBeInTheDocument();

    rerender(<WorkflowRunCard run={makeRun({ status: "failed" })} workflowId="wf-1" />);
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.queryByText("Dry Run")).not.toBeInTheDocument();

    rerender(<WorkflowRunCard run={makeRun({ status: "awaiting_review" })} workflowId="wf-1" />);
    expect(screen.getByText("awaiting review")).toBeInTheDocument();
  });
});

describe("WorkflowRunsTab", () => {
  it("renders loading, empty, and populated run list states", () => {
    const { rerender } = render(
      <WorkflowRunsTab runs={[]} workflowId="wf-1" isLoading />,
    );
    expect(screen.queryByText("No runs yet.")).not.toBeInTheDocument();

    rerender(<WorkflowRunsTab runs={[]} workflowId="wf-1" />);
    expect(screen.getByText("No runs yet.")).toBeInTheDocument();

    rerender(<WorkflowRunsTab runs={[makeRun()]} workflowId="wf-1" />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});
