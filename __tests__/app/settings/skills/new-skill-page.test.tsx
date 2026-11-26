import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const {
  mockPush,
  mockSearchParamsGet,
  mockLoadSkills,
  mockCreateSkill,
  mockImportSkillFile,
  mockToast,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockLoadSkills: vi.fn(),
  mockCreateSkill: vi.fn(),
  mockImportSkillFile: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn(() => ["create", vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/actions/skills/create-skill", () => ({
  createSkill: mockCreateSkill,
}));

vi.mock("@/actions/skills/import-skill", () => ({
  importSkillFile: mockImportSkillFile,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({ loadSkills: mockLoadSkills }),
}));

vi.mock("@/components/skill/create-skill-form", () => ({
  CreateSkillForm: ({ onSubmit, onCancel }: any) => (
    <div data-testid="skill-form">
      <button
        type="button"
        onClick={() =>
          onSubmit({
            name: "my-skill",
            displayName: "My Skill",
            description: "Desc",
            content: "Body",
            enabled: true,
            projectIds: [],
            assistantIds: [],
          })
        }
      >
        Submit Manual
      </button>
      <button type="button" onClick={onCancel}>
        Cancel Manual
      </button>
    </div>
  ),
}));

vi.mock("@/components/skill/skill-bundle-uploader", () => ({
  SkillBundleUploader: ({ onUpload, onCancel }: any) => (
    <div data-testid="skill-upload-dropzone">
      <button
        type="button"
        onClick={() =>
          onUpload(new File(["# Skill"], "skill.md", { type: "text/markdown" }))
        }
      >
        Upload File
      </button>
      <button type="button" onClick={onCancel}>
        Cancel Upload
      </button>
    </div>
  ),
}));

import { useQueryState } from "nuqs";
import NewSkillPage from "@/app/settings/skills/new/page";

describe("NewSkillPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryState).mockReturnValue(["create", vi.fn()] as any);
    mockSearchParamsGet.mockReturnValue(null);
    mockLoadSkills.mockResolvedValue(undefined);
  });

  it("creates skill and redirects to skills list, project detail, or agent detail", async () => {
    mockCreateSkill.mockResolvedValue({ ok: true, value: { id: "s1" } });

    const { rerender } = render(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.SKILLS.path);
    });

    mockSearchParamsGet.mockImplementation((k: string) =>
      k === "projectId" ? "proj-1" : null,
    );
    rerender(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(ROUTES.PROJECTS.detail("proj-1"));
    });

    mockSearchParamsGet.mockImplementation((k: string) =>
      k === "agentId" ? "agent-1" : null,
    );
    rerender(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(ROUTES.AGENTS.detail("agent-1"));
    });
  });

  it("handles createSkill !ok and thrown errors", async () => {
    mockCreateSkill.mockResolvedValueOnce({
      ok: false,
      error: { message: "Slug taken" },
    });
    render(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Slug taken");
    });

    mockCreateSkill.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create skill");
    });

    mockCreateSkill.mockRejectedValueOnce(new Error("Create failed"));
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Create failed");
    });

    mockCreateSkill.mockRejectedValueOnce("unexpected");
    fireEvent.click(screen.getByRole("button", { name: "Submit Manual" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create skill");
    });
  });

  it("uploads skill file and handles success, !ok, and thrown errors", async () => {
    vi.mocked(useQueryState).mockReturnValue(["upload", vi.fn()] as any);
    mockImportSkillFile.mockResolvedValueOnce({
      ok: true,
      value: { name: "my-skill", displayName: "My Skill" },
    });

    render(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Upload File" }));
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Skill "My Skill" imported successfully!',
      );
      expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.SKILLS.path);
    });

    mockImportSkillFile.mockResolvedValueOnce({
      ok: true,
      value: { name: "raw-skill", displayName: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload File" }));
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Skill "raw-skill" imported successfully!',
      );
    });

    mockImportSkillFile.mockResolvedValueOnce({
      ok: false,
      error: { message: "Invalid zip" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload File" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid zip");
    });

    mockImportSkillFile.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload File" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to import skill");
    });

    mockImportSkillFile.mockRejectedValueOnce(new Error("Upload error"));
    fireEvent.click(screen.getByRole("button", { name: "Upload File" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Upload error");
    });

    mockImportSkillFile.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Upload File" }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to import skill");
    });
  });

  it("navigates back on cancel", () => {
    render(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Manual" }));
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.SKILLS.path);

    mockPush.mockClear();
    vi.mocked(useQueryState).mockReturnValueOnce(["upload", vi.fn()] as any);
    render(<NewSkillPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Upload" }));
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.SKILLS.path);
  });
});
