import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KbStatsCards } from "@/components/knowledgebase/kb-stats-cards";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

const mockKb: KnowledgebaseRow = {
  id: "kb-1",
  userId: "user-1",
  name: "Documentation",
  description: "App documentation",
  embeddingModel: "text-embedding-3-small",
  dimensions: 1536,
  indexStatus: "stale",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDocs: KbDocumentRow[] = [];

describe("KbStatsCards", () => {
  it("renders stale index status with re-index button using aria-label and no title", () => {
    render(
      <TooltipProvider>
        <KbStatsCards kb={mockKb} documents={mockDocs} onReindex={vi.fn()} />
      </TooltipProvider>,
    );

    const reindexBtn = screen.getByRole("button", {
      name: "Re-index all documents",
    });
    expect(reindexBtn).toBeInTheDocument();
    expect(reindexBtn.getAttribute("title")).toBeNull();
  });
});

