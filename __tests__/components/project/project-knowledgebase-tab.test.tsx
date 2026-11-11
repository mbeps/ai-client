import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectKnowledgebaseTab } from "@/components/project/project-knowledgebase-tab";
import { ROUTES } from "@/config/routes";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

describe("ProjectKnowledgebaseTab", () => {
  const existingKbs: Knowledgebase[] = [
    {
      id: "kb-1",
      userId: "u1",
      name: "Existing KB",
      description: "Existing docs",
      documentCount: 1,
      indexStatus: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("renders New Knowledgebase link pointing to dedicated creation page", () => {
    render(
      <ProjectKnowledgebaseTab
        knowledgebases={existingKbs}
        selectedKbId={null}
        onSelectKbId={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const newKbLink = screen.getByRole("link", { name: /new knowledgebase/i });
    expect(newKbLink).toHaveAttribute("href", ROUTES.KNOWLEDGEBASES.new);
  });
});
