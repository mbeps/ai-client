import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetKnowledgebaseGraph = vi.hoisted(() => vi.fn());
vi.mock("@/actions/knowledgebases/get-knowledgebase-graph", () => ({
  getKnowledgebaseGraph: mockGetKnowledgebaseGraph,
}));

import { KbGraphTab } from "@/components/knowledgebase/kb-graph-tab";
import type { KbGraphData } from "@/types/knowledgebase/kb-graph-data";

describe("KbGraphTab", () => {
  const KB_ID = "kb-test-123";

  const sampleGraph: KbGraphData = {
    documents: [
      {
        id: "doc-1",
        name: "Architecture.md",
        documentType: "technical_spec",
        summary: "Architecture overview",
        keyEntities: ["System", "Auth"],
        chunkCount: 10,
        tokenCount: 2500,
      },
      {
        id: "doc-2",
        name: "Security.pdf",
        documentType: "policy",
        summary: "Security guidelines",
        keyEntities: ["Auth"],
        chunkCount: 5,
        tokenCount: 1200,
      },
    ],
    relations: [
      {
        id: "rel-1",
        sourceDocId: "doc-1",
        targetDocId: "doc-2",
        relationType: "references",
        reason: "Architecture references security policies",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while fetching graph data", async () => {
    mockGetKnowledgebaseGraph.mockReturnValue(new Promise(() => {}));

    render(<KbGraphTab kbId={KB_ID} />);
    expect(screen.getByText("Loading graph...")).toBeInTheDocument();
  });

  it("renders empty state when knowledgebase has no ready documents", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: { documents: [], relations: [] },
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(
      screen.getByText("No ready documents in this knowledge base."),
    ).toBeInTheDocument();
  });

  it("renders error state when fetching graph data fails", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_FOUND", message: "Knowledgebase not found" },
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(
      screen.getByText("Knowledgebase not found"),
    ).toBeInTheDocument();
  });

  it("renders fallback error message when error message is empty or throws", async () => {
    mockGetKnowledgebaseGraph.mockRejectedValueOnce(new Error("Network crash"));

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(
      screen.getByText("Failed to load document graph"),
    ).toBeInTheDocument();
  });

  it("renders graph controls, overview stats, and Mermaid graph when data is loaded", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValueOnce({
      svg: '<svg data-testid="graph-svg"><g class="node" id="flowchart-doc_doc_1-0"><text>Architecture.md</text></g></svg>',
    } as any);

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByPlaceholderText(/search documents or entities/i)).toBeInTheDocument();
    expect(screen.getByText("All Relations")).toBeInTheDocument();
    expect(screen.getByText("LR")).toBeInTheDocument();
    expect(screen.getByTestId("graph-svg")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("documents")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("relationship")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("selects a document and displays its inspector when a node is clicked", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValue({
      svg: '<svg data-testid="graph-svg"><g class="node" id="flowchart-doc_doc_1-0"><text>Architecture.md</text></g></svg>',
    } as any);

    const { container } = render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const nodeElement = container.querySelector(".node");
    expect(nodeElement).not.toBeNull();
    if (nodeElement) {
      fireEvent.click(nodeElement);
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByText("Architecture overview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close inspector/i })).toBeInTheDocument();

    // Close inspector
    await userEvent.click(screen.getByRole("button", { name: /close inspector/i }));
    expect(screen.queryByText("Architecture overview")).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it("allows selecting a document from the quick document list pills", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValue({
      svg: '<svg data-testid="graph-svg"></svg>',
    } as any);

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const docPill = screen.getByRole("button", { name: /Architecture\.md/ });
    await userEvent.click(docPill);

    expect(screen.getByText("Architecture overview")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("supports changing relation filter and toggling orientation", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValue({
      svg: '<svg data-testid="graph-svg"></svg>',
    } as any);

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const orientationBtn = screen.getByRole("button", { name: /layout orientation/i });
    await userEvent.click(orientationBtn);
    expect(screen.getByText("TD")).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByPlaceholderText(/search documents or entities/i);
    await userEvent.type(searchInput, "Auth");

    // Refresh button
    const refreshBtn = screen.getByRole("button", { name: /refresh graph/i });
    await userEvent.click(refreshBtn);
    expect(mockGetKnowledgebaseGraph).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });

  it("handles singular document and multiple relationships in stats footer", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: {
        documents: [sampleGraph.documents[0]],
        relations: [
          sampleGraph.relations[0],
          {
            id: "rel-2",
            sourceDocId: "doc-1",
            targetDocId: "doc-1",
            relationType: "depicts",
            reason: "reason 2",
          },
        ],
      },
    });

    const mermaidModule = await import("mermaid");
    const spy = vi.spyOn(mermaidModule.default, "render").mockResolvedValue({
      svg: '<svg data-testid="graph-svg"></svg>',
    } as any);

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("document")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("relationships")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("handles res.error without message by using fallback string", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: false,
      error: { code: "SERVER_ERROR", message: "" },
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(
      screen.getByText("Failed to load document graph"),
    ).toBeInTheDocument();
  });
});
