import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetKnowledgebaseGraph = vi.hoisted(() => vi.fn());
vi.mock("@/actions/knowledgebases/get-knowledgebase-graph", () => ({
  getKnowledgebaseGraph: mockGetKnowledgebaseGraph,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
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

    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it("renders loading state while fetching graph data", async () => {
    mockGetKnowledgebaseGraph.mockReturnValue(new Promise(() => {}));

    render(<KbGraphTab kbId={KB_ID} />);
    expect(screen.getByText("Loading document graph...")).toBeInTheDocument();
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

  it("renders graph controls, canvas, and stats when data is loaded", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(
      screen.getByPlaceholderText(/search documents or entities/i),
    ).toBeInTheDocument();
    expect(screen.getByText("All Relations")).toBeInTheDocument();
    expect(screen.getByTestId("kb-force-graph-canvas")).toBeInTheDocument();
    expect(screen.getByText("Document Types")).toBeInTheDocument();
  });

  it("supports search autocomplete and selects a document from the dropdown", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const searchInput = screen.getByPlaceholderText(
      /search documents or entities/i,
    );
    await userEvent.type(searchInput, "Arch");

    // Click result in dropdown
    const resultItem = screen.getByRole("button", {
      name: /Architecture\.md/i,
    });
    await userEvent.click(resultItem);

    // Inspector should open with document details
    expect(screen.getByText("Architecture overview")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close inspector/i }),
    ).toBeInTheDocument();

    // Close inspector
    await userEvent.click(
      screen.getByRole("button", { name: /close inspector/i }),
    );
    expect(screen.queryByText("Architecture overview")).not.toBeInTheDocument();
  });

  it("toggles document type checkboxes in the legend", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const checkbox = screen.getByRole("checkbox", {
      name: /toggle technical_spec documents/i,
    });
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Toggle back on
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("refreshes graph when clicking the refresh button", async () => {
    mockGetKnowledgebaseGraph.mockResolvedValueOnce({
      ok: true,
      value: sampleGraph,
    });

    render(<KbGraphTab kbId={KB_ID} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const refreshBtn = screen.getByRole("button", { name: /refresh graph/i });
    await userEvent.click(refreshBtn);
    expect(mockGetKnowledgebaseGraph).toHaveBeenCalledTimes(2);
  });
});
