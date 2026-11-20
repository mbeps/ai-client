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
  c.$dynamic = vi.fn();
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

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { createPrompt } from "@/actions/prompts/create-prompt";
import { deletePrompt } from "@/actions/prompts/delete-prompt";
import { listPrompts } from "@/actions/prompts/list-prompts";
import { updatePrompt } from "@/actions/prompts/update-prompt";
import { requireSession } from "@/lib/auth/require-session";

const PROMPT_ROW = {
  id: "prompt-1",
  title: "Code Review",
  shortcut: "cr",
  content: "Please review the following code:",
  projectIds: [] as string[],
  assistantIds: [] as string[],
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
  chainable.$dynamic.mockImplementation(() => chainable);
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

// ── createPrompt ──────────────────────────────────────────────────────────────
describe("createPrompt", () => {
  it("inserts a prompt and returns the new row", async () => {
    chainable.returning.mockResolvedValueOnce([PROMPT_ROW]);
    const result = await createPrompt({
      title: "Code Review",
      shortcut: "cr",
      content: "Please review the following code:",
    });
    expect(result).toEqual({ ok: true, value: PROMPT_ROW });
    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Code Review",
        shortcut: "cr",
        content: "Please review the following code:",
        userId: "user-1",
      }),
    );
  });

  it("returns INVALID_INPUT when title is empty", async () => {
    const res = await createPrompt({
      title: "",
      shortcut: "cr",
      content: "Some content",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when shortcut is empty", async () => {
    const res = await createPrompt({
      title: "Code Review",
      shortcut: "",
      content: "Some content",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when shortcut contains spaces", async () => {
    const res = await createPrompt({
      title: "Code Review",
      shortcut: "my shortcut",
      content: "Some content",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when content is empty", async () => {
    const res = await createPrompt({
      title: "Code Review",
      shortcut: "cr",
      content: "",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when title exceeds 100 characters", async () => {
    const res = await createPrompt({
      title: "t".repeat(101),
      shortcut: "cr",
      content: "Some content",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("inserts a scoped prompt with projectIds when project exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "proj-1" }]);
    const scopedRow = { ...PROMPT_ROW, projectIds: ["proj-1"] };
    chainable.returning.mockResolvedValueOnce([scopedRow]);
    const result = await createPrompt({
      title: "Project Prompt",
      shortcut: "pp",
      content: "Content",
      projectIds: ["proj-1"],
    });
    expect(result).toEqual({ ok: true, value: scopedRow });
    expect(chainable.insert).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when projectIds do not exist or are not owned", async () => {
    chainable.where.mockResolvedValueOnce([]);
    const result = await createPrompt({
      title: "Project Prompt",
      shortcut: "pp",
      content: "Content",
      projectIds: ["proj-1"],
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "One or more projects not found",
      }),
    });
  });

  it("inserts a scoped prompt with assistantIds when assistant exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "asst-1" }]);
    const scopedRow = { ...PROMPT_ROW, assistantIds: ["asst-1"] };
    chainable.returning.mockResolvedValueOnce([scopedRow]);
    const result = await createPrompt({
      title: "Assistant Prompt",
      shortcut: "ap",
      content: "Content",
      assistantIds: ["asst-1"],
    });
    expect(result).toEqual({ ok: true, value: scopedRow });
    expect(chainable.insert).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when assistantIds do not exist or are not owned", async () => {
    chainable.where.mockResolvedValueOnce([]);
    const result = await createPrompt({
      title: "Assistant Prompt",
      shortcut: "ap",
      content: "Content",
      assistantIds: ["asst-1"],
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "One or more agents not found",
      }),
    });
  });

  it("inserts a prompt when both projectIds and assistantIds are provided", async () => {
    chainable.where
      .mockResolvedValueOnce([{ id: "proj-1" }])
      .mockResolvedValueOnce([{ id: "asst-1" }]);
    const dualRow = {
      ...PROMPT_ROW,
      projectIds: ["proj-1"],
      assistantIds: ["asst-1"],
    };
    chainable.returning.mockResolvedValueOnce([dualRow]);
    const res = await createPrompt({
      title: "Dual Prompt",
      shortcut: "dual",
      content: "Content",
      projectIds: ["proj-1"],
      assistantIds: ["asst-1"],
    });
    expect(res).toEqual({
      ok: true,
      value: dualRow,
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await createPrompt({
      title: "Code Review",
      shortcut: "cr",
      content: "Some content",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── listPrompts ───────────────────────────────────────────────────────────────
describe("listPrompts", () => {
  it("returns all prompts for the user", async () => {
    chainable.orderBy.mockResolvedValueOnce([PROMPT_ROW]);
    const result = await listPrompts();
    expect(result).toEqual({ ok: true, value: [PROMPT_ROW] });
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no prompts", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);
    expect(await listPrompts()).toEqual({ ok: true, value: [] });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await listPrompts();
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── deletePrompt ──────────────────────────────────────────────────────────────
describe("deletePrompt", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("deletes the prompt and resolves without error", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: VALID_UUID }]);
    await expect(deletePrompt(VALID_UUID)).resolves.toEqual({
      ok: true,
      value: { deletedCount: 1 },
    });
    expect(chainable.delete).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when prompt does not exist or is not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await deletePrompt(VALID_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await deletePrompt(VALID_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── updatePrompt ──────────────────────────────────────────────────────────────
describe("updatePrompt", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates prompt fields and returns the updated row", async () => {
    const updated = {
      ...PROMPT_ROW,
      title: "Updated Review",
      shortcut: "ur",
      content: "New content",
    };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updatePrompt(VALID_UUID, {
      title: "Updated Review",
      shortcut: "ur",
      content: "New content",
    });
    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated Review",
        shortcut: "ur",
        content: "New content",
      }),
    );
  });

  it("returns NOT_FOUND when prompt is missing or not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await updatePrompt(VALID_UUID, { title: "Updated" });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns INVALID_INPUT when id is not a UUID", async () => {
    const res = await updatePrompt("bad-id", { title: "Updated" });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when shortcut contains invalid characters", async () => {
    const res = await updatePrompt(VALID_UUID, { shortcut: "my shortcut" });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("updates prompt with projectIds when project exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "proj-1" }]);
    const updated = { ...PROMPT_ROW, projectIds: ["proj-1"] };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updatePrompt(VALID_UUID, { projectIds: ["proj-1"] });
    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.update).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when updating with non-existent projectIds", async () => {
    chainable.where.mockResolvedValueOnce([]);
    const res = await updatePrompt(VALID_UUID, { projectIds: ["proj-missing"] });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "One or more projects not found",
      }),
    });
  });

  it("updates prompt with assistantIds when assistant exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "asst-1" }]);
    const updated = { ...PROMPT_ROW, assistantIds: ["asst-1"] };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updatePrompt(VALID_UUID, { assistantIds: ["asst-1"] });
    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.update).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when updating with non-existent assistantIds", async () => {
    chainable.where.mockResolvedValueOnce([]);
    const res = await updatePrompt(VALID_UUID, { assistantIds: ["asst-missing"] });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "One or more agents not found",
      }),
    });
  });

  it("updates prompt with both projectIds and assistantIds together", async () => {
    chainable.where
      .mockResolvedValueOnce([{ id: "proj-1" }])
      .mockResolvedValueOnce([{ id: "asst-1" }]);
    const updated = {
      ...PROMPT_ROW,
      projectIds: ["proj-1"],
      assistantIds: ["asst-1"],
    };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updatePrompt(VALID_UUID, {
      projectIds: ["proj-1"],
      assistantIds: ["asst-1"],
    });
    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.update).toHaveBeenCalledOnce();
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await updatePrompt(VALID_UUID, { title: "Updated" });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});
