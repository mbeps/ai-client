import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgebasesPage from "@/app/(main)/knowledgebases/page";

const mockListKnowledgebases = vi.hoisted(() => vi.fn());
const mockGetRagConfig = vi.hoisted(() => vi.fn());
const mockUseUserModels = vi.hoisted(() => vi.fn());

vi.mock("@/actions/knowledgebases/list-knowledgebases", () => ({
  listKnowledgebases: mockListKnowledgebases,
}));

vi.mock("@/actions/knowledgebases/get-rag-config", () => ({
  getRagConfig: mockGetRagConfig,
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

vi.mock("@/components/knowledgebase/knowledgebase-card", () => ({
  KnowledgebaseCard: ({ knowledgebase }: { knowledgebase: { name: string } }) => (
    <div>{knowledgebase.name}</div>
  ),
}));

describe("KnowledgebasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListKnowledgebases.mockResolvedValue({ ok: true, value: [] });
    mockGetRagConfig.mockResolvedValue({
      ok: true,
      value: { ragMode: "hybrid", requiresEmbedding: true },
    });
    mockUseUserModels.mockReturnValue({
      models: [],
      isLoading: false,
    });
  });

  it("shows no embedding models banner when requiresEmbedding is true and no models exist", async () => {
    render(<KnowledgebasesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No embedding models configured. Please set up a provider with embedding support to create knowledgebases.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("hides no embedding models banner when RAG_MODE is file_read", async () => {
    mockGetRagConfig.mockResolvedValueOnce({
      ok: true,
      value: { ragMode: "file_read", requiresEmbedding: false },
    });

    render(<KnowledgebasesPage />);

    await waitFor(() => {
      expect(mockGetRagConfig).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.queryByText(
        "No embedding models configured. Please set up a provider with embedding support to create knowledgebases.",
      ),
    ).not.toBeInTheDocument();
  });

  it("renders knowledgebases, filters by name/description, and handles list errors", async () => {
    const { fireEvent } = await import("@testing-library/react");
    mockListKnowledgebases.mockResolvedValueOnce({
      ok: true,
      value: [
        { id: "kb1", name: "Docs", description: "API reference", updatedAt: new Date() },
        { id: "kb2", name: "Notes", description: null, updatedAt: new Date() },
      ],
    });

    render(<KnowledgebasesPage />);

    await waitFor(() => {
      expect(screen.getByText("Docs")).toBeInTheDocument();
      expect(screen.getByText("Notes")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search knowledgebases...");
    fireEvent.change(searchInput, { target: { value: "api" } });
    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();

    mockListKnowledgebases.mockResolvedValueOnce({
      ok: false,
      error: new Error("fetch failed"),
    });
    const { unmount } = render(<KnowledgebasesPage />);
    await waitFor(() => {
      expect(mockListKnowledgebases).toHaveBeenCalledTimes(2);
    });
    unmount();

    mockListKnowledgebases.mockRejectedValueOnce(new Error("network"));
    render(<KnowledgebasesPage />);
    await waitFor(() => {
      expect(mockListKnowledgebases).toHaveBeenCalledTimes(3);
    });
  });
});
