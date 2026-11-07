import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { createSkill } from "@/actions/skills/create-skill";
import { deleteSkill } from "@/actions/skills/delete-skill";
import { getSkill } from "@/actions/skills/get-skill";
import { listSkills } from "@/actions/skills/list-skills";
import { toggleSkillEnabled } from "@/actions/skills/toggle-skill";
import { updateSkill } from "@/actions/skills/update-skill";
import { requireSession } from "@/lib/auth/require-session";

const SKILL_ROW = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  userId: "user-1",
  name: "clean-code",
  displayName: "Clean Code",
  description: "Pragmatic code quality.",
  content: "# Clean Code\nFollow guidelines.",
  files: [],
  enabled: true,
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

describe("createSkill", () => {
  it("inserts a skill when slug is unique", async () => {
    chainable.limit.mockResolvedValueOnce([]); // no existing
    chainable.returning.mockResolvedValueOnce([SKILL_ROW]);

    const result = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Pragmatic code quality.",
      content: "# Clean Code\nFollow guidelines.",
      files: [],
      enabled: true,
    });

    expect(result).toEqual({ ok: true, value: SKILL_ROW });
    expect(chainable.insert).toHaveBeenCalledOnce();
  });

  it("inserts a scoped skill with projectId when project exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "proj-1" }]);
    chainable.limit.mockResolvedValueOnce([]); // no existing skill name
    const scopedRow = { ...SKILL_ROW, projectId: "proj-1" };
    chainable.returning.mockResolvedValueOnce([scopedRow]);

    const result = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Pragmatic code quality.",
      content: "# Clean Code\nFollow guidelines.",
      projectId: "proj-1",
    });

    expect(result).toEqual({ ok: true, value: scopedRow });
  });

  it("returns NOT_FOUND when projectId does not exist or is not owned", async () => {
    chainable.where.mockResolvedValueOnce([]); // project not found
    const result = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Desc",
      content: "Content",
      projectId: "proj-missing",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "Project not found",
      }),
    });
  });

  it("inserts a scoped skill with assistantId when assistant exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "asst-1" }]);
    chainable.limit.mockResolvedValueOnce([]); // no existing skill name
    const scopedRow = { ...SKILL_ROW, assistantId: "asst-1" };
    chainable.returning.mockResolvedValueOnce([scopedRow]);

    const result = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Pragmatic code quality.",
      content: "# Clean Code\nFollow guidelines.",
      assistantId: "asst-1",
    });

    expect(result).toEqual({ ok: true, value: scopedRow });
  });

  it("returns NOT_FOUND when assistantId does not exist or is not owned", async () => {
    chainable.where.mockResolvedValueOnce([]); // assistant not found
    const result = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Desc",
      content: "Content",
      assistantId: "asst-missing",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "Assistant not found",
      }),
    });
  });

  it("returns INVALID_INPUT when both projectId and assistantId are provided", async () => {
    const result = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Desc",
      content: "Content",
      projectId: "proj-1",
      assistantId: "asst-1",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns CONFLICT error if slug already exists for user", async () => {
    chainable.limit.mockResolvedValueOnce([{ id: "existing-id" }]);

    const res = await createSkill({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Desc",
      content: "Content",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "CONFLICT",
        message: 'A skill with name "clean-code" already exists.',
      }),
    });
  });
});

describe("listSkills", () => {
  it("returns all user skills", async () => {
    chainable.orderBy.mockResolvedValueOnce([SKILL_ROW]);
    const result = await listSkills();
    expect(result).toEqual({ ok: true, value: [SKILL_ROW] });
    expect(chainable.select).toHaveBeenCalledOnce();
  });
});

describe("getSkill", () => {
  it("returns skill by id", async () => {
    chainable.limit.mockResolvedValueOnce([SKILL_ROW]);
    const result = await getSkill(SKILL_ROW.id);
    expect(result).toEqual({ ok: true, value: SKILL_ROW });
  });

  it("returns NOT_FOUND when skill does not exist", async () => {
    chainable.limit.mockResolvedValueOnce([]);
    const res = await getSkill(SKILL_ROW.id);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND", message: "Not Found" }),
    });
  });
});

describe("updateSkill", () => {
  it("updates skill and returns updated row", async () => {
    const updated = { ...SKILL_ROW, displayName: "Updated Clean Code" };
    // First probe resolves the owned row, then the write returns the new one.
    chainable.limit.mockResolvedValueOnce([SKILL_ROW]);
    chainable.returning.mockResolvedValueOnce([updated]);

    const result = await updateSkill(SKILL_ROW.id, {
      displayName: "Updated Clean Code",
    });

    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.update).toHaveBeenCalledOnce();
  });

  it("updates skill with projectId when project exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "proj-1" }]);
    const updated = { ...SKILL_ROW, projectId: "proj-1" };
    chainable.limit.mockResolvedValueOnce([SKILL_ROW]);
    chainable.returning.mockResolvedValueOnce([updated]);

    const result = await updateSkill(SKILL_ROW.id, {
      projectId: "proj-1",
    });

    expect(result).toEqual({ ok: true, value: updated });
  });

  it("returns NOT_FOUND when updating with non-existent projectId", async () => {
    chainable.where.mockResolvedValueOnce([]); // project missing
    const result = await updateSkill(SKILL_ROW.id, {
      projectId: "proj-missing",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "Project not found",
      }),
    });
  });

  it("updates skill with assistantId when assistant exists", async () => {
    chainable.where.mockResolvedValueOnce([{ id: "asst-1" }]);
    const updated = { ...SKILL_ROW, assistantId: "asst-1" };
    chainable.limit.mockResolvedValueOnce([SKILL_ROW]);
    chainable.returning.mockResolvedValueOnce([updated]);

    const result = await updateSkill(SKILL_ROW.id, {
      assistantId: "asst-1",
    });

    expect(result).toEqual({ ok: true, value: updated });
  });

  it("returns NOT_FOUND when updating with non-existent assistantId", async () => {
    chainable.where.mockResolvedValueOnce([]); // assistant missing
    const result = await updateSkill(SKILL_ROW.id, {
      assistantId: "asst-missing",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: "Assistant not found",
      }),
    });
  });
});

describe("toggleSkillEnabled", () => {
  it("toggles enabled status", async () => {
    const toggled = { ...SKILL_ROW, enabled: false };
    chainable.returning.mockResolvedValueOnce([toggled]);

    const result = await toggleSkillEnabled(SKILL_ROW.id, false);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ enabled: false }),
    });
  });
});

describe("deleteSkill", () => {
  it("deletes skill by id", async () => {
    chainable.limit.mockResolvedValueOnce([SKILL_ROW]);
    chainable.returning.mockResolvedValueOnce([{ id: SKILL_ROW.id }]);
    const result = await deleteSkill(SKILL_ROW.id);
    expect(result).toEqual({
      ok: true,
      value: { deletedCount: 1 },
    });
    expect(chainable.delete).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when the skill is not visible to the user", async () => {
    chainable.limit.mockResolvedValueOnce([]);
    const res = await deleteSkill(SKILL_ROW.id);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND", message: "Not Found" }),
    });
  });
});
