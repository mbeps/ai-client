import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";

vi.mock("@/components/knowledgebase/knowledgebase-options", () => ({
  KnowledgebaseOptions: () => <div data-testid="kb-options" />,
}));

const baseKb: KnowledgebaseWithCount = {
  id: "kb-1",
  userId: "user-1",
  name: "Test KB",
  description: "Desc",
  indexStatus: "ready",
  createdAt: new Date(),
  updatedAt: new Date(),
  documentCount: 2,
} as KnowledgebaseWithCount;

describe("KnowledgebaseCard", () => {
  it("renders Stale and Indexing badges based on indexStatus", () => {
    const { rerender } = render(
      <KnowledgebaseCard knowledgebase={{ ...baseKb, indexStatus: "stale" }} />,
    );
    expect(screen.getByText("Stale")).toBeInTheDocument();

    rerender(
      <KnowledgebaseCard knowledgebase={{ ...baseKb, indexStatus: "indexing" }} />,
    );
    expect(screen.getByText("Indexing")).toBeInTheDocument();
  });
});
