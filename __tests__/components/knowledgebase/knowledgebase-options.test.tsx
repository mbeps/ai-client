import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteKnowledgebase } from "@/actions/knowledgebases/delete-knowledgebase";
import { updateKnowledgebase } from "@/actions/knowledgebases/update-knowledgebase";
import { KnowledgebaseOptions } from "@/components/knowledgebase/knowledgebase-options";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));
vi.mock("@/actions/knowledgebases/update-knowledgebase", () => ({
  updateKnowledgebase: vi.fn(async () => ({ ok: true, value: {} })),
}));
vi.mock("@/actions/knowledgebases/delete-knowledgebase", () => ({
  deleteKnowledgebase: vi.fn(async () => ({ ok: true, value: undefined })),
}));

const kb: Knowledgebase = {
  id: "kb-1",
  userId: "user-1",
  name: "My KB",
  description: "Desc",
  indexStatus: "ready",
  createdAt: new Date(),
  updatedAt: new Date(),
} as Knowledgebase;

describe("KnowledgebaseOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Rename and Delete options and invokes server actions", async () => {
    const user = userEvent.setup();
    render(<KnowledgebaseOptions kb={kb} onAfterMutation={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Rename"));
    const input = screen.getByDisplayValue("My KB");
    await user.clear(input);
    await user.type(input, "Renamed KB");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(updateKnowledgebase).toHaveBeenCalledWith("kb-1", {
      name: "Renamed KB",
    });

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Delete"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(deleteKnowledgebase).toHaveBeenCalledWith("kb-1");
  });
});
