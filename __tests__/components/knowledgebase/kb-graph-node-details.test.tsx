import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KbGraphNodeDetails } from "@/components/knowledgebase/kb-graph-node-details";
import type { KbGraphEdge, KbGraphNode } from "@/types/knowledgebase/kb-graph-data";

describe("KbGraphNodeDetails", () => {
  const mockNode: KbGraphNode = {
    id: "doc-1",
    name: "Architecture.md",
    documentType: "technical_spec",
    summary: "System architecture overview with key components.",
    keyEntities: ["System", "Auth", "OAuth"],
    chunkCount: 8,
    tokenCount: 2200,
  };

  const allDocs: KbGraphNode[] = [
    mockNode,
    {
      id: "doc-2",
      name: "Security Guide.pdf",
      documentType: "policy",
      summary: "Security guidelines",
      keyEntities: ["Auth"],
      chunkCount: 4,
      tokenCount: 1100,
    },
    {
      id: "doc-3",
      name: "Changelog.md",
      documentType: "general",
      summary: "Version changes",
      keyEntities: [],
      chunkCount: 2,
      tokenCount: 500,
    },
  ];

  const mockRelations: KbGraphEdge[] = [
    {
      id: "rel-1",
      sourceDocId: "doc-1",
      targetDocId: "doc-2",
      relationType: "references",
      reason: "References security protocols",
    },
    {
      id: "rel-2",
      sourceDocId: "doc-3",
      targetDocId: "doc-1",
      relationType: "supersedes",
      reason: "Supersedes previous architecture revision",
    },
  ];

  it("renders document name, classification badge, metrics, summary, and entities", () => {
    render(
      <KbGraphNodeDetails
        node={mockNode}
        allDocuments={allDocs}
        relations={mockRelations}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Architecture.md")).toBeInTheDocument();
    expect(screen.getByText("technical_spec")).toBeInTheDocument();
    expect(screen.getByText("System architecture overview with key components.")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Auth")).toBeInTheDocument();
    expect(screen.getByText("OAuth")).toBeInTheDocument();
    expect(screen.getByText(/2,200 tokens/)).toBeInTheDocument();
    expect(screen.getByText(/8 chunks/)).toBeInTheDocument();
  });

  it("renders outgoing and incoming relations with connected document names", () => {
    render(
      <KbGraphNodeDetails
        node={mockNode}
        allDocuments={allDocs}
        relations={mockRelations}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Security Guide.pdf")).toBeInTheDocument();
    expect(screen.getByText("References security protocols")).toBeInTheDocument();
    expect(screen.getByText("references")).toBeInTheDocument();

    expect(screen.getByText("Changelog.md")).toBeInTheDocument();
    expect(screen.getByText("Supersedes previous architecture revision")).toBeInTheDocument();
    expect(screen.getByText("supersedes")).toBeInTheDocument();
  });

  it("calls onSelectDocument when clicking on a connected document link", async () => {
    const handleSelect = vi.fn();
    render(
      <KbGraphNodeDetails
        node={mockNode}
        allDocuments={allDocs}
        relations={mockRelations}
        onSelectDocument={handleSelect}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("Security Guide.pdf"));
    expect(handleSelect).toHaveBeenCalledWith("doc-2");
  });

  it("calls onClose when clicking the close button", async () => {
    const handleClose = vi.fn();
    render(
      <KbGraphNodeDetails
        node={mockNode}
        allDocuments={allDocs}
        relations={mockRelations}
        onSelectDocument={vi.fn()}
        onClose={handleClose}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /close inspector/i }));
    expect(handleClose).toHaveBeenCalled();
  });

  it("handles document with no relations gracefully", () => {
    render(
      <KbGraphNodeDetails
        node={mockNode}
        allDocuments={allDocs}
        relations={[]}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("No direct relationships found for this document.")).toBeInTheDocument();
  });

  it("handles document with no summary and no entities gracefully", () => {
    const emptyDoc: KbGraphNode = {
      id: "doc-empty",
      name: "Empty.txt",
      documentType: "general",
      summary: "",
      keyEntities: [],
      chunkCount: 1,
      tokenCount: 50,
    };

    render(
      <KbGraphNodeDetails
        node={emptyDoc}
        allDocuments={[emptyDoc]}
        relations={[]}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Empty.txt")).toBeInTheDocument();
    expect(screen.queryByText("Key Entities")).not.toBeInTheDocument();
  });

  it("renders correct badge variants for contradicts and supplements relations", () => {
    const customRelations: KbGraphEdge[] = [
      {
        id: "rel-c",
        sourceDocId: "doc-1",
        targetDocId: "doc-2",
        relationType: "contradicts",
        reason: "",
      },
      {
        id: "rel-s",
        sourceDocId: "doc-1",
        targetDocId: "doc-3",
        relationType: "supplements",
        reason: "Supplements reason",
      },
      {
        id: "rel-missing-peer",
        sourceDocId: "doc-1",
        targetDocId: "non-existent-peer",
        relationType: "references",
        reason: "Missing peer test",
      },
    ];

    render(
      <KbGraphNodeDetails
        node={mockNode}
        allDocuments={allDocs}
        relations={customRelations}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("contradicts")).toBeInTheDocument();
    expect(screen.getByText("supplements")).toBeInTheDocument();
    expect(screen.getByText("Unknown document")).toBeInTheDocument();
  });
});
