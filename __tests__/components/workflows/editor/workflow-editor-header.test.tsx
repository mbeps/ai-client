import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowEditorHeader } from "@/components/workflows/editor/workflow-editor-header";

vi.mock("@/components/workflows/editor/workflow-run-dialog", () => ({
  WorkflowRunDialog: () => <div data-testid="workflow-run-dialog" />,
}));

function makeProps(
  overrides: Partial<React.ComponentProps<typeof WorkflowEditorHeader>> = {},
): React.ComponentProps<typeof WorkflowEditorHeader> {
  return {
    isNew: false,
    name: "Daily Digest",
    nodeCount: 2,
    runDialogOpen: false,
    onRunDialogOpenChange: vi.fn(),
    requiresFileUpload: false,
    runFiles: [],
    onRunFilesChange: vi.fn(),
    initialInputJson: "",
    onInitialInputJsonChange: vi.fn(),
    dryRun: false,
    onDryRunChange: vi.fn(),
    onStartRun: vi.fn(),
    isStartingRun: false,
    disabledRun: false,
    onSave: vi.fn(),
    isSaving: false,
    disabledSave: false,
    ...overrides,
  };
}

describe("WorkflowEditorHeader", () => {
  it("invokes onSave with zero arguments so click event is not forwarded", () => {
    const onSave = vi.fn();
    render(<WorkflowEditorHeader {...makeProps({ onSave })} />);

    fireEvent.click(screen.getByRole("button", { name: /save workflow/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith();
  });

  it("renders new workflow title/subtitle and hides run dialog", () => {
    render(<WorkflowEditorHeader {...makeProps({ isNew: true, isSaving: true })} />);

    expect(screen.getByText("New Workflow")).toBeInTheDocument();
    expect(
      screen.getByText("Design a visual multi-node AI automation"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("workflow-run-dialog")).not.toBeInTheDocument();
  });

  it("renders singular node count and fallback untitled name", () => {
    render(
      <WorkflowEditorHeader
        {...makeProps({ name: "", nodeCount: 1, disabledSave: true })}
      />,
    );

    expect(screen.getByText("Untitled Workflow")).toBeInTheDocument();
    expect(screen.getByText("1 node in graph")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save workflow/i }),
    ).toBeDisabled();
  });
});
