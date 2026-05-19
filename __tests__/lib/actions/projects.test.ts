// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/lib/env", () => ({
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
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

// ── chainable DB mock ─────────────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "leftJoin",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn();
  c.orderBy = vi.fn();
  c.returning = vi.fn();
  c.transaction = vi.fn();
  for (const m of [
    "select",
    "from",
    "leftJoin",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m].mockReturnValue(c);
  }
  c.where.mockReturnValue(c);
  c.orderBy.mockResolvedValue([]);
  c.returning.mockResolvedValue([]);
  c.transaction.mockImplementation(
    async (fn: (tx: typeof c) => Promise<unknown>) => fn(c),
  );
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/actions/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { requireSession } from "@/lib/actions/require-session";
import { createProject } from "@/lib/actions/projects/create-project";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { deleteProject } from "@/lib/actions/projects/delete-project";
import { renameProject } from "@/lib/actions/projects/rename-project";
import { updateProject } from "@/lib/actions/projects/update-project";
import { getProject } from "@/lib/actions/projects/get-project";
import { togglePinProject } from "@/lib/actions/projects/toggle-pin-project";

const PROJECT_ROW = {
  id: "proj-1",
  name: "Test Project",
  description: null,
  globalPrompt: null,
  isPinned: false,
  userId: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.leftJoin.mockReturnValue(chainable);
  chainable.limit.mockReturnValue(chainable);
  chainable.insert.mockReturnValue(chainable);
  chainable.values.mockReturnValue(chainable);
  chainable.update.mockReturnValue(chainable);
  chainable.set.mockReturnValue(chainable);
  chainable.delete.mockReturnValue(chainable);
  chainable.where.mockImplementation(() => chainable);
  chainable.orderBy.mockResolvedValue([]);
  chainable.returning.mockResolvedValue([]);
  chainable.transaction.mockImplementation(
    async (fn: (tx: typeof chainable) => Promise<unknown>) => fn(chainable),
  );
  vi.mocked(requireSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: {
      id: "session-1",
      token: "tok",
      userId: "user-1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as Awaited<ReturnType<typeof requireSession>>);
});

// ── createProject ─────────────────────────────────────────────────────────────
describe("createProject", () => {
  it("inserts a project and returns the new row", async () => {
    chainable.returning.mockResolvedValueOnce([PROJECT_ROW]);
    const result = await createProject({ name: "Test Project" });
    expect(result).toEqual(PROJECT_ROW);
    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Project", userId: "user-1" }),
    );
  });

  it("stores description and globalPrompt when provided", async () => {
    chainable.returning.mockResolvedValueOnce([
      { ...PROJECT_ROW, description: "Desc", globalPrompt: "System prompt" },
    ]);
    await createProject({
      name: "Test Project",
      description: "Desc",
      globalPrompt: "System prompt",
    });
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Desc",
        globalPrompt: "System prompt",
      }),
    );
  });

  it("sets description and globalPrompt to null when omitted", async () => {
    chainable.returning.mockResolvedValueOnce([PROJECT_ROW]);
    await createProject({ name: "Test Project" });
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ description: null, globalPrompt: null }),
    );
  });

  it("throws ZodError when name is empty", async () => {
    await expect(createProject({ name: "" })).rejects.toThrow();
  });

  it("throws ZodError when name exceeds 100 characters", async () => {
    await expect(createProject({ name: "n".repeat(101) })).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(createProject({ name: "Test" })).rejects.toThrow(
      "Unauthorized",
    );
  });
});

// ── listProjects ──────────────────────────────────────────────────────────────
describe("listProjects", () => {
  it("returns all projects for the user", async () => {
    chainable.orderBy.mockResolvedValueOnce([PROJECT_ROW]);
    const result = await listProjects();
    expect(result).toEqual([PROJECT_ROW]);
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no projects", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);
    expect(await listProjects()).toEqual([]);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(listProjects()).rejects.toThrow("Unauthorized");
  });
});

// ── deleteProject ─────────────────────────────────────────────────────────────
describe("deleteProject", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("runs a transaction to unlink chats and delete project", async () => {
    await expect(deleteProject(VALID_UUID)).resolves.toBeUndefined();
    expect(chainable.transaction).toHaveBeenCalledOnce();
    expect(chainable.update).toHaveBeenCalledOnce(); // unlink chats
    expect(chainable.delete).toHaveBeenCalledOnce(); // delete project
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(deleteProject(VALID_UUID)).rejects.toThrow("Unauthorized");
  });

  it("propagates transaction errors", async () => {
    chainable.transaction.mockRejectedValueOnce(new Error("DB error"));
    await expect(deleteProject(VALID_UUID)).rejects.toThrow("DB error");
  });
});

// ── renameProject ─────────────────────────────────────────────────────────────
describe("renameProject", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates the project name and returns the updated row", async () => {
    const updated = { ...PROJECT_ROW, name: "Renamed Project" };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await renameProject(VALID_UUID, "Renamed Project");
    expect(result).toEqual(updated);
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Renamed Project" }),
    );
  });

  it("throws 'Not Found' when project does not exist or is not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(renameProject(VALID_UUID, "Renamed")).rejects.toThrow(
      "Not Found",
    );
  });

  it("throws ZodError when name is empty", async () => {
    await expect(renameProject(VALID_UUID, "")).rejects.toThrow();
  });

  it("throws ZodError when projectId is not a UUID", async () => {
    await expect(renameProject("bad-id", "New Name")).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(renameProject(VALID_UUID, "New Name")).rejects.toThrow(
      "Unauthorized",
    );
  });
});

// ── updateProject ─────────────────────────────────────────────────────────────
describe("updateProject", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates project fields and returns the updated row", async () => {
    const updated = {
      ...PROJECT_ROW,
      name: "Updated",
      globalPrompt: "New prompt",
    };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updateProject(VALID_UUID, {
      name: "Updated",
      globalPrompt: "New prompt",
    });
    expect(result).toEqual(updated);
    expect(chainable.update).toHaveBeenCalledOnce();
  });

  it("throws 'Not Found' when project is missing or not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(
      updateProject(VALID_UUID, { name: "Updated" }),
    ).rejects.toThrow("Not Found");
  });

  it("throws ZodError when projectId is not a UUID", async () => {
    await expect(
      updateProject("bad-id", { name: "Updated" }),
    ).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(
      updateProject(VALID_UUID, { name: "Updated" }),
    ).rejects.toThrow("Unauthorized");
  });
});

// ── getProject ────────────────────────────────────────────────────────────────
describe("getProject", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("returns the project row when found", async () => {
    chainable.where.mockResolvedValueOnce([PROJECT_ROW]);
    const result = await getProject(VALID_UUID);
    expect(result).toEqual(PROJECT_ROW);
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("throws when project is not found", async () => {
    chainable.where.mockResolvedValueOnce([]);
    await expect(getProject(VALID_UUID)).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(getProject(VALID_UUID)).rejects.toThrow("Unauthorized");
  });
});

// ── togglePinProject ──────────────────────────────────────────────────────────
describe("togglePinProject", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates pin status atomically and returns the updated row", async () => {
    const pinned = { ...PROJECT_ROW, isPinned: true };
    chainable.returning.mockResolvedValueOnce([pinned]);

    const result = await togglePinProject(VALID_UUID);
    expect(result).toEqual(pinned);
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
  });

  it("throws 'Not Found' when project does not exist or is not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]); // no matching row
    await expect(togglePinProject(VALID_UUID)).rejects.toThrow("Not Found");
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(togglePinProject(VALID_UUID)).rejects.toThrow("Unauthorized");
  });
});
