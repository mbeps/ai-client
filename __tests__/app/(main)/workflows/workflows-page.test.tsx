import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const mockGetWorkflowRun = vi.hoisted(() => vi.fn());
const mockListWorkflows = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/actions/workflow-runs/get-workflow-run", () => ({
  getWorkflowRun: mockGetWorkflowRun,
}));
vi.mock("@/actions/workflows/list-workflows", () => ({
  listWorkflows: mockListWorkflows,
}));
vi.mock("@/components/workflows/editor/workflow-card", () => ({
  WorkflowCard: ({ workflow }: { workflow: { name: string } }) => (
    <div data-testid="workflow-card">{workflow.name}</div>
  ),
}));

import WorkflowsPage from "@/app/(main)/workflows/page";

describe("WorkflowsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to run detail route when ?runId= resolves to a workflow run", async () => {
    mockGetWorkflowRun.mockResolvedValueOnce({
      ok: true,
      value: { id: "run-99", workflowId: "wf-42" },
    });

    await expect(
      WorkflowsPage({ searchParams: Promise.resolve({ runId: "run-99" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/workflows/wf-42/run-99");
    expect(mockRedirect).toHaveBeenCalledWith("/workflows/wf-42/run-99");
  });

  it("renders distinct error state instead of empty state when listWorkflows fails", async () => {
    mockListWorkflows.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL", message: "Database offline" },
    });

    const element = await WorkflowsPage({});
    render(element);

    expect(screen.getByText("Failed to load workflows")).toBeInTheDocument();
    expect(screen.getByText("Database offline")).toBeInTheDocument();
    expect(screen.queryByText("No workflows found")).not.toBeInTheDocument();
  });

  it("renders fallback error message when listWorkflows fails with empty message", async () => {
    mockListWorkflows.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL", message: "" },
    });

    const element = await WorkflowsPage({});
    render(element);

    expect(
      screen.getByText("Unable to fetch workflows right now."),
    ).toBeInTheDocument();
  });

  it("renders workflow cards when listWorkflows succeeds and empty state when empty", async () => {
    mockGetWorkflowRun.mockResolvedValueOnce({ ok: false, error: {} });
    mockListWorkflows.mockResolvedValueOnce({
      ok: true,
      value: [{ id: "wf-1", name: "My WF" }],
    });

    const element = await WorkflowsPage({
      searchParams: Promise.resolve({ runId: "missing" }),
    });
    const { rerender } = render(element);
    expect(screen.getByTestId("workflow-card")).toHaveTextContent("My WF");

    mockListWorkflows.mockResolvedValueOnce({ ok: true, value: [] });
    const emptyEl = await WorkflowsPage({});
    rerender(emptyEl);
    expect(screen.getByText("No workflows found")).toBeInTheDocument();
  });
});
