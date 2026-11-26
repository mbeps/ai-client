import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listKnowledgebases } from "@/actions/knowledgebases/list-knowledgebases";
import { AgentKnowledgebasesTab } from "@/components/agent/agent-knowledgebases-tab";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";

vi.mock("@/actions/knowledgebases/list-knowledgebases", () => ({
  listKnowledgebases: vi.fn(),
}));

const mockKbs: KnowledgebaseWithCount[] = [
  {
    id: "kb-1",
    name: "Docs KB",
    description: "Product documentation",
    userId: "user-1",
    indexStatus: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
    documentCount: 3,
  } as KnowledgebaseWithCount,
  {
    id: "kb-2",
    name: "API KB",
    description: "API specs",
    userId: "user-1",
    indexStatus: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
    documentCount: 2,
  } as KnowledgebaseWithCount,
];

describe("AgentKnowledgebasesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders KnowledgebasePicker with provided knowledgebases", () => {
    const onSave = vi.fn();
    render(
      <AgentKnowledgebasesTab
        knowledgebases={mockKbs}
        selectedKbIds={["kb-1"]}
        onSelectKbIds={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Knowledge Bases")).toBeInTheDocument();
    expect(screen.getByText("Docs KB")).toBeInTheDocument();
    expect(screen.getByText("API KB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New Knowledgebase/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Knowledge Bases/i })).toBeInTheDocument();
  });

  it("fetches knowledgebases when prop is not provided", async () => {
    vi.mocked(listKnowledgebases).mockResolvedValue({
      ok: true,
      value: mockKbs,
    });

    render(
      <AgentKnowledgebasesTab
        selectedKbIds={[]}
        onSelectKbIds={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/Loading knowledge bases/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Docs KB")).toBeInTheDocument();
    });
    expect(listKnowledgebases).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectKbIds when a knowledgebase is toggled", () => {
    const onSelectKbIds = vi.fn();
    render(
      <AgentKnowledgebasesTab
        knowledgebases={mockKbs}
        selectedKbIds={["kb-1"]}
        onSelectKbIds={onSelectKbIds}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("API KB"));
    expect(onSelectKbIds).toHaveBeenCalledWith(["kb-1", "kb-2"]);
  });

  it("falls back to onToggleKb when onSelectKbIds is not provided", () => {
    const onToggleKb = vi.fn();
    render(
      <AgentKnowledgebasesTab
        knowledgebases={mockKbs}
        selectedKbIds={["kb-1"]}
        onToggleKb={onToggleKb}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("API KB"));
    expect(onToggleKb).toHaveBeenCalledWith("kb-2");

    fireEvent.click(screen.getByText("Docs KB"));
    expect(onToggleKb).toHaveBeenCalledWith("kb-1");
  });

  it("hides save button and disables selection when disabled is true", () => {
    const onSelectKbIds = vi.fn();
    render(
      <AgentKnowledgebasesTab
        knowledgebases={mockKbs}
        selectedKbIds={["kb-1"]}
        onSelectKbIds={onSelectKbIds}
        onSave={vi.fn()}
        disabled
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Save Knowledge Bases/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("API KB"));
    expect(onSelectKbIds).not.toHaveBeenCalled();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <AgentKnowledgebasesTab
        knowledgebases={mockKbs}
        selectedKbIds={[]}
        onSelectKbIds={vi.fn()}
        onSave={onSave}
        saveLabel="Create Agent"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Agent/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("handles failed listKnowledgebases, null description, and isSaving state", async () => {
    vi.mocked(listKnowledgebases).mockResolvedValue({
      ok: false,
      error: "Failed",
    });

    render(
      <AgentKnowledgebasesTab
        selectedKbIds={[]}
        onSelectKbIds={vi.fn()}
        onSave={vi.fn()}
        isSaving
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading knowledge bases/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Save Knowledge Bases/i })).toBeDisabled();
  });

  it("skips state updates if unmounted before listKnowledgebases resolves", async () => {
    let resolveFn!: (v: any) => void;
    vi.mocked(listKnowledgebases).mockReturnValue(
      new Promise((res) => {
        resolveFn = res;
      }),
    );

    const { unmount } = render(
      <AgentKnowledgebasesTab
        selectedKbIds={[]}
        onSelectKbIds={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    unmount();
    resolveFn({ ok: true, value: [{ ...mockKbs[0], description: null }] });
  });

  it("renders knowledgebases with null description", () => {
    render(
      <AgentKnowledgebasesTab
        knowledgebases={[{ ...mockKbs[0], description: null }]}
        selectedKbIds={[]}
        onSelectKbIds={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Docs KB")).toBeInTheDocument();
  });
});
