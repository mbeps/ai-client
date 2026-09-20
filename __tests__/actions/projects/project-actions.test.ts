// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "update",
    "set",
    "delete",
    "returning",
    "orderBy",
    "transaction",
    "$dynamic",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/actions/projects/create-project";
import { deleteProject } from "@/actions/projects/delete-project";
import { listProjects } from "@/actions/projects/list-projects";
import { renameProject } from "@/actions/projects/rename-project";
import { togglePinProject } from "@/actions/projects/toggle-pin-project";
import { updateProject } from "@/actions/projects/update-project";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const KB_ID = "22222222-2222-4222-8222-222222222222";

const SAMPLE_PROJECT = {
  id: PROJECT_ID,
  userId: "user-1",
  name: "Test Project",
  description: "A test project",
  isPinned: false,
  globalPrompt: "System prompt",
  tools: ["web_search"],
  knowledgebaseId: KB_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Project Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.orderBy.mockReturnValue(chainable);
    chainable.transaction.mockImplementation(async (cb: (tx: any) => any) =>
      cb(chainable),
    );
  });

  describe("createProject", () => {
    it("creates a project with all optional fields provided", async () => {
      chainable.returning.mockResolvedValueOnce([SAMPLE_PROJECT]);

      const result = await createProject({
        name: "Test Project",
        description: "A test project",
        globalPrompt: "System prompt",
        tools: ["web_search"],
        knowledgebaseId: KB_ID,
      });

      expect(result).toEqual(SAMPLE_PROJECT);
      expect(chainable.insert).toHaveBeenCalled();
    });

    it("creates a project with only name and defaults optional fields to null / []", async () => {
      const minimalProject = {
        ...SAMPLE_PROJECT,
        description: null,
        globalPrompt: null,
        tools: [],
        knowledgebaseId: null,
      };
      chainable.returning.mockResolvedValueOnce([minimalProject]);

      const result = await createProject({
        name: "Test Project",
      });

      expect(result).toEqual(minimalProject);
    });
  });

  describe("deleteProject", () => {
    it("deletes project and unbinds from chat table in transaction", async () => {
      chainable.returning.mockResolvedValueOnce([{ id: PROJECT_ID }]);

      const result = await deleteProject(PROJECT_ID);
      expect(result).toEqual({ deletedCount: 1 });
      expect(chainable.update).toHaveBeenCalled();
      expect(chainable.delete).toHaveBeenCalled();
    });
  });

  describe("listProjects", () => {
    it("returns all user projects ordered by isPinned and updatedAt DESC", async () => {
      chainable.orderBy.mockResolvedValueOnce([SAMPLE_PROJECT]);

      const result = await listProjects();
      expect(result).toEqual([SAMPLE_PROJECT]);
    });
  });

  describe("renameProject", () => {
    it("renames project successfully", async () => {
      const renamed = { ...SAMPLE_PROJECT, name: "Renamed Project" };
      chainable.returning.mockResolvedValueOnce([renamed]);

      const result = await renameProject(PROJECT_ID, "Renamed Project");
      expect(result).toEqual(renamed);
    });
  });

  describe("togglePinProject", () => {
    it("toggles pin status and returns updated row", async () => {
      const pinned = { ...SAMPLE_PROJECT, isPinned: true };
      chainable.returning.mockResolvedValueOnce([pinned]);

      const result = await togglePinProject(PROJECT_ID);
      expect(result).toEqual(pinned);
      expect(chainable.update).toHaveBeenCalled();
    });

    it("throws 'Not Found' when project does not exist", async () => {
      chainable.returning.mockResolvedValueOnce([]);

      await expect(togglePinProject(PROJECT_ID)).rejects.toThrow("Not Found");
    });
  });

  describe("updateProject", () => {
    it("updates all fields when provided", async () => {
      const updated = {
        ...SAMPLE_PROJECT,
        name: "Updated Project",
        description: "New Desc",
        globalPrompt: "New Prompt",
        tools: ["calc"],
        knowledgebaseId: null,
      };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateProject(PROJECT_ID, {
        name: "Updated Project",
        description: "New Desc",
        globalPrompt: "New Prompt",
        tools: ["calc"],
        knowledgebaseId: null,
      });

      expect(result).toEqual(updated);
    });

    it("updates even fields (name, globalPrompt, knowledgebaseId)", async () => {
      chainable.returning.mockResolvedValueOnce([SAMPLE_PROJECT]);

      const result = await updateProject(PROJECT_ID, {
        name: "Updated Name",
        globalPrompt: "Prompt Only",
        knowledgebaseId: KB_ID,
      });

      expect(result).toEqual(SAMPLE_PROJECT);
    });

    it("updates odd fields (description, tools)", async () => {
      chainable.returning.mockResolvedValueOnce([SAMPLE_PROJECT]);

      const result = await updateProject(PROJECT_ID, {
        description: "Desc Only",
        tools: [],
      });

      expect(result).toEqual(SAMPLE_PROJECT);
    });

    it("throws 'Not Found' when updated row is not found", async () => {
      chainable.returning.mockResolvedValueOnce([]);

      await expect(
        updateProject(PROJECT_ID, { name: "Non-existent" }),
      ).rejects.toThrow("Not Found");
    });
  });
});
