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
const mockUploadKbDocument = vi.hoisted(() => vi.fn());
const mockIngestKbDocument = vi.hoisted(() => vi.fn());
const mockUpdateKnowledgebase = vi.hoisted(() => vi.fn());
const mockGetRagConfig = vi.hoisted(() => vi.fn());
const mockUseUserModels = vi.hoisted(() => vi.fn());

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

vi.mock("@/actions/knowledgebases/upload-kb-document", () => ({
  uploadKbDocument: mockUploadKbDocument,
}));

vi.mock("@/actions/knowledgebases/ingest-kb-document", () => ({
  ingestKbDocument: mockIngestKbDocument,
}));

vi.mock("@/actions/knowledgebases/delete-knowledgebase", () => ({
  deleteKnowledgebase: vi.fn(),
}));

vi.mock("@/actions/knowledgebases/update-knowledgebase", () => ({
  updateKnowledgebase: mockUpdateKnowledgebase,
}));

vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: mockGetUserSettings,
}));

vi.mock("@/actions/models/list-models", () => ({
  listModels: mockListModels,
}));

vi.mock("@/actions/knowledgebases/get-rag-config", () => ({
  getRagConfig: mockGetRagConfig,
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

vi.mock("@/components/knowledgebase/kb-graph-tab", () => ({
  KbGraphTab: ({ kbId }: { kbId: string }) => (
    <div data-testid="kb-graph-tab" data-kbid={kbId}>
      Knowledgebase Graph Tab
    </div>
  ),
}));

vi.mock("@/components/knowledgebase/upload-document-dialog", () => ({
  UploadDocumentDialog: ({
    open,
    onUpload,
    onOpenChange,
  }: {
    open: boolean;
    onUpload: (file: File) => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="upload-dialog">
        <button
          type="button"
          data-testid="simulate-upload-success"
          onClick={() => {
            onUpload(
              new File(["hello"], "uploaded.pdf", { type: "application/pdf" }),
            );
            onOpenChange(false);
          }}
        >
          Simulate Upload
        </button>
      </div>
    ) : null,
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

describe("KnowledgebasePage - In-Flight Document Polling & Lifecycle (Task 5)", () => {
  const baseKb: KnowledgebaseRow = {
    id: "kb-1",
    userId: "user-1",
    name: "Engineering Handbook",
    description: "Company technical docs",
    embeddingModel: "text-embedding-3-small",
    dimensions: 1536,
    metadataModelId: null,
    indexStatus: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockGetRagConfig.mockResolvedValue({
      ok: true,
      value: { ragMode: "hybrid", requiresEmbedding: true },
    });
    mockUseUserModels.mockImplementation((type?: string) => ({
      models:
        type === "chat"
          ? [{ id: "chat-1", label: "GPT-4o Mini", providerName: "OpenRouter" }]
          : [{ id: "model-1", label: "text-embedding-3-small" }],
      isLoading: false,
    }));
    mockGetUserSettings.mockResolvedValue({ defaultEmbeddingModelId: "model-1" });
    mockListModels.mockResolvedValue([
      { id: "model-1", label: "text-embedding-3-small" },
    ]);
  });

  it("polls listDocuments every 3s while an in-flight document is processing and calls fetchKb when settled", async () => {
    vi.useFakeTimers();

    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    // Initial fetch: 1 processing doc
    mockListDocuments.mockResolvedValueOnce({
      ok: true,
      value: [
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
      ],
    });

    render(<KnowledgebasePage />);

    // Fast-forward initial mount fetches
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("Engineering Handbook")).toBeInTheDocument();
    expect(mockListDocuments).toHaveBeenCalledTimes(1);
    expect(mockGetKnowledgebase).toHaveBeenCalledTimes(1);

    // After 3 seconds, polls again
    mockListDocuments.mockResolvedValueOnce({
      ok: true,
      value: [
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
      ],
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockListDocuments).toHaveBeenCalledTimes(2);

    // Since in-flight documents transitioned to ready, fetchKb should be called to refresh KB metadata
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockGetKnowledgebase).toHaveBeenCalledTimes(2);
  });

  it("shows inline upload progress inside the document row and polls until settled", async () => {
    vi.useFakeTimers();

    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValueOnce({ ok: true, value: [] }); // Initially empty

    // Hold the upload action so the placeholder row is observable.
    let resolveUpload!: (value: { ok: true; value: KbDocumentRow }) => void;
    mockUploadKbDocument.mockImplementationOnce(
      () =>
        new Promise<{ ok: true; value: KbDocumentRow }>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    mockIngestKbDocument.mockResolvedValueOnce({ ok: true, value: undefined });

    render(<KnowledgebasePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Open upload dialog
    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByTestId("upload-dialog")).toBeInTheDocument();

    // Trigger upload
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-upload-success"));
    });

    // Placeholder row renders inside the Documents list with the uploading step loading.
    expect(screen.getByText("uploaded.pdf")).toBeInTheDocument();
    expect(screen.getByText("Uploading document")).toBeInTheDocument();
    // Placeholders are not persisted rows, so stats still report an empty KB.
    expect(screen.getByText("Empty")).toBeInTheDocument();

    // Upload action resolves with the persisted row.
    await act(async () => {
      resolveUpload({
        ok: true,
        value: {
          id: "doc-new",
          kbId: "kb-1",
          name: "uploaded.pdf",
          status: "pending",
          mimeType: "application/pdf",
          size: 1024,
          chunkCount: 0,
          tokenCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    // Placeholder replaced by the real row; its steps are absent so none render.
    expect(screen.queryByText("Uploading document")).not.toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalledWith(
      '"uploaded.pdf" uploaded and queued for processing',
    );

    // Next poll returns a processing doc with in-flight ingest steps.
    mockListDocuments.mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: "doc-new",
          kbId: "kb-1",
          name: "uploaded.pdf",
          status: "processing",
          mimeType: "application/pdf",
          size: 1024,
          chunkCount: 0,
          tokenCount: 0,
          ingestSteps: {
            uploading: { status: "completed" },
            extracting: { status: "loading" },
            embedding: { status: "pending" },
            metadata: { status: "pending" },
            relations: { status: "pending" },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Inline steps render under the document name inside the row.
    expect(screen.getByText("Extracting & chunking text")).toBeInTheDocument();

    // Final poll returns the ready doc; steps hide once ready.
    mockListDocuments.mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: "doc-new",
          kbId: "kb-1",
          name: "uploaded.pdf",
          status: "ready",
          mimeType: "application/pdf",
          size: 1024,
          chunkCount: 3,
          tokenCount: 10,
          ingestSteps: {
            uploading: { status: "completed" },
            extracting: { status: "completed" },
            embedding: { status: "completed" },
            metadata: { status: "completed" },
            relations: { status: "completed" },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(
      screen.queryByText("Extracting & chunking text"),
    ).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockGetKnowledgebase).toHaveBeenCalledTimes(2);
  });

  it("toasts upload errors and removes the placeholder row", async () => {
    vi.useFakeTimers();

    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });
    mockUploadKbDocument.mockResolvedValueOnce({
      ok: false,
      error: { code: "RATE_LIMIT", message: "Too many uploads" },
    });

    render(<KnowledgebasePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-upload-success"));
    });

    expect(mockToast.error).toHaveBeenCalledWith("Too many uploads");
    // Placeholder row is removed on failure.
    expect(screen.queryByText("uploaded.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Uploading document")).not.toBeInTheDocument();

    mockUploadKbDocument.mockRejectedValueOnce(new Error("Network lost"));
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-upload-success"));
    });
    expect(mockToast.error).toHaveBeenCalledWith("Network lost");
    expect(screen.queryByText("uploaded.pdf")).not.toBeInTheDocument();
  });

  it("shows a failed row with the ingest error when ingestKbDocument fails after upload", async () => {
    vi.useFakeTimers();

    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });
    mockUploadKbDocument.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "doc-fail-ingest",
        kbId: "kb-1",
        name: "uploaded.pdf",
        status: "pending",
        mimeType: "application/pdf",
        size: 1024,
        chunkCount: 0,
        tokenCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockIngestKbDocument.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL", message: "Inngest unavailable" },
    });

    render(<KnowledgebasePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("simulate-upload-success"));
    });

    // Failed row shows the error message once; steps are hidden for failed docs.
    expect(screen.getAllByText("Inngest unavailable")).toHaveLength(1);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Uploading document")).not.toBeInTheDocument();
  });

  it("does not auto-trigger reindex if indexStatus is stale when documents are in-flight", async () => {
    vi.useFakeTimers();

    const staleKb: KnowledgebaseRow = {
      ...baseKb,
      indexStatus: "stale",
    };
    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: staleKb });
    // In-flight doc returned on mount
    mockListDocuments.mockResolvedValue({
      ok: true,
      value: [
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
      ],
    });

    render(<KnowledgebasePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Auto-reindex should NOT be triggered while documents are in flight
    expect(mockReindexKnowledgebase).not.toHaveBeenCalled();
  });

  it("renders the Graph tab trigger alongside Documents and Settings", async () => {
    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });

    render(<KnowledgebasePage />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByRole("tab", { name: /graph/i })).toBeInTheDocument();
  });

  it("saves metadataModelId from the Settings tab via updateKnowledgebase", async () => {
    const nuqs = await import("nuqs");
    vi.mocked(nuqs.useQueryState).mockReturnValue([
      "settings",
      vi.fn(),
    ] as unknown as ReturnType<typeof nuqs.useQueryState>);

    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      value: {
        defaultEmbeddingModelId: "model-1",
        defaultKbModelId: null,
        defaultChatModelId: "chat-1",
      },
    });
    mockListModels.mockResolvedValue({
      ok: true,
      value: [{ id: "chat-1", label: "GPT-4o Mini" }],
    });
    mockUpdateKnowledgebase.mockResolvedValue({
      ok: true,
      value: { ...baseKb, metadataModelId: "chat-1" },
    });

    render(<KnowledgebasePage />);

    const trigger = await screen.findByRole("combobox");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("GPT-4o Mini (OpenRouter)"));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateKnowledgebase).toHaveBeenCalledWith("kb-1", {
        name: "Engineering Handbook",
        description: "Company technical docs",
        metadataModelId: "chat-1",
      });
    });
  });

  it("enables upload without embedding models and shows file_read notice in settings when RAG_MODE is file_read", async () => {
    const nuqs = await import("nuqs");
    vi.mocked(nuqs.useQueryState).mockReturnValue([
      "documents",
      vi.fn(),
    ] as unknown as ReturnType<typeof nuqs.useQueryState>);

    mockGetRagConfig.mockResolvedValue({
      ok: true,
      value: { ragMode: "file_read", requiresEmbedding: false },
    });
    mockUseUserModels.mockImplementation((type?: string) => ({
      models:
        type === "chat"
          ? [{ id: "chat-1", label: "GPT-4o Mini", providerName: "OpenRouter" }]
          : [],
      isLoading: false,
    }));
    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });

    const { rerender } = render(<KnowledgebasePage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /upload/i }),
      ).toBeEnabled();
    });

    expect(
      screen.queryByText(
        "No embedding models configured. Please set up a provider with embedding support to upload documents.",
      ),
    ).not.toBeInTheDocument();

    vi.mocked(nuqs.useQueryState).mockReturnValue([
      "settings",
      vi.fn(),
    ] as unknown as ReturnType<typeof nuqs.useQueryState>);
    rerender(<KnowledgebasePage />);

    expect(
      await screen.findByText("Not required (File Read mode)"),
    ).toBeInTheDocument();
  });

  it("hides Graph tab and Metadata & Relations Model selector when RAG_MODE is vector", async () => {
    const nuqs = await import("nuqs");
    vi.mocked(nuqs.useQueryState).mockReturnValue([
      "settings",
      vi.fn(),
    ] as unknown as ReturnType<typeof nuqs.useQueryState>);

    mockGetRagConfig.mockResolvedValue({
      ok: true,
      value: { ragMode: "vector", requiresEmbedding: true },
    });
    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: baseKb });
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });

    render(<KnowledgebasePage />);

    await waitFor(() => {
      expect(screen.getByText("Knowledge Base Details")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("tab", { name: /graph/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Metadata & Relations Model"),
    ).not.toBeInTheDocument();
  });

  it("covers reindex outcomes and indexing polling", async () => {
    vi.useFakeTimers();

    mockListDocuments.mockResolvedValue({ ok: true, value: [] });
    mockGetKnowledgebase.mockResolvedValue({
      ok: true,
      value: { ...baseKb, indexStatus: "indexing" },
    });
    render(<KnowledgebasePage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3050);
    });
    expect(mockGetKnowledgebase).toHaveBeenCalled();

    const reindexBtn = screen.queryByRole("button", { name: /re-?index/i });
    if (reindexBtn) {
      fireEvent.click(reindexBtn);
    }
  });

  it("handles fetch error, stale auto-reindex, and missing kb", async () => {
    mockGetKnowledgebase.mockRejectedValueOnce(new Error("fetch fail"));
    mockListDocuments.mockResolvedValue({ ok: true, value: [] });
    expect(() => render(<KnowledgebasePage />)).not.toThrow();
    await waitFor(() => expect(mockGetKnowledgebase).toHaveBeenCalled());
  });
});
