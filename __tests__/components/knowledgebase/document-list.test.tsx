import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteDocument = vi.hoisted(() => vi.fn());
vi.mock("@/actions/knowledgebases/delete-document", () => ({
  deleteDocument: mockDeleteDocument,
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

import { DocumentList } from "@/components/knowledgebase/document-list";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

function createMockDoc(overrides: Partial<KbDocumentRow> = {}): KbDocumentRow {
  return {
    id: "doc-1",
    kbId: "kb-1",
    userId: "user-1",
    name: "architecture.pdf",
    mimeType: "application/pdf",
    size: 2048,
    s3Key: "kb/kb-1/doc-1/architecture.pdf",
    status: "ready",
    statusMessage: null,
    chunkCount: 12,
    tokenCount: 4500,
    truncated: false,
    documentType: "general",
    summary: "",
    keyEntities: [],
    tableOfContents: [],
    relationCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("DocumentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state message when documents array is empty", () => {
    render(<DocumentList documents={[]} onDeleted={vi.fn()} />);
    expect(screen.getByText("No documents uploaded yet.")).toBeInTheDocument();
  });

  it("renders ready document with documentType, relationCount, summary, and keyEntities badges", () => {
    const doc = createMockDoc({
      name: "API Spec.pdf",
      status: "ready",
      documentType: "technical_spec",
      relationCount: 2,
      summary: "Detailed specification of the API endpoints and security.",
      keyEntities: [
        "Auth",
        "OAuth",
        "RateLimiter",
        "PostgreSQL",
        "Redis",
        "Cache",
      ],
    });

    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);

    expect(screen.getByText("API Spec.pdf")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();

    // documentType badge (technical_spec -> technical spec)
    expect(screen.getByText("technical spec")).toBeInTheDocument();

    // relationCount badge ("2 links")
    expect(screen.getByText("2 links")).toBeInTheDocument();

    // summary text
    expect(
      screen.getByText(
        "Detailed specification of the API endpoints and security.",
      ),
    ).toBeInTheDocument();

    // first 4 keyEntities badges
    expect(screen.getByText("Auth")).toBeInTheDocument();
    expect(screen.getByText("OAuth")).toBeInTheDocument();
    expect(screen.getByText("RateLimiter")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();

    // overflow badge for remaining 2 entities
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText("Redis")).not.toBeInTheDocument();
  });

  it("renders singular '1 link' for relationCount of 1 and does not show documentType badge when general", () => {
    const doc = createMockDoc({
      name: "Overview.txt",
      status: "ready",
      documentType: "general",
      relationCount: 1,
      summary: "A brief overview document.",
      keyEntities: ["Project", "Overview"],
    });

    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);

    expect(screen.getByText("Overview.txt")).toBeInTheDocument();
    expect(screen.getByText("1 link")).toBeInTheDocument();
    expect(screen.queryByText("general")).not.toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it("does not render relationCount badge when relationCount is 0 or undefined", () => {
    const doc = createMockDoc({
      name: "Notes.md",
      status: "ready",
      documentType: "manual",
      relationCount: 0,
      summary: "",
      keyEntities: [],
    });

    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);

    expect(screen.getByText("Notes.md")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();
    expect(screen.queryByText(/link/i)).not.toBeInTheDocument();
  });

  it("renders pending, processing, and failed status documents without ready-only metadata", () => {
    const pendingDoc = createMockDoc({
      id: "doc-pending",
      name: "pending.pdf",
      status: "pending",
      summary: "Pending summary",
      keyEntities: ["Entity1"],
      documentType: "report",
      relationCount: 3,
    });

    const processingDoc = createMockDoc({
      id: "doc-processing",
      name: "processing.pdf",
      status: "processing",
    });

    const failedDocWithMessage = createMockDoc({
      id: "doc-failed-1",
      name: "failed-msg.pdf",
      status: "failed",
      statusMessage: "Corrupt file format",
    });

    const failedDocWithoutMessage = createMockDoc({
      id: "doc-failed-2",
      name: "failed-no-msg.pdf",
      status: "failed",
      statusMessage: null,
      chunkCount: 0,
      size: 1024,
    });

    render(
      <DocumentList
        documents={[
          pendingDoc,
          processingDoc,
          failedDocWithMessage,
          failedDocWithoutMessage,
        ]}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Corrupt file format")).toBeInTheDocument();
    expect(screen.getAllByText("Failed")).toHaveLength(2);

    // Ready-only metadata should not be rendered for pendingDoc
    expect(screen.queryByText("Pending summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Entity1")).not.toBeInTheDocument();
    expect(screen.queryByText("3 links")).not.toBeInTheDocument();
  });

  it("handles unknown status by falling back to pending config", () => {
    const unknownDoc = createMockDoc({
      id: "doc-unknown",
      name: "unknown.pdf",
      status: "some_weird_status" as unknown as KbDocumentRow["status"],
    });

    render(<DocumentList documents={[unknownDoc]} onDeleted={vi.fn()} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("handles document deletion successfully", async () => {
    const doc = createMockDoc({ id: "doc-to-delete" });
    const onDeleted = vi.fn();
    mockDeleteDocument.mockResolvedValueOnce({ ok: true, value: undefined });

    render(<DocumentList documents={[doc]} onDeleted={onDeleted} />);

    const deleteBtn = screen.getByRole("button");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith({
        documentId: "doc-to-delete",
      });
      expect(mockToast.success).toHaveBeenCalledWith("Document deleted");
      expect(onDeleted).toHaveBeenCalledWith("doc-to-delete");
    });
  });

  it("handles document deletion error with message", async () => {
    const doc = createMockDoc({ id: "doc-err" });
    mockDeleteDocument.mockResolvedValueOnce({
      ok: false,
      error: { message: "Permission denied" },
    });

    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Permission denied");
    });
  });

  it("handles document deletion error with fallback message when message is empty", async () => {
    const doc = createMockDoc({ id: "doc-err-empty" });
    mockDeleteDocument.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });

    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete document");
    });
  });

  it("handles document deletion exception", async () => {
    const doc = createMockDoc({ id: "doc-throw" });
    mockDeleteDocument.mockRejectedValueOnce(new Error("Network crash"));

    render(<DocumentList documents={[doc]} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete document");
    });
  });
});
