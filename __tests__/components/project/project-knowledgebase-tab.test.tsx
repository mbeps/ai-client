import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("handles selectedKbId, onSelectKbId, and isSaving state", async () => {
    const user = userEvent.setup();
    const onSelectKbId = vi.fn();

    render(
      <ProjectKnowledgebaseTab
        knowledgebases={existingKbs}
        selectedKbId="kb-1"
        onSelectKbId={onSelectKbId}
        onSave={vi.fn()}
        isSaving={true}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeDisabled();

    await user.click(screen.getByText("Existing KB"));
    await user.click(screen.getByText("Do not use a knowledge base (None)"));
    expect(onSelectKbId).toHaveBeenCalledWith(null);
  });
});
