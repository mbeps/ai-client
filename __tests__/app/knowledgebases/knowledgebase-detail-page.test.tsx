import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgebasePage from "@/app/(main)/knowledgebases/[id]/page";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

const mockGetKnowledgebase = vi.hoisted(() => vi.fn());
const mockListDocuments = vi.hoisted(() => vi.fn());
const mockReindexKnowledgebase = vi.hoisted(() => vi.fn());
const mockGetUserSettings = vi.hoisted(() => vi.fn());
const mockListModels = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "kb-1" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: vi.fn(),
}));

vi.mock("nuqs", () => ({
  useQueryState: vi.fn(() => ["documents", vi.fn()]),
  parseAsString: {
    withDefault: () => ({
      withOptions: () => ({}),
    }),
  },
}));

vi.mock("@/actions/knowledgebases/get-knowledgebase", () => ({
  getKnowledgebase: mockGetKnowledgebase,
}));

vi.mock("@/actions/knowledgebases/list-documents", () => ({
  listDocuments: mockListDocuments,
}));

vi.mock("@/actions/knowledgebases/reindex-knowledgebase", () => ({
  reindexKnowledgebase: mockReindexKnowledgebase,
}));

vi.mock("@/actions/knowledgebases/delete-knowledgebase", () => ({
  deleteKnowledgebase: vi.fn(),
}));

vi.mock("@/actions/knowledgebases/update-knowledgebase", () => ({
  updateKnowledgebase: vi.fn(),
}));

vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: mockGetUserSettings,
}));

vi.mock("@/actions/models/list-models", () => ({
  listModels: mockListModels,
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [{ id: "model-1", label: "text-embedding-3-small" }],
    isLoading: false,
  }),
}));

vi.mock("@/components/knowledgebase/upload-document-dialog", () => ({
  UploadDocumentDialog: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: (doc: KbDocumentRow) => void;
  }) =>
    open ? (
      <div data-testid="upload-dialog">
        <button
          type="button"
          data-testid="simulate-upload-success"
          onClick={() =>
            onSuccess({
              id: "doc-new",
              kbId: "kb-1",
              name: "uploaded.pdf",
              status: "pending",
              fileType: "application/pdf",
              fileSize: 1024,
              chunkCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as KbDocumentRow)
          }
        >
          Simulate Upload Success
        </button>
      </div>
    ) : null,
}));

describe("KnowledgebasePage - In-Flight Document Polling & Lifecycle (Task 5)", () => {
  const baseKb: KnowledgebaseRow = {
    id: "kb-1",
    userId: "user-1",
    name: "Engineering Handbook",
    description: "Company technical docs",
    embeddingModel: "text-embedding-3-small",
    dimensions: 1536,
    indexStatus: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockGetUserSettings.mockResolvedValue({ defaultEmbeddingModelId: "model-1" });
    mockListModels.mockResolvedValue([
      { id: "model-1", label: "text-embedding-3-small" },
    ]);
  });

  it("polls listDocuments every 3s while an in-flight document is processing and calls fetchKb when settled", async () => {
    vi.useFakeTimers();

    mockGetKnowledgebase.mockResolvedValue(baseKb);
    // Initial fetch: 1 processing doc
    mockListDocuments.mockResolvedValueOnce([
      {
        id: "doc-1",
        kbId: "kb-1",
        name: "architecture.pdf",
        status: "processing",
        fileType: "application/pdf",
        fileSize: 2048,
        chunkCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    render(<KnowledgebasePage />);

    // Fast-forward initial mount fetches
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("Engineering Handbook")).toBeInTheDocument();
    expect(mockListDocuments).toHaveBeenCalledTimes(1);
    expect(mockGetKnowledgebase).toHaveBeenCalledTimes(1);

    // After 3 seconds, polls again
    mockListDocuments.mockResolvedValueOnce([
      {
        id: "doc-1",
        kbId: "kb-1",
        name: "architecture.pdf",
        status: "ready",
        fileType: "application/pdf",
        fileSize: 2048,
        chunkCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockListDocuments).toHaveBeenCalledTimes(2);

    // Since in-flight documents transitioned to ready, fetchKb should be called to refresh KB metadata
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockGetKnowledgebase).toHaveBeenCalledTimes(2);
  });

  it("marks uploaded document as processing and starts polling until settled", async () => {
    vi.useFakeTimers();

    mockGetKnowledgebase.mockResolvedValue(baseKb);
    mockListDocuments.mockResolvedValueOnce([]); // Initially empty

    render(<KnowledgebasePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Open upload dialog
    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByTestId("upload-dialog")).toBeInTheDocument();

    // Trigger upload success: returns doc with status "pending"
    const triggerSuccess = screen.getByTestId("simulate-upload-success");
    fireEvent.click(triggerSuccess);

    // Verify document in UI is marked "processing" (not "pending")
    expect(screen.getByText("Processing")).toBeInTheDocument();

    // Next poll returns ready
    mockListDocuments.mockResolvedValueOnce([
      {
        id: "doc-new",
        kbId: "kb-1",
        name: "uploaded.pdf",
        status: "ready",
        fileType: "application/pdf",
        fileSize: 1024,
        chunkCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockListDocuments).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockGetKnowledgebase).toHaveBeenCalledTimes(2);
  });

  it("does not auto-trigger reindex if indexStatus is stale when documents are in-flight", async () => {
    vi.useFakeTimers();

    const staleKb: KnowledgebaseRow = {
      ...baseKb,
      indexStatus: "stale",
    };
    mockGetKnowledgebase.mockResolvedValue(staleKb);
    // In-flight doc returned on mount
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        kbId: "kb-1",
        name: "draft.pdf",
        status: "processing",
        fileType: "application/pdf",
        fileSize: 1024,
        chunkCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    render(<KnowledgebasePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Auto-reindex should NOT be triggered while documents are in flight
    expect(mockReindexKnowledgebase).not.toHaveBeenCalled();
  });
});
